namespace Pouspourika.IdeaVerse.Api.Notifications;

/// <summary>
/// Decides when people are reminded that an idea is about to start, and when they are nudged to add its components.
/// </summary>
/// <remarks>
/// The reminders depend on the notice a person had: the time between when they learned of the start (it was set, or they
/// joined the team) and the start itself.
/// <list type="bullet">
/// <item>More than 2 days: 10, 5, and 2 days before, skipping those already past.</item>
/// <item>24 to 48 hours: 24 hours and 2 hours before.</item>
/// <item>2 to 24 hours: 1 hour before.</item>
/// <item>15 minutes to 2 hours: 15 minutes before.</item>
/// <item>Less: none.</item>
/// </list>
/// A reminder is only sent strictly after the person learned of the start, so with exactly 24 hours' notice only the
/// 2-hour reminder is left, and with exactly 15 minutes none is.
/// </remarks>
public static class StartSchedule
{
  /// <summary>
  /// The local time a start without a time of day begins, and the time a long-range nudge to add components goes out.
  /// </summary>
  public static readonly TimeOnly DefaultTime = new(9, 0);

  /// <summary>
  /// How far before the start the first reminder goes out, at most.
  /// </summary>
  public static readonly TimeSpan Window = TimeSpan.FromDays(10);

  private static readonly TimeSpan[] DayLeads = [TimeSpan.FromDays(10), TimeSpan.FromDays(5), TimeSpan.FromDays(2)];
  private static readonly TimeSpan[] HourLeads = [TimeSpan.FromHours(24), TimeSpan.FromHours(2)];

  /// <summary>
  /// Returns how long before the start each reminder goes out, earliest first, for the notice a person had.
  /// </summary>
  /// <param name="notice">The time between when the person learned of the start and the start.</param>
  /// <returns>The reminders' lead times, longest first; empty when the notice is too short for any.</returns>
  public static IReadOnlyList<TimeSpan> Leads(TimeSpan notice)
  {
    if (notice > TimeSpan.FromDays(2))
    {
      return [.. DayLeads.Where(lead => lead < notice)];
    }

    if (notice >= TimeSpan.FromHours(24))
    {
      return [.. HourLeads.Where(lead => lead < notice)];
    }

    if (notice >= TimeSpan.FromHours(2))
    {
      return [TimeSpan.FromHours(1)];
    }

    return notice > TimeSpan.FromMinutes(15) ? [TimeSpan.FromMinutes(15)] : [];
  }

  /// <summary>
  /// Returns the latest reminder due by <paramref name="now"/>, if any: the moment it was due.
  /// </summary>
  /// <remarks>
  /// Only the latest is returned, so a missed run sends the most relevant reminder instead of several stale ones.
  /// </remarks>
  /// <param name="startsAt">When the idea starts.</param>
  /// <param name="noticeFrom">When the person learned of the start.</param>
  /// <param name="now">The current time.</param>
  /// <returns>When the due reminder was due, or <see langword="null"/> when none is due or the idea has started.</returns>
  public static DateTimeOffset? DueReminder(DateTimeOffset startsAt, DateTimeOffset noticeFrom, DateTimeOffset now)
  {
    if (now >= startsAt)
    {
      return null;
    }

    return Leads(startsAt - noticeFrom)
      .Select(lead => (DateTimeOffset?)(startsAt - lead))
      .LastOrDefault(at => at <= now);
  }

  /// <summary>
  /// Returns when to nudge a person to add components: halfway between their first reminder and the start, moved to
  /// <see cref="DefaultTime"/> in their time zone that day when the two are at least 2 days apart.
  /// </summary>
  /// <param name="startsAt">When the idea starts.</param>
  /// <param name="noticeFrom">When the person learned of the start.</param>
  /// <param name="zone">The person's time zone.</param>
  /// <returns>When to nudge, or <see langword="null"/> when they get no reminders at all.</returns>
  public static DateTimeOffset? NudgeAt(DateTimeOffset startsAt, DateTimeOffset noticeFrom, TimeZoneInfo zone)
  {
    ArgumentNullException.ThrowIfNull(zone);
    var leads = Leads(startsAt - noticeFrom);
    if (leads.Count == 0)
    {
      return null;
    }

    var span = leads[0];
    var halfway = startsAt - (span / 2);
    if (span < TimeSpan.FromDays(2))
    {
      return halfway;
    }

    var day = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(halfway, zone).DateTime);
    return ToInstant(day, DefaultTime, zone);
  }

  /// <summary>
  /// Converts a local date and time in a time zone to an instant.
  /// </summary>
  /// <param name="date">The local date.</param>
  /// <param name="time">The local time.</param>
  /// <param name="zone">The time zone.</param>
  /// <returns>The instant, in UTC, as PostgreSQL stores it.</returns>
  public static DateTimeOffset ToInstant(DateOnly date, TimeOnly time, TimeZoneInfo zone)
  {
    ArgumentNullException.ThrowIfNull(zone);
    var local = date.ToDateTime(time, DateTimeKind.Unspecified);
    if (zone.IsInvalidTime(local))
    {
      local = local.AddHours(1);
    }

    return new DateTimeOffset(local, zone.GetUtcOffset(local)).ToUniversalTime();
  }
}
