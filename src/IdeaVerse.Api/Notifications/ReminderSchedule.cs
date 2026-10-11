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
  public static IReadOnlyList<ReminderKind> Stages { get; } = [ReminderKind.ComingUp, ReminderKind.Tomorrow, ReminderKind.Today, ReminderKind.Overdue];

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
  {
    ArgumentNullException.ThrowIfNull(content);
    var date = content.TargetDate.ToString("ddd d MMM yyyy", CultureInfo.InvariantCulture);
    var idea = $"“{content.IdeaTitle}”";
    var subject = content.ComponentTitle is { } component ? $"“{component}” for {idea}" : idea;
    var actor = content.Actor ?? "Someone";
    var days = Math.Max(content.TargetDate.DayNumber - today.DayNumber, 2);
    return content.Kind switch
    {
      ReminderKind.ComingUp => $"{subject} is due in {days} days, on {date}.",
      ReminderKind.Tomorrow => $"{subject} is due tomorrow, {date}.",
      ReminderKind.Today => $"{subject} is due today.",
      ReminderKind.Overdue when content.ComponentTitle is not null => $"{subject} was due on {date} and isn’t done.",
      ReminderKind.Overdue => $"{subject} was due on {date} and isn’t done. Postpone it or mark it done so it doesn’t slip away.",
      ReminderKind.Assigned => $"{actor} assigned “{content.ComponentTitle}” for {idea} to you.",
      ReminderKind.AddedToTeam => $"{actor} added you to the team of {idea}.",
      ReminderKind.Commented => $"{actor} commented on {idea}: “{content.Detail}”",
      _ => throw new ArgumentOutOfRangeException(nameof(content), content.Kind, "Unknown notification kind."),
    };
  }
}
