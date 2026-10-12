namespace Pouspourika.IdeaVerse.Api.InviteLinks;

/// <summary>
/// What someone opening an invite link is about to join.
/// </summary>
/// <param name="WorkspaceId">The workspace's identifier.</param>
/// <param name="Name">The workspace's name.</param>
/// <param name="MemberCount">How many people are in it.</param>
/// <param name="AlreadyMember">Whether the signed-in user is in it already.</param>
public sealed record JoinPreviewResponse(Guid WorkspaceId, string Name, int MemberCount, bool AlreadyMember);
