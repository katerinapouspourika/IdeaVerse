namespace Pouspourika.IdeaVerse.Api.Discovery;

/// <summary>
/// A workspace at the signed-in user's company that they can ask to join.
/// </summary>
/// <param name="Id">The workspace's identifier.</param>
/// <param name="Name">The workspace's name.</param>
/// <param name="MemberCount">How many people are in it.</param>
/// <param name="Requested">Whether they have asked to join and are waiting for an answer.</param>
public sealed record DiscoveredWorkspaceResponse(Guid Id, string Name, int MemberCount, bool Requested);
