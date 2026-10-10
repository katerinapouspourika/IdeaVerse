namespace Pouspourika.IdeaVerse.Api.Accounts;

using Microsoft.EntityFrameworkCore;

using Pouspourika.IdeaVerse.Api.Data;

/// <summary>
/// Tells what day it is for a user, in their own time zone.
/// </summary>
/// <param name="context">The database context, for the user's time zone.</param>
/// <param name="timeProvider">The clock.</param>
public sealed class UserCalendar(IdeaVerseDbContext context, TimeProvider timeProvider)
{
  /// <summary>
  /// Gets today's date in the user's time zone, or in UTC when they have not chosen one.
  /// </summary>
  /// <param name="userId">The user's identifier.</param>
  /// <param name="cancellationToken">Token to cancel the query.</param>
  /// <returns>The user's local date.</returns>
  public async Task<DateOnly> TodayAsync(string userId, CancellationToken cancellationToken)
  {
    var id = await context.Users
      .Where(u => u.Id == userId)
      .Select(u => u.TimeZone)
      .FirstOrDefaultAsync(cancellationToken)
      .ConfigureAwait(false);
    return timeProvider.TodayIn(TimeZones.Find(id));
  }
}
