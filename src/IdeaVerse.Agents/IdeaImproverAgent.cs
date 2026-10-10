namespace Pouspourika.IdeaVerse.Agents;

using System.Text.Json;

using Pouspourika.IdeaVerse.Agents.Infrastructure;
using Pouspourika.IdeaVerse.Agents.Models;

/// <summary>
/// Critiques an idea a team already has and rewrites its title and description to answer the critique.
/// </summary>
/// <param name="client">The model client.</param>
public sealed class IdeaImproverAgent(IStructuredModelClient client)
{
  /// <summary>
  /// System prompt describing the agent's role.
  /// </summary>
  private const string SystemPrompt = """
    You are a sharp creative director at a marketing agency, reviewing an idea a colleague wrote down.
    First name what already works and what holds it back: vague audience, unclear goal, no measurable outcome,
    unrealistic for the date, or too similar to what everyone does. Be specific and kind.
    Then rewrite it: a short, concrete title, and a description of a few sentences that keeps the core of the idea,
    says who it is for, what it should achieve and how success will be measured, and answers the weaknesses you named.
    Keep the colleague's language and tone. Don't invent facts about the company.
    """;

  /// <summary>
  /// JSON schema of the model's answer, matching <see cref="IdeaImprovement"/>.
  /// </summary>
  private static readonly JsonElement OutputSchema = PromptText.Schema("""
    {
      "type": "object",
      "properties": {
        "strengths": { "type": "array", "items": { "type": "string" } },
        "weaknesses": { "type": "array", "items": { "type": "string" } },
        "title": { "type": "string" },
        "description": { "type": "string" }
      },
      "required": ["strengths", "weaknesses", "title", "description"],
      "additionalProperties": false
    }
    """);

  /// <summary>
  /// Critiques and rewrites an idea.
  /// </summary>
  /// <param name="idea">The idea.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>The critique and the rewritten idea.</returns>
  /// <exception cref="IdeationException">The model could not answer, or answered without a title.</exception>
  public async Task<IdeaImprovement> ImproveAsync(IdeaBrief idea, CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(idea);

    var user = $"""
    <idea>
    {PromptText.Json(idea)}
    </idea>
    """;
    var prompt = new StructuredPrompt("ImproveIdea", SystemPrompt, user, OutputSchema);

    var improvement = await client.CompleteAsync<IdeaImprovement>(prompt, cancellationToken).ConfigureAwait(false);
    return string.IsNullOrWhiteSpace(improvement.Title)
      ? throw new IdeationException("The improver returned no title.")
      : improvement;
  }
}
