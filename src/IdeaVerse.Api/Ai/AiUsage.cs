namespace Pouspourika.IdeaVerse.Api.Ai;

using Pouspourika.IdeaVerse.Api.Workspaces;

/// <summary>
/// How many AI requests a workspace made on one UTC day.
/// </summary>
public sealed class AiUsage
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
  /// Gets the UTC day.
  /// </summary>
  public DateOnly Day { get; init; }

  /// <summary>
  /// Gets or sets how many requests were made that day.
  /// </summary>
  public int Count { get; set; }
}
