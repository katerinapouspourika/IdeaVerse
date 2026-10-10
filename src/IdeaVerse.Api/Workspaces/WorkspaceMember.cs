namespace Pouspourika.IdeaVerse.Api.Workspaces;

using Pouspourika.IdeaVerse.Api.Data;

/// <summary>
/// A person in a workspace.
/// </summary>
public sealed class WorkspaceMember
{
  /// <summary>
  /// Gets the identifier of the <see cref="Workspaces.Workspace"/>.
  /// </summary>
  public Guid WorkspaceId { get; init; }

  /// <summary>
  /// Gets the workspace.
  /// </summary>
  public Workspace? Workspace { get; init; }

  /// <summary>
  /// Gets the identifier of the person's <see cref="Data.User"/>.
  /// </summary>
  public required string UserId { get; init; }

  /// <summary>
  /// Gets the person's account.
  /// </summary>
  public User? User { get; init; }

  /// <summary>
  /// Gets or sets the person's role.
  /// </summary>
  public WorkspaceRole Role { get; set; }

  /// <summary>
  /// Gets when the person joined.
  /// </summary>
  public DateTimeOffset JoinedAt { get; init; }
}
