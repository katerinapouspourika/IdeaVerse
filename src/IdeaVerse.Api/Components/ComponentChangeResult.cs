namespace Pouspourika.IdeaVerse.Api.Components;

/// <summary>
/// Outcome of an operation that changes an idea's components.
/// </summary>
/// <param name="Outcome">What happened: <see cref="ChangeOutcome.Changed"/>, <see cref="ChangeOutcome.NotFound"/>, or <see cref="ChangeOutcome.Forbidden"/>.</param>
/// <param name="Component">The created or updated component, when there is one.</param>
public sealed record ComponentChangeResult(ChangeOutcome Outcome, Component? Component = null)
{
  /// <summary>
  /// Why a user who can see an idea may not change its components.
  /// </summary>
  public const string ForbiddenMessage = "Only the idea's team and the workspace's admins can change its components.";
}
