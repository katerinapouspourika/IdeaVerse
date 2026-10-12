namespace Pouspourika.IdeaVerse.Api.Tests;

using System.Net;
using System.Net.Http.Headers;

using Pouspourika.IdeaVerse.Api.Branding;

public class BrandingEndpointsTests
{
  // The smallest valid PNG: its 8-byte signature followed by a 1×1 image.
  private static readonly byte[] Png = Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=");

  [Test]
  public async Task SetColor_PaletteColour_ShowsInTheWorkspaceList()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    var workspaceId = await owner.WorkspaceIdAsync();

    using var response = await owner.PutAsJsonAsync($"/api/v1/workspaces/{workspaceId}/color", new ColorRequest("teal"), Json.Options);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NoContent);
    await Assert.That((await owner.WorkspaceAsync()).Color).IsEqualTo("teal");
  }

  [Test]
  public async Task SetColor_OutsideThePalette_ReturnsValidationProblem()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    var workspaceId = await owner.WorkspaceIdAsync();

    using var response = await owner.PutAsJsonAsync($"/api/v1/workspaces/{workspaceId}/color", new ColorRequest("#ff00ff"), Json.Options);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.BadRequest);
    await Assert.That((await response.ReadValidationErrorsAsync()).Keys).Contains("color");
  }

  [Test]
  public async Task SetLogo_Png_IsServedToMembersWithItsUploadTime()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var member = await factory.CreateSignedInClientAsync("member@example.com", withWorkspace: false);
    await factory.JoinAsync(owner, member, "member@example.com");
    var workspaceId = await owner.WorkspaceIdAsync();

    using var upload = await UploadAsync(owner, workspaceId, Png, "image/png");
    using var logo = await member.GetAsync($"/api/v1/workspaces/{workspaceId}/logo");
    var listed = await owner.WorkspaceAsync();

    await Assert.That(upload.StatusCode).IsEqualTo(HttpStatusCode.NoContent);
    await Assert.That(logo.Content.Headers.ContentType!.MediaType).IsEqualTo("image/png");
    await Assert.That(await logo.Content.ReadAsByteArrayAsync()).IsEquivalentTo(Png);
    await Assert.That(logo.Headers.CacheControl!.Private).IsTrue();
    await Assert.That(listed.LogoUpdatedAt).IsEqualTo(factory.Time.GetUtcNow());
  }

  [Test]
  [Arguments("svg")]
  [Arguments("too-big")]
  [Arguments("mislabelled")]
  public async Task SetLogo_NotAnAcceptedImage_ReturnsValidationProblem(string problem)
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    var workspaceId = await owner.WorkspaceIdAsync();
    var (data, type) = problem switch
    {
      "svg" => ("<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>"u8.ToArray(), "image/svg+xml"),
      "too-big" => ([.. Png, .. new byte[WorkspaceLogo.MaxBytes]], "image/png"),
      _ => ("not really a png"u8.ToArray(), "image/png"),
    };

    using var upload = await UploadAsync(owner, workspaceId, data, type);
    using var logo = await owner.GetAsync($"/api/v1/workspaces/{workspaceId}/logo");

    await Assert.That(upload.StatusCode).IsEqualTo(HttpStatusCode.BadRequest);
    await Assert.That(logo.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
  }

  [Test]
  public async Task RemoveLogo_AfterUpload_RemovesIt()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    var workspaceId = await owner.WorkspaceIdAsync();
    (await UploadAsync(owner, workspaceId, Png, "image/png")).Dispose();

    using var remove = await owner.DeleteAsync($"/api/v1/workspaces/{workspaceId}/logo");
    using var logo = await owner.GetAsync($"/api/v1/workspaces/{workspaceId}/logo");

    await Assert.That(remove.StatusCode).IsEqualTo(HttpStatusCode.NoContent);
    await Assert.That(logo.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
    await Assert.That((await owner.WorkspaceAsync()).LogoUpdatedAt).IsNull();
  }

  [Test]
  public async Task Branding_Member_IsForbiddenAndOutsiderSeesNothing()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var member = await factory.CreateSignedInClientAsync("member@example.com", withWorkspace: false);
    using var outsider = await factory.CreateSignedInClientAsync("outsider@example.com");
    await factory.JoinAsync(owner, member, "member@example.com");
    var workspaceId = await owner.WorkspaceIdAsync();
    (await UploadAsync(owner, workspaceId, Png, "image/png")).Dispose();

    using var color = await member.PutAsJsonAsync($"/api/v1/workspaces/{workspaceId}/color", new ColorRequest("teal"), Json.Options);
    using var upload = await UploadAsync(member, workspaceId, Png, "image/png");
    using var peek = await outsider.GetAsync($"/api/v1/workspaces/{workspaceId}/logo");

    await Assert.That(color.StatusCode).IsEqualTo(HttpStatusCode.Forbidden);
    await Assert.That(upload.StatusCode).IsEqualTo(HttpStatusCode.Forbidden);
    await Assert.That(peek.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
  }

  private static async Task<HttpResponseMessage> UploadAsync(HttpClient client, Guid workspaceId, byte[] data, string type)
  {
    using var content = new ByteArrayContent(data);
    content.Headers.ContentType = new MediaTypeHeaderValue(type);
    return await client.PutAsync($"/api/v1/workspaces/{workspaceId}/logo", content);
  }
}
