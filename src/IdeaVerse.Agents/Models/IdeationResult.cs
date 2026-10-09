namespace Pouspourika.IdeaVerse.Agents.Models;

/// <summary>
/// Output of a full <see cref="IdeationPipeline"/> run.
/// </summary>
/// <param name="Ideas">Every generated idea paired with its critique, ordered by descending score.</param>
/// <param name="Refined">The top-scoring ideas, refined into actionable concepts.</param>
public sealed record IdeationResult(
  IReadOnlyList<CritiquedIdea> Ideas,
  IReadOnlyList<RefinedIdea> Refined);
