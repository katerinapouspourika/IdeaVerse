namespace Pouspourika.IdeaVerse.Api.Web;

using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Net.Http.Headers;

/// <summary>
/// Serves the React web app (built from <c>src/IdeaVerse.Web</c> into <c>wwwroot</c>) from the API's own origin.
/// </summary>
/// <remarks>
/// <para>
/// Same-origin hosting lets the web app use the API's <c>SameSite=Strict</c> login cookie without CORS.
/// When <c>wwwroot</c> is empty, as in development and tests, only the API is served.
/// </para>
/// <para>
/// The build prerenders the public pages to their own HTML files (<c>index.html</c>, <c>how-it-works.html</c>, <c>contact.html</c>),
/// writes the empty app shell the signed-in pages start from (<c>app.html</c>), and a "not found" page (<c>404.html</c>).
/// Any other address is answered with that page and status 404, so search engines do not index made-up URLs.
/// </para>
/// </remarks>
internal static class WebAppExtensions
{
  /// <summary>
  /// The web app's signed-in and account pages, which all start from <see cref="AppShellFile"/>.
  /// Keep in step with the routes in <c>src/IdeaVerse.Web/src/routes.tsx</c>.
  /// </summary>
  internal static readonly string[] AppRoutes =
  [
    "/login",
    "/register",
    "/confirm-email",
    "/forgot-password",
    "/reset-password",
    "/ideas",
    "/ideas/{id}",
    "/notifications",
    "/people",
    "/invitations",
    "/workspaces/new",
    "/settings",
  ];

  /// <summary>
  /// The prerendered public pages and the files they are in, the home page included. Keep in step with <c>src/IdeaVerse.Web/src/seo/pages.ts</c>.
  /// </summary>
  internal static readonly (string Route, string File)[] PublicPages =
  [
    ("/", "index.html"),
    ("/how-it-works", "how-it-works.html"),
    ("/contact", "contact.html"),
  ];

  /// <summary>
  /// Folder Vite writes content-hashed bundles to; their names change with their content, so they can be cached for good.
  /// </summary>
  private const string HashedAssetsPath = "/assets";

  /// <summary>
  /// The empty app shell for pages rendered in the browser.
  /// </summary>
  private const string AppShellFile = "app.html";

  /// <summary>
  /// The prerendered "not found" page.
  /// </summary>
  private const string NotFoundFile = "404.html";

  /// <summary>
  /// Registers response compression for the web app's files.
  /// </summary>
  /// <param name="services">The service collection.</param>
  /// <returns>The same service collection.</returns>
  public static IServiceCollection AddWebAppCompression(this IServiceCollection services)
    => services.AddResponseCompression(o =>
    {
      o.EnableForHttps = true;
      o.Providers.Add<BrotliCompressionProvider>();
      o.Providers.Add<GzipCompressionProvider>();
      o.MimeTypes = ResponseCompressionDefaults.MimeTypes.Concat(["image/svg+xml", "application/manifest+json"]);
    });

  /// <summary>
  /// Serves the web app's static files, compressed, caching content-hashed bundles indefinitely, images and videos for a day,
  /// and revalidating pages on every visit.
  /// </summary>
  /// <remarks>
  /// Only the web app's files are compressed: API responses can carry secrets next to text an attacker controls, which
  /// compression over HTTPS can leak (BREACH).
  /// </remarks>
  /// <param name="app">The application.</param>
  /// <returns>The same application.</returns>
  public static WebApplication UseWebAppFiles(this WebApplication app)
  {
    app.UseWhen(context => !context.Request.Path.StartsWithSegments("/api", StringComparison.Ordinal), branch => branch.UseResponseCompression());
    app.UseStaticFiles(new StaticFileOptions
    {
      ContentTypeProvider = ContentTypes(),
      OnPrepareResponse = context => SetCacheHeaders(context.Context),
    });
    return app;
  }

  /// <summary>
  /// Answers unknown <c>/api</c> routes with 404, the public pages with their prerendered HTML, the app's own routes with the
  /// app shell, and every other address without a file extension with the "not found" page and status 404.
  /// A missing file, such as an image, gets a plain 404.
  /// </summary>
  /// <param name="endpoints">The route builder.</param>
  /// <returns>The same route builder.</returns>
  public static IEndpointRouteBuilder MapWebAppFallback(this IEndpointRouteBuilder endpoints)
  {
    var files = new StaticFileOptions { OnPrepareResponse = context => SetCacheHeaders(context.Context) };
    endpoints.MapFallback("/api/{**path}", () => TypedResults.NotFound()).ExcludeFromDescription();
    foreach (var (route, file) in PublicPages)
    {
      endpoints.MapFallbackToFile(route, file, files);
    }

    foreach (var route in AppRoutes)
    {
      endpoints.MapFallbackToFile(route, AppShellFile, files);
    }

    endpoints.MapFallback(ServeNotFoundAsync).ExcludeFromDescription();
    return endpoints;
  }

  /// <summary>
  /// Writes the "not found" page with status 404, or an empty 404 when the web app is not built.
  /// </summary>
  /// <param name="context">The HTTP context.</param>
  /// <returns>A task that completes when the response is written.</returns>
  private static async Task ServeNotFoundAsync(HttpContext context)
  {
    context.Response.StatusCode = StatusCodes.Status404NotFound;
    var page = context.RequestServices.GetRequiredService<IWebHostEnvironment>().WebRootFileProvider.GetFileInfo(NotFoundFile);
    if (page.Exists && HttpMethods.IsGet(context.Request.Method))
    {
      context.Response.ContentType = "text/html; charset=utf-8";
      SetCacheHeaders(context);
      await context.Response.SendFileAsync(page, context.RequestAborted).ConfigureAwait(false);
    }
  }

  /// <summary>
  /// The default content types, plus the web app manifest.
  /// </summary>
  /// <returns>The content type provider.</returns>
  private static FileExtensionContentTypeProvider ContentTypes()
  {
    var provider = new FileExtensionContentTypeProvider();
    provider.Mappings[".webmanifest"] = "application/manifest+json";
    return provider;
  }

  /// <summary>
  /// Sets <c>Cache-Control</c> for a static file response.
  /// </summary>
  /// <param name="context">The HTTP context of the response.</param>
  private static void SetCacheHeaders(HttpContext context)
  {
    var path = context.Request.Path;
    context.Response.Headers[HeaderNames.CacheControl] = path.StartsWithSegments(HashedAssetsPath, StringComparison.Ordinal)
      ? "public, max-age=31536000, immutable"
      : IsMedia(path.Value) ? "public, max-age=86400" : "no-cache";
  }

  /// <summary>
  /// Whether a path is an image or video, which may be cached for a day without revalidating.
  /// </summary>
  /// <param name="path">The request path.</param>
  /// <returns><see langword="true"/> for images and videos.</returns>
  private static bool IsMedia(string? path)
    => Path.GetExtension(path) is ".png" or ".webp" or ".jpg" or ".ico" or ".svg" or ".mp4" or ".webm" or ".woff2";
}
