namespace Pouspourika.IdeaVerse.Agents;

using System.Text.Json;

using Pouspourika.IdeaVerse.Agents.Infrastructure;
using Pouspourika.IdeaVerse.Agents.Models;

/// <summary>
/// Suggests the components an idea needs: the people, budget, approvals, assets, and tools that must be in place before it can happen.
/// </summary>
/// <param name="client">The model client.</param>
public sealed class ComponentSuggesterAgent(IStructuredModelClient client)
{
  /// <summary>
  /// The most suggestions kept from one request.
  /// </summary>
  public const int MaxSuggestions = 8;

  /// <summary>
  /// System prompt describing the agent's role.
  /// </summary>
  private const string SystemPrompt = """
    You are an experienced marketing project lead who plans campaigns, events, and launches.
    Given an idea and the date it should happen by, list what must be in place before it can happen:
    people and skills, budget and approvals, assets and content, tools, venues, partners, and data.
    Each suggestion is one concrete thing a team could tick off, with a short note on why it is needed.
    Order them by what should be started first, given the target date. Suggest at most eight.
    Never repeat anything the team already listed.
    """;

  /// <summary>
  /// JSON schema of the model's answer, matching <see cref="SuggestionBatch"/>.
  /// </summary>
  private static readonly JsonElement OutputSchema = PromptText.Schema("""
    {
      "type": "object",
      "properties": {
        "suggestions": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "title": { "type": "string" },
              "notes": { "type": "string" }
            },
            "required": ["title", "notes"],
            "additionalProperties": false
          }
        }
      },
      "required": ["suggestions"],
      "additionalProperties": false
    }
    """);

  /// <summary>
  /// Suggests components for an idea, leaving out the ones it already has.
  /// </summary>
  /// <param name="idea">The idea.</param>
  /// <param name="existing">Titles of the components the idea already has.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>Up to <see cref="MaxSuggestions"/> suggestions, most urgent first.</returns>
  /// <exception cref="IdeationException">The model could not answer.</exception>
  public async Task<IReadOnlyList<ComponentSuggestion>> SuggestAsync(IdeaBrief idea, IReadOnlyList<string> existing, CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(idea);
    ArgumentNullException.ThrowIfNull(existing);

    var user = $"""
    <idea>
    {PromptText.Json(idea)}
    </idea>
    <already_listed>
    {PromptText.Json(existing)}
    </already_listed>
    """;
    var prompt = new StructuredPrompt("SuggestComponents", SystemPrompt, user, OutputSchema);

    var batch = await client.CompleteAsync<SuggestionBatch>(prompt, cancellationToken).ConfigureAwait(false);
    var fresh = batch.Suggestions
      .Where(s => !string.IsNullOrWhiteSpace(s.Title))
      .Where(s => !existing.Contains(s.Title.Trim(), StringComparer.OrdinalIgnoreCase))
      .Take(MaxSuggestions);
    return [.. fresh];
  }

  /// <summary>
  /// The model's answer.
  /// </summary>
  /// <param name="Suggestions">The suggestions.</param>
  internal sealed record SuggestionBatch(IReadOnlyList<ComponentSuggestion> Suggestions);
}
