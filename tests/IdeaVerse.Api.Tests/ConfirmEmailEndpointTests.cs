namespace Pouspourika.IdeaVerse.Api.Tests;

using System.Net;
using System.Web;

using Pouspourika.IdeaVerse.Api.Accounts;
using Pouspourika.IdeaVerse.Api.Auth;

public class ConfirmEmailEndpointTests
{
  private const string Email = "new@example.com";

  [Test]
  public async Task Confirm_NewAccount_ConfirmsAndSignsIn()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = factory.CreateClient();
    var request = await RegisterAsync(factory, client);

    using var confirm = await client.PostAsJsonAsync("/api/v1/auth/confirm", request, Json.Options);
    var result = await confirm.Content.ReadFromJsonAsync<ConfirmEmailResponse>(Json.Options);
    using var account = await client.GetAsync("/api/v1/account");

    await Assert.That(confirm.StatusCode).IsEqualTo(HttpStatusCode.OK);
    await Assert.That(result).IsEqualTo(new ConfirmEmailResponse(SignedIn: true));
    await Assert.That(account.StatusCode).IsEqualTo(HttpStatusCode.OK);
  }

  [Test]
  public async Task Confirm_LinkOpenedAgain_ConfirmsNothingAndSignsNoOneIn()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var first = factory.CreateClient();
    var request = await RegisterAsync(factory, first);
    (await first.PostAsJsonAsync("/api/v1/auth/confirm", request, Json.Options)).Dispose();
    using var second = factory.CreateClient();

    using var again = await second.PostAsJsonAsync("/api/v1/auth/confirm", request, Json.Options);
    var result = await again.Content.ReadFromJsonAsync<ConfirmEmailResponse>(Json.Options);
    using var account = await second.GetAsync("/api/v1/account");

    await Assert.That(result).IsEqualTo(new ConfirmEmailResponse(SignedIn: false));
    await Assert.That(account.StatusCode).IsEqualTo(HttpStatusCode.Unauthorized);
  }

  [Test]
  [Arguments("tampered")]
  [Arguments("not-base64")]
  [Arguments("unknown-user")]
  public async Task Confirm_InvalidLink_ReturnsUnauthorizedAndLeavesAccountUnconfirmed(string problem)
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = factory.CreateClient();
    var request = await RegisterAsync(factory, client);
    var broken = problem switch
    {
      "tampered" => request with { Code = "x" + request.Code },
      "not-base64" => request with { Code = "%%%" },
      _ => request with { UserId = Guid.NewGuid().ToString() },
    };

    using var confirm = await client.PostAsJsonAsync("/api/v1/auth/confirm", broken, Json.Options);
    using var login = await client.PostAsJsonAsync("/api/v1/auth/login?useCookies=true", new { email = Email, password = IdeaVerseApiFactory.Password });

    await Assert.That(confirm.StatusCode).IsEqualTo(HttpStatusCode.Unauthorized);
    await Assert.That(login.StatusCode).IsEqualTo(HttpStatusCode.Unauthorized);
  }

  [Test]
  public async Task Confirm_ChangedEmail_ChangesTheAddressWithoutSigningIn()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    (await client.PostAsJsonAsync("/api/v1/auth/manage/info", new { newEmail = "kat@new.example.com" })).Dispose();
    var link = FakeMailSender.LinkIn(factory.Mail.Take("kat@new.example.com", IdentityEmailSender.ChangeEmailSubject), $"{IdeaVerseApiFactory.AppUrl}/confirm-email");
    using var other = factory.CreateClient();

    using var confirm = await other.PostAsJsonAsync("/api/v1/auth/confirm", RequestFrom(link), Json.Options);
    var result = await confirm.Content.ReadFromJsonAsync<ConfirmEmailResponse>(Json.Options);
    using var account = await other.GetAsync("/api/v1/account");
    using var login = await other.PostAsJsonAsync("/api/v1/auth/login?useCookies=true", new { email = "kat@new.example.com", password = IdeaVerseApiFactory.Password });

    await Assert.That(result).IsEqualTo(new ConfirmEmailResponse(SignedIn: false));
    await Assert.That(account.StatusCode).IsEqualTo(HttpStatusCode.Unauthorized);
    await Assert.That(login.StatusCode).IsEqualTo(HttpStatusCode.OK);
  }

  [Test]
  public async Task Confirm_ChangedEmailInTheSameSession_KeepsItSignedIn()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    (await client.PostAsJsonAsync("/api/v1/auth/manage/info", new { newEmail = "kat@new.example.com" })).Dispose();
    var link = FakeMailSender.LinkIn(factory.Mail.Take("kat@new.example.com", IdentityEmailSender.ChangeEmailSubject), $"{IdeaVerseApiFactory.AppUrl}/confirm-email");

    using var confirm = await client.PostAsJsonAsync("/api/v1/auth/confirm", RequestFrom(link), Json.Options);
    factory.Time.Advance(TimeSpan.FromMinutes(2));
    var account = await client.GetFromJsonAsync<AccountResponse>("/api/v1/account", Json.Options);

    await Assert.That(confirm.StatusCode).IsEqualTo(HttpStatusCode.OK);
    await Assert.That(account!.Email).IsEqualTo("kat@new.example.com");
  }

  private static async Task<ConfirmEmailRequest> RegisterAsync(IdeaVerseApiFactory factory, HttpClient client)
  {
    (await client.PostAsJsonAsync("/api/v1/auth/register", new { email = Email, password = IdeaVerseApiFactory.Password })).Dispose();
    return RequestFrom(FakeMailSender.LinkIn(factory.Mail.Take(Email, IdentityEmailSender.ConfirmationSubject), $"{IdeaVerseApiFactory.AppUrl}/confirm-email"));
  }

  private static ConfirmEmailRequest RequestFrom(Uri link)
  {
    var query = HttpUtility.ParseQueryString(link.Query);
    return new ConfirmEmailRequest(query["userId"]!, query["code"]!, query["changedEmail"]);
  }
}
