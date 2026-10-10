namespace Pouspourika.IdeaVerse.Agents.Models;

/// <summary>
/// A critique of an idea and a sharper version of it, from <see cref="IdeaImproverAgent"/>.
/// </summary>
/// <param name="Strengths">What already works.</param>
/// <param name="Weaknesses">What holds the idea back.</param>
/// <param name="Title">A sharper title.</param>
/// <param name="Description">A sharper description that answers the weaknesses.</param>
public sealed record IdeaImprovement(
  IReadOnlyList<string> Strengths,
  IReadOnlyList<string> Weaknesses,
  string Title,
  string Description);
