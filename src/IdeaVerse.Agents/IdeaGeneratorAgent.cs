namespace Pouspourika.IdeaVerse.Agents;

using System.Globalization;
using System.Text.Json;

using Microsoft.Extensions.Options;

using Pouspourika.IdeaVerse.Agents.Infrastructure;
using Pouspourika.IdeaVerse.Agents.Models;

/// <summary>
/// Brainstorms a diverse set of ideas for a topic.
/// </summary>
/// <param name="client">Model client used to generate ideas.</param>
/// <param name="options">Ideation options supplying the number of ideas.</param>
public sealed class IdeaGeneratorAgent(IStructuredModelClient client, IOptions<IdeationOptions> options)
{
  /// <summary>
  /// System prompt defining the generator's role.
  /// </summary>
  private const string SystemPrompt = """
    You are a creative strategist who brainstorms ideas for products, services, projects, and ventures.
    Aim for range: mix safe bets with bold bets, and avoid ideas that are minor variations of one another.
    Each idea should be concrete enough that someone could picture the first version of it.
    Respect every constraint in the brief.
    """;

  /// <summary>
  /// Output schema: an object with an <c>ideas</c> array.
  /// </summary>
  private static readonly JsonElement OutputSchema = PromptText.Schema("""
    {
      "type": "object",
      "properties": {
        "ideas": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "title": { "type": "string" },
              "summary": { "type": "string" },
              "target_audience": { "type": "string" },
              "differentiator": { "type": "string" }
            },
            "required": ["title", "summary", "target_audience", "differentiator"],
            "additionalProperties": false
          }
        }
      },
      "required": ["ideas"],
      "additionalProperties": false
    }
    """);

  /// <summary>
  /// Generates ideas for <paramref name="request"/>.
  /// </summary>
  /// <param name="request">The topic and constraints.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>The generated ideas.</returns>
  public async Task<IReadOnlyList<Idea>> GenerateAsync(IdeationRequest request, CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(request);
    ArgumentException.ThrowIfNullOrWhiteSpace(request.Topic);

    var count = options.Value.IdeaCount;
    var user = $"""
    {PromptText.Brief(request)}
    Generate {count.ToString(CultureInfo.InvariantCulture)} distinct ideas for this brief.
    """;
    var prompt = new StructuredPrompt("GenerateIdeas", SystemPrompt, user, OutputSchema);

    var batch = await client.CompleteAsync<IdeaBatch>(prompt, cancellationToken).ConfigureAwait(false);
    return batch.Ideas.Count > 0
      ? batch.Ideas
      : throw new IdeationException("The generator returned no ideas.");
  }

  /// <summary>
  /// Shape of the generator's JSON response.
  /// </summary>
  /// <param name="Ideas">The generated ideas.</param>
  internal sealed record IdeaBatch(IReadOnlyList<Idea> Ideas);
}
