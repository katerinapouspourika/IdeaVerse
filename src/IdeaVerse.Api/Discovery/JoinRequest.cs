namespace Pouspourika.IdeaVerse.Api.Discovery;

using Pouspourika.IdeaVerse.Api.Data;
using Pouspourika.IdeaVerse.Api.Workspaces;

/// <summary>
/// Someone at a workspace's company asking to join it, waiting for its owner or an admin to answer.
/// </summary>
public sealed class JoinRequest
{
  /// <summary>
  /// Gets the identifier.
  /// </summary>
  public Guid Id { get; init; } = Guid.CreateVersion7();

  /// <summary>
  /// Gets the workspace they ask to join.
  /// </summary>
  public Guid WorkspaceId { get; init; }

  /// <summary>
  /// Gets the workspace they ask to join.
  /// </summary>
  public Workspace? Workspace { get; init; }

  /// <summary>
  /// Gets the identifier of the person asking.
  /// </summary>
  public required string UserId { get; init; }

  /// <summary>
  /// Gets the person asking.
  /// </summary>
  public User? User { get; init; }

  /// <summary>
  /// Gets when they asked.
  /// </summary>
  public DateTimeOffset CreatedAt { get; init; }
}
