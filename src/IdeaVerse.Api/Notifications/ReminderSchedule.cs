namespace Pouspourika.IdeaVerse.Api.Notifications;

using System.Globalization;

/// <summary>
/// Decides which reminder an idea is due and how it reads.
/// </summary>
public static class ReminderSchedule
{
  /// <summary>
  /// How many days before the target date the first reminder is sent.
  /// </summary>
  public const int WindowDays = 7;

  /// <summary>
  /// Gets the countdown stages, in order, which people choose in their reminder settings.
  /// </summary>
  public static IReadOnlyList<ReminderKind> Stages { get; } =
    [ReminderKind.StartingSoon, ReminderKind.ComingUp, ReminderKind.Tomorrow, ReminderKind.Today, ReminderKind.Overdue];

  /// <summary>
  /// Returns the reminder that applies to an idea due on <paramref name="targetDate"/>, or <see langword="null"/> when none does yet.
  /// </summary>
  /// <remarks>
  /// Each stage covers a range of days rather than one exact day, so a run that was missed, or an idea created
  /// close to its date, still gets the most relevant reminder instead of none.
  /// </remarks>
  /// <param name="targetDate">The idea's target date.</param>
  /// <param name="today">The current date.</param>
  /// <returns>The applicable reminder kind.</returns>
  public static ReminderKind? KindFor(DateOnly targetDate, DateOnly today)
    => (targetDate.DayNumber - today.DayNumber) switch
    {
      < 0 => ReminderKind.Overdue,
      0 => ReminderKind.Today,
      1 => ReminderKind.Tomorrow,
      <= WindowDays => ReminderKind.ComingUp,
      _ => null,
    };

  /// <summary>
  /// Writes an idea countdown's text, shown in the app and used as the email body's first line.
  /// </summary>
  /// <param name="kind">The countdown stage.</param>
  /// <param name="ideaTitle">The idea's title.</param>
  /// <param name="targetDate">The target date the reminder was raised for.</param>
  /// <param name="today">The current date, for the "in N days" wording.</param>
  /// <returns>The message.</returns>
  public static string Message(ReminderKind kind, string ideaTitle, DateOnly targetDate, DateOnly today)
    => Message(new NotificationContent(kind, ideaTitle, targetDate), today);

  /// <summary>
  /// Writes a notification's text, shown in the app and used as the email body's first line.
  /// </summary>
  /// <param name="content">What the notification is about.</param>
  /// <param name="today">The reader's current date, for the "in N days" wording.</param>
  /// <returns>The message.</returns>
  public static string Message(NotificationContent content, DateOnly today)
    => MessageCore(content, today);

  /// <summary>
  /// Writes how soon a start is, such as "in 5 days", "in 2 hours", or "in 15 minutes".
  /// </summary>
  /// <param name="start">The start.</param>
  /// <returns>The phrase.</returns>
  private static string In(StartContent? start)
  {
    var notice = start?.Notice ?? TimeSpan.Zero;
    if (notice >= TimeSpan.FromHours(36))
    {
      return Count((int)Math.Round(notice.TotalDays), "day");
    }

    return notice >= TimeSpan.FromMinutes(90)
      ? Count((int)Math.Round(notice.TotalHours), "hour")
      : Count(Math.Max((int)Math.Round(notice.TotalMinutes), 1), "minute");

    static string Count(int value, string unit)
      => string.Create(CultureInfo.InvariantCulture, $"in {value} {unit}{(value == 1 ? string.Empty : "s")}");
  }

  /// <summary>
  /// Writes when a start is, such as ", on Mon 2 Nov 2026 at 15:30", ", at 15:30" when it is less than a day away, or
  /// ", on Mon 2 Nov 2026" for a start without a time, which is the date as entered whatever the reader's time zone.
  /// </summary>
  /// <param name="start">The start.</param>
  /// <returns>The phrase, starting with a comma.</returns>
  private static string On(StartContent? start)
  {
    if (start is null)
    {
      return string.Empty;
    }

    if (!start.HasTime)
    {
      return $", on {start.Date.ToString("ddd d MMM yyyy", CultureInfo.InvariantCulture)}";
    }

    var time = start.Local.ToString("HH:mm", CultureInfo.InvariantCulture);
    return start.Notice < TimeSpan.FromHours(24)
      ? $", at {time}"
      : $", on {start.Local.ToString("ddd d MMM yyyy", CultureInfo.InvariantCulture)} at {time}";
  }

  /// <summary>
  /// Writes a notification's text.
  /// </summary>
  /// <param name="content">What the notification is about.</param>
  /// <param name="today">The reader's current date.</param>
  /// <returns>The message.</returns>
  private static string MessageCore(NotificationContent content, DateOnly today)
  {
    ArgumentNullException.ThrowIfNull(content);
    var date = content.TargetDate.ToString("ddd d MMM yyyy", CultureInfo.InvariantCulture);
    var idea = $"“{content.IdeaTitle}”";
    var subject = content.ComponentTitle is { } component ? $"“{component}” for {idea}" : idea;
    var actor = content.Actor ?? "Someone";
    var days = Math.Max(content.TargetDate.DayNumber - today.DayNumber, 2);
    var isComponent = content.ComponentTitle is not null;
    return content.Kind switch
    {
      // A component has a due date; an idea has a target date, named as such so the reminder matches the app.
      ReminderKind.ComingUp when isComponent => $"{subject} is due in {days} days, on {date}.",
      ReminderKind.ComingUp => $"The target date for {idea} is in {days} days, on {date}.",
      ReminderKind.Tomorrow when isComponent => $"{subject} is due tomorrow, {date}.",
      ReminderKind.Tomorrow => $"The target date for {idea} is tomorrow, {date}.",
      ReminderKind.Today when isComponent => $"{subject} is due today.",
      ReminderKind.Today => $"The target date for {idea} is today.",
      ReminderKind.Overdue when isComponent => $"{subject} was due on {date} and isn’t done.",
      ReminderKind.Overdue => $"The target date for {idea} was {date} and it isn’t done. Postpone it or mark it done so it doesn’t slip away.",
      ReminderKind.Assigned => $"{actor} assigned “{content.ComponentTitle}” for {idea} to you.",
      ReminderKind.AddedToTeam => $"{actor} added you to the team of {idea}.",
      ReminderKind.Commented => $"{actor} commented on {idea}: “{content.Detail}”",
      ReminderKind.Mentioned => $"{actor} mentioned you on {idea}: “{content.Detail}”",
      ReminderKind.StartingSoon => $"{idea} starts {In(content.Start)}{On(content.Start)}.",
      ReminderKind.AddComponents =>
        $"{idea} starts {In(content.Start)}{On(content.Start)}, and it has no components yet. Add the steps it needs, so the team knows where to begin and it can move along.",
      _ => throw new ArgumentOutOfRangeException(nameof(content), content.Kind, "Unknown notification kind."),
    };
  }
}
