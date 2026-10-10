namespace Pouspourika.IdeaVerse.Api.Tests;

using System.Net;
using System.Text.Json;

using Pouspourika.IdeaVerse.Api.Auth;

public class AccountEmailTests
{
  private const string Email = "new@example.com";

  private static readonly object Credentials = new { email = Email, password = IdeaVerseApiFactory.Password };

  [Test]
  public async Task Register_NewAccount_EmailsConfirmationLinkToWebApp()
  {
    await using var factory = new IdeaVerseApiFactory();
    var client = factory.CreateClient();

    using var register = await client.PostAsJsonAsync("/api/v1/auth/register", Credentials);
    var link = FakeMailSender.LinkIn(factory.Mail.Take(Email, IdentityEmailSender.ConfirmationSubject), $"{IdeaVerseApiFactory.AppUrl}/confirm-email");

    await Assert.That(register.StatusCode).IsEqualTo(HttpStatusCode.OK);
    await Assert.That(link.Query).Contains("userId=");
    await Assert.That(link.Query).Contains("code=");
  }

  [Test]
  public async Task Login_BeforeConfirmingEmail_IsRefusedAsNotAllowed()
  {
    await using var factory = new IdeaVerseApiFactory();
    var client = factory.CreateClient();
    (await client.PostAsJsonAsync("/api/v1/auth/register", Credentials)).Dispose();

    using var login = await client.PostAsJsonAsync("/api/v1/auth/login?useCookies=true", Credentials);

    await Assert.That(login.StatusCode).IsEqualTo(HttpStatusCode.Unauthorized);
    await Assert.That(await DetailAsync(login)).IsEqualTo("NotAllowed");
  }

  [Test]
  public async Task Login_AfterConfirmingThroughEmailLink_Succeeds()
  {
    await using var factory = new IdeaVerseApiFactory();
    var client = factory.CreateClient();
    await factory.RegisterAndConfirmAsync(client, Email);

    using var login = await client.PostAsJsonAsync("/api/v1/auth/login?useCookies=true", Credentials);

    await Assert.That(login.StatusCode).IsEqualTo(HttpStatusCode.OK);
  }

  [Test]
  public async Task ConfirmEmail_TamperedCode_IsRejected()
  {
    await using var factory = new IdeaVerseApiFactory();
    var client = factory.CreateClient();
    (await client.PostAsJsonAsync("/api/v1/auth/register", Credentials)).Dispose();
    var link = FakeMailSender.LinkIn(factory.Mail.Take(Email, IdentityEmailSender.ConfirmationSubject), $"{IdeaVerseApiFactory.AppUrl}/confirm-email");

    using var confirm = await client.GetAsync($"/api/v1/auth/confirmEmail{link.Query.Replace("code=", "code=x", StringComparison.Ordinal)}");
    using var login = await client.PostAsJsonAsync("/api/v1/auth/login?useCookies=true", Credentials);

    await Assert.That(confirm.IsSuccessStatusCode).IsFalse();
    await Assert.That(login.StatusCode).IsEqualTo(HttpStatusCode.Unauthorized);
  }

  [Test]
  public async Task ResendConfirmationEmail_UnconfirmedAccount_SendsAnotherLink()
  {
    await using var factory = new IdeaVerseApiFactory();
    var client = factory.CreateClient();
    (await client.PostAsJsonAsync("/api/v1/auth/register", Credentials)).Dispose();
    factory.Mail.Take(Email, IdentityEmailSender.ConfirmationSubject);

    using var resend = await client.PostAsJsonAsync("/api/v1/auth/resendConfirmationEmail", new { email = Email });

    await Assert.That(resend.StatusCode).IsEqualTo(HttpStatusCode.OK);
    await Assert.That(factory.Mail.Sent.Count(m => m.To == Email && m.Subject == IdentityEmailSender.ConfirmationSubject)).IsEqualTo(1);
  }

  [Test]
  public async Task ForgotPassword_ConfirmedAccount_EmailsResetLinkToWebApp()
  {
    await using var factory = new IdeaVerseApiFactory();
    var client = factory.CreateClient();
    await factory.RegisterAndConfirmAsync(client, Email);

    using var forgot = await client.PostAsJsonAsync("/api/v1/auth/forgotPassword", new { email = Email });
    var link = FakeMailSender.LinkIn(factory.Mail.Take(Email, IdentityEmailSender.PasswordResetSubject), $"{IdeaVerseApiFactory.AppUrl}/reset-password");

    await Assert.That(forgot.StatusCode).IsEqualTo(HttpStatusCode.OK);
    await Assert.That(link.Query).Contains($"email={Uri.EscapeDataString(Email)}");
    await Assert.That(link.Query).Contains("code=");
  }

  [Test]
  public async Task ForgotPassword_UnknownEmail_LooksTheSameAndSendsNothing()
  {
    await using var factory = new IdeaVerseApiFactory();
    var client = factory.CreateClient();

    using var forgot = await client.PostAsJsonAsync("/api/v1/auth/forgotPassword", new { email = "nobody@example.com" });

    await Assert.That(forgot.StatusCode).IsEqualTo(HttpStatusCode.OK);
    await Assert.That(factory.Mail.Sent).IsEmpty();
  }

  [Test]
  public async Task ResetPassword_WithCodeFromEmail_ReplacesThePassword()
  {
    await using var factory = new IdeaVerseApiFactory();
    var client = factory.CreateClient();
    await factory.RegisterAndConfirmAsync(client, Email);
    (await client.PostAsJsonAsync("/api/v1/auth/forgotPassword", new { email = Email })).Dispose();
    var link = FakeMailSender.LinkIn(factory.Mail.Take(Email, IdentityEmailSender.PasswordResetSubject), $"{IdeaVerseApiFactory.AppUrl}/reset-password");
    var code = System.Web.HttpUtility.ParseQueryString(link.Query)["code"];

    using var reset = await client.PostAsJsonAsync("/api/v1/auth/resetPassword", new { email = Email, resetCode = code, newPassword = "N3w-passw0rd!" });
    using var oldLogin = await client.PostAsJsonAsync("/api/v1/auth/login?useCookies=true", Credentials);
    using var newLogin = await client.PostAsJsonAsync("/api/v1/auth/login?useCookies=true", new { email = Email, password = "N3w-passw0rd!" });

    await Assert.That(reset.StatusCode).IsEqualTo(HttpStatusCode.OK);
    await Assert.That(oldLogin.StatusCode).IsEqualTo(HttpStatusCode.Unauthorized);
    await Assert.That(newLogin.StatusCode).IsEqualTo(HttpStatusCode.OK);
  }

  [Test]
  public async Task ResetPassword_InvalidCode_ReturnsValidationProblem()
  {
    await using var factory = new IdeaVerseApiFactory();
    var client = factory.CreateClient();
    await factory.RegisterAndConfirmAsync(client, Email);

    using var reset = await client.PostAsJsonAsync("/api/v1/auth/resetPassword", new { email = Email, resetCode = "bogus", newPassword = "N3w-passw0rd!" });

    await Assert.That(reset.StatusCode).IsEqualTo(HttpStatusCode.BadRequest);
  }

  private static async Task<string?> DetailAsync(HttpResponseMessage response)
  {
    using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
    return document.RootElement.TryGetProperty("detail", out var detail) ? detail.GetString() : null;
  }
}
