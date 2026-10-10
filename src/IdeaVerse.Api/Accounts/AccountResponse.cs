namespace Pouspourika.IdeaVerse.Api.Accounts;

/// <summary>
/// The signed-in user's account settings.
/// </summary>
/// <param name="Email">The account's email address.</param>
/// <param name="TimeZone">The IANA time zone, or <see langword="null"/> until chosen, when UTC applies.</param>
public sealed record AccountResponse(string Email, string? TimeZone);
