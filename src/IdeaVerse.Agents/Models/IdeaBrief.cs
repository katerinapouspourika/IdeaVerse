namespace Pouspourika.IdeaVerse.Agents.Models;

/// <summary>
/// An idea a team already has, as the agents that help with it see it.
/// </summary>
/// <param name="Title">The idea's title.</param>
/// <param name="Description">The idea's description, if any.</param>
/// <param name="TargetDate">The date the team wants it done by.</param>
public sealed record IdeaBrief(string Title, string? Description, DateOnly TargetDate);
