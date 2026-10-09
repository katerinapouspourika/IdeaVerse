namespace Pouspourika.IdeaVerse.Agents;

using Microsoft.Extensions.Options;

using Pouspourika.IdeaVerse.Agents.Models;

/// <summary>
/// Runs the full ideation workflow: generate, critique, then refine the best ideas.
/// </summary>
/// <param name="generator">Agent that brainstorms ideas.</param>
/// <param name="critic">Agent that scores ideas.</param>
/// <param name="refiner">Agent that expands the top ideas.</param>
/// <param name="options">Ideation options supplying how many ideas to refine.</param>
public sealed class IdeationPipeline(
  IdeaGeneratorAgent generator,
  IdeaCriticAgent critic,
  IdeaRefinerAgent refiner,
  IOptions<IdeationOptions> options)
{
  /// <summary>
  /// Runs the workflow for <paramref name="request"/>.
  /// </summary>
  /// <remarks>
  /// Refinements of the top ideas are independent, so they run concurrently.
  /// </remarks>
  /// <param name="request">The topic and constraints.</param>
  /// <param name="cancellationToken">Token to cancel the run.</param>
  /// <returns>All ideas with their critiques, ranked, plus the refined top ideas.</returns>
  public async Task<IdeationResult> RunAsync(IdeationRequest request, CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(request);

    using var activity = Telemetry.Source.StartActivity("RunIdeation");

    var ideas = await generator.GenerateAsync(request, cancellationToken).ConfigureAwait(false);
    var critiques = await critic.CritiqueAsync(request, ideas, cancellationToken).ConfigureAwait(false);

    var ranked = ideas
      .Zip(critiques, (idea, critique) => new CritiquedIdea(idea, critique))
      .OrderByDescending(c => c.Critique.Score)
      .ToArray();

    var refined = await Task.WhenAll(ranked
      .Take(options.Value.IdeasToRefine)
      .Select(idea => refiner.RefineAsync(request, idea, cancellationToken))).ConfigureAwait(false);

    return new IdeationResult(ranked, refined);
  }
}
