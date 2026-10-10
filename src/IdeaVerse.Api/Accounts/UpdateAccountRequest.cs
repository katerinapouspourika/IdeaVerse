namespace Pouspourika.IdeaVerse.Api.Accounts;

using System.ComponentModel.DataAnnotations;

using Pouspourika.IdeaVerse.Api.Data;

/// <summary>
/// Request to change the signed-in user's settings.
/// </summary>
/// <param name="TimeZone">An IANA time zone, such as <c>Europe/Athens</c>.</param>
public sealed record UpdateAccountRequest(
  [property: Required(AllowEmptyStrings = false), MaxLength(User.TimeZoneMaxLength)] string TimeZone) : IValidatableObject
{
  /// <inheritdoc/>
  public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
  {
    if (!string.IsNullOrEmpty(TimeZone) && !TimeZones.IsKnownIanaId(TimeZone))
    {
      yield return new ValidationResult("Choose a time zone from the list, such as Europe/Athens.", [nameof(TimeZone)]);
    }
  }
}
