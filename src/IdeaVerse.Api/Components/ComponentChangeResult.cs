namespace Pouspourika.IdeaVerse.Api.Components;

/// <summary>
/// Outcome of an operation that changes an idea's components.
/// </summary>
/// <param name="Outcome">What happened: <see cref="ChangeOutcome.Changed"/>, <see cref="ChangeOutcome.NotFound"/>, <see cref="ChangeOutcome.Forbidden"/>, or <see cref="ChangeOutcome.Invalid"/>.</param>
/// <param name="Component">The created or updated component, when there is one.</param>
/// <param name="Field">The request field at fault, when <paramref name="Outcome"/> is <see cref="ChangeOutcome.Invalid"/>.</param>
/// <param name="Message">Why the value is invalid.</param>
public sealed record ComponentChangeResult(ChangeOutcome Outcome, Component? Component = null, string? Field = null, string? Message = null)
{
  /// <summary>
  /// Why a user who can see an idea may not change its components.
  /// </summary>
  public const string ForbiddenMessage = "Only the idea's team and the workspace's admins can change its components.";
}
