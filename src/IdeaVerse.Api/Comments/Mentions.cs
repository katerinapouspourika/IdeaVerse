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
  /// Writes a comment as plain text, each mention as <c>@Name</c>, for notifications and emails.
  /// </summary>
  /// <param name="body">The comment's text.</param>
  /// <returns>The plain text.</returns>
  public static string ToPlainText(string body)
    => Token().Replace(body, m => $"@{m.Groups["name"].Value}");

  [GeneratedRegex(@"@\[(?<name>[^\]\r\n]{1,100})\]\((?<id>[A-Za-z0-9-]{1,64})\)", RegexOptions.CultureInvariant, matchTimeoutMilliseconds: 1000)]
  private static partial Regex Token();
}
