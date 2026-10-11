namespace Pouspourika.IdeaVerse.Api.Contact;

using System.Threading.RateLimiting;

using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Options;

using Pouspourika.IdeaVerse.Api.Email;
using Pouspourika.IdeaVerse.Api.Validation;

/// <summary>
/// The public contact form under <c>/api/v1/contact</c>.
/// </summary>
internal static class ContactEndpoints
{
  /// <summary>
  /// Name of the rate limiting policy that caps how often one address may send a message.
  /// </summary>
  public const string RateLimitPolicy = "contact";

  /// <summary>
  /// Registers the contact options and the rate limiting policy for the form.
  /// </summary>
  /// <param name="services">The service collection.</param>
  /// <returns>The same service collection.</returns>
  public static IServiceCollection AddContactForm(this IServiceCollection services)
  {
    services.AddOptions<ContactOptions>().BindConfiguration(ContactOptions.SectionName).ValidateDataAnnotations().ValidateOnStart();
    services.AddRateLimiter(o =>
    {
      o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
      o.AddPolicy(RateLimitPolicy, context =>
      {
        var limit = context.RequestServices.GetRequiredService<IOptions<ContactOptions>>().Value.MessagesPerHour;
        return RateLimitPartition.GetFixedWindowLimiter(
          context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
          _ => new FixedWindowRateLimiterOptions { PermitLimit = limit, Window = TimeSpan.FromHours(1), QueueLimit = 0 });
      });
    });
    return services;
  }

  /// <summary>
  /// Maps the contact endpoint. It is open to everyone and rate limited per address.
  /// </summary>
  /// <param name="endpoints">The route builder.</param>
  /// <returns>The same route builder.</returns>
  public static IEndpointRouteBuilder MapContactEndpoints(this IEndpointRouteBuilder endpoints)
  {
    endpoints.MapPost("/api/v1/contact", SendAsync)
      .WithTags("Contact")
      .AllowAnonymous()
      .RequireRateLimiting(RateLimitPolicy)
      .WithValidation<ContactRequest>();
    return endpoints;
  }

  /// <summary>
  /// Emails a contact message to the configured recipient, with the sender's address to reply to.
  /// </summary>
  /// <param name="request">The validated message.</param>
  /// <param name="options">The contact settings.</param>
  /// <param name="mailSender">Sends the email.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>204 once sent (or dropped as spam), or 503 while no recipient is configured.</returns>
  private static async Task<Results<NoContent, ProblemHttpResult>> SendAsync(
    ContactRequest request,
    IOptions<ContactOptions> options,
    IMailSender mailSender,
    CancellationToken cancellationToken)
  {
    var recipient = options.Value.Recipient;
    if (string.IsNullOrWhiteSpace(recipient))
    {
      return TypedResults.Problem(detail: "The contact form is not available right now.", statusCode: StatusCodes.Status503ServiceUnavailable);
    }

    if (!string.IsNullOrEmpty(request.Website))
    {
      return TypedResults.NoContent();
    }

    var name = request.Name.Trim();
    var body = $"""
      {name} <{request.Email.Trim()}> wrote through the IdeaVerse contact form:

      {request.Message.Trim()}
      """;
    await mailSender.SendAsync(new MailMessage(recipient, $"Contact form: {name}", body), cancellationToken).ConfigureAwait(false);
    return TypedResults.NoContent();
  }
}
