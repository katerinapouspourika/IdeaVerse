namespace Pouspourika.IdeaVerse.Api.Tests;

using System.Net;

public class AuthTests
{
  [Test]
  public async Task Ideas_Anonymous_ReturnsUnauthorized()
  {
    await using var factory = new IdeaVerseApiFactory();
    var client = factory.CreateClient();

    using var response = await client.GetAsync("/api/v1/ideas");

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.Unauthorized);
  }

  [Test]
  public async Task Login_RegisteredUser_SetsHttpOnlyCookie()
  {
    await using var factory = new IdeaVerseApiFactory();
    var client = factory.CreateClient();
    await factory.RegisterAndConfirmAsync(client, "owner@example.com");

    using var login = await client.PostAsJsonAsync("/api/v1/auth/login?useCookies=true", new { email = "owner@example.com", password = IdeaVerseApiFactory.Password });

    var cookie = login.Headers.GetValues("Set-Cookie").Single(c => c.StartsWith("IdeaVerse.Auth=", StringComparison.Ordinal));
    await Assert.That(cookie).Contains("httponly", StringComparison.OrdinalIgnoreCase);
    await Assert.That(cookie).Contains("samesite=strict", StringComparison.OrdinalIgnoreCase);
  }

  [Test]
  public async Task Login_WrongPassword_ReturnsUnauthorized()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    using var anonymous = factory.CreateClient();

    using var login = await anonymous.PostAsJsonAsync("/api/v1/auth/login?useCookies=true", new { email = "owner@example.com", password = "Wrong0rd!" });

    await Assert.That(login.StatusCode).IsEqualTo(HttpStatusCode.Unauthorized);
  }

  [Test]
  public async Task Register_DuplicateEmail_ReturnsBadRequest()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();

    using var response = await client.PostAsJsonAsync("/api/v1/auth/register", new { email = "owner@example.com", password = IdeaVerseApiFactory.Password });

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.BadRequest);
  }

  [Test]
  public async Task Logout_SignedIn_RevokesAccess()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();

    using var logout = await client.PostAsync("/api/v1/auth/logout", content: null);
    using var response = await client.GetAsync("/api/v1/ideas");

    await Assert.That(logout.StatusCode).IsEqualTo(HttpStatusCode.NoContent);
    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.Unauthorized);
  }
}
