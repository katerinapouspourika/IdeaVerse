namespace Pouspourika.IdeaVerse.Api.Ideas;

/// <summary>
/// A user's relationship to an idea, which decides what they may do with it.
/// </summary>
public enum IdeaRole
{
  /// <summary>
  /// Created the idea; may also delete it and manage its members.
  /// </summary>
  Owner,

  /// <summary>
  /// Added by the owner; may view and edit the idea and its components, and leave it.
  /// </summary>
  Member,
}
