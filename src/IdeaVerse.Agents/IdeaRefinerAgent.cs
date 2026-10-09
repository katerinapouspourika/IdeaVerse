namespace Pouspourika.IdeaVerse.Agents;

using System.Text.Json;

using Pouspourika.IdeaVerse.Agents.Infrastructure;
using Pouspourika.IdeaVerse.Agents.Models;

/// <summary>
/// Expands a critiqued idea into an actionable concept that addresses the critique.
/// </summary>
/// <param name="client">Model client used to refine ideas.</param>
public sealed class IdeaRefinerAgent(IStructuredModelClient client)
{
  /// <summary>
  /// System prompt defining the refiner's role.
  /// </summary>
  private const string SystemPrompt = """
    You are a product strategist who turns promising raw ideas into concepts a small team could start on.
    Keep what the critique found strong, and change the idea where needed to answer its weaknesses.
    Where a weakness cannot be fixed, keep it as a risk and say how to reduce it.
    Next steps should be small, concrete, and aimed at learning whether the idea works before building much.
    """;

  /// <summary>
  /// Output schema for a <see cref="RefinedIdea"/>.
  /// </summary>
  private static readonly JsonElement OutputSchema = PromptText.Schema("""
    {
      "type": "object",
      "properties": {
        "title": { "type": "string" },
        "pitch": { "type": "string" },
        "key_features": { "type": "array", "items": { "type": "string" } },
        "risks": { "type": "array", "items": { "type": "string" } },
        "next_steps": { "type": "array", "items": { "type": "string" } }
      },
      "required": ["title", "pitch", "key_features", "risks", "next_steps"],
      "additionalProperties": false
    }
    """);

  /// <summary>
  /// Refines <paramref name="idea"/> using its critique.
  /// </summary>
  /// <param name="request">The brief the idea was generated for.</param>
  /// <param name="idea">The idea and its critique.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>The refined idea.</returns>
  public Task<RefinedIdea> RefineAsync(IdeationRequest request, CritiquedIdea idea, CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(request);
    ArgumentNullException.ThrowIfNull(idea);

    var user = $"""
    {PromptText.Brief(request)}
    <idea>
    {PromptText.Json(idea.Idea)}
    </idea>
    <critique>
    {PromptText.Json(idea.Critique)}
    </critique>
    """;
    var prompt = new StructuredPrompt("RefineIdea", SystemPrompt, user, OutputSchema);

    return client.CompleteAsync<RefinedIdea>(prompt, cancellationToken);
  }
}
