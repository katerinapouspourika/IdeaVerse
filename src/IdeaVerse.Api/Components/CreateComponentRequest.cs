namespace Pouspourika.IdeaVerse.Api.Components;

using System.ComponentModel.DataAnnotations;

/// <summary>
/// Request to add a component to an idea.
/// </summary>
/// <param name="Title">What is needed.</param>
/// <param name="Notes">Optional notes.</param>
public sealed record CreateComponentRequest(
  [property: Required(AllowEmptyStrings = false), MaxLength(Component.TitleMaxLength)] string Title,
  [property: MaxLength(Component.NotesMaxLength)] string? Notes);
