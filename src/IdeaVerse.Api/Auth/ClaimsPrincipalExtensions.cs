namespace Pouspourika.IdeaVerse.Api.Auth;

using System.Security.Claims;

/// <summary>
/// Helpers for reading the signed-in user.
/// </summary>
internal static class ClaimsPrincipalExtensions
{
  /// <summary>
  /// Gets the signed-in user's identifier.
  /// </summary>
  /// <param name="principal">The authenticated principal.</param>
  /// <returns>The user identifier.</returns>
  /// <exception cref="InvalidOperationException">The principal has no user identifier; the endpoint is missing authorization.</exception>
  public static string GetUserId(this ClaimsPrincipal principal)
    => principal.FindFirstValue(ClaimTypes.NameIdentifier)
      ?? throw new InvalidOperationException("The request has no authenticated user.");
}
