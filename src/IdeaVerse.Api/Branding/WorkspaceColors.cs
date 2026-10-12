namespace Pouspourika.IdeaVerse.Api.Branding;

/// <summary>
/// The colours a workspace can pick, from a preset palette so text on them stays readable in light and dark mode. The web
/// app maps each name to its shades.
/// </summary>
public static class WorkspaceColors
{
  /// <summary>
  /// Gets the colour names a workspace may use.
  /// </summary>
  public static IReadOnlyList<string> All { get; } = ["indigo", "blue", "teal", "green", "amber", "orange", "rose", "violet", "slate"];

  /// <summary>
  /// Whether a name is one of the palette's colours.
  /// </summary>
  /// <param name="color">The name.</param>
  /// <returns><see langword="true"/> for a palette colour.</returns>
  public static bool IsValid(string color) => All.Contains(color, StringComparer.Ordinal);
}
