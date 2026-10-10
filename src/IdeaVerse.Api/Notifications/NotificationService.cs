namespace Pouspourika.IdeaVerse.Api.Notifications;

using Microsoft.EntityFrameworkCore;

using Pouspourika.IdeaVerse.Api.Data;
using Pouspourika.IdeaVerse.Api.Ideas;

/// <summary>
/// Reads and marks the signed-in user's reminders.
/// </summary>
/// <remarks>
/// Only reminders about ideas the user can still access are visible, so leaving or being removed from an idea hides its reminders.
/// </remarks>
/// <param name="context">The database context.</param>
/// <param name="timeProvider">Clock for read times and message wording.</param>
public sealed class NotificationService(IdeaVerseDbContext context, TimeProvider timeProvider)
{
  /// <summary>
  /// How many reminders a list returns.
  /// </summary>
  public const int PageSize = 50;

  /// <summary>
  /// Lists the user's most recent reminders, newest first and most urgent first within a run, and counts the unread ones.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="cancellationToken">Token to cancel the query.</param>
  /// <returns>The reminders and unread count.</returns>
  public async Task<NotificationsResponse> ListAsync(string userId, CancellationToken cancellationToken)
  {
    var visible = Visible(userId);
    var unread = await visible.CountAsync(n => n.ReadAt == null, cancellationToken).ConfigureAwait(false);
    var rows = await visible
      .OrderByDescending(n => n.CreatedAt)
      .ThenBy(n => n.TargetDate)
      .ThenBy(n => n.Id)
      .Take(PageSize)
      .Select(n => new { n.Id, n.IdeaId, n.Idea!.Title, n.Kind, n.TargetDate, n.CreatedAt, n.ReadAt })
      .ToListAsync(cancellationToken)
      .ConfigureAwait(false);

    var today = timeProvider.Today();
    var items = rows
      .Select(n => new NotificationResponse(n.Id, n.IdeaId, n.Title, n.Kind, n.TargetDate, ReminderSchedule.Message(n.Kind, n.Title, n.TargetDate, today), n.CreatedAt, n.ReadAt))
      .ToList();
    return new NotificationsResponse(items, unread);
  }

  /// <summary>
  /// Marks one of the user's reminders read.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="id">The reminder identifier.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns><see langword="true"/> when the reminder exists and is visible to the user.</returns>
  public async Task<bool> MarkReadAsync(string userId, Guid id, CancellationToken cancellationToken)
  {
    var notification = await Visible(userId).FirstOrDefaultAsync(n => n.Id == id, cancellationToken).ConfigureAwait(false);
    if (notification is null)
    {
      return false;
    }

    notification.ReadAt ??= timeProvider.GetUtcNow();
    await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    return true;
  }

  /// <summary>
  /// Marks all of the user's unread reminders read.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>A task that completes when the reminders are marked.</returns>
  public Task MarkAllReadAsync(string userId, CancellationToken cancellationToken)
  {
    var now = timeProvider.GetUtcNow();
    return Visible(userId)
      .Where(n => n.ReadAt == null)
      .ExecuteUpdateAsync(set => set.SetProperty(n => n.ReadAt, now), cancellationToken);
  }

  /// <summary>
  /// Queries the user's reminders about ideas they can still access.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <returns>The visible reminders.</returns>
  private IQueryable<Notification> Visible(string userId)
    => context.Notifications.Where(n => n.UserId == userId && context.AccessibleIdeas(userId).Any(i => i.Id == n.IdeaId));
}
