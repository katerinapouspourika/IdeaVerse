namespace Pouspourika.IdeaVerse.Api.Invitations;

using Pouspourika.IdeaVerse.Api.Workspaces;

/// <summary>
/// A pending invitation, as its workspace's owner and admins see it.
/// </summary>
/// <param name="Id">The identifier.</param>
/// <param name="Email">The invited email address.</param>
/// <param name="Role">The role the invited person gets on joining.</param>
/// <param name="InvitedByEmail">The email address of who last sent the invitation.</param>
/// <param name="SentAt">When the invitation was last sent.</param>
/// <param name="ExpiresAt">When the invitation stops working.</param>
public sealed record InvitationResponse(Guid Id, string Email, WorkspaceRole Role, string InvitedByEmail, DateTimeOffset SentAt, DateTimeOffset ExpiresAt);
