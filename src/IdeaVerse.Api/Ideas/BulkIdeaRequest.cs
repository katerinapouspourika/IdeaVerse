namespace Pouspourika.IdeaVerse.Api.Ideas;

using System.ComponentModel.DataAnnotations;

/// <summary>
/// Request to apply one change to several ideas at once.
/// </summary>
/// <param name="Ids">The ideas to change, at most <see cref="MaxIdeas"/>.</param>
/// <param name="Operation">The change to make to each.</param>
/// <param name="Status">The new status, for <see cref="BulkIdeaOperation.SetStatus"/>.</param>
/// <param name="Tag">The tag to add or remove, for <see cref="BulkIdeaOperation.AddTag"/> and <see cref="BulkIdeaOperation.RemoveTag"/>.</param>
/// <param name="TargetDate">The new target date, for <see cref="BulkIdeaOperation.MoveTargetDate"/>; or give <paramref name="Days"/>.</param>
/// <param name="Days">How many days later each idea's own target date moves, for <see cref="BulkIdeaOperation.MoveTargetDate"/>; or give <paramref name="TargetDate"/>.</param>
public sealed record BulkIdeaRequest(
  [property: Required] IReadOnlyList<Guid> Ids,
  BulkIdeaOperation Operation,
  IdeaStatus? Status = null,
  string? Tag = null,
  DateOnly? TargetDate = null,
  int? Days = null)
  : IValidatableObject
{
  /// <summary>
  /// The most ideas one request may change.
  /// </summary>
  public const int MaxIdeas = 100;

  /// <summary>
  /// The furthest a target date may be moved by <see cref="Days"/>.
  /// </summary>
  public const int MaxDays = 366;

  /// <inheritdoc/>
  public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
  {
    if (Ids is null)
    {
      yield break;
    }

    if (Ids.Count is 0 or > MaxIdeas)
    {
      yield return new ValidationResult($"Choose between 1 and {MaxIdeas} ideas.", [nameof(Ids)]);
    }

    if (OperationProblem() is { } problem)
    {
      yield return problem;
    }
  }

  /// <summary>
  /// Checks that the fields <see cref="Operation"/> needs are given.
  /// </summary>
  /// <returns>The problem, or <see langword="null"/> when there is none.</returns>
  private ValidationResult? OperationProblem()
    => Operation switch
    {
      BulkIdeaOperation.SetStatus when Status is null => new ValidationResult("Choose a status.", [nameof(Status)]),
      BulkIdeaOperation.AddTag or BulkIdeaOperation.RemoveTag when TagProblem() is { } problem => new ValidationResult(problem, [nameof(Tag)]),
      BulkIdeaOperation.MoveTargetDate when (TargetDate is null) == (Days is null)
        => new ValidationResult("Give either a target date or a number of days.", [nameof(TargetDate)]),
      BulkIdeaOperation.MoveTargetDate when Days is < 1 or > MaxDays => new ValidationResult($"Move the target date by 1 to {MaxDays} days.", [nameof(Days)]),
      BulkIdeaOperation.SetStatus
        or BulkIdeaOperation.AddTag
        or BulkIdeaOperation.RemoveTag
        or BulkIdeaOperation.MoveTargetDate
        or BulkIdeaOperation.Archive
        or BulkIdeaOperation.Restore
        or _ => null,
    };

  /// <summary>
  /// Checks <see cref="Tag"/> by the rules every idea's tags follow.
  /// </summary>
  /// <returns>Why the tag cannot be used, or <see langword="null"/> when it can.</returns>
  private string? TagProblem()
    => string.IsNullOrWhiteSpace(Tag)
      ? "Enter a tag."
      : IdeaTags.TryNormalize([Tag], out _, out var error) ? null : error;
}
