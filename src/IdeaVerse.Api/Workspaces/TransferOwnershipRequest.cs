namespace Pouspourika.IdeaVerse.Api.Workspaces;

using System.ComponentModel.DataAnnotations;

/// <summary>
/// Request to hand a workspace to someone else in it.
/// </summary>
/// <param name="UserId">The identifier of the person who becomes the owner.</param>
public sealed record TransferOwnershipRequest([property: Required(AllowEmptyStrings = false)] string UserId);
