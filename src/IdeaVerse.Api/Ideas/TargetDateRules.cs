namespace Pouspourika.IdeaVerse.Api.Ideas;

using System.ComponentModel.DataAnnotations;

/// <summary>
/// Validation rules shared by requests that set a target date.
/// </summary>
internal static class TargetDateRules
{
  /// <summary>
  /// Name of the target date member in validation errors.
  /// </summary>
  public const string MemberName = nameof(CreateIdeaRequest.TargetDate);

  /// <summary>
  /// Error message for a target date before today.
  /// </summary>
  public const string NotInPastMessage = "The target date cannot be in the past.";

  /// <summary>
  /// Yields an error when <paramref name="targetDate"/> is before today.
  /// </summary>
  /// <param name="targetDate">The requested target date.</param>
  /// <param name="validationContext">Context providing the <see cref="TimeProvider"/>.</param>
  /// <returns>The validation errors, if any.</returns>
  public static IEnumerable<ValidationResult> RequireNotInPast(DateOnly targetDate, ValidationContext validationContext)
  {
    var timeProvider = validationContext.GetService(typeof(TimeProvider)) as TimeProvider ?? TimeProvider.System;
    if (targetDate < timeProvider.Today())
    {
      yield return new ValidationResult(NotInPastMessage, [MemberName]);
    }
  }

  /// <summary>
  /// Returns today's date in UTC.
  /// </summary>
  /// <param name="timeProvider">The time provider.</param>
  /// <returns>Today's date.</returns>
  public static DateOnly Today(this TimeProvider timeProvider) => DateOnly.FromDateTime(timeProvider.GetUtcNow().UtcDateTime);
}
