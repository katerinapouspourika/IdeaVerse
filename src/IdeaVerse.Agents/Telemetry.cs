namespace Pouspourika.IdeaVerse.Agents;

using System.Diagnostics;

/// <summary>
/// Tracing primitives for the ideation agents.
/// </summary>
internal static class Telemetry
{
  /// <summary>
  /// Name shared by the activity source.
  /// </summary>
  public const string Name = "Pouspourika.IdeaVerse.Agents";

  /// <summary>
  /// Activity source for agent operations.
  /// </summary>
  public static readonly ActivitySource Source = new(Name);
}
