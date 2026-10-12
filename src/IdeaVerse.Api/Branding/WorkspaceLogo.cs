namespace Pouspourika.IdeaVerse.Api.Branding;

using System.Diagnostics.CodeAnalysis;

using Pouspourika.IdeaVerse.Api.Workspaces;

/// <summary>
/// A workspace's logo image, kept apart from the workspace so listing workspaces never loads it.
/// </summary>
public sealed class WorkspaceLogo
{
  /// <summary>
  /// The largest logo accepted, in bytes.
  /// </summary>
  public const int MaxBytes = 512 * 1024;

  /// <summary>
  /// Gets the workspace's identifier.
  /// </summary>
  public Guid WorkspaceId { get; init; }

  /// <summary>
  /// Gets the workspace.
  /// </summary>
  public Workspace? Workspace { get; init; }

  /// <summary>
  /// Gets or sets the image's media type: PNG, JPEG, or WebP.
  /// </summary>
  public required string ContentType { get; set; }

  /// <summary>
  /// Gets or sets the image.
  /// </summary>
  [SuppressMessage("Performance", "CA1819:Properties should not return arrays", Justification = "EF Core maps binary columns to byte arrays.")]
  public required byte[] Data { get; set; }
}
