namespace Pouspourika.IdeaVerse.Api.Web;

using Microsoft.Net.Http.Headers;

/// <summary>
/// Adds the browser security headers every response carries, pages and API answers alike.
/// </summary>
internal static class SecurityHeadersExtensions
{
  /// <summary>
  /// Tells browsers not to guess content types, not to show the app in another site's frame, and to send only the
  /// origin, not the full address, to other sites.
  /// </summary>
  /// <remarks>
  /// The headers are set as the response starts, so error responses, whose headers the exception handler clears, carry
  /// them too.
  /// </remarks>
  /// <param name="app">The application builder.</param>
  /// <returns>The same application builder.</returns>
  public static IApplicationBuilder UseSecurityHeaders(this IApplicationBuilder app)
    => app.Use(async (context, next) =>
    {
      context.Response.OnStarting(() =>
      {
        var headers = context.Response.Headers;
        headers[HeaderNames.XContentTypeOptions] = "nosniff";
        headers[HeaderNames.XFrameOptions] = "DENY";
        headers[HeaderNames.ContentSecurityPolicy] = "frame-ancestors 'none'";
        headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
        return Task.CompletedTask;
      });
      await next(context).ConfigureAwait(false);
    });
}
