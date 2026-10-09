namespace Pouspourika.IdeaVerse.Agents;

using System.Text.Json;

using Pouspourika.IdeaVerse.Agents.Infrastructure;
using Pouspourika.IdeaVerse.Agents.Models;

/// <summary>
/// Evaluates ideas against the brief and scores them.
/// </summary>
/// <param name="client">Model client used to critique ideas.</param>
public sealed class IdeaCriticAgent(IStructuredModelClient client)
{
  /// <summary>
  /// System prompt defining the critic's role.
  /// </summary>
  private const string SystemPrompt = """
    You are a seasoned, skeptical reviewer of new ideas: part investor, part product lead, part end user.
    Judge each idea on its merits against the brief: how well it fits the constraints, whether the audience
    actually has the problem, how feasible a first version is, and how it differs from what already exists.
    Be specific; name the concrete reason behind each strength and weakness.
    Score each idea from 1 (not worth pursuing) to 10 (pursue immediately), using the full range.
    Return one critique per idea, in the same order the ideas were given.
    """;

  /// <summary>
  /// Output schema: an object with a <c>critiques</c> array.
  /// </summary>
  private static readonly JsonElement OutputSchema = PromptText.Schema("""
    {
      "type": "object",
      "properties": {
        "critiques": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "idea_title": { "type": "string" },
              "strengths": { "type": "array", "items": { "type": "string" } },
              "weaknesses": { "type": "array", "items": { "type": "string" } },
              "score": { "type": "integer" }
            },
            "required": ["idea_title", "strengths", "weaknesses", "score"],
            "additionalProperties": false
          }
        }
      },
      "required": ["critiques"],
      "additionalProperties": false
    }
    """);

  /// <summary>
  /// Critiques every idea in <paramref name="ideas"/>.
  /// </summary>
  /// <param name="request">The brief the ideas were generated for.</param>
  /// <param name="ideas">The ideas to critique.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>One critique per idea, in the same order as <paramref name="ideas"/>.</returns>
  public async Task<IReadOnlyList<IdeaCritique>> CritiqueAsync(
    IdeationRequest request,
    IReadOnlyList<Idea> ideas,
    CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(request);
    ArgumentNullException.ThrowIfNull(ideas);
    if (ideas.Count == 0)
    {
      return [];
    }

    var user = $"""
    {PromptText.Brief(request)}
    <ideas>
    {PromptText.Json(ideas)}
    </ideas>
    """;
    var prompt = new StructuredPrompt("CritiqueIdeas", SystemPrompt, user, OutputSchema);

    var batch = await client.CompleteAsync<CritiqueBatch>(prompt, cancellationToken).ConfigureAwait(false);
    if (batch.Critiques.Count != ideas.Count)
    {
      throw new IdeationException($"The critic returned {batch.Critiques.Count} critiques for {ideas.Count} ideas.");
    }

    return [.. batch.Critiques.Select(c => c with { Score = Math.Clamp(c.Score, IdeaCritique.MinScore, IdeaCritique.MaxScore) })];
  }

  /// <summary>
  /// Shape of the critic's JSON response.
  /// </summary>
  /// <param name="Critiques">The critiques, one per idea.</param>
  internal sealed record CritiqueBatch(IReadOnlyList<IdeaCritique> Critiques);
}
