namespace Pouspourika.IdeaVerse.Api.Invitations;

using System.ComponentModel.DataAnnotations;

using Pouspourika.IdeaVerse.Api.Workspaces;

/// <summary>
/// Request to invite someone to a workspace by email.
/// </summary>
/// <param name="Email">The email address to invite; it need not have an IdeaVerse account yet.</param>
/// <param name="Role">The role they get on joining: <see cref="WorkspaceRole.Admin"/> or <see cref="WorkspaceRole.Member"/>.</param>
public sealed record InviteRequest(
  [property: Required(AllowEmptyStrings = false), EmailAddress, MaxLength(Invitation.EmailMaxLength)] string Email,
  WorkspaceRole Role = WorkspaceRole.Member);
