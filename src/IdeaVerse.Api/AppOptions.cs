namespace Pouspourika.IdeaVerse.Api;

using System.ComponentModel.DataAnnotations;

/// <summary>
/// Application-wide settings, bound from the <see cref="SectionName"/> configuration section.
/// </summary>
public sealed class AppOptions
{
  /// <summary>
  /// Configuration section the options bind to.
  /// </summary>
  public const string SectionName = "App";

  /// <summary>
  /// Gets or sets the web app's public address, used for links in emails.
  /// </summary>
  [Required]
  public Uri PublicUrl { get; set; } = new("http://localhost:8080");

  /// <summary>
  /// Builds an absolute link to a web app page.
  /// </summary>
  /// <param name="pathAndQuery">The page's path, starting with <c>/</c>, and optional query string.</param>
  /// <returns>The absolute link.</returns>
  public string Link(string pathAndQuery) => $"{PublicUrl.ToString().TrimEnd('/')}{pathAndQuery}";
}
