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
    File.WriteAllText(Path.Combine(webRoot.FullName, "app.html"), "<!doctype html><title>App</title><div id=\"root\"></div>");
    File.WriteAllText(Path.Combine(webRoot.FullName, "404.html"), "<!doctype html><title>Page not found</title><div id=\"root\"></div>");
    File.WriteAllText(Path.Combine(webRoot.FullName, "logo.png"), "png");
    Directory.CreateDirectory(Path.Combine(webRoot.FullName, "assets"));
    File.WriteAllText(Path.Combine(webRoot.FullName, "assets", "index-abc123.js"), "console.log('app');");
  }

  public void Dispose() => webRoot.Delete(recursive: true);

  [Test]
  [Arguments("/", "Home")]
  [Arguments("/how-it-works", "How it works")]
  [Arguments("/contact", "Contact us")]
  [Arguments("/ideas", "App")]
  [Arguments("/ideas/0199a0f0-0000-7000-8000-000000000000", "App")]
  [Arguments("/login", "App")]
  [Arguments("/workspaces/new", "App")]
  public async Task Get_WebAppRoute_ServesItsPageWithoutLongCaching(string path, string title)
  {
    await using var factory = new IdeaVerseApiFactory(webRoot.FullName);
    var client = factory.CreateClient();

    using var response = await client.GetAsync(path);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.OK);
    await Assert.That(response.Content.Headers.ContentType!.MediaType).IsEqualTo("text/html");
    await Assert.That(await response.Content.ReadAsStringAsync()).Contains($"<title>{title}</title>");
    await Assert.That(response.Headers.CacheControl!.NoCache).IsTrue();
  }

  [Test]
  [Arguments("/no-such-page")]
  [Arguments("/ideas/0199a0f0-0000-7000-8000-000000000000/extra")]
  public async Task Get_UnknownAddress_ServesNotFoundPageWithStatus404(string path)
  {
    await using var factory = new IdeaVerseApiFactory(webRoot.FullName);
    var client = factory.CreateClient();

    using var response = await client.GetAsync(path);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
    await Assert.That(await response.Content.ReadAsStringAsync()).Contains("<title>Page not found</title>");
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
  public async Task Get_Image_IsCachedForADay()
  {
    await using var factory = new IdeaVerseApiFactory(webRoot.FullName);
    var client = factory.CreateClient();

    using var response = await client.GetAsync("/logo.png");

    await Assert.That(response.Headers.CacheControl!.MaxAge).IsEqualTo(TimeSpan.FromDays(1));
  }

  [Test]
  public async Task Get_PageAcceptingBrotli_IsCompressed()
  {
    await using var factory = new IdeaVerseApiFactory(webRoot.FullName);
    var client = factory.CreateClient();
    using var request = new HttpRequestMessage(HttpMethod.Get, "/assets/index-abc123.js");
    request.Headers.AcceptEncoding.ParseAdd("br");

    using var response = await client.SendAsync(request);

    await Assert.That(response.Content.Headers.ContentEncoding).Contains("br");
  }

  [Test]
  public async Task Get_ApiAcceptingBrotli_IsNotCompressed()
  {
    await using var factory = new IdeaVerseApiFactory(webRoot.FullName);
    using var client = await factory.CreateSignedInClientAsync();
    using var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/account");
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
}
