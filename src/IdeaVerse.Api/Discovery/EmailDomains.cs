namespace Pouspourika.IdeaVerse.Api.Discovery;

using System.Diagnostics.CodeAnalysis;

/// <summary>
/// Email domains: which company an address belongs to, and which domains are shared by everyone.
/// </summary>
public static class EmailDomains
{
  /// <summary>
  /// Domains of free email providers, which belong to no one company, so no workspace may claim them.
  /// </summary>
  private static readonly HashSet<string> Public = new(StringComparer.OrdinalIgnoreCase)
  {
    "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "msn.com", "yahoo.com", "ymail.com",
    "icloud.com", "me.com", "mac.com", "aol.com", "proton.me", "protonmail.com", "gmx.com", "gmx.net", "mail.com",
    "yandex.com", "zoho.com", "fastmail.com", "hey.com", "tutanota.com", "qq.com", "163.com",
  };

  /// <summary>
  /// The domain of an email address, lower-cased.
  /// </summary>
  /// <param name="email">The address.</param>
  /// <returns>The part after the last <c>@</c>, or <see langword="null"/> when there is none.</returns>
  [SuppressMessage("Globalization", "CA1308:Normalize strings to uppercase", Justification = "Domains are shown as stored, and are written in lower case.")]
  public static string? Of(string? email)
  {
    var at = email?.LastIndexOf('@') ?? -1;
    return at < 0 || at == email!.Length - 1 ? null : email[(at + 1)..].Trim().ToLowerInvariant();
  }

  /// <summary>
  /// Whether a domain belongs to a free email provider rather than a company.
  /// </summary>
  /// <param name="domain">The domain.</param>
  /// <returns><see langword="true"/> for a public provider's domain.</returns>
  public static bool IsPublic(string domain) => Public.Contains(domain);

  /// <summary>
  /// The company domain of an email address: its domain, unless that is a public provider's.
  /// </summary>
  /// <param name="email">The address.</param>
  /// <returns>The company domain, or <see langword="null"/>.</returns>
  public static string? CompanyOf(string? email) => Of(email) is { } domain && !IsPublic(domain) ? domain : null;
}
