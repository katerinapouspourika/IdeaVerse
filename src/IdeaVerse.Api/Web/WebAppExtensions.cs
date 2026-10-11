namespace Pouspourika.IdeaVerse.Api.Web;

using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.FileProviders;
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
    "/ideas/{id:guid}",
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
    ("/templates", "templates.html"),
  ];

  /// <summary>
  /// Folders of public pages the web build prerenders one per item, such as <c>/templates/product-launch</c> from
  /// <c>templates/product-launch.html</c>. An address whose page wasn't built gets the "not found" page.
  /// </summary>
  internal static readonly string[] PageCollections = ["templates"];

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
  /// The content type every page is served with.
  /// </summary>
  private const string HtmlContentType = "text/html; charset=utf-8";

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
    app.UseWhen(IsWebAppRequest, branch => branch.UseResponseCompression());
    app.Use(HideBuiltPagesAsync);
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
    var files = new StaticFileOptions { ContentTypeProvider = ContentTypes(), OnPrepareResponse = context => SetCacheHeaders(context.Context) };
    endpoints.MapFallback("/api/{**path}", () => TypedResults.NotFound()).ExcludeFromDescription();
    foreach (var (route, file) in PublicPages)
    {
      endpoints.MapFallbackToFile(route, file, files);
    }

    foreach (var route in AppRoutes)
    {
      endpoints.MapFallbackToFile(route, AppShellFile, files);
    }

    foreach (var collection in PageCollections)
    {
      endpoints.MapFallback($"/{collection}/{{slug:regex(^[a-z0-9-]+$)}}", context => ServeCollectionPageAsync(context, collection)).ExcludeFromDescription();
    }

    endpoints.MapFallback(ServeNotFoundAsync).ExcludeFromDescription();
    return endpoints;
  }

  /// <summary>
  /// Whether a request is for the web app rather than the API, matching <c>/api</c> in any casing as routing does.
  /// </summary>
  /// <param name="context">The HTTP context.</param>
  /// <returns><see langword="true"/> unless the path is under <c>/api</c>.</returns>
  private static bool IsWebAppRequest(HttpContext context)
    => !context.Request.Path.StartsWithSegments("/api", StringComparison.OrdinalIgnoreCase);

  /// <summary>
  /// Answers requests for the built HTML files themselves, such as <c>/how-it-works.html</c>, with the "not found" page,
  /// so each page is only reachable at its own address.
  /// </summary>
  /// <param name="context">The HTTP context.</param>
  /// <param name="next">The rest of the pipeline.</param>
  /// <returns>A task that completes when the response is written.</returns>
  private static Task HideBuiltPagesAsync(HttpContext context, RequestDelegate next)
    => context.Request.Path.Value?.EndsWith(".html", StringComparison.OrdinalIgnoreCase) == true
      ? ServeNotFoundAsync(context)
      : next(context);

  /// <summary>
  /// Writes the prerendered page of one item in a collection, such as a template, or the "not found" page when it wasn't built.
  /// </summary>
  /// <param name="context">The HTTP context, whose <c>slug</c> route value names the item.</param>
  /// <param name="collection">The collection's folder, such as <c>templates</c>.</param>
  /// <returns>A task that completes when the response is written.</returns>
  private static Task ServeCollectionPageAsync(HttpContext context, string collection)
  {
    var slug = (string)context.GetRouteValue("slug")!;
    var page = context.RequestServices.GetRequiredService<IWebHostEnvironment>().WebRootFileProvider.GetFileInfo($"{collection}/{slug}.html");
    return page.Exists ? SendPageAsync(context, page) : ServeNotFoundAsync(context);
  }

  /// <summary>
  /// Writes the "not found" page with status 404 (its headers only, for <c>HEAD</c>), or an empty 404 when the web app is not built.
  /// </summary>
  /// <param name="context">The HTTP context.</param>
  /// <returns>A task that completes when the response is written.</returns>
  private static Task ServeNotFoundAsync(HttpContext context)
  {
    context.Response.StatusCode = StatusCodes.Status404NotFound;
    var page = context.RequestServices.GetRequiredService<IWebHostEnvironment>().WebRootFileProvider.GetFileInfo(NotFoundFile);
    return page.Exists ? SendPageAsync(context, page) : Task.CompletedTask;
  }

  /// <summary>
  /// Writes a built page as HTML that browsers revalidate (its headers only, for <c>HEAD</c>), keeping the status already set.
  /// </summary>
  /// <param name="context">The HTTP context.</param>
  /// <param name="page">The page's file.</param>
  /// <returns>A task that completes when the response is written.</returns>
  private static async Task SendPageAsync(HttpContext context, IFileInfo page)
  {
    context.Response.ContentType = HtmlContentType;
    SetCacheHeaders(context);
    if (HttpMethods.IsHead(context.Request.Method))
    {
      context.Response.ContentLength = page.Length;
      await context.Response.CompleteAsync().ConfigureAwait(false);
      return;
    }

    await context.Response.SendFileAsync(page, context.RequestAborted).ConfigureAwait(false);
  }

  /// <summary>
  /// The default content types, plus the web app manifest, with pages declared as UTF-8.
  /// </summary>
  /// <returns>The content type provider.</returns>
  private static FileExtensionContentTypeProvider ContentTypes()
  {
    var provider = new FileExtensionContentTypeProvider();
    provider.Mappings[".webmanifest"] = "application/manifest+json";
    provider.Mappings[".html"] = HtmlContentType;
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
