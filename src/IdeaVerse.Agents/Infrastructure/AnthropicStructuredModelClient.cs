namespace Pouspourika.IdeaVerse.Agents.Infrastructure;

using System.Diagnostics;
using System.Text.Json;

using Anthropic;
using Anthropic.Exceptions;
using Anthropic.Models.Beta.Messages;

using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

/// <summary>
/// <see cref="IStructuredModelClient"/> backed by the Claude Messages API with structured outputs.
/// </summary>
/// <remarks>
/// Uses the beta endpoint so that a policy refusal can be re-served server-side by the model's default fallback.
/// </remarks>
/// <param name="client">The Anthropic client.</param>
/// <param name="options">Ideation options supplying model, effort, and token limits.</param>
/// <param name="logger">Logger for request diagnostics.</param>
public sealed partial class AnthropicStructuredModelClient(
  IAnthropicClient client,
  IOptions<IdeationOptions> options,
  ILogger<AnthropicStructuredModelClient> logger) : IStructuredModelClient
{
  /// <summary>
  /// Beta flag enabling <c>fallbacks: "default"</c>.
  /// </summary>
  private const string FallbackBeta = "server-side-fallback-2026-07-01";

  /// <summary>
  /// Serializer settings matching the snake_case property names used in the agents' schemas.
  /// </summary>
  private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web)
  {
    PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
  };

  /// <inheritdoc/>
  public async Task<T> CompleteAsync<T>(StructuredPrompt prompt, CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(prompt);

    using var activity = Telemetry.Source.StartActivity(prompt.Operation);
    var settings = options.Value;
    activity?.SetTag("gen_ai.request.model", settings.Model);

    BetaMessage response;
    try
    {
      response = await client.Beta.Messages.Create(BuildParams(prompt, settings), cancellationToken).ConfigureAwait(false);
      activity?.SetTag("gen_ai.response.model", response.Model.Raw());
      activity?.SetTag("gen_ai.usage.input_tokens", response.Usage.InputTokens);
      activity?.SetTag("gen_ai.usage.output_tokens", response.Usage.OutputTokens);
      LogCompleted(logger, prompt.Operation, response.Usage.InputTokens, response.Usage.OutputTokens);
    }
    catch (AnthropicException ex)
    {
      activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
      throw new IdeationException($"Claude request for '{prompt.Operation}' failed: {ex.Message}", ex);
    }
    catch (OperationCanceledException ex) when (!cancellationToken.IsCancellationRequested)
    {
      activity?.SetStatus(ActivityStatusCode.Error, "Timed out");
      throw new IdeationException($"Claude request for '{prompt.Operation}' timed out.", ex);
    }

    return Deserialize<T>(prompt.Operation, response);
  }

  /// <summary>
  /// Builds the Messages API request for <paramref name="prompt"/>.
  /// </summary>
  /// <param name="prompt">The prompt to send.</param>
  /// <param name="settings">Current ideation options.</param>
  /// <returns>The request parameters.</returns>
  private static MessageCreateParams BuildParams(StructuredPrompt prompt, IdeationOptions settings)
  {
    var parameters = new MessageCreateParams
    {
      Model = settings.Model,
      MaxTokens = settings.MaxTokens,
      System = prompt.System,
      Messages = [new() { Role = Role.User, Content = prompt.User }],
      OutputConfig = new BetaOutputConfig
      {
        Effort = settings.Effort,
        Format = new BetaJsonOutputFormat { Schema = ToDictionary(prompt.Schema) },
      },
    };

    return settings.EnableRefusalFallback
      ? parameters with { Betas = [FallbackBeta], Fallbacks = new Default() }
      : parameters;
  }

  /// <summary>
  /// Validates the stop reason and deserializes the response's text into <typeparamref name="T"/>.
  /// </summary>
  /// <typeparam name="T">Target type.</typeparam>
  /// <param name="operation">Operation name, for error messages.</param>
  /// <param name="response">The model response.</param>
  /// <returns>The deserialized value.</returns>
  private static T Deserialize<T>(string operation, BetaMessage response)
  {
    var stopReason = response.StopReason?.Raw();
    if (stopReason == "refusal")
    {
      throw new IdeationException($"Claude declined '{operation}': {response.StopDetails?.Explanation ?? "no explanation"}.");
    }

    if (stopReason == "max_tokens")
    {
      throw new IdeationException($"Claude's response to '{operation}' was truncated; raise {nameof(IdeationOptions.MaxTokens)}.");
    }

    var json = string.Concat(response.Content.Select(b => b.Value).OfType<BetaTextBlock>().Select(t => t.Text));
    try
    {
      return JsonSerializer.Deserialize<T>(json, SerializerOptions)
        ?? throw new IdeationException($"Claude returned an empty response to '{operation}'.");
    }
    catch (JsonException ex)
    {
      throw new IdeationException($"Claude returned invalid JSON for '{operation}'.", ex);
    }
  }

  /// <summary>
  /// Converts a JSON schema object into the dictionary shape the SDK expects.
  /// </summary>
  /// <param name="schema">A JSON object.</param>
  /// <returns>The schema's top-level properties.</returns>
  private static Dictionary<string, JsonElement> ToDictionary(JsonElement schema)
    => schema.EnumerateObject().ToDictionary(p => p.Name, p => p.Value.Clone(), StringComparer.Ordinal);

  /// <summary>
  /// Logs token usage for a completed request.
  /// </summary>
  /// <param name="logger">Target logger.</param>
  /// <param name="operation">Agent operation name.</param>
  /// <param name="inputTokens">Input tokens billed.</param>
  /// <param name="outputTokens">Output tokens billed.</param>
  [LoggerMessage(Level = LogLevel.Debug, Message = "{Operation} completed: {InputTokens} input / {OutputTokens} output tokens")]
  private static partial void LogCompleted(ILogger logger, string operation, long inputTokens, long outputTokens);
}
