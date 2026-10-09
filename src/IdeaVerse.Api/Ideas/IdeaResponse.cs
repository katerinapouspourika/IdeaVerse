namespace Pouspourika.IdeaVerse.Api.Ideas;

/// <summary>
/// An idea as returned by the API.
/// </summary>
/// <param name="Id">The identifier.</param>
/// <param name="Title">The title.</param>
/// <param name="Description">The optional description.</param>
/// <param name="TargetDate">The date the idea should be implemented by.</param>
/// <param name="Status">The lifecycle status.</param>
/// <param name="PostponeCount">How many times the idea has been postponed.</param>
/// <param name="IsOverdue">Whether the target date has passed without the idea being done.</param>
/// <param name="CreatedAt">When the idea was created.</param>
/// <param name="UpdatedAt">When the idea was last changed.</param>
public sealed record IdeaResponse(
  Guid Id,
  string Title,
  string? Description,
  DateOnly TargetDate,
  IdeaStatus Status,
  int PostponeCount,
  bool IsOverdue,
  DateTimeOffset CreatedAt,
  DateTimeOffset UpdatedAt)
{
  /// <summary>
  /// Maps an <see cref="Idea"/> to its response shape.
  /// </summary>
  /// <param name="idea">The idea.</param>
  /// <param name="today">The current date, used to compute <see cref="IsOverdue"/>.</param>
  /// <returns>The response.</returns>
  public static IdeaResponse From(Idea idea, DateOnly today)
  {
    ArgumentNullException.ThrowIfNull(idea);
    return new(
      idea.Id,
      idea.Title,
      idea.Description,
      idea.TargetDate,
      idea.Status,
      idea.PostponeCount,
      idea.IsOverdue(today),
      idea.CreatedAt,
      idea.UpdatedAt);
  }
}
