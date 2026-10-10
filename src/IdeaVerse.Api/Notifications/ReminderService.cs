namespace Pouspourika.IdeaVerse.Api.Notifications;

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

using Pouspourika.IdeaVerse.Api.Accounts;
using Pouspourika.IdeaVerse.Api.Data;
using Pouspourika.IdeaVerse.Api.Email;
using Pouspourika.IdeaVerse.Api.Ideas;

/// <summary>
/// Raises due reminders for every unfinished idea's team and emails them.
/// </summary>
/// <param name="context">The database context.</param>
/// <param name="mailSender">Sends reminder emails.</param>
/// <param name="options">Reminder settings.</param>
/// <param name="app">Application settings, for links back to the web app.</param>
/// <param name="timeProvider">Clock deciding each person's local date and time.</param>
/// <param name="logger">Logger for delivery problems.</param>
public sealed partial class ReminderService(
  IdeaVerseDbContext context,
  IMailSender mailSender,
  IOptions<ReminderOptions> options,
  IOptions<AppOptions> app,
  TimeProvider timeProvider,
  ILogger<ReminderService> logger)
{
  /// <summary>
  /// Raises the reminders due today, then emails every reminder not yet emailed within the retry window.
  /// </summary>
  /// <remarks>
  /// Safe to run repeatedly: a reminder is raised at most once per idea, recipient, kind, and target date.
  /// </remarks>
  /// <param name="cancellationToken">Token to cancel the run.</param>
  /// <returns>How many reminders were raised and emailed.</returns>
  public async Task<ReminderRunResult> RunAsync(CancellationToken cancellationToken)
  {
    var raised = await RaiseDueRemindersAsync(cancellationToken).ConfigureAwait(false);
    var emailed = await EmailPendingAsync(cancellationToken).ConfigureAwait(false);
    return new ReminderRunResult(raised, emailed);
  }

  /// <summary>
  /// Writes an email subject for a reminder.
  /// </summary>
  /// <param name="kind">The reminder kind.</param>
  /// <param name="ideaTitle">The idea's title.</param>
  /// <returns>The subject line.</returns>
  private static string Subject(ReminderKind kind, string ideaTitle) => kind switch
  {
    ReminderKind.ComingUp => $"Coming up: {ideaTitle}",
    ReminderKind.Tomorrow => $"Due tomorrow: {ideaTitle}",
    ReminderKind.Today => $"Due today: {ideaTitle}",
    ReminderKind.Overdue => $"Overdue: {ideaTitle}",
    _ => throw new ArgumentOutOfRangeException(nameof(kind), kind, "Unknown reminder kind."),
  };

  /// <summary>
  /// Logs a reminder email that could not be sent.
  /// </summary>
  /// <param name="logger">Target logger.</param>
  /// <param name="exception">The failure.</param>
  /// <param name="notificationId">The notification whose email failed.</param>
  [LoggerMessage(Level = LogLevel.Warning, Message = "Could not email reminder {NotificationId}; it will be retried on the next run")]
  private static partial void LogEmailFailed(ILogger logger, Exception exception, Guid notificationId);

  /// <summary>
  /// Creates a notification for each team member, owner included, of each unfinished idea whose reminder stage has no notification yet.
  /// </summary>
  /// <remarks>
  /// Only people still in the idea's workspace are reminded. Each person's stage follows their own local date, and is raised
  /// only once their local time reaches <see cref="ReminderOptions.SendAt"/>, so reminders arrive in the morning. Kinds a person
  /// turned off are skipped.
  /// </remarks>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>How many notifications were created.</returns>
  private async Task<int> RaiseDueRemindersAsync(CancellationToken cancellationToken)
  {
    var now = timeProvider.GetUtcNow();
    var sendAt = options.Value.SendAt;
    var horizon = DateOnly.FromDateTime(now.UtcDateTime).AddDays(ReminderSchedule.WindowDays + 1);

    var ideas = await context.Ideas
      .AsNoTracking()
      .Where(i => i.Status != IdeaStatus.Done && i.TargetDate <= horizon)
      .AsSplitQuery()
      .Select(i => new
      {
        i.Id,
        i.TargetDate,
        i.OwnerId,
        MemberIds = i.Members.Select(m => m.UserId).ToList(),
        WorkspaceUserIds = i.Workspace!.Members.Select(w => w.UserId).ToList(),
        Sent = context.Notifications
          .Where(n => n.IdeaId == i.Id && n.TargetDate == i.TargetDate)
          .Select(n => new { n.UserId, n.Kind })
          .ToList(),
      })
      .ToListAsync(cancellationToken)
      .ConfigureAwait(false);

    var recipientIds = ideas.SelectMany(i => i.MemberIds.Append(i.OwnerId)).Distinct(StringComparer.Ordinal).ToList();
    var recipients = await context.Users
      .Where(u => recipientIds.Contains(u.Id))
      .Select(u => new { u.Id, u.TimeZone, u.MutedReminderKinds })
      .ToDictionaryAsync(u => u.Id, u => (Zone: TimeZones.Find(u.TimeZone), Muted: u.MutedReminderKinds), StringComparer.Ordinal, cancellationToken)
      .ConfigureAwait(false);

    var created = 0;
    foreach (var idea in ideas)
    {
      var team = idea.MemberIds.Prepend(idea.OwnerId).Intersect(idea.WorkspaceUserIds, StringComparer.Ordinal);
      foreach (var userId in team)
      {
        var (zone, muted) = recipients.GetValueOrDefault(userId, (TimeZoneInfo.Utc, 0));
        var localNow = timeProvider.LocalNow(zone);
        if (TimeOnly.FromDateTime(localNow) < sendAt
          || ReminderSchedule.KindFor(idea.TargetDate, DateOnly.FromDateTime(localNow)) is not { } kind
          || !User.Wants(muted, kind)
          || idea.Sent.Any(s => s.UserId == userId && s.Kind == kind))
        {
          continue;
        }

        context.Notifications.Add(new Notification { UserId = userId, IdeaId = idea.Id, Kind = kind, TargetDate = idea.TargetDate, CreatedAt = now });
        created++;
      }
    }

    await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    return created;
  }

  /// <summary>
  /// Emails reminders that have not been emailed yet and are recent enough to still be useful.
  /// </summary>
  /// <remarks>
  /// A failed email is logged and left for the next run; one failure does not stop the rest.
  /// Reminders for people no longer on the idea's team or in its workspace, or who turned reminder emails off, are not emailed.
  /// </remarks>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>How many emails were sent.</returns>
  private async Task<int> EmailPendingAsync(CancellationToken cancellationToken)
  {
    var settings = options.Value;
    var now = timeProvider.GetUtcNow();
    var oldest = now - settings.EmailRetryWindow;

    var pending = await context.Notifications
      .Where(n => n.EmailedAt == null && n.CreatedAt >= oldest && n.User!.EmailReminders)
      .Where(n => context.WorkspaceMembers.Any(w => w.WorkspaceId == n.Idea!.WorkspaceId && w.UserId == n.UserId))
      .Where(n => n.Idea!.OwnerId == n.UserId || n.Idea.Members.Any(m => m.UserId == n.UserId))
      .Select(n => new { Notification = n, n.User!.Email, n.User.TimeZone, IdeaTitle = n.Idea!.Title })
      .ToListAsync(cancellationToken)
      .ConfigureAwait(false);

    var sent = 0;
    foreach (var item in pending.Where(p => !string.IsNullOrEmpty(p.Email)))
    {
      var notification = item.Notification;
      var today = timeProvider.TodayIn(TimeZones.Find(item.TimeZone));
      var message = ReminderSchedule.Message(notification.Kind, item.IdeaTitle, notification.TargetDate, today);
      var link = app.Value.Link($"/ideas/{notification.IdeaId}");
      var mail = new MailMessage(
        item.Email!,
        Subject(notification.Kind, item.IdeaTitle),
        $"{message}\n\nOpen the idea: {link}\n\nYou get this because you are on this idea's team in IdeaVerse.");

      try
      {
        await mailSender.SendAsync(mail, cancellationToken).ConfigureAwait(false);
        notification.EmailedAt = timeProvider.GetUtcNow();
        await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        sent++;
      }
      catch (Exception ex) when (ex is not OperationCanceledException)
      {
        LogEmailFailed(logger, ex, notification.Id);
      }
    }

    return sent;
  }
}
