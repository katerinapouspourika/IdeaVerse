namespace Pouspourika.IdeaVerse.Api.Ideas;

using System.Linq.Expressions;

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
/// <param name="ComponentCount">How many components the idea has.</param>
/// <param name="CompletedComponentCount">How many of those components are done.</param>
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
  int ComponentCount,
  int CompletedComponentCount,
  DateTimeOffset CreatedAt,
  DateTimeOffset UpdatedAt)
{
  /// <summary>
  /// Builds a query projection from <see cref="Idea"/> to its response, counting components in the database.
  /// </summary>
  /// <param name="today">The current date, used to compute <see cref="IsOverdue"/>.</param>
  /// <returns>The projection expression.</returns>
  public static Expression<Func<Idea, IdeaResponse>> Projection(DateOnly today)
    => i => new IdeaResponse(
      i.Id,
      i.Title,
      i.Description,
      i.TargetDate,
      i.Status,
      i.PostponeCount,
      i.Status != IdeaStatus.Done && i.TargetDate < today,
      i.Components.Count,
      i.Components.Count(c => c.IsDone),
      i.CreatedAt,
      i.UpdatedAt);
}
