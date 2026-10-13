namespace Pouspourika.IdeaVerse.Api.Ideas;

/// <summary>
/// Request to plan when work on an idea starts, or to clear it.
/// </summary>
/// <param name="StartDate">The start date, on or before the target date; <see langword="null"/> clears the start.</param>
/// <param name="StartTime">The time of day work starts, in the signed-in user's time zone; optional.</param>
public sealed record SetStartRequest(DateOnly? StartDate, TimeOnly? StartTime = null);
