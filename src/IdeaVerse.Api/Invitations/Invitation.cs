namespace Pouspourika.IdeaVerse.Api.Invitations;

using Pouspourika.IdeaVerse.Api.Data;
using Pouspourika.IdeaVerse.Api.Workspaces;

/// <summary>
/// A pending invitation for an email address to join a workspace.
/// </summary>
/// <remarks>
/// Whoever signs in with that confirmed email can accept it, whether they had an account when invited or created one afterwards.
/// Accepting, declining, or revoking deletes the invitation.
/// </remarks>
public sealed class Invitation
{
  /// <summary>
  /// Maximum length of <see cref="Email"/>, matching Identity's.
  /// </summary>
  public const int EmailMaxLength = 256;

  /// <summary>
  /// How long an invitation stays open.
  /// </summary>
  public static readonly TimeSpan Lifetime = TimeSpan.FromDays(7);

  /// <summary>
  /// Gets the identifier.
  /// </summary>
  public Guid Id { get; init; } = Guid.CreateVersion7();

  /// <summary>
  /// Gets the identifier of the <see cref="Workspaces.Workspace"/> the invitation is for.
  /// </summary>
  public Guid WorkspaceId { get; init; }

  /// <summary>
  /// Gets the workspace.
  /// </summary>
  public Workspace? Workspace { get; init; }

  /// <summary>
  /// Gets the invited email address, as entered.
  /// </summary>
  public required string Email { get; init; }

  /// <summary>
  /// Gets <see cref="Email"/> normalized the way Identity normalizes account emails, for matching accounts.
  /// </summary>
  public required string NormalizedEmail { get; init; }

  /// <summary>
  /// Gets or sets the role the invited person gets on joining.
  /// </summary>
  public WorkspaceRole Role { get; set; }

  /// <summary>
  /// Gets or sets the identifier of the <see cref="User"/> who last sent the invitation.
  /// </summary>
  public required string InvitedById { get; set; }

  /// <summary>
  /// Gets the person who last sent the invitation.
  /// </summary>
  public User? InvitedBy { get; init; }

  /// <summary>
  /// Gets or sets when the invitation was last sent.
  /// </summary>
  public DateTimeOffset SentAt { get; set; }

  /// <summary>
  /// Gets or sets when the invitation stops working.
  /// </summary>
  public DateTimeOffset ExpiresAt { get; set; }
}
