namespace Pouspourika.IdeaVerse.Agents.Infrastructure;

using System.Text;
using System.Text.Json;

using Pouspourika.IdeaVerse.Agents.Models;

/// <summary>
/// Helpers shared by the agents for building prompt text and schemas.
/// </summary>
internal static class PromptText
{
  /// <summary>
  /// Serializer settings for embedding inputs in prompts with the same field names as the output schemas.
  /// </summary>
  private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web)
  {
    PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
    WriteIndented = true,
  };

  /// <summary>
  /// Renders the topic and constraints of <paramref name="request"/> as tagged prompt text.
  /// </summary>
  /// <param name="request">The ideation request.</param>
  /// <returns>Prompt text describing the brief.</returns>
  public static string Brief(IdeationRequest request)
  {
    var builder = new StringBuilder()
      .Append("<topic>").Append(request.Topic).AppendLine("</topic>");

    if (request.Constraints is { Count: > 0 } constraints)
    {
      builder.AppendLine("<constraints>");
      foreach (var constraint in constraints)
      {
        builder.Append("- ").AppendLine(constraint);
      }

      builder.AppendLine("</constraints>");
    }

    return builder.ToString();
  }

  /// <summary>
  /// Serializes <paramref name="value"/> to indented snake_case JSON for inclusion in a prompt.
  /// </summary>
  /// <typeparam name="T">Type of the value.</typeparam>
  /// <param name="value">The value to serialize.</param>
  /// <returns>The JSON text.</returns>
  public static string Json<T>(T value) => JsonSerializer.Serialize(value, SerializerOptions);

  /// <summary>
  /// Parses a JSON schema literal.
  /// </summary>
  /// <param name="json">The schema as JSON text.</param>
  /// <returns>The parsed schema.</returns>
  public static JsonElement Schema(string json)
  {
    using var document = JsonDocument.Parse(json);
    return document.RootElement.Clone();
  }
}
