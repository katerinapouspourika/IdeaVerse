namespace Pouspourika.IdeaVerse.Api.Auth;

using System.Text;

using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;

using Pouspourika.IdeaVerse.Api.Data;

/// <summary>
/// Account endpoints under <c>/api/v1/auth</c>.
/// </summary>
internal static class AuthEndpoints
{
  /// <summary>
  /// Maps the Identity endpoints (register, login, password reset, account info) plus logout.
  /// </summary>
  /// <remarks>
  /// The web app signs in with <c>POST /api/v1/auth/login?useCookies=true</c>, which issues an HTTP-only cookie. A
  /// successful password reset also unlocks the account (<see cref="ResetPasswordUnlockFilter"/>), and changing the
  /// password signs out the account's other sessions (<see cref="PasswordChangeSignInFilter"/>). A change of email to
  /// an address another account uses is refused up front (<see cref="EmailChangeFilter"/>). Password reset and
  /// confirmation emails are limited per address (<see cref="AccountEmailThrottleFilter"/>).
  /// </remarks>
  /// <param name="endpoints">The route builder.</param>
  /// <returns>The same route builder.</returns>
  public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder endpoints)
  {
    var group = endpoints.MapGroup("/api/v1/auth").WithTags("Auth");
    group.AddEndpointFilter<PasswordChangeSignInFilter>();
    group.MapGroup(string.Empty).AddEndpointFilter<ResetPasswordUnlockFilter>().MapIdentityApi<User>();
    group.MapPost("/logout", LogoutAsync).RequireAuthorization();
    group.MapPost("/confirm", ConfirmAsync).AllowAnonymous();
    group.AddEndpointFilter<EmailChangeFilter>();
    group.AddEndpointFilter<AccountEmailThrottleFilter>();
    return endpoints;
  }

  /// <summary>
  /// Confirms an email address from a confirmation link and, for a new account, signs it in.
  /// </summary>
  /// <remarks>
  /// Opening the link proves the person owns the inbox, so a new account starts signed in rather than being sent to the
  /// sign-in form. Only the first confirmation signs in: Identity's confirmation codes stay valid for their lifetime, so
  /// opening the link again, or a link for an address already confirmed, confirms nothing and signs no one in. A change
  /// of address is confirmed without signing in, since the person already has a session where they asked for it; that
  /// session, if it is the one confirming, is kept signed in, while the account's other sessions are signed out.
  /// The old address is then told of the change, so its owner notices one they did not make.
  /// </remarks>
  /// <param name="request">The values from the link.</param>
  /// <param name="userManager">The user manager.</param>
  /// <param name="signInManager">The sign-in manager.</param>
  /// <param name="emailSender">Tells the old address about a change of address.</param>
  /// <returns>Whether the user is now signed in, or 401 when the link is not valid.</returns>
  private static async Task<Results<Ok<ConfirmEmailResponse>, UnauthorizedHttpResult>> ConfirmAsync(
    ConfirmEmailRequest request,
    UserManager<User> userManager,
    SignInManager<User> signInManager,
    IdentityEmailSender emailSender)
  {
    var user = await userManager.FindByIdAsync(request.UserId).ConfigureAwait(false);
    var code = Decode(request.Code);
    if (user is null || code is null)
    {
      return TypedResults.Unauthorized();
    }

    if (request.ChangedEmail is { } changed)
    {
      var previous = user.Email;
      if (!await ChangeEmailAsync(userManager, user, changed, code).ConfigureAwait(false))
      {
        return TypedResults.Unauthorized();
      }

      // The change renews the security stamp, which signs out every session; the one confirming stays signed in.
      if (userManager.GetUserId(signInManager.Context.User) == user.Id)
      {
        await signInManager.RefreshSignInAsync(user).ConfigureAwait(false);
      }

      if (previous is not null)
      {
        await emailSender.SendEmailChangedAsync(previous, changed).ConfigureAwait(false);
      }

      return TypedResults.Ok(new ConfirmEmailResponse(SignedIn: false));
    }

    if (user.EmailConfirmed)
    {
      return TypedResults.Ok(new ConfirmEmailResponse(SignedIn: false));
    }

    var confirmed = await userManager.ConfirmEmailAsync(user, code).ConfigureAwait(false);
    if (!confirmed.Succeeded)
    {
      return TypedResults.Unauthorized();
    }

    await signInManager.SignInAsync(user, isPersistent: true).ConfigureAwait(false);
    return TypedResults.Ok(new ConfirmEmailResponse(SignedIn: true));
  }

  /// <summary>
  /// Changes the account's email, and with it the sign-in name, as Identity's own confirmation endpoint does.
  /// </summary>
  /// <param name="userManager">The user manager.</param>
  /// <param name="user">The account.</param>
  /// <param name="email">The new address.</param>
  /// <param name="code">The decoded change-of-email code.</param>
  /// <returns>Whether the change was made.</returns>
  private static async Task<bool> ChangeEmailAsync(UserManager<User> userManager, User user, string email, string code)
  {
    var changed = await userManager.ChangeEmailAsync(user, email, code).ConfigureAwait(false);
    return changed.Succeeded && (await userManager.SetUserNameAsync(user, email).ConfigureAwait(false)).Succeeded;
  }

  /// <summary>
  /// Decodes a code from a link, which Identity Base64Url-encodes.
  /// </summary>
  /// <param name="code">The code as it appears in the link.</param>
  /// <returns>The code, or <see langword="null"/> when it is not valid Base64Url.</returns>
  private static string? Decode(string code)
  {
    try
    {
      return Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(code));
    }
    catch (FormatException)
    {
      return null;
    }
  }

  /// <summary>
  /// Signs the user out by clearing the authentication cookie.
  /// </summary>
  /// <param name="signInManager">The sign-in manager.</param>
  /// <returns>An empty response.</returns>
  private static async Task<NoContent> LogoutAsync(SignInManager<User> signInManager)
  {
    await signInManager.SignOutAsync().ConfigureAwait(false);
    return TypedResults.NoContent();
  }
}
