namespace Pouspourika.IdeaVerse.Api.Tests;

using System.Net;

public sealed class WebAppTests : IDisposable
{
  private readonly DirectoryInfo webRoot = Directory.CreateTempSubdirectory("ideaverse-wwwroot-");

  public WebAppTests()
  {
    File.WriteAllText(Path.Combine(webRoot.FullName, "index.html"), "<!doctype html><title>Home</title><div id=\"root\"></div>");
    File.WriteAllText(Path.Combine(webRoot.FullName, "how-it-works.html"), "<!doctype html><title>How it works</title><div id=\"root\"></div>");
    File.WriteAllText(Path.Combine(webRoot.FullName, "contact.html"), "<!doctype html><title>Contact us</title><div id=\"root\"></div>");
    File.WriteAllText(Path.Combine(webRoot.FullName, "pricing.html"), "<!doctype html><title>Pricing</title><div id=\"root\"></div>");
    File.WriteAllText(Path.Combine(webRoot.FullName, "privacy.html"), "<!doctype html><title>Privacy Policy</title><div id=\"root\"></div>");
    File.WriteAllText(Path.Combine(webRoot.FullName, "terms.html"), "<!doctype html><title>Terms of Service</title><div id=\"root\"></div>");
    File.WriteAllText(Path.Combine(webRoot.FullName, "templates.html"), "<!doctype html><title>Templates</title><div id=\"root\"></div>");
    Directory.CreateDirectory(Path.Combine(webRoot.FullName, "templates"));
    File.WriteAllText(Path.Combine(webRoot.FullName, "templates", "product-launch.html"), "<!doctype html><title>Product launch template</title><div id=\"root\"></div>");
    File.WriteAllText(Path.Combine(webRoot.FullName, "use-cases.html"), "<!doctype html><title>Use cases</title><div id=\"root\"></div>");
    Directory.CreateDirectory(Path.Combine(webRoot.FullName, "use-cases"));
    File.WriteAllText(Path.Combine(webRoot.FullName, "use-cases", "marketing-teams.html"), "<!doctype html><title>Marketing teams</title><div id=\"root\"></div>");
    File.WriteAllText(Path.Combine(webRoot.FullName, "compare.html"), "<!doctype html><title>Compare</title><div id=\"root\"></div>");
    Directory.CreateDirectory(Path.Combine(webRoot.FullName, "compare"));
    File.WriteAllText(Path.Combine(webRoot.FullName, "compare", "spreadsheets.html"), "<!doctype html><title>Spreadsheets</title><div id=\"root\"></div>");
    File.WriteAllText(Path.Combine(webRoot.FullName, "app.html"), "<!doctype html><title>App</title><div id=\"root\"></div>");
    File.WriteAllText(Path.Combine(webRoot.FullName, "404.html"), "<!doctype html><title>Page not found</title><div id=\"root\"></div>");
    File.WriteAllText(Path.Combine(webRoot.FullName, "logo.png"), "png");
    File.WriteAllText(Path.Combine(webRoot.FullName, "sw.js"), "self.addEventListener('fetch', () => {});");
    File.WriteAllText(Path.Combine(webRoot.FullName, "manifest.webmanifest"), "{}");
    Directory.CreateDirectory(Path.Combine(webRoot.FullName, "how-it-works"));
    File.WriteAllText(Path.Combine(webRoot.FullName, "how-it-works", "clip.mp4"), "mp4");
    Directory.CreateDirectory(Path.Combine(webRoot.FullName, "assets"));
    File.WriteAllText(Path.Combine(webRoot.FullName, "assets", "index-abc123.js"), "console.log('app');");
  }

  public void Dispose() => webRoot.Delete(recursive: true);

  [Test]
  [Arguments("/", "Home")]
  [Arguments("/how-it-works", "How it works")]
  [Arguments("/contact", "Contact us")]
  [Arguments("/pricing", "Pricing")]
  [Arguments("/privacy", "Privacy Policy")]
  [Arguments("/terms", "Terms of Service")]
  [Arguments("/templates", "Templates")]
  [Arguments("/templates/product-launch", "Product launch template")]
  [Arguments("/use-cases", "Use cases")]
  [Arguments("/use-cases/marketing-teams", "Marketing teams")]
  [Arguments("/compare", "Compare")]
  [Arguments("/compare/spreadsheets", "Spreadsheets")]
  [Arguments("/ideas", "App")]
  [Arguments("/ideas/0199a0f0-0000-7000-8000-000000000000", "App")]
  [Arguments("/login", "App")]
  [Arguments("/workspaces/new", "App")]
  [Arguments("/workspaces/0199a0f0-0000-7000-8000-000000000000/invite", "App")]
  [Arguments("/join/abc123", "App")]
  public async Task Get_WebAppRoute_ServesItsPageWithoutLongCaching(string path, string title)
  {
    await using var factory = new IdeaVerseApiFactory(webRoot.FullName);
    var client = factory.CreateClient();

    using var response = await client.GetAsync(path);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.OK);
    await Assert.That(response.Content.Headers.ContentType!.ToString()).IsEqualTo("text/html; charset=utf-8");
    await Assert.That(await response.Content.ReadAsStringAsync()).Contains($"<title>{title}</title>");
    await Assert.That(response.Headers.CacheControl!.NoCache).IsTrue();
  }

  [Test]
  [Arguments("/no-such-page")]
  [Arguments("/ideas/0199a0f0-0000-7000-8000-000000000000/extra")]
  [Arguments("/ideas/not-an-id")]
  [Arguments("/how-it-works.html")]
  [Arguments("/app.html")]
  [Arguments("/pricing.html")]
  [Arguments("/templates/no-such-template")]
  [Arguments("/use-cases/astronauts")]
  [Arguments("/compare/spreadsheets.html")]
  [Arguments("/templates/Product_Launch")]
  [Arguments("/templates/product-launch.html")]
  [Arguments("/templates/product-launch/extra")]
  [Arguments("/INDEX.HTML")]
  public async Task Get_UnknownAddress_ServesNotFoundPageWithStatus404(string path)
  {
    await using var factory = new IdeaVerseApiFactory(webRoot.FullName);
    var client = factory.CreateClient();

    using var response = await client.GetAsync(path);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
    await Assert.That(response.Content.Headers.ContentType!.ToString()).IsEqualTo("text/html; charset=utf-8");
    await Assert.That(response.Headers.CacheControl!.NoCache).IsTrue();
    await Assert.That(await response.Content.ReadAsStringAsync()).Contains("<title>Page not found</title>");
  }

  [Test]
  public async Task Head_UnknownAddress_ReturnsNotFoundPageHeadersWithoutBody()
  {
    await using var factory = new IdeaVerseApiFactory(webRoot.FullName);
    var client = factory.CreateClient();
    using var request = new HttpRequestMessage(HttpMethod.Head, "/no-such-page");

    using var response = await client.SendAsync(request);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
    await Assert.That(response.Content.Headers.ContentType!.ToString()).IsEqualTo("text/html; charset=utf-8");
    await Assert.That(await response.Content.ReadAsByteArrayAsync()).IsEmpty();
  }

  [Test]
  public async Task Get_ServiceWorker_IsServedAsScriptAndAlwaysRevalidated()
  {
    await using var factory = new IdeaVerseApiFactory(webRoot.FullName);
    var client = factory.CreateClient();

    using var response = await client.GetAsync("/sw.js");

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.OK);
    await Assert.That(response.Content.Headers.ContentType!.MediaType).IsEqualTo("text/javascript");
    await Assert.That(response.Headers.CacheControl!.NoCache).IsTrue();
  }

  [Test]
  public async Task Get_Manifest_IsServedAsWebAppManifest()
  {
    await using var factory = new IdeaVerseApiFactory(webRoot.FullName);
    var client = factory.CreateClient();

    using var response = await client.GetAsync("/manifest.webmanifest");

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.OK);
    await Assert.That(response.Content.Headers.ContentType!.MediaType).IsEqualTo("application/manifest+json");
  }

  [Test]
  public async Task Get_MissingFile_ReturnsNotFound()
  {
    await using var factory = new IdeaVerseApiFactory(webRoot.FullName);
    var client = factory.CreateClient();

    using var response = await client.GetAsync("/missing.png");

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
  }

  [Test]
  [Arguments("/logo.png")]
  [Arguments("/how-it-works/clip.mp4")]
  public async Task Get_ImageOrVideo_IsCachedForADay(string path)
  {
    await using var factory = new IdeaVerseApiFactory(webRoot.FullName);
    var client = factory.CreateClient();

    using var response = await client.GetAsync(path);

    await Assert.That(response.Headers.CacheControl!.MaxAge).IsEqualTo(TimeSpan.FromDays(1));
  }

  [Test]
  [Arguments("/assets/index-abc123.js")]
  [Arguments("/how-it-works")]
  [Arguments("/no-such-page")]
  public async Task Get_WebAppFileAcceptingBrotli_IsCompressed(string path)
  {
    await using var factory = new IdeaVerseApiFactory(webRoot.FullName);
    var client = factory.CreateClient();
    using var request = new HttpRequestMessage(HttpMethod.Get, path);
    request.Headers.AcceptEncoding.ParseAdd("br");

    using var response = await client.SendAsync(request);

    await Assert.That(response.Content.Headers.ContentEncoding).Contains("br");
  }

  [Test]
  [Arguments("/api/v1/account")]
  [Arguments("/API/v1/account")]
  public async Task Get_ApiAcceptingBrotli_IsNotCompressed(string path)
  {
    await using var factory = new IdeaVerseApiFactory(webRoot.FullName);
    using var client = await factory.CreateSignedInClientAsync();
    using var request = new HttpRequestMessage(HttpMethod.Get, path);
    request.Headers.AcceptEncoding.ParseAdd("br");

    using var response = await client.SendAsync(request);

    await Assert.That(response.Content.Headers.ContentEncoding).IsEmpty();
  }

  [Test]
  public async Task Get_HashedAsset_IsCachedImmutably()
  {
    await using var factory = new IdeaVerseApiFactory(webRoot.FullName);
    var client = factory.CreateClient();

    using var response = await client.GetAsync("/assets/index-abc123.js");

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.OK);
    await Assert.That(response.Headers.CacheControl!.ToString()).Contains("immutable");
  }

  [Test]
  [Arguments("/api/v1/unknown")]
  [Arguments("/api")]
  public async Task Get_UnknownApiRoute_ReturnsNotFoundInsteadOfWebApp(string path)
  {
    await using var factory = new IdeaVerseApiFactory(webRoot.FullName);
    var client = factory.CreateClient();

    using var response = await client.GetAsync(path);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
  }

  [Test]
  public async Task Get_KnownApiRoute_StillReachesTheApi()
  {
    await using var factory = new IdeaVerseApiFactory(webRoot.FullName);
    var client = factory.CreateClient();

    using var response = await client.GetAsync("/api/v1/workspaces");

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.Unauthorized);
  }

  [Test]
  [Arguments("/")]
  [Arguments("/api/v1/workspaces")]
  [Arguments("/no-such-page")]
  public async Task AnyResponse_CarriesSecurityHeaders(string path)
  {
    await using var factory = new IdeaVerseApiFactory(webRoot.FullName);
    var client = factory.CreateClient();

    using var response = await client.GetAsync(path);

    await Assert.That(response.Headers.GetValues("X-Content-Type-Options")).IsEquivalentTo(["nosniff"]);
    await Assert.That(response.Headers.GetValues("X-Frame-Options")).IsEquivalentTo(["DENY"]);
    await Assert.That(response.Headers.GetValues("Referrer-Policy")).IsEquivalentTo(["strict-origin-when-cross-origin"]);
  }
}
