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
  /// Writes an email subject for a notification.
  /// </summary>
  /// <param name="content">What the notification is about.</param>
  /// <returns>The subject line.</returns>
  private static string Subject(NotificationContent content)
  {
    var about = content.ComponentTitle is { } component ? $"{component} ({content.IdeaTitle})" : content.IdeaTitle;
    return content.Kind switch
    {
      ReminderKind.ComingUp => $"Coming up: {about}",
      ReminderKind.Tomorrow => $"Due tomorrow: {about}",
      ReminderKind.Today => $"Due today: {about}",
      ReminderKind.Overdue => $"Overdue: {about}",
      ReminderKind.Assigned => $"Assigned to you: {about}",
      ReminderKind.AddedToTeam => $"You're on the team: {content.IdeaTitle}",
      ReminderKind.Commented => $"New comment on {content.IdeaTitle}",
      _ => throw new ArgumentOutOfRangeException(nameof(content), content.Kind, "Unknown notification kind."),
    };
  }

  /// <summary>
  /// Logs a reminder email that could not be sent.
  /// </summary>
  /// <param name="logger">Target logger.</param>
  /// <param name="exception">The failure.</param>
  /// <param name="notificationId">The notification whose email failed.</param>
  [LoggerMessage(Level = LogLevel.Warning, Message = "Could not email reminder {NotificationId}; it will be retried on the next run")]
  private static partial void LogEmailFailed(ILogger logger, Exception exception, Guid notificationId);

  /// <summary>
  /// Raises the countdown reminders now due for ideas and for assigned components.
  /// </summary>
  /// <remarks>
  /// Each person's stage follows their own local date, and is raised only once their local time reaches
  /// <see cref="ReminderOptions.SendAt"/>, so reminders arrive in the morning. Stages a person turned off are skipped, and only
  /// people still in the workspace are reminded.
  /// </remarks>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>How many notifications were created.</returns>
  private async Task<int> RaiseDueRemindersAsync(CancellationToken cancellationToken)
  {
    var now = timeProvider.GetUtcNow();
    var horizon = DateOnly.FromDateTime(now.UtcDateTime).AddDays(ReminderSchedule.WindowDays + 1);
    var created = await RaiseIdeaRemindersAsync(now, horizon, cancellationToken).ConfigureAwait(false)
      + await RaiseComponentRemindersAsync(now, horizon, cancellationToken).ConfigureAwait(false);
    await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    return created;
  }

  /// <summary>
  /// Adds a reminder for each person on the team, owner included, of each unfinished idea whose current stage they have not had.
  /// </summary>
  /// <param name="now">The current time.</param>
  /// <param name="horizon">The latest target date any time zone could be counting down to.</param>
  /// <param name="cancellationToken">Token to cancel the query.</param>
  /// <returns>How many notifications were added.</returns>
  private async Task<int> RaiseIdeaRemindersAsync(DateTimeOffset now, DateOnly horizon, CancellationToken cancellationToken)
  {
    var ideas = await context.Ideas
      .AsNoTracking()
      .Where(i => i.Status != IdeaStatus.Done && i.ArchivedAt == null && i.TargetDate <= horizon)
      .AsSplitQuery()
      .Select(i => new
      {
        i.Id,
        i.TargetDate,
        i.OwnerId,
        MemberIds = i.Members.Select(m => m.UserId).ToList(),
        WorkspaceUserIds = i.Workspace!.Members.Select(w => w.UserId).ToList(),
        Sent = context.Notifications
          .Where(n => n.IdeaId == i.Id && n.ComponentId == null && n.TargetDate == i.TargetDate)
          .Select(n => new { n.UserId, n.Kind })
          .ToList(),
      })
      .ToListAsync(cancellationToken)
      .ConfigureAwait(false);

    var recipients = await LoadRecipientsAsync(ideas.SelectMany(i => i.MemberIds.Append(i.OwnerId)), cancellationToken).ConfigureAwait(false);
    var created = 0;
    foreach (var idea in ideas)
    {
      foreach (var userId in idea.MemberIds.Prepend(idea.OwnerId).Intersect(idea.WorkspaceUserIds, StringComparer.Ordinal))
      {
        if (DueStage(recipients, userId, idea.TargetDate) is { } kind && !idea.Sent.Any(s => s.UserId == userId && s.Kind == kind))
        {
          context.Notifications.Add(new Notification { UserId = userId, IdeaId = idea.Id, Kind = kind, TargetDate = idea.TargetDate, CreatedAt = now });
          created++;
        }
      }
    }

    return created;
  }

  /// <summary>
  /// Adds a reminder for the assignee of each unfinished component with a due date whose current stage they have not had.
  /// </summary>
  /// <param name="now">The current time.</param>
  /// <param name="horizon">The latest due date any time zone could be counting down to.</param>
  /// <param name="cancellationToken">Token to cancel the query.</param>
  /// <returns>How many notifications were added.</returns>
  private async Task<int> RaiseComponentRemindersAsync(DateTimeOffset now, DateOnly horizon, CancellationToken cancellationToken)
  {
    var components = await context.Components
      .AsNoTracking()
      .Where(c => !c.IsDone && c.AssigneeId != null && c.DueDate != null && c.DueDate <= horizon && c.Idea!.Status != IdeaStatus.Done && c.Idea.ArchivedAt == null)
      .Where(c => context.WorkspaceMembers.Any(w => w.WorkspaceId == c.Idea!.WorkspaceId && w.UserId == c.AssigneeId))
      .Select(c => new { c.Id, c.IdeaId, AssigneeId = c.AssigneeId!, DueDate = c.DueDate!.Value })
      .ToListAsync(cancellationToken)
      .ConfigureAwait(false);
    var componentIds = components.Select(c => (Guid?)c.Id).ToList();
    var sent = await context.Notifications
      .Where(n => componentIds.Contains(n.ComponentId))
      .Select(n => new { n.ComponentId, n.UserId, n.Kind, n.TargetDate })
      .ToListAsync(cancellationToken)
      .ConfigureAwait(false);

    var recipients = await LoadRecipientsAsync(components.Select(c => c.AssigneeId), cancellationToken).ConfigureAwait(false);
    var created = 0;
    foreach (var component in components)
    {
      if (DueStage(recipients, component.AssigneeId, component.DueDate) is { } kind
        && !sent.Any(s => s.ComponentId == component.Id && s.UserId == component.AssigneeId && s.Kind == kind && s.TargetDate == component.DueDate))
      {
        context.Notifications.Add(new Notification
        {
          UserId = component.AssigneeId,
          IdeaId = component.IdeaId,
          ComponentId = component.Id,
          Kind = kind,
          TargetDate = component.DueDate,
          CreatedAt = now,
        });
        created++;
      }
    }

    return created;
  }

  /// <summary>
  /// Loads the time zone and turned-off stages of each person who might be reminded.
  /// </summary>
  /// <param name="userIds">The people's identifiers, possibly repeated.</param>
  /// <param name="cancellationToken">Token to cancel the query.</param>
  /// <returns>Each person's time zone and turned-off stages.</returns>
  private async Task<Dictionary<string, (TimeZoneInfo Zone, int Muted)>> LoadRecipientsAsync(IEnumerable<string> userIds, CancellationToken cancellationToken)
  {
    var ids = userIds.Distinct(StringComparer.Ordinal).ToList();
    return await context.Users
      .Where(u => ids.Contains(u.Id))
      .Select(u => new { u.Id, u.TimeZone, u.MutedReminderKinds })
      .ToDictionaryAsync(u => u.Id, u => (Zone: TimeZones.Find(u.TimeZone), Muted: u.MutedReminderKinds), StringComparer.Ordinal, cancellationToken)
      .ConfigureAwait(false);
  }

  /// <summary>
  /// Returns the countdown stage a person is due for a date, if any: none before their send time, or for a stage they turned off.
  /// </summary>
  /// <param name="recipients">Each person's time zone and turned-off stages.</param>
  /// <param name="userId">The person.</param>
  /// <param name="date">The date counted down to.</param>
  /// <returns>The stage to raise, or <see langword="null"/>.</returns>
  private ReminderKind? DueStage(Dictionary<string, (TimeZoneInfo Zone, int Muted)> recipients, string userId, DateOnly date)
  {
    var (zone, muted) = recipients.GetValueOrDefault(userId, (TimeZoneInfo.Utc, 0));
    var localNow = timeProvider.LocalNow(zone);
    return TimeOnly.FromDateTime(localNow) >= options.Value.SendAt
      && ReminderSchedule.KindFor(date, DateOnly.FromDateTime(localNow)) is { } kind
      && User.Wants(muted, kind)
      ? kind
      : null;
  }

  /// <summary>
  /// Emails notifications that have not been emailed yet and are recent enough to still be useful.
  /// </summary>
  /// <remarks>
  /// A failed email is logged and left for the next run; one failure does not stop the rest.
  /// Notifications that no longer concern their recipient (see <see cref="NotificationAccess.StillRelevant"/>), or for people
  /// who turned reminder emails off, are not emailed.
  /// </remarks>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>How many emails were sent.</returns>
  private async Task<int> EmailPendingAsync(CancellationToken cancellationToken)
  {
    var settings = options.Value;
    var now = timeProvider.GetUtcNow();
    var oldest = now - settings.EmailRetryWindow;

    var pending = await context.StillRelevant()
      .Where(n => n.EmailedAt == null && n.CreatedAt >= oldest && n.User!.EmailReminders)
      .Select(n => new
      {
        Notification = n,
        n.User!.Email,
        n.User.TimeZone,
        IdeaTitle = n.Idea!.Title,
        ComponentTitle = n.Component!.Title,
        ActorName = n.Actor!.DisplayName,
        ActorEmail = n.Actor.Email,
      })
      .ToListAsync(cancellationToken)
      .ConfigureAwait(false);

    var sent = 0;
    foreach (var item in pending.Where(p => !string.IsNullOrEmpty(p.Email)))
    {
      var notification = item.Notification;
      var content = new NotificationContent(
        notification.Kind,
        item.IdeaTitle,
        notification.TargetDate,
        item.ComponentTitle,
        item.ActorName ?? item.ActorEmail,
        notification.Detail);
      var message = ReminderSchedule.Message(content, timeProvider.TodayIn(TimeZones.Find(item.TimeZone)));
      var link = app.Value.Link($"/ideas/{notification.IdeaId}");
      var reason = notification.ComponentId is null
        ? "You get this because you are on this idea's team in IdeaVerse."
        : "You get this because this is assigned to you in IdeaVerse.";
      var mail = new MailMessage(item.Email!, Subject(content), $"{message}\n\nOpen the idea: {link}\n\n{reason}");

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
