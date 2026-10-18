namespace Pouspourika.IdeaVerse.Api.Ideas;

/// <summary>
/// Request to take back the user's latest postponement of an idea, restoring what it was before.
/// </summary>
/// <param name="TargetDate">The target date before the postponement; earlier than the current one.</param>
/// <param name="Status">The status before the postponement.</param>
public sealed record UndoPostponeRequest(DateOnly TargetDate, IdeaStatus Status);
