namespace Pouspourika.IdeaVerse.Agents.Models;

/// <summary>
/// The <see cref="IdeaCriticAgent"/>'s assessment of a single <see cref="Idea"/>.
/// </summary>
/// <param name="IdeaTitle">Title of the critiqued idea, matching <see cref="Idea.Title"/>.</param>
/// <param name="Strengths">What works well about the idea.</param>
/// <param name="Weaknesses">Risks, gaps, or reasons the idea might fail.</param>
/// <param name="Score">Overall score, from <see cref="MinScore"/> to <see cref="MaxScore"/>.</param>
public sealed record IdeaCritique(
  string IdeaTitle,
  IReadOnlyList<string> Strengths,
  IReadOnlyList<string> Weaknesses,
  int Score)
{
  /// <summary>
  /// Lowest score a critique can assign.
  /// </summary>
  public const int MinScore = 1;

  /// <summary>
  /// Highest score a critique can assign.
  /// </summary>
  public const int MaxScore = 10;
}
