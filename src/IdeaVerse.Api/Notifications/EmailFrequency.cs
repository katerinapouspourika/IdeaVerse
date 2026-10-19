namespace Pouspourika.IdeaVerse.Api.Notifications;

/// <summary>
/// How often a person's notifications are emailed.
/// </summary>
public enum EmailFrequency
{
  /// <summary>
  /// At the reminder job's next run, everything pending for the person in one email.
  /// </summary>
  RightAway,

  /// <summary>
  /// Once a day at <see cref="ReminderOptions.SendAt"/> in the person's time zone; mentions still go right away.
  /// </summary>
  DailyDigest,
}
