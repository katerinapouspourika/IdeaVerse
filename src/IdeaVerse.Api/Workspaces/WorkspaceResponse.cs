namespace Pouspourika.IdeaVerse.Api.Workspaces;

/// <summary>
/// A workspace as returned by the API.
/// </summary>
/// <param name="Id">The identifier.</param>
/// <param name="Name">The name.</param>
/// <param name="Role">The signed-in user's role in the workspace.</param>
/// <param name="MemberCount">How many people are in the workspace.</param>
/// <param name="CreatedAt">When the workspace was created.</param>
public sealed record WorkspaceResponse(Guid Id, string Name, WorkspaceRole Role, int MemberCount, DateTimeOffset CreatedAt);
