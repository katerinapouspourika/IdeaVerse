namespace Pouspourika.IdeaVerse.Api.Activity;

/// <summary>
/// What happened to an idea, as recorded in its history.
/// </summary>
public enum ActivityKind
{
  /// <summary>
  /// The idea was created.
  /// </summary>
  Created,

  /// <summary>
  /// The title changed; the detail is the new title.
  /// </summary>
  Renamed,

  /// <summary>
  /// The description changed.
  /// </summary>
  DescriptionChanged,

  /// <summary>
  /// The target date changed through editing; the detail is the new date.
  /// </summary>
  Rescheduled,

  /// <summary>
  /// The status changed; the detail is the new status.
  /// </summary>
  StatusChanged,

  /// <summary>
  /// The idea was postponed; the detail is the new date.
  /// </summary>
  Postponed,

  /// <summary>
  /// A component was added; the detail is its title.
  /// </summary>
  ComponentAdded,

  /// <summary>
  /// A component was ticked off; the detail is its title.
  /// </summary>
  ComponentCompleted,

  /// <summary>
  /// A component was unticked; the detail is its title.
  /// </summary>
  ComponentReopened,

  /// <summary>
  /// A component was removed; the detail is its title.
  /// </summary>
  ComponentRemoved,

  /// <summary>
  /// Someone was added to the team; the detail is their name or email.
  /// </summary>
  MemberAdded,

  /// <summary>
  /// Someone was taken off the team; the detail is their name or email.
  /// </summary>
  MemberRemoved,

  /// <summary>
  /// The person acting left the team.
  /// </summary>
  MemberLeft,
}
