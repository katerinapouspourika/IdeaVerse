namespace Pouspourika.IdeaVerse.Api.Components;

/// <summary>
/// A component as returned by the API.
/// </summary>
/// <param name="Id">The identifier.</param>
/// <param name="Title">What is needed.</param>
/// <param name="Notes">Optional notes.</param>
/// <param name="IsDone">Whether the component is in place.</param>
/// <param name="Position">The zero-based order within the idea.</param>
/// <param name="CreatedAt">When the component was added.</param>
/// <param name="CompletedAt">When the component was marked done, if it is.</param>
/// <param name="AssigneeId">The identifier of the person responsible for it, if anyone.</param>
/// <param name="AssigneeEmail">Their email.</param>
/// <param name="AssigneeName">Their display name, or <see langword="null"/> when unset.</param>
/// <param name="DueDate">The date it should be done by, if any.</param>
public sealed record ComponentResponse(
  Guid Id,
  string Title,
  string? Notes,
  bool IsDone,
  int Position,
  DateTimeOffset CreatedAt,
  DateTimeOffset? CompletedAt,
  string? AssigneeId,
  string? AssigneeEmail,
  string? AssigneeName,
  DateOnly? DueDate)
{
  /// <summary>
  /// Maps a <see cref="Component"/> to its response shape.
  /// </summary>
  /// <param name="component">The component.</param>
  /// <returns>The response.</returns>
  public static ComponentResponse From(Component component)
  {
    ArgumentNullException.ThrowIfNull(component);
    return new(
      component.Id,
      component.Title,
      component.Notes,
      component.IsDone,
      component.Position,
      component.CreatedAt,
      component.CompletedAt,
      component.AssigneeId,
      component.Assignee?.Email,
      component.Assignee?.DisplayName,
      component.DueDate);
  }
}
