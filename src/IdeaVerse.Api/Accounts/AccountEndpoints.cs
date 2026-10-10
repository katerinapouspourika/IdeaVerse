namespace Pouspourika.IdeaVerse.Api.Accounts;

using System.Security.Claims;

using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

using Pouspourika.IdeaVerse.Api.Auth;
using Pouspourika.IdeaVerse.Api.Data;
using Pouspourika.IdeaVerse.Api.Validation;

/// <summary>
/// The signed-in user's settings under <c>/api/v1/account</c>: time zone and reminders.
/// </summary>
internal static class AccountEndpoints
{
  /// <summary>
  /// Maps the account endpoints. Both require a signed-in user.
  /// </summary>
  /// <param name="endpoints">The route builder.</param>
  /// <returns>The same route builder.</returns>
  public static IEndpointRouteBuilder MapAccountEndpoints(this IEndpointRouteBuilder endpoints)
  {
    var group = endpoints.MapGroup("/api/v1/account").WithTags("Account").RequireAuthorization();

    group.MapGet("/", GetAsync);
    group.MapPut("/", UpdateAsync).WithValidation<UpdateAccountRequest>();
    group.MapPut("/reminders", UpdateRemindersAsync).WithValidation<UpdateRemindersRequest>();

    return endpoints;
  }

  /// <summary>
  /// Gets the signed-in user's settings.
  /// </summary>
  /// <param name="user">The signed-in user.</param>
  /// <param name="context">The database context.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>The settings, or 404 when the account no longer exists.</returns>
  private static async Task<Results<Ok<AccountResponse>, NotFound>> GetAsync(
    ClaimsPrincipal user,
    IdeaVerseDbContext context,
    CancellationToken cancellationToken)
  {
    var userId = user.GetUserId();
    var account = await context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, cancellationToken).ConfigureAwait(false);
    return account is null ? TypedResults.NotFound() : TypedResults.Ok(AccountResponse.From(account));
  }

  /// <summary>
  /// Changes the signed-in user's time zone.
  /// </summary>
  /// <param name="request">The validated request.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="context">The database context.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>The updated settings, or 404 when the account no longer exists.</returns>
  private static async Task<Results<Ok<AccountResponse>, NotFound>> UpdateAsync(
    UpdateAccountRequest request,
    ClaimsPrincipal user,
    IdeaVerseDbContext context,
    CancellationToken cancellationToken)
  {
    var userId = user.GetUserId();
    var account = await context.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken).ConfigureAwait(false);
    if (account is null)
    {
      return TypedResults.NotFound();
    }

    account.TimeZone = request.TimeZone;
    await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    return TypedResults.Ok(AccountResponse.From(account));
  }

  /// <summary>
  /// Chooses which reminders the signed-in user gets and whether they are emailed.
  /// </summary>
  /// <remarks>
  /// Turning emails back on settles the reminders raised while they were off, so only new reminders are emailed.
  /// </remarks>
  /// <param name="request">The validated request.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="context">The database context.</param>
  /// <param name="timeProvider">Clock for settling reminders.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>The updated settings, or 404 when the account no longer exists.</returns>
  private static async Task<Results<Ok<AccountResponse>, NotFound>> UpdateRemindersAsync(
    UpdateRemindersRequest request,
    ClaimsPrincipal user,
    IdeaVerseDbContext context,
    TimeProvider timeProvider,
    CancellationToken cancellationToken)
  {
    var userId = user.GetUserId();
    var account = await context.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken).ConfigureAwait(false);
    if (account is null)
    {
      return TypedResults.NotFound();
    }

    if (request.EmailReminders && !account.EmailReminders)
    {
      var now = timeProvider.GetUtcNow();
      await context.Notifications
        .Where(n => n.UserId == userId && n.EmailedAt == null)
        .ExecuteUpdateAsync(set => set.SetProperty(n => n.EmailedAt, now), cancellationToken)
        .ConfigureAwait(false);
    }

    account.EmailReminders = request.EmailReminders;
    account.MutedReminderKinds = User.MuteAllBut(request.ReminderKinds);
    await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    return TypedResults.Ok(AccountResponse.From(account));
  }
}
