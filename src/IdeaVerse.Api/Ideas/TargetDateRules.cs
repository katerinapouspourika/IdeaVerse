namespace Pouspourika.IdeaVerse.Api.Ideas;

/// <summary>
/// Names and messages shared by the rules on an idea's target date.
/// </summary>
internal static class TargetDateRules
{
  /// <summary>
  /// Name of the target date member in validation errors.
  /// </summary>
  public const string MemberName = nameof(CreateIdeaRequest.TargetDate);

  /// <summary>
  /// Error message for a target date before the user's today.
  /// </summary>
  public const string NotInPastMessage = "The target date cannot be in the past.";
}
