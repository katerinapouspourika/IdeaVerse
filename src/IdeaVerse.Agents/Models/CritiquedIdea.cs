namespace Pouspourika.IdeaVerse.Agents.Models;

/// <summary>
/// An <see cref="Idea"/> together with its <see cref="IdeaCritique"/>.
/// </summary>
/// <param name="Idea">The generated idea.</param>
/// <param name="Critique">The critic's assessment of the idea.</param>
public sealed record CritiquedIdea(Idea Idea, IdeaCritique Critique);
