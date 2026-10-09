namespace Pouspourika.IdeaVerse.Api.Ideas;

/// <summary>
/// Kinds of <see cref="IdeaChangeResult"/>.
/// </summary>
public enum IdeaChangeOutcome
{
  /// <summary>
  /// The idea was changed.
  /// </summary>
  Changed,

  /// <summary>
  /// The owner has no such idea.
  /// </summary>
  NotFound,

  /// <summary>
  /// A request field is invalid for the idea's current state.
  /// </summary>
  Invalid,

  /// <summary>
  /// The idea's state does not allow the change.
  /// </summary>
  Conflict,
}
