namespace Pouspourika.IdeaVerse.Api.Ideas;

/// <summary>
/// Request to move an idea to a later target date.
/// </summary>
/// <param name="TargetDate">The new target date; later than the current one and not in the past.</param>
public sealed record PostponeIdeaRequest(DateOnly TargetDate);
