namespace Pouspourika.IdeaVerse.Api.Workspaces;

/// <summary>
/// A person's role in a workspace, which decides what they may manage.
/// </summary>
public enum WorkspaceRole
{
  /// <summary>
  /// Created the workspace; can do everything an admin can, and cannot leave or be removed.
  /// </summary>
  Owner,

  /// <summary>
  /// Invites and removes people, changes roles, renames the workspace, and edits or manages any of its ideas.
  /// </summary>
  Admin,

  /// <summary>
  /// Sees every idea in the workspace, creates ideas, and edits those they own or are on the team of.
  /// </summary>
  Member,
}
