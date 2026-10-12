namespace Pouspourika.IdeaVerse.Api.Workspaces;

using Pouspourika.IdeaVerse.Api.Ideas;

/// <summary>
/// A company or team whose people share ideas.
/// </summary>
public sealed class Workspace
{
  /// <summary>
  /// Maximum length of <see cref="Name"/>.
  /// </summary>
  public const int NameMaxLength = 100;

  /// <summary>
  /// Length of <see cref="InviteToken"/>: 128 random bits, Base64Url-encoded.
  /// </summary>
  public const int InviteTokenLength = 22;

  /// <summary>
  /// Gets the identifier.
  /// </summary>
  public Guid Id { get; init; } = Guid.CreateVersion7();

  /// <summary>
  /// Gets or sets the name.
  /// </summary>
  public required string Name { get; set; }

  /// <summary>
  /// Gets or sets the secret in the workspace's invite link, which lets anyone signed in who has it join as a member,
  /// or <see langword="null"/> while the link is turned off.
  /// </summary>
  public string? InviteToken { get; set; }

  /// <summary>
  /// Gets the people in the workspace.
  /// </summary>
  public ICollection<WorkspaceMember> Members { get; init; } = [];

  /// <summary>
  /// Gets the workspace's ideas.
  /// </summary>
  public ICollection<Idea> Ideas { get; init; } = [];

  /// <summary>
  /// Gets when the workspace was created.
  /// </summary>
  public DateTimeOffset CreatedAt { get; init; }
}
