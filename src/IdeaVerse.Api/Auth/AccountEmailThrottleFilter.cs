namespace Pouspourika.IdeaVerse.Api.Auth;

using Microsoft.AspNetCore.Identity.Data;

using Pouspourika.IdeaVerse.Api.Email;

/// <summary>
/// Limits Identity's <c>forgotPassword</c> and <c>resendConfirmationEmail</c> endpoints to
/// <see cref="EmailsPerHour"/> emails an hour for each address, so they cannot be used to flood someone's inbox.
/// </summary>
/// <remarks>
/// A request over the limit gets the same empty 200 as any other, so the response still says nothing about whether the
/// account exists; it just sends nothing.
/// </remarks>
internal sealed class AccountEmailThrottleFilter : IEndpointFilter
{
  /// <summary>
  /// How many password reset, or confirmation, emails one address can get in an hour.
  /// </summary>
  public const int EmailsPerHour = 3;

  /// <inheritdoc/>
  public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
  {
    ArgumentNullException.ThrowIfNull(context);
    ArgumentNullException.ThrowIfNull(next);

    var key = context.Arguments.FirstOrDefault() switch
    {
      ForgotPasswordRequest request => $"forgotPassword:{request.Email.ToUpperInvariant()}",
      ResendConfirmationEmailRequest request => $"resendConfirmationEmail:{request.Email.ToUpperInvariant()}",
      _ => null,
    };
    var throttle = context.HttpContext.RequestServices.GetRequiredService<EmailThrottle>();
    if (key is not null && !throttle.TryAcquire(key, EmailsPerHour, TimeSpan.FromHours(1)))
    {
      return TypedResults.Ok();
    }

    return await next(context).ConfigureAwait(false);
  }
}
