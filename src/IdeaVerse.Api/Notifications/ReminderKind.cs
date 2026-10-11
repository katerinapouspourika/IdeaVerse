namespace Pouspourika.IdeaVerse.Api.Notifications;

/// <summary>
/// What a notification is about: a stage of an idea's or component's countdown, or something a teammate did.
/// </summary>
/// <remarks>
/// The first four are countdown stages (see <see cref="ReminderSchedule.Stages"/>), which people choose in their reminder settings.
/// The rest are always sent.
/// </remarks>
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

  /// <summary>
  /// Someone assigned a component to the person.
  /// </summary>
  Assigned,

  /// <summary>
  /// Someone added the person to an idea's team.
  /// </summary>
  AddedToTeam,

  /// <summary>
  /// Someone commented on an idea the person owns or is on the team of; the notification's detail is the start of the comment.
  /// </summary>
  Commented,
}
