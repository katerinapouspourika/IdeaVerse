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
  /// Writes the reminder text shown in the app and used as the email body's first line.
  /// </summary>
  /// <param name="kind">The reminder kind.</param>
  /// <param name="ideaTitle">The idea's title.</param>
  /// <param name="targetDate">The target date the reminder was raised for.</param>
  /// <param name="today">The current date, for the "in N days" wording.</param>
  /// <returns>The message.</returns>
  public static string Message(ReminderKind kind, string ideaTitle, DateOnly targetDate, DateOnly today)
  {
    var date = targetDate.ToString("ddd d MMM yyyy", CultureInfo.InvariantCulture);
    return kind switch
    {
      ReminderKind.ComingUp => $"“{ideaTitle}” is due in {Math.Max(targetDate.DayNumber - today.DayNumber, 2)} days, on {date}.",
      ReminderKind.Tomorrow => $"“{ideaTitle}” is due tomorrow, {date}.",
      ReminderKind.Today => $"“{ideaTitle}” is due today.",
      ReminderKind.Overdue => $"“{ideaTitle}” was due on {date} and isn’t done. Postpone it or mark it done so it doesn’t slip away.",
      _ => throw new ArgumentOutOfRangeException(nameof(kind), kind, "Unknown reminder kind."),
    };
  }
}
