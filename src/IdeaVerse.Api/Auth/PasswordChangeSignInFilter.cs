namespace Pouspourika.IdeaVerse.Api.Auth;

using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.Data;

using Pouspourika.IdeaVerse.Api.Data;

/// <summary>
/// Keeps the session that changed the password signed in, while every other session of the account is signed out.
/// </summary>
/// <remarks>
/// Changing the password through Identity's <c>manage/info</c> endpoint renews the account's security stamp, so within
/// <see cref="SecurityStampValidatorOptions.ValidationInterval"/> every session cookie issued before is refused. This
/// filter reissues the caller's own cookie with the new stamp.
/// </remarks>
internal sealed class PasswordChangeSignInFilter : IEndpointFilter
{
  /// <inheritdoc/>
  public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
  {
    ArgumentNullException.ThrowIfNull(context);
    ArgumentNullException.ThrowIfNull(next);

    var result = await next(context).ConfigureAwait(false);
    if (context.Arguments.OfType<InfoRequest>().FirstOrDefault() is { NewPassword.Length: > 0 } && Succeeded(result))
    {
      var services = context.HttpContext.RequestServices;
      var userManager = services.GetRequiredService<UserManager<User>>();
      if (await userManager.GetUserAsync(context.HttpContext.User).ConfigureAwait(false) is { } user)
      {
        await services.GetRequiredService<SignInManager<User>>().RefreshSignInAsync(user).ConfigureAwait(false);
      }
    }

    return result;
  }

  private static bool Succeeded(object? result) => result switch
  {
    INestedHttpResult nested => Succeeded(nested.Result),
    IStatusCodeHttpResult { StatusCode: StatusCodes.Status200OK } => true,
    _ => false,
  };
}
