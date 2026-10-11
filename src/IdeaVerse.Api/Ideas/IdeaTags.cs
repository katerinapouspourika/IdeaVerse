namespace Pouspourika.IdeaVerse.Api.Ideas;

using System.Diagnostics.CodeAnalysis;

/// <summary>
/// Normalizes and validates the tags submitted for an idea.
/// </summary>
internal static class IdeaTags
{
  /// <summary>
  /// The request member that carries the tags, for validation problems.
  /// </summary>
  public const string MemberName = "Tags";

  /// <summary>
  /// Trims and lower-cases <paramref name="tags"/>, collapsing inner spaces and dropping blanks and duplicates while keeping their order.
  /// The request's <c>MaxLength</c> already caps how many there are.
  /// </summary>
  /// <param name="tags">The submitted tags.</param>
  /// <param name="normalized">The normalized tags, when they are valid.</param>
  /// <param name="error">Why the tags are invalid, when they are.</param>
  /// <returns>Whether the tags are valid.</returns>
  public static bool TryNormalize(IEnumerable<string> tags, out IReadOnlyList<string> normalized, out string? error)
  {
    normalized = [.. tags
      .Where(t => !string.IsNullOrWhiteSpace(t))
      .Select(Normalize)
      .Distinct(StringComparer.Ordinal),
    ];

    error = normalized.Any(t => t.Length > Idea.TagMaxLength)
      ? $"Tags can be at most {Idea.TagMaxLength} characters long."
      : normalized.Any(t => t.Contains(',', StringComparison.Ordinal))
        ? "Tags cannot contain commas."
        : null;
    return error is null;
  }

  /// <summary>
  /// Trims a tag, collapses its inner spaces, and lower-cases it.
  /// </summary>
  /// <param name="tag">A tag as typed.</param>
  /// <returns>The tag as stored.</returns>
  [SuppressMessage("Globalization", "CA1308:Normalize strings to uppercase", Justification = "Tags are shown as stored, and lower case reads better.")]
  public static string Normalize(string tag)
    => string.Join(' ', tag.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)).ToLowerInvariant();
}
