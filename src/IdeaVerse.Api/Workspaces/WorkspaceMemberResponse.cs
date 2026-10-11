namespace Pouspourika.IdeaVerse.Api.Workspaces;

/// <summary>
/// A person in a workspace, as returned by the API.
/// </summary>
/// <param name="UserId">The user identifier.</param>
/// <param name="Email">The user's email address.</param>
/// <param name="Name">The user's display name, or <see langword="null"/> when they have not set one.</param>
/// <param name="Role">The user's role in the workspace.</param>
/// <param name="JoinedAt">When the user joined.</param>
public sealed record WorkspaceMemberResponse(string UserId, string Email, string? Name, WorkspaceRole Role, DateTimeOffset JoinedAt);
