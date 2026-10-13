namespace Pouspourika.IdeaVerse.Api.Accounts;

/// <summary>
/// Resolves users' time zones and their local calendar.
/// </summary>
internal static class TimeZones
{
  /// <summary>
  /// Finds a time zone by IANA identifier.
  /// </summary>
  /// <param name="id">The identifier, or <see langword="null"/> when the user has not chosen one.</param>
  /// <returns>The time zone, or UTC when <paramref name="id"/> is missing or unknown.</returns>
  public static TimeZoneInfo Find(string? id)
    => id is not null && TimeZoneInfo.TryFindSystemTimeZoneById(id, out var zone) ? zone : TimeZoneInfo.Utc;

  /// <summary>
  /// Returns whether <paramref name="id"/> names a time zone this server knows by its IANA identifier.
  /// </summary>
  /// <param name="id">The identifier to check.</param>
  /// <returns><see langword="true"/> for identifiers such as <c>Europe/Athens</c> or <c>UTC</c>; <see langword="false"/> for Windows names such as <c>GTB Standard Time</c>.</returns>
  public static bool IsKnownIanaId(string id)
    => IanaName(id) is not null;

  /// <summary>
  /// Returns the IANA identifier <paramref name="id"/> names, spelled as the time zone database spells it.
  /// </summary>
  /// <param name="id">The identifier, in any case, such as <c>utc</c> or <c>europe/athens</c>.</param>
  /// <returns>The identifier, such as <c>UTC</c> or <c>Europe/Athens</c>; <see langword="null"/> for an unknown zone or a Windows name.</returns>
  public static string? IanaName(string id)
  {
    if (string.Equals(id, TimeZoneInfo.Utc.Id, StringComparison.OrdinalIgnoreCase))
    {
      return TimeZoneInfo.Utc.Id;
    }

    if (TimeZoneInfo.TryFindSystemTimeZoneById(id, out var zone) && zone.HasIanaId)
    {
      return zone.Id;
    }

    return TimeZoneInfo.GetSystemTimeZones()
      .FirstOrDefault(z => z.HasIanaId && string.Equals(z.Id, id, StringComparison.OrdinalIgnoreCase))?.Id;
  }

  /// <summary>
  /// Gets the current local time in a time zone.
  /// </summary>
  /// <param name="timeProvider">The clock.</param>
  /// <param name="zone">The time zone.</param>
  /// <returns>The local date and time.</returns>
  public static DateTime LocalNow(this TimeProvider timeProvider, TimeZoneInfo zone)
    => TimeZoneInfo.ConvertTime(timeProvider.GetUtcNow(), zone).DateTime;

  /// <summary>
  /// Gets today's date in a time zone.
  /// </summary>
  /// <param name="timeProvider">The clock.</param>
  /// <param name="zone">The time zone.</param>
  /// <returns>The local date.</returns>
  public static DateOnly TodayIn(this TimeProvider timeProvider, TimeZoneInfo zone)
    => DateOnly.FromDateTime(timeProvider.LocalNow(zone));
}
