namespace Pouspourika.IdeaVerse.Agents.Models;

/// <summary>
/// An idea expanded by the <see cref="IdeaRefinerAgent"/> into an actionable concept.
/// </summary>
/// <param name="Title">Title of the refined idea.</param>
/// <param name="Pitch">One-paragraph elevator pitch.</param>
/// <param name="KeyFeatures">The core features or components of the idea.</param>
/// <param name="Risks">Remaining risks, each paired with a mitigation where possible.</param>
/// <param name="NextSteps">Concrete first steps to validate or build the idea.</param>
public sealed record RefinedIdea(
  string Title,
  string Pitch,
  IReadOnlyList<string> KeyFeatures,
  IReadOnlyList<string> Risks,
  IReadOnlyList<string> NextSteps);
