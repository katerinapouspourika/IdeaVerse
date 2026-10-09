namespace Pouspourika.IdeaVerse.Api.Ideas;

/// <summary>
/// Where an idea is in its lifecycle.
/// </summary>
public enum IdeaStatus
{
  /// <summary>
  /// Scheduled for its target date and not started.
  /// </summary>
  Planned,

  /// <summary>
  /// Being implemented.
  /// </summary>
  InProgress,

  /// <summary>
  /// Moved to a later target date.
  /// </summary>
  Postponed,

  /// <summary>
  /// Implemented.
  /// </summary>
  Done,
}
