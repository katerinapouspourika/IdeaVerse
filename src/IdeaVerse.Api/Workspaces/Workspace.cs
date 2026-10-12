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
  /// Maximum length of <see cref="CompanyDomain"/>, the longest a domain name can be.
  /// </summary>
  public const int CompanyDomainMaxLength = 253;

  /// <summary>
  /// Gets the identifier.
  /// </summary>
  public Guid Id { get; init; } = Guid.CreateVersion7();

  /// <summary>
  /// Gets or sets the name.
  /// </summary>
  public required string Name { get; set; }

  /// <summary>
  /// Gets or sets the workspace's colour, one of <see cref="Branding.WorkspaceColors.All"/>, or <see langword="null"/> for the default.
  /// </summary>
  public string? Color { get; set; }

  /// <summary>
  /// Gets or sets when the workspace's logo was last uploaded, or <see langword="null"/> while it has none.
  /// </summary>
  public DateTimeOffset? LogoUpdatedAt { get; set; }

  /// <summary>
  /// Gets or sets the company email domain, such as <c>acme.com</c>, whose people may find the workspace and ask to join,
  /// or <see langword="null"/> when it has none.
  /// </summary>
  public string? CompanyDomain { get; set; }

  /// <summary>
  /// Gets or sets a value indicating whether people with an address at <see cref="CompanyDomain"/> can find the
  /// workspace. Turning it off hides it from them without forgetting the domain.
  /// </summary>
  public bool Discoverable { get; set; }

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
