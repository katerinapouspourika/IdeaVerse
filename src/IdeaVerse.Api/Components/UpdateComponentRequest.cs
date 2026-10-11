namespace Pouspourika.IdeaVerse.Api.Components;

using System.ComponentModel.DataAnnotations;

/// <summary>
/// Request to replace a component's editable fields.
/// </summary>
/// <param name="Title">What is needed.</param>
/// <param name="Notes">Optional notes.</param>
/// <param name="IsDone">Whether the component is in place.</param>
/// <param name="AssigneeId">The identifier of the person in the workspace responsible for it, or <see langword="null"/> for nobody.</param>
/// <param name="DueDate">The date it should be done by, or <see langword="null"/> for none.</param>
public sealed record UpdateComponentRequest(
  [property: Required(AllowEmptyStrings = false), MaxLength(Component.TitleMaxLength)] string Title,
  [property: MaxLength(Component.NotesMaxLength)] string? Notes,
  bool IsDone,
  string? AssigneeId = null,
  DateOnly? DueDate = null);
