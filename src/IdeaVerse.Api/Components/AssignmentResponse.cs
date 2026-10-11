namespace Pouspourika.IdeaVerse.Api.Components;

/// <summary>
/// An unfinished component assigned to the signed-in user, with the idea it belongs to.
/// </summary>
/// <param name="ComponentId">The component identifier.</param>
/// <param name="Title">The component's title.</param>
/// <param name="DueDate">When it should be done, if it has a date.</param>
/// <param name="IdeaId">The idea the component belongs to.</param>
/// <param name="IdeaTitle">The idea's title.</param>
/// <param name="IdeaTargetDate">The idea's target date.</param>
public sealed record AssignmentResponse(Guid ComponentId, string Title, DateOnly? DueDate, Guid IdeaId, string IdeaTitle, DateOnly IdeaTargetDate);
