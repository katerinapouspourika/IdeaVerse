namespace Pouspourika.IdeaVerse.Api.Tests;

using System.Net;

using Pouspourika.IdeaVerse.Api.Accounts;

public class AccountEndpointsTests
{
  [Test]
  public async Task Get_NewAccount_ReturnsEmailAndNoTimeZone()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();

    var account = await client.GetFromJsonAsync<AccountResponse>("/api/v1/account", Json.Options);

    await Assert.That(account).IsEqualTo(new AccountResponse("owner@example.com", null));
  }

  [Test]
  public async Task Get_Anonymous_ReturnsUnauthorized()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = factory.CreateClient();

    using var response = await client.GetAsync("/api/v1/account");

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.Unauthorized);
  }

  [Test]
  public async Task Update_IanaTimeZone_SavesIt()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();

    using var response = await client.PutAsJsonAsync("/api/v1/account", new UpdateAccountRequest("Europe/Athens"), Json.Options);
    var account = await client.GetFromJsonAsync<AccountResponse>("/api/v1/account", Json.Options);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.OK);
    await Assert.That(account!.TimeZone).IsEqualTo("Europe/Athens");
  }

  [Test]
  [Arguments("Mars/Olympus_Mons")]
  [Arguments("GTB Standard Time")]
  [Arguments("")]
  public async Task Update_UnknownOrNonIanaTimeZone_ReturnsValidationProblem(string timeZone)
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();

    using var response = await client.PutAsJsonAsync("/api/v1/account", new UpdateAccountRequest(timeZone), Json.Options);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.BadRequest);
    await Assert.That((await response.ReadValidationErrorsAsync()).Keys).Contains("timeZone");
  }
}
