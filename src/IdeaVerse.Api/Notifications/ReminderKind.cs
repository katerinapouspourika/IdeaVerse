namespace Pouspourika.IdeaVerse.Api.Notifications;

/// <summary>
/// The stage of an idea's countdown a reminder is about.
/// </summary>
public enum ReminderKind
{
  /// <summary>
  /// The target date is two to seven days away.
  /// </summary>
  ComingUp,

  /// <summary>
  /// The target date is tomorrow.
  /// </summary>
  Tomorrow,

  /// <summary>
  /// The target date is today.
  /// </summary>
  Today,

  /// <summary>
  /// The target date has passed and the idea is not done.
  /// </summary>
  Overdue,
}
