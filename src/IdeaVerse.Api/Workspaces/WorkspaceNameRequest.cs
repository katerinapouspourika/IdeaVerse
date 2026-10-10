namespace Pouspourika.IdeaVerse.Api.Workspaces;

using System.ComponentModel.DataAnnotations;

/// <summary>
/// Request to create or rename a workspace.
/// </summary>
/// <param name="Name">The workspace's name, such as the company's.</param>
public sealed record WorkspaceNameRequest(
  [property: Required(AllowEmptyStrings = false), MaxLength(Workspace.NameMaxLength)] string Name);
