namespace Pouspourika.IdeaVerse.Api.Tests;

using System.Net;

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

using Pouspourika.IdeaVerse.Api.Accounts;
using Pouspourika.IdeaVerse.Api.Data;
using Pouspourika.IdeaVerse.Api.Notifications;
using Pouspourika.IdeaVerse.Api.Workspaces;

using TUnit.Assertions.Enums;

public class AccountEndpointsTests
{
  private static readonly int[] UnknownKind = [9];

  [Test]
  public async Task Get_NewAccount_ReturnsEmailAndNoTimeZone()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();

    var account = await client.GetFromJsonAsync<AccountResponse>("/api/v1/account", Json.Options);

    await Assert.That(account!.Email).IsEqualTo("owner@example.com");
    await Assert.That(account.TimeZone).IsNull();
    await Assert.That(account.EmailReminders).IsTrue();
    await Assert.That(account.ReminderKinds).IsEquivalentTo(
      [ReminderKind.ComingUp, ReminderKind.Tomorrow, ReminderKind.Today, ReminderKind.Overdue],
      CollectionOrdering.Matching);
  }

  [Test]
  public async Task UpdateReminders_SomeKindsWithoutEmail_SavesThem()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();

    using var response = await client.PutAsJsonAsync(
      "/api/v1/account/reminders",
      new UpdateRemindersRequest(EmailReminders: false, [ReminderKind.Overdue, ReminderKind.Today]),
      Json.Options);
    var account = await client.GetFromJsonAsync<AccountResponse>("/api/v1/account", Json.Options);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.OK);
    await Assert.That(account!.EmailReminders).IsFalse();
    await Assert.That(account.ReminderKinds).IsEquivalentTo([ReminderKind.Today, ReminderKind.Overdue], CollectionOrdering.Matching);
  }

  [Test]
  public async Task UpdateReminders_UnknownKind_ReturnsValidationProblem()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();

    using var response = await client.PutAsJsonAsync("/api/v1/account/reminders", new { emailReminders = true, reminderKinds = UnknownKind });

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.BadRequest);
    await Assert.That((await response.ReadValidationErrorsAsync()).Keys).Contains("reminderKinds");
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

  [Test]
  public async Task UpdateProfile_DisplayName_ShowsItWhereverThePersonAppears()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var member = await factory.CreateSignedInClientAsync("member@example.com");
    await factory.JoinAsync(owner, member, "member@example.com");
    var workspaceId = await owner.WorkspaceIdAsync();
    var idea = await (await owner.CreateIdeaAsync("Launch", IdeaVerseApiFactory.Today.AddDays(5))).ReadIdeaAsync();

    using var response = await owner.PutAsJsonAsync("/api/v1/account/profile", new UpdateProfileRequest("  Katerina  "), Json.Options);
    var account = await response.Content.ReadFromJsonAsync<AccountResponse>(Json.Options);
    var seenByMember = await (await member.GetAsync($"/api/v1/ideas/{idea.Id}")).ReadIdeaAsync();
    var team = await (await member.GetAsync($"/api/v1/ideas/{idea.Id}/members")).ReadMembersAsync();
    var people = await member.GetFromJsonAsync<WorkspaceMemberResponse[]>($"/api/v1/workspaces/{workspaceId}/members", Json.Options);

    await Assert.That(account!.DisplayName).IsEqualTo("Katerina");
    await Assert.That(seenByMember.OwnerName).IsEqualTo("Katerina");
    await Assert.That(team.Single().Name).IsEqualTo("Katerina");
    await Assert.That(people!.Single(p => p.Email == "owner@example.com").Name).IsEqualTo("Katerina");
  }

  [Test]
  public async Task UpdateProfile_BlankName_ClearsIt()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    (await client.PutAsJsonAsync("/api/v1/account/profile", new UpdateProfileRequest("Kat"), Json.Options)).Dispose();

    using var response = await client.PutAsJsonAsync("/api/v1/account/profile", new UpdateProfileRequest("   "), Json.Options);

    await Assert.That((await response.Content.ReadFromJsonAsync<AccountResponse>(Json.Options))!.DisplayName).IsNull();
  }

  [Test]
  public async Task UpdateProfile_NameTooLong_ReturnsValidationProblem()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();

    using var response = await client.PutAsJsonAsync("/api/v1/account/profile", new UpdateProfileRequest(new string('a', User.DisplayNameMaxLength + 1)), Json.Options);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.BadRequest);
    await Assert.That((await response.ReadValidationErrorsAsync()).Keys).Contains("displayName");
  }

  [Test]
  public async Task Invite_InviterWithName_EmailNamesThem()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    (await owner.PutAsJsonAsync("/api/v1/account/profile", new UpdateProfileRequest("Katerina"), Json.Options)).Dispose();
    var workspace = await owner.WorkspaceAsync();

    (await owner.PostAsJsonAsync($"/api/v1/workspaces/{workspace.Id}/invitations", new Invitations.InviteRequest("new@example.com"), Json.Options)).Dispose();

    var mail = factory.Mail.Take("new@example.com", Invitations.InvitationService.Subject(workspace.Name));
    await Assert.That(mail.Body).StartsWith("Katerina (owner@example.com) invited you");
  }

  [Test]
  public async Task ChangeEmail_ConfirmedThroughNewAddress_SignsInWithIt()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();

    using var request = await client.PostAsJsonAsync("/api/v1/auth/manage/info", new { newEmail = "kat@new.example.com" });
    var mail = factory.Mail.Take("kat@new.example.com", Auth.IdentityEmailSender.ChangeEmailSubject);
    var link = FakeMailSender.LinkIn(mail, $"{IdeaVerseApiFactory.AppUrl}/confirm-email");
    using var confirm = await client.GetAsync($"/api/v1/auth/confirmEmail{link.Query}");
    using var fresh = factory.CreateClient();
    using var login = await fresh.PostAsJsonAsync("/api/v1/auth/login?useCookies=true", new { email = "kat@new.example.com", password = IdeaVerseApiFactory.Password });

    await Assert.That(request.StatusCode).IsEqualTo(HttpStatusCode.OK);
    await Assert.That(confirm.StatusCode).IsEqualTo(HttpStatusCode.OK);
    await Assert.That(login.StatusCode).IsEqualTo(HttpStatusCode.OK);
  }

  [Test]
  public async Task Delete_WrongPassword_ReturnsValidationProblemAndKeepsAccount()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();

    using var response = await client.PostAsJsonAsync("/api/v1/account/delete", new DeleteAccountRequest("Wrong1!"), Json.Options);
    using var still = await client.GetAsync("/api/v1/account");

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.BadRequest);
    await Assert.That((await response.ReadValidationErrorsAsync()).Keys).Contains("password");
    await Assert.That(still.StatusCode).IsEqualTo(HttpStatusCode.OK);
  }

  [Test]
  public async Task Delete_OwnerOfWorkspaceOthersUse_ReturnsConflictNamingIt()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var member = await factory.CreateSignedInClientAsync("member@example.com");
    await factory.JoinAsync(owner, member, "member@example.com");

    using var response = await owner.PostAsJsonAsync("/api/v1/account/delete", new DeleteAccountRequest(IdeaVerseApiFactory.Password), Json.Options);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.Conflict);
    await Assert.That(await response.Content.ReadAsStringAsync()).Contains("owner@example.com");
  }

  [Test]
  public async Task Delete_MemberWithIdeas_PassesTheirIdeasToTheWorkspaceOwnerAndSignsOut()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var member = await factory.CreateSignedInClientAsync("member@example.com");
    await factory.JoinAsync(owner, member, "member@example.com");
    var workspaceId = await owner.WorkspaceIdAsync();
    var idea = await (await member.PostAsJsonAsync(
      $"/api/v1/workspaces/{workspaceId}/ideas",
      new Ideas.CreateIdeaRequest("Member's idea", null, IdeaVerseApiFactory.Today.AddDays(5)),
      Json.Options)).ReadIdeaAsync();
    (await member.AddMemberAsync(idea.Id, "owner@example.com")).Dispose();
    var ownWorkspaceId = await member.WorkspaceIdAsync();

    using var response = await member.PostAsJsonAsync("/api/v1/account/delete", new DeleteAccountRequest(IdeaVerseApiFactory.Password), Json.Options);
    using var afterwards = await member.GetAsync("/api/v1/account");
    var kept = await (await owner.GetAsync($"/api/v1/ideas/{idea.Id}")).ReadIdeaAsync();
    var team = await (await owner.GetAsync($"/api/v1/ideas/{idea.Id}/members")).ReadMembersAsync();
    var people = await owner.GetFromJsonAsync<WorkspaceMemberResponse[]>($"/api/v1/workspaces/{workspaceId}/members", Json.Options);
    await using var scope = factory.Services.CreateAsyncScope();
    var ownWorkspaceLeft = await scope.ServiceProvider.GetRequiredService<IdeaVerseDbContext>().Workspaces.AnyAsync(w => w.Id == ownWorkspaceId);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NoContent);
    await Assert.That(afterwards.StatusCode).IsEqualTo(HttpStatusCode.Unauthorized);
    await Assert.That(kept.OwnerEmail).IsEqualTo("owner@example.com");
    await Assert.That(team.Select(m => m.Email)).IsEquivalentTo(["owner@example.com"]);
    await Assert.That(people!.Select(p => p.Email)).IsEquivalentTo(["owner@example.com"]);
    await Assert.That(ownWorkspaceLeft).IsFalse();
  }
}
