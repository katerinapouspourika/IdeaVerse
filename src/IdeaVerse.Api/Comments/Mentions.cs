namespace Pouspourika.IdeaVerse.Api.Comments;

using System.Text.RegularExpressions;

/// <summary>
/// Reads the mentions in a comment. The web app writes a mention as <c>@[Name](userId)</c>, which keeps the name people
/// saw when they wrote it and the account it points to.
/// </summary>
public static partial class Mentions
{
  /// <summary>
  /// Gets the distinct accounts a comment mentions, in the order they first appear.
  /// </summary>
  /// <param name="body">The comment's text.</param>
  /// <returns>The mentioned user identifiers.</returns>
  public static IReadOnlyList<string> UserIds(string body)
    => [.. Token().Matches(body).Select(m => m.Groups["id"].Value).Distinct(StringComparer.Ordinal)];

  /// <summary>
  /// Rewrites each mention to name its account as the workspace knows it, so the name can't be made up, and turns a mention
  /// of anyone not in <paramref name="labels"/> into plain <c>@Name</c> text.
  /// </summary>
  /// <param name="body">The comment's text.</param>
  /// <param name="labels">How each person in the workspace is named, by user identifier (see <see cref="Labels"/>).</param>
  /// <returns>The comment with its mentions rewritten.</returns>
  public static string Canonicalize(string body, IReadOnlyDictionary<string, string> labels)
  {
    ArgumentNullException.ThrowIfNull(labels);
    return Token().Replace(body, m => labels.TryGetValue(m.Groups["id"].Value, out var label)
      ? $"@[{label}]({m.Groups["id"].Value})"
      : $"@{m.Groups["name"].Value}");
  }

  /// <summary>
  /// Names the people in a workspace as mentions show them: their display name, or their email when they have none, and
  /// the name followed by the email when two people share a name. The web app names people the same way.
  /// </summary>
  /// <param name="people">Each person's identifier, display name, and email.</param>
  /// <returns>Each person's name for mentions, by user identifier.</returns>
  public static IReadOnlyDictionary<string, string> Labels(IEnumerable<(string UserId, string? DisplayName, string Email)> people)
  {
    var all = people.ToList();
    var shared = all
      .GroupBy(p => p.DisplayName ?? p.Email, StringComparer.OrdinalIgnoreCase)
      .Where(g => g.Count() > 1)
      .Select(g => g.Key)
      .ToHashSet(StringComparer.OrdinalIgnoreCase);
    return all.ToDictionary(
      p => p.UserId,
      p => Clean(p.DisplayName is { } name && shared.Contains(name) ? $"{name} ({p.Email})" : p.DisplayName ?? p.Email),
      StringComparer.Ordinal);
  }

  /// <summary>
  /// Writes a comment as plain text, each mention as <c>@Name</c>, for notifications and emails.
  /// </summary>
  /// <param name="body">The comment's text.</param>
  /// <returns>The plain text.</returns>
  public static string ToPlainText(string body)
    => Token().Replace(body, m => $"@{m.Groups["name"].Value}");

  /// <summary>
  /// Fits a name into a mention: no brackets or line breaks, at most 100 characters.
  /// </summary>
  /// <param name="name">The name.</param>
  /// <returns>The name as a mention can hold it.</returns>
  private static string Clean(string name)
  {
    var cleaned = string.Join(' ', name.Split(['[', ']', '\r', '\n'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
    return cleaned.Length <= 100 ? cleaned : cleaned[..100].TrimEnd();
  }

  /// <summary>
  /// Matches one mention, <c>@[Name](userId)</c>: a name of 1 to 100 characters without brackets or line breaks, and an
  /// identifier of 1 to 64 letters, digits, or dashes. Both are bounded, and the match times out, so a long comment can't
  /// make it slow.
  /// </summary>
  /// <returns>The expression.</returns>
  [GeneratedRegex(@"@\[(?<name>[^\]\r\n]{1,100})\]\((?<id>[A-Za-z0-9-]{1,64})\)", RegexOptions.CultureInvariant, matchTimeoutMilliseconds: 1000)]
  private static partial Regex Token();
}
