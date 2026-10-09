namespace Pouspourika.IdeaVerse.Agents.Infrastructure;

/// <summary>
/// Sends a <see cref="StructuredPrompt"/> to a language model and deserializes the schema-constrained response.
/// </summary>
public interface IStructuredModelClient
{
  /// <summary>
  /// Sends <paramref name="prompt"/> and deserializes the response into <typeparamref name="T"/>.
  /// </summary>
  /// <typeparam name="T">Type the JSON response deserializes into.</typeparam>
  /// <param name="prompt">The prompt and output schema.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>The deserialized response.</returns>
  /// <exception cref="IdeationException">The model refused, was truncated, or returned unparseable output.</exception>
  Task<T> CompleteAsync<T>(StructuredPrompt prompt, CancellationToken cancellationToken = default);
}
