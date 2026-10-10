namespace Pouspourika.IdeaVerse.Api.Accounts;

using System.Diagnostics;
using System.Security.Claims;
using System.Text.Json;

using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

using Pouspourika.IdeaVerse.Api.Auth;
using Pouspourika.IdeaVerse.Api.Data;
using Pouspourika.IdeaVerse.Api.Validation;

/// <summary>
/// The signed-in user's account under <c>/api/v1/account</c>: display name, time zone, reminders, and deleting it.
/// Password and email changes use Identity's <c>/api/v1/auth/manage/info</c>.
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
    group.MapPut("/profile", UpdateProfileAsync).WithValidation<UpdateProfileRequest>();
    group.MapPost("/delete", DeleteAsync).WithValidation<DeleteAccountRequest>();

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

  /// <summary>
  /// Changes the signed-in user's display name.
  /// </summary>
  /// <param name="request">The validated request.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="context">The database context.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>The updated account, or 404 when it no longer exists.</returns>
  private static async Task<Results<Ok<AccountResponse>, NotFound>> UpdateProfileAsync(
    UpdateProfileRequest request,
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

    account.DisplayName = string.IsNullOrWhiteSpace(request.DisplayName) ? null : request.DisplayName.Trim();
    await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    return TypedResults.Ok(AccountResponse.From(account));
  }

  /// <summary>
  /// Deletes the signed-in user's account and signs them out.
  /// </summary>
  /// <param name="request">The validated request.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The account service.</param>
  /// <param name="signInManager">Signs the user out once the account is gone.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>204, 400 for a wrong password, or 409 while the user owns a workspace others use.</returns>
  private static async Task<Results<NoContent, NotFound, ValidationProblem, ProblemHttpResult>> DeleteAsync(
    DeleteAccountRequest request,
    ClaimsPrincipal user,
    AccountService service,
    SignInManager<User> signInManager,
    CancellationToken cancellationToken)
  {
    var result = await service.DeleteAsync(user.GetUserId(), request, cancellationToken).ConfigureAwait(false);
    if (result.Outcome == ChangeOutcome.Changed)
    {
      await signInManager.SignOutAsync().ConfigureAwait(false);
    }

    return result.Outcome switch
    {
      ChangeOutcome.Changed => TypedResults.NoContent(),
      ChangeOutcome.NotFound => TypedResults.NotFound(),
      ChangeOutcome.Invalid => TypedResults.ValidationProblem(new Dictionary<string, string[]>(StringComparer.Ordinal)
      {
        [JsonNamingPolicy.CamelCase.ConvertName(result.Field!)] = [result.Message!],
      }),
      ChangeOutcome.Conflict => TypedResults.Problem(detail: result.Message, statusCode: StatusCodes.Status409Conflict),
      ChangeOutcome.Forbidden or _ => throw new UnreachableException($"Unhandled outcome {result.Outcome}."),
    };
  }
}
