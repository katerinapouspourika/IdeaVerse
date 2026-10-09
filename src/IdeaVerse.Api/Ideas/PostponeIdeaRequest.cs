namespace Pouspourika.IdeaVerse.Api.Ideas;

using System.ComponentModel.DataAnnotations;

/// <summary>
/// Request to move an idea to a later target date.
/// </summary>
/// <param name="TargetDate">The new target date; later than the current one and not in the past.</param>
public sealed record PostponeIdeaRequest(DateOnly TargetDate) : IValidatableObject
{
  /// <inheritdoc/>
  public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
  {
    ArgumentNullException.ThrowIfNull(validationContext);
    return TargetDateRules.RequireNotInPast(TargetDate, validationContext);
  }
}
