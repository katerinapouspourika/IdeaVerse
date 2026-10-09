namespace Pouspourika.IdeaVerse.Agents;

using System.ComponentModel.DataAnnotations;

/// <summary>
/// Configuration for the ideation agents, bound from the <see cref="SectionName"/> configuration section.
/// </summary>
public sealed class IdeationOptions
{
  /// <summary>
  /// Configuration section the options bind to.
  /// </summary>
  public const string SectionName = "Ideation";

  /// <summary>
  /// Gets or sets the Claude model used by every agent.
  /// </summary>
  [Required]
  public string Model { get; set; } = "claude-opus-5-5";

  /// <summary>
  /// Gets or sets the effort level (<c>low</c>, <c>medium</c>, <c>high</c>, <c>xhigh</c>, <c>max</c>).
  /// </summary>
  [Required]
  [AllowedValues("low", "medium", "high", "xhigh", "max")]
  public string Effort { get; set; } = "high";

  /// <summary>
  /// Gets or sets the maximum number of output tokens per agent call.
  /// </summary>
  [Range(1024, 64000)]
  public int MaxTokens { get; set; } = 16000;

  /// <summary>
  /// Gets or sets how many ideas the generator produces per run.
  /// </summary>
  [Range(1, 20)]
  public int IdeaCount { get; set; } = 6;

  /// <summary>
  /// Gets or sets how many of the top-scoring ideas the refiner expands.
  /// </summary>
  [Range(0, 20)]
  public int IdeasToRefine { get; set; } = 2;

  /// <summary>
  /// Gets or sets a value indicating whether a policy refusal is retried server-side on a fallback model.
  /// </summary>
  public bool EnableRefusalFallback { get; set; } = true;
}
