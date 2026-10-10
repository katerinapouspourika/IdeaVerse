namespace Pouspourika.IdeaVerse.Api.Invitations;

using Pouspourika.IdeaVerse.Api.Workspaces;

/// <summary>
/// A pending invitation, as the invited person sees it.
/// </summary>
/// <param name="Id">The identifier.</param>
/// <param name="WorkspaceId">The workspace the invitation is for.</param>
/// <param name="WorkspaceName">The workspace's name.</param>
/// <param name="Role">The role the person gets on joining.</param>
/// <param name="InvitedByEmail">The email address of who sent the invitation.</param>
/// <param name="ExpiresAt">When the invitation stops working.</param>
public sealed record ReceivedInvitationResponse(Guid Id, Guid WorkspaceId, string WorkspaceName, WorkspaceRole Role, string InvitedByEmail, DateTimeOffset ExpiresAt);
