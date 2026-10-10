namespace Pouspourika.IdeaVerse.Api.Ideas;

/// <summary>
/// A user's relationship to an idea.
/// </summary>
/// <remarks>
/// What the user may do also depends on their workspace role; <see cref="IdeaResponse.CanEdit"/> and <see cref="IdeaResponse.CanManage"/> combine both.
/// </remarks>
public enum IdeaRole
{
  /// <summary>
  /// Created the idea; may edit and delete it and manage its team.
  /// </summary>
  Owner,

  /// <summary>
  /// On the idea's team; may edit the idea and its components, and leave the team.
  /// </summary>
  Member,

  /// <summary>
  /// In the idea's workspace but not on its team; sees the idea.
  /// </summary>
  Viewer,
}
