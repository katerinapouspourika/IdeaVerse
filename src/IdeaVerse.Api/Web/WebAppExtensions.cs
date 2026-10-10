namespace Pouspourika.IdeaVerse.Api.Web;

using Microsoft.Net.Http.Headers;

/// <summary>
/// Serves the React web app (built from <c>src/IdeaVerse.Web</c> into <c>wwwroot</c>) from the API's own origin.
/// </summary>
/// <remarks>
/// Same-origin hosting lets the web app use the API's <c>SameSite=Strict</c> login cookie without CORS.
/// When <c>wwwroot</c> is empty, as in development and tests, only the API is served.
/// </remarks>
internal static class WebAppExtensions
{
  /// <summary>
  /// Folder Vite writes content-hashed bundles to; their names change with their content, so they can be cached for good.
  /// </summary>
  private const string HashedAssetsPath = "/assets";

  /// <summary>
  /// Serves the web app's static files, caching content-hashed bundles indefinitely and revalidating everything else.
  /// </summary>
  /// <param name="app">The application.</param>
  /// <returns>The same application.</returns>
  public static WebApplication UseWebAppFiles(this WebApplication app)
  {
    app.UseDefaultFiles();
    app.UseStaticFiles(new StaticFileOptions { OnPrepareResponse = context => SetCacheHeaders(context.Context) });
    return app;
  }

  /// <summary>
  /// Answers unknown <c>/api</c> routes with 404 and every other unknown route with the web app's <c>index.html</c>,
  /// so client-side routes such as <c>/ideas/{id}</c> load the app.
  /// </summary>
  /// <param name="endpoints">The route builder.</param>
  /// <returns>The same route builder.</returns>
  public static IEndpointRouteBuilder MapWebAppFallback(this IEndpointRouteBuilder endpoints)
  {
    endpoints.MapFallback("/api/{**path}", () => TypedResults.NotFound()).ExcludeFromDescription();
    endpoints.MapFallbackToFile("index.html", new StaticFileOptions { OnPrepareResponse = context => SetCacheHeaders(context.Context) });
    return endpoints;
  }

  /// <summary>
  /// Sets <c>Cache-Control</c> for a static file response.
  /// </summary>
  /// <param name="context">The HTTP context of the response.</param>
  private static void SetCacheHeaders(HttpContext context)
    => context.Response.Headers[HeaderNames.CacheControl] = context.Request.Path.StartsWithSegments(HashedAssetsPath, StringComparison.Ordinal)
      ? "public, max-age=31536000, immutable"
      : "no-cache";
}
