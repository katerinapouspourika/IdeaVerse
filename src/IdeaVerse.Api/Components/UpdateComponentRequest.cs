namespace Pouspourika.IdeaVerse.Api.Components;

using System.ComponentModel.DataAnnotations;

/// <summary>
/// Request to replace a component's editable fields.
/// </summary>
/// <param name="Title">What is needed.</param>
/// <param name="Notes">Optional notes.</param>
/// <param name="IsDone">Whether the component is in place.</param>
public sealed record UpdateComponentRequest(
  [property: Required(AllowEmptyStrings = false), MaxLength(Component.TitleMaxLength)] string Title,
  [property: MaxLength(Component.NotesMaxLength)] string? Notes,
  bool IsDone);
