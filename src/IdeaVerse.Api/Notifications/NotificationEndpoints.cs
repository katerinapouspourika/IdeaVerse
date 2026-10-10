namespace Pouspourika.IdeaVerse.Api.Notifications;

using System.Security.Claims;

using Microsoft.AspNetCore.Http.HttpResults;

using Pouspourika.IdeaVerse.Api.Auth;

/// <summary>
/// Reminder endpoints under <c>/api/v1/notifications</c>.
/// </summary>
internal static class NotificationEndpoints
{
  /// <summary>
  /// Maps the reminder endpoints. All require a signed-in user and only see that user's reminders.
  /// </summary>
  /// <param name="endpoints">The route builder.</param>
  /// <returns>The same route builder.</returns>
  public static IEndpointRouteBuilder MapNotificationEndpoints(this IEndpointRouteBuilder endpoints)
  {
    var group = endpoints.MapGroup("/api/v1/notifications").WithTags("Notifications").RequireAuthorization();

    group.MapGet("/", ListAsync);
    group.MapPost("/{id:guid}/read", MarkReadAsync);
    group.MapPost("/read-all", MarkAllReadAsync);

    return endpoints;
  }

  /// <summary>
  /// Lists the user's most recent reminders, newest first, with the unread count.
  /// </summary>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The notification service.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>The reminders.</returns>
  private static async Task<Ok<NotificationsResponse>> ListAsync(ClaimsPrincipal user, NotificationService service, CancellationToken cancellationToken)
    => TypedResults.Ok(await service.ListAsync(user.GetUserId(), cancellationToken).ConfigureAwait(false));

  /// <summary>
  /// Marks one reminder read.
  /// </summary>
  /// <param name="id">The reminder identifier.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The notification service.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>204, or 404.</returns>
  private static async Task<Results<NoContent, NotFound>> MarkReadAsync(Guid id, ClaimsPrincipal user, NotificationService service, CancellationToken cancellationToken)
    => await service.MarkReadAsync(user.GetUserId(), id, cancellationToken).ConfigureAwait(false)
      ? TypedResults.NoContent()
      : TypedResults.NotFound();

  /// <summary>
  /// Marks all of the user's reminders read.
  /// </summary>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The notification service.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>204.</returns>
  private static async Task<NoContent> MarkAllReadAsync(ClaimsPrincipal user, NotificationService service, CancellationToken cancellationToken)
  {
    await service.MarkAllReadAsync(user.GetUserId(), cancellationToken).ConfigureAwait(false);
    return TypedResults.NoContent();
  }
}
