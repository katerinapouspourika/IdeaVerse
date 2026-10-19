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
      ReminderKind.Mentioned => $"You were mentioned on {content.IdeaTitle}",
      ReminderKind.StartingSoon => $"Starting soon: {content.IdeaTitle}",
      ReminderKind.AddComponents => $"Add components to {content.IdeaTitle}",
      _ => throw new ArgumentOutOfRangeException(nameof(content), content.Kind, "Unknown notification kind."),
    };
  }

  /// <summary>
  /// The web app address a notification opens, as the bell does (<c>notificationLink</c> in the web app): the comment or component it is about
  /// as the page's fragment, or the idea itself.
  /// </summary>
  /// <param name="notification">The notification.</param>
  /// <returns>The path and fragment, starting with <c>/ideas/</c>.</returns>
  private static string PathTo(Notification notification)
    => (notification.CommentId, notification.ComponentId) switch
    {
      ({ } commentId, _) => $"/ideas/{notification.IdeaId}#comment-{commentId}",
      (null, { } componentId) => $"/ideas/{notification.IdeaId}#component-{componentId}",
      _ => $"/ideas/{notification.IdeaId}",
    };

  /// <summary>
  /// Labels the link to a notification in an email that lists several: what it leads to.
  /// </summary>
  /// <param name="notification">The notification.</param>
  /// <returns>The link's label.</returns>
  private static string LinkLabel(Notification notification)
    => notification switch
    {
      { Kind: ReminderKind.AddComponents } => "Add components",
      { CommentId: not null } => "View the comment",
      { ComponentId: not null } => "View the component",
      _ => "Open the idea",
    };

  /// <summary>
  /// Gathers what a notification's message says.
  /// </summary>
  /// <param name="item">The notification and what its email needs.</param>
  /// <returns>The message's content.</returns>
  private static NotificationContent Content(PendingEmail item)
  {
    var notification = item.Notification;
    return new NotificationContent(
      notification.Kind,
      item.IdeaTitle,
      notification.TargetDate,
      item.ComponentTitle,
      item.ActorName,
      notification.Detail,
      StartContent.For(notification.StartsAt, notification.CreatedAt, TimeZones.Find(item.TimeZone), item.StartDate, item.StartHasTime));
  }

  /// <summary>
  /// Returns whether a pending notification may be emailed now: it never failed, or its last failure was before <paramref name="lastFailure"/>.
  /// </summary>
  /// <param name="notification">The notification.</param>
  /// <param name="lastFailure">The latest failure that may already be retried.</param>
  /// <returns><see langword="true"/> when it can be emailed in this run.</returns>
  private static bool Retryable(Notification notification, DateTimeOffset lastFailure)
    => notification.EmailFailedAt is not { } failedAt || failedAt <= lastFailure;

  /// <summary>
  /// Logs a notification email that could not be sent.
  /// </summary>
  /// <param name="logger">Target logger.</param>
  /// <param name="exception">The failure.</param>
  /// <param name="userId">The person whose email failed.</param>
  /// <param name="count">How many notifications the email held.</param>
  [LoggerMessage(Level = LogLevel.Warning, Message = "Could not email {Count} notifications to user {UserId}; they will be retried later")]
  private static partial void LogEmailFailed(ILogger logger, Exception exception, string userId, int count);

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
      + await RaiseComponentRemindersAsync(now, horizon, cancellationToken).ConfigureAwait(false)
      + await RaiseStartRemindersAsync(now, cancellationToken).ConfigureAwait(false);
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
  /// Adds the start reminders now due, and the nudge to add components, for each person on the team of each idea about to start.
  /// </summary>
  /// <remarks>
  /// Each person's reminders follow <see cref="StartSchedule"/>, counted from when the start was set or, for someone added to
  /// the team later, from when they joined. Only the latest reminder due is raised, so a missed run never sends stale ones.
  /// The nudge goes only while the idea still has no components. Ideas already in progress, done, or archived are skipped, as
  /// are people who turned start reminders off.
  /// </remarks>
  /// <param name="now">The current time.</param>
  /// <param name="cancellationToken">Token to cancel the query.</param>
  /// <returns>How many notifications were added.</returns>
  private async Task<int> RaiseStartRemindersAsync(DateTimeOffset now, CancellationToken cancellationToken)
  {
    var horizon = now + StartSchedule.Window + TimeSpan.FromDays(1);
    var ideas = await context.Ideas
      .AsNoTracking()
      .Where(i => i.StartsAt != null && i.StartsAt > now && i.StartsAt <= horizon)
      .Where(i => (i.Status == IdeaStatus.Planned || i.Status == IdeaStatus.Postponed) && i.ArchivedAt == null)
      .AsSplitQuery()
      .Select(i => new
      {
        i.Id,
        i.TargetDate,
        StartsAt = i.StartsAt!.Value,
        StartSetAt = i.StartSetAt ?? i.CreatedAt,
        i.OwnerId,
        Members = i.Members.Select(m => new { m.UserId, m.AddedAt }).ToList(),
        WorkspaceUserIds = i.Workspace!.Members.Select(w => w.UserId).ToList(),
        HasComponents = i.Components.Any(),
        Sent = context.Notifications
          .Where(n => n.IdeaId == i.Id && n.StartsAt == i.StartsAt && (n.Kind == ReminderKind.StartingSoon || n.Kind == ReminderKind.AddComponents))
          .Select(n => new { n.UserId, n.Kind, n.DueAt })
          .ToList(),
      })
      .ToListAsync(cancellationToken)
      .ConfigureAwait(false);

    var recipients = await LoadRecipientsAsync(ideas.SelectMany(i => i.Members.Select(m => m.UserId).Append(i.OwnerId)), cancellationToken).ConfigureAwait(false);
    var created = 0;
    foreach (var idea in ideas)
    {
      var team = idea.Members
        .Select(m => (m.UserId, NoticeFrom: m.AddedAt > idea.StartSetAt ? m.AddedAt : idea.StartSetAt))
        .Prepend((UserId: idea.OwnerId, NoticeFrom: idea.StartSetAt))
        .DistinctBy(p => p.UserId, StringComparer.Ordinal)
        .Where(p => idea.WorkspaceUserIds.Contains(p.UserId, StringComparer.Ordinal));
      foreach (var (userId, noticeFrom) in team)
      {
        var (zone, muted) = recipients.GetValueOrDefault(userId, (TimeZoneInfo.Utc, 0));
        if (!User.Wants(muted, ReminderKind.StartingSoon))
        {
          continue;
        }

        if (StartSchedule.DueReminder(idea.StartsAt, noticeFrom, now) is { } dueAt
          && !idea.Sent.Any(s => s.UserId == userId && s.Kind == ReminderKind.StartingSoon && s.DueAt == dueAt))
        {
          Add(ReminderKind.StartingSoon, dueAt);
        }

        if (!idea.HasComponents
          && StartSchedule.NudgeAt(idea.StartsAt, noticeFrom, zone) is { } nudgeAt
          && nudgeAt <= now
          && !idea.Sent.Any(s => s.UserId == userId && s.Kind == ReminderKind.AddComponents && s.DueAt > noticeFrom))
        {
          Add(ReminderKind.AddComponents, nudgeAt);
        }

        void Add(ReminderKind kind, DateTimeOffset dueAt)
        {
          context.Notifications.Add(new Notification
          {
            UserId = userId,
            IdeaId = idea.Id,
            Kind = kind,
            TargetDate = idea.TargetDate,
            StartsAt = idea.StartsAt,
            DueAt = dueAt,
            CreatedAt = now,
          });
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
  /// Emails notifications that have not been emailed yet and are recent enough to still be useful, one email per person.
  /// </summary>
  /// <remarks>
  /// People who get emails right away get everything pending in one email; people who chose a daily digest get only their
  /// mentions until their digest is due (see <see cref="DigestsDueAsync"/>), then everything. A failed email is logged and tried
  /// again once <see cref="ReminderOptions.EmailRetryInterval"/> has passed; one failure does not stop the rest. Notifications that
  /// no longer concern their recipient (see <see cref="NotificationAccess.StillRelevant"/>), about archived ideas, or for people
  /// who turned reminder emails off, are not emailed; nor are comments, unless the recipient asked for comment emails.
  /// </remarks>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>How many emails were sent.</returns>
  private async Task<int> EmailPendingAsync(CancellationToken cancellationToken)
  {
    var settings = options.Value;
    var now = timeProvider.GetUtcNow();
    var oldest = now - settings.EmailRetryWindow;
    var lastFailure = now - settings.EmailRetryInterval;

    var pending = await context.StillRelevant()
      .Where(n => n.EmailedAt == null && n.CreatedAt >= oldest && n.User!.EmailReminders && n.Idea!.ArchivedAt == null)
      .Where(n => n.Kind != ReminderKind.Commented || n.User!.EmailComments)
      .Select(n => new PendingEmail(
        n,
        n.User!.Email,
        n.User.TimeZone,
        n.User.EmailFrequency,
        n.Idea!.Title,
        n.Component!.Title,
        n.Actor!.DisplayName ?? n.Actor.Email,
        n.Idea.StartDate,
        n.Idea.StartTime != null))
      .ToListAsync(cancellationToken)
      .ConfigureAwait(false);
    var digests = await DigestsDueAsync(cancellationToken).ConfigureAwait(false);

    var sent = 0;
    var byPerson = pending.Where(p => !string.IsNullOrEmpty(p.Email)).OrderBy(p => p.Notification.CreatedAt).ToLookup(p => p.Notification.UserId, StringComparer.Ordinal);
    foreach (var person in byPerson)
    {
      var digest = digests.GetValueOrDefault(person.Key);
      if (digest is not null && person.Any(p => !Retryable(p.Notification, lastFailure)))
      {
        digests.Remove(person.Key);
        continue;
      }

      var due = person
        .Where(p => Retryable(p.Notification, lastFailure))
        .Where(p => digest is not null || p.Frequency == EmailFrequency.RightAway || p.Notification.Kind == ReminderKind.Mentioned)
        .ToList();
      if (due.Count == 0)
      {
        continue;
      }

      var mail = due.Count == 1 ? Single(due[0]) : Grouped(due, digest is not null);
      try
      {
        await mailSender.SendAsync(mail, cancellationToken).ConfigureAwait(false);
        var emailedAt = timeProvider.GetUtcNow();
        due.ForEach(p => p.Notification.EmailedAt = emailedAt);
        await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        sent++;
      }
      catch (Exception ex) when (ex is not OperationCanceledException)
      {
        LogEmailFailed(logger, ex, person.Key, due.Count);
        var failedAt = timeProvider.GetUtcNow();
        due.ForEach(p => p.Notification.EmailFailedAt = failedAt);
        digests.Remove(person.Key);
        await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
      }
    }

    await MarkDigestsSentAsync(digests, cancellationToken).ConfigureAwait(false);
    return sent;
  }

  /// <summary>
  /// Finds the people whose daily digest is due: their local time has reached <see cref="ReminderOptions.SendAt"/> and they have
  /// not had a digest on their local date yet.
  /// </summary>
  /// <remarks>
  /// Loads only people with emails on who chose a digest and whose last digest is before the latest local date any time zone
  /// has reached (the UTC date after today's), then judges each by their own local date and time.
  /// </remarks>
  /// <param name="cancellationToken">Token to cancel the query.</param>
  /// <returns>Each due person, tracked, by identifier, with their local date.</returns>
  private async Task<Dictionary<string, Digest>> DigestsDueAsync(CancellationToken cancellationToken)
  {
    var latest = DateOnly.FromDateTime(timeProvider.GetUtcNow().UtcDateTime).AddDays(1);
    var people = await context.Users
      .Where(u => u.EmailReminders && u.EmailFrequency == EmailFrequency.DailyDigest && (u.LastDigestDate == null || u.LastDigestDate < latest))
      .ToListAsync(cancellationToken)
      .ConfigureAwait(false);
    var due = new Dictionary<string, Digest>(StringComparer.Ordinal);
    foreach (var person in people)
    {
      var localNow = timeProvider.LocalNow(TimeZones.Find(person.TimeZone));
      var today = DateOnly.FromDateTime(localNow);
      if (TimeOnly.FromDateTime(localNow) >= options.Value.SendAt && (person.LastDigestDate is not { } last || last < today))
      {
        due[person.Id] = new Digest(person, today);
      }
    }

    return due;
  }

  /// <summary>
  /// Records that each person's digest went out today, including those who had nothing to receive, so anything raised later today
  /// waits for tomorrow's digest rather than being emailed at once.
  /// </summary>
  /// <param name="digests">The people whose digest went out, with their local date; failed ones are left out so they are retried.</param>
  /// <param name="cancellationToken">Token to cancel the save.</param>
  /// <returns>A task that completes once saved.</returns>
  private async Task MarkDigestsSentAsync(Dictionary<string, Digest> digests, CancellationToken cancellationToken)
  {
    if (digests.Count == 0)
    {
      return;
    }

    foreach (var digest in digests.Values)
    {
      digest.Person.LastDigestDate = digest.Today;
    }

    await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
  }

  /// <summary>
  /// Writes the email for a single notification: its own subject, its message, and a button to where it leads.
  /// </summary>
  /// <param name="item">The notification and what its email needs.</param>
  /// <returns>The email.</returns>
  private MailMessage Single(PendingEmail item)
  {
    var notification = item.Notification;
    var content = Content(item);
    var message = ReminderSchedule.Message(content, timeProvider.TodayIn(TimeZones.Find(item.TimeZone)));
    var reason = notification.Kind == ReminderKind.Mentioned
      ? "You get this because someone mentioned you in IdeaVerse."
      : notification.ComponentId is null
        ? "You get this because you are on this idea's team in IdeaVerse."
        : "You get this because this is assigned to you in IdeaVerse.";
    var action = new EmailAction(notification.Kind == ReminderKind.AddComponents ? "Add components" : "Open the idea", new Uri(app.Value.Link(PathTo(notification))));
    return EmailLayout.Compose(item.Email!, Subject(content), new EmailContent(item.IdeaTitle, [message], action, reason), app.Value);
  }

  /// <summary>
  /// Writes one email for several notifications, a section per idea with each notification's message and link, under a subject
  /// that counts them.
  /// </summary>
  /// <param name="items">The notifications, oldest first, all for one person.</param>
  /// <param name="digest">Whether this is the person's daily digest.</param>
  /// <returns>The email.</returns>
  private MailMessage Grouped(List<PendingEmail> items, bool digest)
  {
    var today = timeProvider.TodayIn(TimeZones.Find(items[0].TimeZone));
    var sections = items
      .GroupBy(p => p.Notification.IdeaId)
      .Select(idea => new EmailSection(
        idea.First().IdeaTitle,
        [.. idea.Select(p => new EmailItem(ReminderSchedule.Message(Content(p), today), new EmailAction(LinkLabel(p.Notification), new Uri(app.Value.Link(PathTo(p.Notification))))))]))
      .ToList();
    var summary = sections.Count == 1
      ? $"{items.Count} updates on “{sections[0].Heading}”"
      : $"{items.Count} updates on {sections.Count} ideas";
    var subject = digest ? $"Your daily digest: {summary}" : summary;
    var (heading, intro) = digest
      ? ("Your daily digest", "Here’s everything since your last digest, by idea.")
      : sections.Count == 1
        ? (sections[0].Heading, "Here’s what’s new on this idea.")
        : ("What’s new on your ideas", "Here’s what’s new, by idea.");
    var action = sections.Count == 1 ? new EmailAction("Open the idea", new Uri(app.Value.Link($"/ideas/{items[0].Notification.IdeaId}"))) : null;
    var footnote = digest
      ? "You get one email a day because you chose a daily digest in IdeaVerse; mentions still arrive right away."
      : "You get this because you are on these ideas' teams, were assigned their work, or were mentioned in IdeaVerse.";
    return EmailLayout.Compose(items[0].Email!, subject, new EmailContent(heading, [intro], action, footnote, sections), app.Value);
  }
}
