namespace Pouspourika.IdeaVerse.Api.Ai;

using System.ComponentModel.DataAnnotations;

using Anthropic;

/// <summary>
/// AI help settings, bound from the <see cref="SectionName"/> configuration section.
/// </summary>
/// <remarks>
/// AI help also needs a Claude API key in <c>ANTHROPIC_API_KEY</c>; without one it reports itself unavailable.
/// The agents' model and effort come from the <c>Ideation</c> section.
/// </remarks>
public sealed class AiOptions
{
  /// <summary>
  /// Configuration section the options bind to.
  /// </summary>
  public const string SectionName = "Ai";

  /// <summary>
  /// Name of the setting holding the Claude API key.
  /// </summary>
  public const string ApiKeySetting = "ANTHROPIC_API_KEY";

  /// <summary>
  /// Gets or sets a value indicating whether AI help is offered.
  /// </summary>
  public bool Enabled { get; set; } = true;

  /// <summary>
  /// Gets or sets how many AI requests each workspace may make per UTC day.
  /// </summary>
  [Range(1, 100_000)]
  public int DailyLimitPerWorkspace { get; set; } = 50;

  /// <summary>
  /// Returns whether configuration holds a Claude API key.
  /// </summary>
  /// <param name="configuration">The application configuration: environment variables, user secrets, or settings files.</param>
  /// <returns><see langword="true"/> when <see cref="ApiKeySetting"/> is set.</returns>
  public static bool HasApiKey(IConfiguration configuration)
  {
    ArgumentNullException.ThrowIfNull(configuration);
    return !string.IsNullOrWhiteSpace(configuration[ApiKeySetting]);
  }

  /// <summary>
  /// Creates the Claude client with the key from configuration, so it uses the same key <see cref="HasApiKey"/> sees.
  /// </summary>
  /// <param name="configuration">The application configuration.</param>
  /// <returns>The client; without a key, one that AI help never calls.</returns>
  public static AnthropicClient CreateClient(IConfiguration configuration)
  {
    ArgumentNullException.ThrowIfNull(configuration);
    return configuration[ApiKeySetting] is { Length: > 0 } key && !string.IsNullOrWhiteSpace(key)
      ? new AnthropicClient { ApiKey = key }
      : new AnthropicClient();
  }
}
