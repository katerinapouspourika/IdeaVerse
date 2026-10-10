namespace Pouspourika.IdeaVerse.Api.Workspaces;

/// <summary>
/// Request to change a person's role in a workspace.
/// </summary>
/// <param name="Role">The new role: <see cref="WorkspaceRole.Admin"/> or <see cref="WorkspaceRole.Member"/>.</param>
public sealed record ChangeRoleRequest(WorkspaceRole Role);
