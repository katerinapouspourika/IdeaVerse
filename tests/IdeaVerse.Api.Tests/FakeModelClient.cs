namespace Pouspourika.IdeaVerse.Api.Tests;

using System.Collections.Concurrent;
using System.Text.Json;

using Pouspourika.IdeaVerse.Agents;
using Pouspourika.IdeaVerse.Agents.Infrastructure;

// Answers agent prompts with canned snake_case JSON per operation, deserialized the way the real client reads the model's output.
internal sealed class FakeModelClient : IStructuredModelClient
{
  private static readonly JsonSerializerOptions SnakeCase = new(JsonSerializerDefaults.Web) { PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower };

  private readonly ConcurrentDictionary<string, string> answers = new(StringComparer.Ordinal);
  private readonly ConcurrentQueue<StructuredPrompt> prompts = new();

  public bool Fail { get; set; }

  public IReadOnlyList<StructuredPrompt> Prompts => [.. prompts];

  public void Answer(string operation, string json) => answers[operation] = json;

  public Task<T> CompleteAsync<T>(StructuredPrompt prompt, CancellationToken cancellationToken = default)
  {
    prompts.Enqueue(prompt);
    if (Fail)
    {
      throw new IdeationException("The model refused.");
    }

    return answers.TryGetValue(prompt.Operation, out var json)
      ? Task.FromResult(JsonSerializer.Deserialize<T>(json, SnakeCase)!)
      : throw new InvalidOperationException($"No canned answer for {prompt.Operation}.");
  }
}
