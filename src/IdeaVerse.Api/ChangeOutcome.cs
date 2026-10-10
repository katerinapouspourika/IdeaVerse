namespace Pouspourika.IdeaVerse.Api;

/// <summary>
/// What happened to a request that changes something: an idea, its team or components, a workspace, or an invitation.
/// </summary>
public enum ChangeOutcome
{
  /// <summary>
  /// The change was made.
  /// </summary>
  Changed,

  /// <summary>
  /// The target does not exist, or the user cannot see it.
  /// </summary>
  NotFound,

  /// <summary>
  /// A request field is invalid for the target's current state.
  /// </summary>
  Invalid,

  /// <summary>
  /// The target's state does not allow the change.
  /// </summary>
  Conflict,

  /// <summary>
  /// The user can see the target but their role does not allow the change.
  /// </summary>
  Forbidden,
}
