namespace Pouspourika.IdeaVerse.Api.Ai;

using System.ComponentModel.DataAnnotations;

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
}
