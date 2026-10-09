namespace Pouspourika.IdeaVerse.Agents.Infrastructure;

using System.Text.Json;

/// <summary>
/// A single request to the model whose response must match <see cref="Schema"/>.
/// </summary>
/// <param name="Operation">Name of the agent operation, used for tracing.</param>
/// <param name="System">System prompt describing the agent's role.</param>
/// <param name="User">The user turn carrying the task input.</param>
/// <param name="Schema">JSON schema the model's response is constrained to.</param>
public sealed record StructuredPrompt(string Operation, string System, string User, JsonElement Schema);
