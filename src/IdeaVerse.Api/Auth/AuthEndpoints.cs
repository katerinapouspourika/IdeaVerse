namespace Pouspourika.IdeaVerse.Api.Auth;

using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;

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
  /// The web app signs in with <c>POST /api/v1/auth/login?useCookies=true</c>, which issues an HTTP-only cookie.
  /// </remarks>
  /// <param name="endpoints">The route builder.</param>
  /// <returns>The same route builder.</returns>
  public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder endpoints)
  {
    var group = endpoints.MapGroup("/api/v1/auth").WithTags("Auth");
    group.MapIdentityApi<User>();
    group.MapPost("/logout", LogoutAsync).RequireAuthorization();
    return endpoints;
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
