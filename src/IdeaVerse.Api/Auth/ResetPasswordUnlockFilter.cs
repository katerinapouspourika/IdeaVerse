namespace Pouspourika.IdeaVerse.Api.Auth;

using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.Data;

using Pouspourika.IdeaVerse.Api.Data;

/// <summary>
/// Unlocks an account once its password has been reset, so someone locked out after too many wrong passwords can sign in
/// with the new one straight away.
/// </summary>
/// <remarks>
/// Identity's <c>resetPassword</c> endpoint changes the password but leaves the lockout in place. Proving ownership of the
/// inbox is enough to lift it, as the sign-in page's "reset your password" advice promises.
/// </remarks>
internal sealed class ResetPasswordUnlockFilter : IEndpointFilter
{
  /// <inheritdoc/>
  public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
  {
    ArgumentNullException.ThrowIfNull(context);
    ArgumentNullException.ThrowIfNull(next);

    var result = await next(context).ConfigureAwait(false);
    if (context.Arguments.OfType<ResetPasswordRequest>().FirstOrDefault() is { } request && Succeeded(result))
    {
      var userManager = context.HttpContext.RequestServices.GetRequiredService<UserManager<User>>();
      if (await userManager.FindByEmailAsync(request.Email).ConfigureAwait(false) is { } user)
      {
        await userManager.SetLockoutEndDateAsync(user, null).ConfigureAwait(false);
        await userManager.ResetAccessFailedCountAsync(user).ConfigureAwait(false);
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
