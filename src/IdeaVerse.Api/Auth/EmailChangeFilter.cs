namespace Pouspourika.IdeaVerse.Api.Auth;

using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.Data;

using Pouspourika.IdeaVerse.Api.Data;

/// <summary>
/// Refuses a change of email to an address another account already uses, before Identity's <c>manage/info</c> endpoint
/// sends that address a confirmation link that could never work.
/// </summary>
internal sealed class EmailChangeFilter : IEndpointFilter
{
  /// <summary>
  /// Why the new address was refused.
  /// </summary>
  public const string TakenMessage = "Another account already uses this email.";

  /// <inheritdoc/>
  public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
  {
    ArgumentNullException.ThrowIfNull(context);
    ArgumentNullException.ThrowIfNull(next);

    if (context.Arguments.OfType<InfoRequest>().FirstOrDefault() is { NewEmail: { Length: > 0 } newEmail })
    {
      var userManager = context.HttpContext.RequestServices.GetRequiredService<UserManager<User>>();
      var owner = await userManager.FindByEmailAsync(newEmail).ConfigureAwait(false);
      if (owner is not null && owner.Id != userManager.GetUserId(context.HttpContext.User))
      {
        return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["newEmail"] = [TakenMessage] });
      }
    }

    return await next(context).ConfigureAwait(false);
  }
}
