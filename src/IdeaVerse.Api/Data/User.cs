namespace Pouspourika.IdeaVerse.Api.Data;

using Microsoft.AspNetCore.Identity;

/// <summary>
/// An IdeaVerse account.
/// </summary>
/// <remarks>
/// A dedicated type, rather than <see cref="IdentityUser"/> directly, so profile fields can be added without changing every Identity registration.
/// </remarks>
public sealed class User : IdentityUser
{
  /// <summary>
  /// Maximum length of <see cref="TimeZone"/>.
  /// </summary>
  public const int TimeZoneMaxLength = 64;

  /// <summary>
  /// Gets or sets the IANA time zone, such as <c>Europe/Athens</c>, that decides the user's "today" and when their reminders arrive.
  /// </summary>
  /// <remarks>
  /// <see langword="null"/> until chosen; the web app then sets it from the browser. Until then UTC applies.
  /// </remarks>
  public string? TimeZone { get; set; }
}
