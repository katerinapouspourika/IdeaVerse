namespace Pouspourika.IdeaVerse.Api.Tests;

using System.Net;

using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;

using Pouspourika.IdeaVerse.Api.Data;
using Pouspourika.IdeaVerse.Api.Invitations;
using Pouspourika.IdeaVerse.Api.Workspaces;

public class InvitationEndpointsTests
{
  private const string InviteeEmail = "invitee@example.com";

  [Test]
  public async Task Invite_NewEmail_ReturnsCreatedAndEmailsLinkToInvitations()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    var workspace = await owner.WorkspaceAsync();

    using var response = await InviteAsync(owner, workspace.Id, "  Invitee@Example.com ", WorkspaceRole.Admin);
    var invitation = await response.Content.ReadFromJsonAsync<InvitationResponse>(Json.Options);
    var mail = factory.Mail.Take("Invitee@Example.com", InvitationService.Subject(workspace.Name));

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.Created);
    await Assert.That(invitation!.Email).IsEqualTo("Invitee@Example.com");
    await Assert.That(invitation.Role).IsEqualTo(WorkspaceRole.Admin);
    await Assert.That(invitation.InvitedByEmail).IsEqualTo("owner@example.com");
    await Assert.That(invitation.ExpiresAt).IsEqualTo(factory.Time.GetUtcNow() + Invitation.Lifetime);
    await Assert.That(FakeMailSender.LinkIn(mail, IdeaVerseApiFactory.AppUrl).ToString()).IsEqualTo($"{IdeaVerseApiFactory.AppUrl}/invitations");
    await Assert.That(mail.Body).Contains("owner@example.com invited you");
  }

  [Test]
  public async Task Invite_SameEmailAgain_RenewsAndResendsTheInvitation()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    var workspace = await owner.WorkspaceAsync();
    (await InviteAsync(owner, workspace.Id, InviteeEmail)).Dispose();
    factory.Time.Advance(TimeSpan.FromDays(3));

    using var response = await InviteAsync(owner, workspace.Id, "INVITEE@example.com", WorkspaceRole.Admin);
    var open = await ListAsync(owner, workspace.Id);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.OK);
    await Assert.That(open.Single().Role).IsEqualTo(WorkspaceRole.Admin);
    await Assert.That(open.Single().ExpiresAt).IsEqualTo(factory.Time.GetUtcNow() + Invitation.Lifetime);
    await Assert.That(factory.Mail.Sent.Count(m => m.Subject == InvitationService.Subject(workspace.Name))).IsEqualTo(2);
  }

  [Test]
  public async Task Invite_SomeoneAlreadyInWorkspace_ReturnsValidationProblem()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var member = await factory.CreateSignedInClientAsync("member@example.com");
    await factory.JoinAsync(owner, member, "member@example.com");

    using var response = await InviteAsync(owner, await owner.WorkspaceIdAsync(), "member@example.com");

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.BadRequest);
    await Assert.That((await response.ReadValidationErrorsAsync()).Keys).Contains("email");
  }

  [Test]
  public async Task Invite_AsOwner_ReturnsValidationProblem()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();

    using var response = await InviteAsync(owner, await owner.WorkspaceIdAsync(), InviteeEmail, WorkspaceRole.Owner);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.BadRequest);
    await Assert.That((await response.ReadValidationErrorsAsync()).Keys).Contains("role");
  }

  [Test]
  [Arguments("")]
  [Arguments("not-an-email")]
  public async Task Invite_MalformedEmail_ReturnsValidationProblem(string email)
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();

    using var response = await InviteAsync(owner, await owner.WorkspaceIdAsync(), email);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.BadRequest);
    await Assert.That(factory.Mail.Sent).IsEmpty();
  }

  [Test]
  public async Task Invite_ByMember_ReturnsForbiddenAndSendsNothing()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var member = await factory.CreateSignedInClientAsync("member@example.com");
    await factory.JoinAsync(owner, member, "member@example.com");

    using var invite = await InviteAsync(member, await owner.WorkspaceIdAsync(), InviteeEmail);
    using var list = await member.GetAsync($"/api/v1/workspaces/{await owner.WorkspaceIdAsync()}/invitations");

    await Assert.That(invite.StatusCode).IsEqualTo(HttpStatusCode.Forbidden);
    await Assert.That(list.StatusCode).IsEqualTo(HttpStatusCode.Forbidden);
    await Assert.That(factory.Mail.Sent).IsEmpty();
  }

  [Test]
  public async Task Invite_ByOutsider_ReturnsNotFound()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var outsider = await factory.CreateSignedInClientAsync("outsider@example.com");

    using var response = await InviteAsync(outsider, await owner.WorkspaceIdAsync(), InviteeEmail);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
  }

  [Test]
  public async Task Invite_EmailFails_ReturnsErrorAndKeepsNoInvitation()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    var workspaceId = await owner.WorkspaceIdAsync();
    factory.Mail.Fail = true;

    using var response = await InviteAsync(owner, workspaceId, InviteeEmail);
    factory.Mail.Fail = false;

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.InternalServerError);
    await Assert.That(await ListAsync(owner, workspaceId)).IsEmpty();
  }

  [Test]
  public async Task List_ExpiredInvitation_IsNotListed()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    var workspaceId = await owner.WorkspaceIdAsync();
    (await InviteAsync(owner, workspaceId, InviteeEmail)).Dispose();
    factory.Time.Advance(Invitation.Lifetime + TimeSpan.FromMinutes(1));

    await Assert.That(await ListAsync(owner, workspaceId)).IsEmpty();
  }

  [Test]
  public async Task ListReceived_AccountCreatedAfterInvitation_IncludesIt()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    var workspace = await owner.WorkspaceAsync();
    (await InviteAsync(owner, workspace.Id, InviteeEmail, WorkspaceRole.Admin)).Dispose();

    using var invitee = await factory.CreateSignedInClientAsync(InviteeEmail, withWorkspace: false);
    var received = await ReceivedAsync(invitee);

    await Assert.That(received.Single().WorkspaceId).IsEqualTo(workspace.Id);
    await Assert.That(received.Single().WorkspaceName).IsEqualTo(workspace.Name);
    await Assert.That(received.Single().Role).IsEqualTo(WorkspaceRole.Admin);
    await Assert.That(received.Single().InvitedByEmail).IsEqualTo("owner@example.com");
  }

  [Test]
  public async Task ListReceived_SomeoneElsesInvitation_IsNotListed()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var other = await factory.CreateSignedInClientAsync("other@example.com");
    (await InviteAsync(owner, await owner.WorkspaceIdAsync(), InviteeEmail)).Dispose();

    await Assert.That(await ReceivedAsync(other)).IsEmpty();
  }

  [Test]
  public async Task Accept_OpenInvitation_JoinsWorkspaceWithInvitedRole()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var invitee = await factory.CreateSignedInClientAsync(InviteeEmail, withWorkspace: false);
    var workspaceId = await owner.WorkspaceIdAsync();
    (await InviteAsync(owner, workspaceId, InviteeEmail, WorkspaceRole.Admin)).Dispose();
    var invitation = (await ReceivedAsync(invitee)).Single();

    using var response = await invitee.PostAsync($"/api/v1/invitations/{invitation.Id}/accept", content: null);
    var joined = await response.Content.ReadFromJsonAsync<WorkspaceResponse>(Json.Options);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.OK);
    await Assert.That(joined!.Id).IsEqualTo(workspaceId);
    await Assert.That(joined.Role).IsEqualTo(WorkspaceRole.Admin);
    await Assert.That(joined.MemberCount).IsEqualTo(2);
    await Assert.That(await ReceivedAsync(invitee)).IsEmpty();
    await Assert.That(await ListAsync(owner, workspaceId)).IsEmpty();
  }

  [Test]
  public async Task Accept_SomeoneElsesInvitation_ReturnsNotFound()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var other = await factory.CreateSignedInClientAsync("other@example.com");
    var workspaceId = await owner.WorkspaceIdAsync();
    (await InviteAsync(owner, workspaceId, InviteeEmail)).Dispose();
    var invitation = (await ListAsync(owner, workspaceId)).Single();

    using var response = await other.PostAsync($"/api/v1/invitations/{invitation.Id}/accept", content: null);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
  }

  [Test]
  public async Task Accept_ExpiredInvitation_ReturnsNotFound()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var invitee = await factory.CreateSignedInClientAsync(InviteeEmail, withWorkspace: false);
    (await InviteAsync(owner, await owner.WorkspaceIdAsync(), InviteeEmail)).Dispose();
    var invitation = (await ReceivedAsync(invitee)).Single();
    factory.Time.Advance(Invitation.Lifetime + TimeSpan.FromMinutes(1));

    using var response = await invitee.PostAsync($"/api/v1/invitations/{invitation.Id}/accept", content: null);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
  }

  [Test]
  public async Task Decline_OpenInvitation_RemovesItWithoutJoining()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var invitee = await factory.CreateSignedInClientAsync(InviteeEmail, withWorkspace: false);
    var workspaceId = await owner.WorkspaceIdAsync();
    (await InviteAsync(owner, workspaceId, InviteeEmail)).Dispose();
    var invitation = (await ReceivedAsync(invitee)).Single();

    using var response = await invitee.DeleteAsync($"/api/v1/invitations/{invitation.Id}");
    var workspaces = await invitee.GetFromJsonAsync<WorkspaceResponse[]>("/api/v1/workspaces", Json.Options);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NoContent);
    await Assert.That(workspaces!).IsEmpty();
    await Assert.That(await ListAsync(owner, workspaceId)).IsEmpty();
  }

  [Test]
  public async Task Revoke_ByAdmin_RemovesInvitation()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var invitee = await factory.CreateSignedInClientAsync(InviteeEmail, withWorkspace: false);
    var workspaceId = await owner.WorkspaceIdAsync();
    (await InviteAsync(owner, workspaceId, InviteeEmail)).Dispose();
    var invitation = (await ListAsync(owner, workspaceId)).Single();

    using var response = await owner.DeleteAsync($"/api/v1/workspaces/{workspaceId}/invitations/{invitation.Id}");

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NoContent);
    await Assert.That(await ReceivedAsync(invitee)).IsEmpty();
  }

  [Test]
  public async Task Invite_ByAdmin_InvitesAnotherAdmin()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var admin = await factory.CreateSignedInClientAsync("admin@example.com");
    await factory.JoinAsync(owner, admin, "admin@example.com", WorkspaceRole.Admin);

    using var response = await InviteAsync(admin, await owner.WorkspaceIdAsync(), InviteeEmail, WorkspaceRole.Admin);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.Created);
  }

  [Test]
  public async Task Accept_UnconfirmedEmail_ReturnsNotFound()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var invitee = await factory.CreateSignedInClientAsync(InviteeEmail, withWorkspace: false);
    var workspaceId = await owner.WorkspaceIdAsync();
    (await InviteAsync(owner, workspaceId, InviteeEmail)).Dispose();
    var invitation = (await ListAsync(owner, workspaceId)).Single();
    await using (var scope = factory.Services.CreateAsyncScope())
    {
      var users = scope.ServiceProvider.GetRequiredService<UserManager<User>>();
      var account = await users.FindByEmailAsync(InviteeEmail);
      account!.EmailConfirmed = false;
      await users.UpdateAsync(account);
    }

    using var response = await invitee.PostAsync($"/api/v1/invitations/{invitation.Id}/accept", content: null);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
    await Assert.That(await ReceivedAsync(invitee)).IsEmpty();
  }

  [Test]
  public async Task Decline_SomeoneElsesInvitation_ReturnsNotFoundAndKeepsIt()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var other = await factory.CreateSignedInClientAsync("other@example.com");
    var workspaceId = await owner.WorkspaceIdAsync();
    (await InviteAsync(owner, workspaceId, InviteeEmail)).Dispose();
    var invitation = (await ListAsync(owner, workspaceId)).Single();

    using var response = await other.DeleteAsync($"/api/v1/invitations/{invitation.Id}");

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
    await Assert.That(await ListAsync(owner, workspaceId)).Count().IsEqualTo(1);
  }

  [Test]
  public async Task Revoke_ByMember_ReturnsForbiddenAndKeepsIt()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var member = await factory.CreateSignedInClientAsync("member@example.com");
    await factory.JoinAsync(owner, member, "member@example.com");
    var workspaceId = await owner.WorkspaceIdAsync();
    (await InviteAsync(owner, workspaceId, InviteeEmail)).Dispose();
    var invitation = (await ListAsync(owner, workspaceId)).Single();

    using var response = await member.DeleteAsync($"/api/v1/workspaces/{workspaceId}/invitations/{invitation.Id}");

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.Forbidden);
    await Assert.That(await ListAsync(owner, workspaceId)).Count().IsEqualTo(1);
  }

  [Test]
  public async Task Revoke_InvitationOfAnotherWorkspace_ReturnsNotFoundAndKeepsIt()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var other = await factory.CreateSignedInClientAsync("other@example.com");
    var workspaceId = await owner.WorkspaceIdAsync();
    (await InviteAsync(owner, workspaceId, InviteeEmail)).Dispose();
    var invitation = (await ListAsync(owner, workspaceId)).Single();

    using var response = await other.DeleteAsync($"/api/v1/workspaces/{await other.WorkspaceIdAsync()}/invitations/{invitation.Id}");

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
    await Assert.That(await ListAsync(owner, workspaceId)).Count().IsEqualTo(1);
  }

  private static Task<HttpResponseMessage> InviteAsync(HttpClient client, Guid workspaceId, string email, WorkspaceRole role = WorkspaceRole.Member)
    => client.PostAsJsonAsync($"/api/v1/workspaces/{workspaceId}/invitations", new InviteRequest(email, role), Json.Options);

  private static async Task<InvitationResponse[]> ListAsync(HttpClient client, Guid workspaceId)
    => (await client.GetFromJsonAsync<InvitationResponse[]>($"/api/v1/workspaces/{workspaceId}/invitations", Json.Options))!;

  private static async Task<ReceivedInvitationResponse[]> ReceivedAsync(HttpClient client)
    => (await client.GetFromJsonAsync<ReceivedInvitationResponse[]>("/api/v1/invitations", Json.Options))!;
}
