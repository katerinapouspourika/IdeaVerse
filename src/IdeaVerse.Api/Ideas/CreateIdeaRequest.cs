namespace Pouspourika.IdeaVerse.Api.Ideas;

using System.ComponentModel.DataAnnotations;

/// <summary>
/// Request to create an idea.
/// </summary>
/// <param name="Title">The idea's title.</param>
/// <param name="Description">An optional description.</param>
/// <param name="TargetDate">The date the idea should be implemented by; today or later.</param>
public sealed record CreateIdeaRequest(
  [property: Required(AllowEmptyStrings = false), MaxLength(Idea.TitleMaxLength)] string Title,
  [property: MaxLength(Idea.DescriptionMaxLength)] string? Description,
  DateOnly TargetDate) : IValidatableObject
{
  /// <inheritdoc/>
  public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
  {
    ArgumentNullException.ThrowIfNull(validationContext);
    return TargetDateRules.RequireNotInPast(TargetDate, validationContext);
  }
}
