namespace Pouspourika.IdeaVerse.Api.Tests;

using System.Net;

public sealed class WebAppTests : IDisposable
{
  private readonly DirectoryInfo webRoot = Directory.CreateTempSubdirectory("ideaverse-wwwroot-");

  public WebAppTests()
  {
    File.WriteAllText(Path.Combine(webRoot.FullName, "index.html"), "<!doctype html><div id=\"root\"></div>");
    Directory.CreateDirectory(Path.Combine(webRoot.FullName, "assets"));
    File.WriteAllText(Path.Combine(webRoot.FullName, "assets", "index-abc123.js"), "console.log('app');");
  }

  public void Dispose() => webRoot.Delete(recursive: true);

  [Test]
  [Arguments("/")]
  [Arguments("/ideas/0199a0f0-0000-7000-8000-000000000000")]
  [Arguments("/login")]
  public async Task Get_WebAppRoute_ServesIndexWithoutLongCaching(string path)
  {
    await using var factory = new IdeaVerseApiFactory(webRoot.FullName);
    var client = factory.CreateClient();

    using var response = await client.GetAsync(path);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.OK);
    await Assert.That(response.Content.Headers.ContentType!.MediaType).IsEqualTo("text/html");
    await Assert.That(await response.Content.ReadAsStringAsync()).Contains("id=\"root\"");
    await Assert.That(response.Headers.CacheControl!.NoCache).IsTrue();
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

    using var response = await client.GetAsync("/api/v1/ideas");

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.Unauthorized);
  }
}
