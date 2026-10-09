namespace Pouspourika.IdeaVerse.Agents.Models;

/// <summary>
/// Input to an ideation run.
/// </summary>
/// <param name="Topic">The problem space or theme to generate ideas for.</param>
/// <param name="Constraints">Optional constraints the ideas must respect (budget, audience, technology, ...).</param>
public sealed record IdeationRequest(string Topic, IReadOnlyList<string>? Constraints = null);
