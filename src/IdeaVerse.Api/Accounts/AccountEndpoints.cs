namespace Pouspourika.IdeaVerse.Api.Accounts;

using System.Security.Claims;

using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

using Pouspourika.IdeaVerse.Api.Auth;
using Pouspourika.IdeaVerse.Api.Data;
using Pouspourika.IdeaVerse.Api.Validation;

/// <summary>
/// The signed-in user's settings under <c>/api/v1/account</c>.
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
    var account = await context.Users
      .Where(u => u.Id == userId)
      .Select(u => new AccountResponse(u.Email!, u.TimeZone))
      .FirstOrDefaultAsync(cancellationToken)
      .ConfigureAwait(false);
    return account is null ? TypedResults.NotFound() : TypedResults.Ok(account);
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
    return TypedResults.Ok(new AccountResponse(account.Email!, account.TimeZone));
  }
}
