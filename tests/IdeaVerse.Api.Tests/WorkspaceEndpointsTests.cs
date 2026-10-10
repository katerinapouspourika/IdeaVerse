namespace Pouspourika.IdeaVerse.Api.Tests;

using System.Net;

using Pouspourika.IdeaVerse.Api.Ideas;
using Pouspourika.IdeaVerse.Api.Invitations;
using Pouspourika.IdeaVerse.Api.Workspaces;

using TUnit.Assertions.Enums;

public class WorkspaceEndpointsTests
{
  private static readonly DateOnly Today = IdeaVerseApiFactory.Today;

  [Test]
  public async Task Create_ValidName_ReturnsCreatedWorkspaceOwnedByUser()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync(withWorkspace: false);

    using var response = await client.PostAsJsonAsync("/api/v1/workspaces", new WorkspaceNameRequest("  Acme Marketing  "), Json.Options);
    var workspace = await response.Content.ReadFromJsonAsync<WorkspaceResponse>(Json.Options);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.Created);
    await Assert.That(workspace!.Name).IsEqualTo("Acme Marketing");
    await Assert.That(workspace.Role).IsEqualTo(WorkspaceRole.Owner);
    await Assert.That(workspace.MemberCount).IsEqualTo(1);
  }

  [Test]
  [Arguments("")]
  [Arguments("   ")]
  public async Task Create_BlankName_ReturnsValidationProblem(string name)
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync(withWorkspace: false);

    using var response = await client.PostAsJsonAsync("/api/v1/workspaces", new WorkspaceNameRequest(name), Json.Options);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.BadRequest);
    await Assert.That((await response.ReadValidationErrorsAsync()).Keys).Contains("name");
  }

  [Test]
  public async Task List_NewAccount_ReturnsNoWorkspaces()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync(withWorkspace: false);

    var workspaces = await ListAsync(client);

    await Assert.That(workspaces).IsEmpty();
  }

  [Test]
  public async Task List_OwnedAndJoinedWorkspaces_ReturnsBothByNameWithRoles()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync("zed@example.com");
    using var member = await factory.CreateSignedInClientAsync("amy@example.com");
    using var outsider = await factory.CreateSignedInClientAsync("outsider@example.com");
    await factory.JoinAsync(owner, member, "amy@example.com");

    var workspaces = await ListAsync(member);

    await Assert.That(workspaces.Select(w => (w.Name, w.Role, w.MemberCount))).IsEquivalentTo(
      [("amy@example.com", WorkspaceRole.Owner, 1), ("zed@example.com", WorkspaceRole.Member, 2)],
      CollectionOrdering.Matching);
  }

  [Test]
  public async Task Rename_ByAdmin_RenamesWorkspace()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var admin = await factory.CreateSignedInClientAsync("admin@example.com");
    await factory.JoinAsync(owner, admin, "admin@example.com", WorkspaceRole.Admin);
    var workspaceId = await owner.WorkspaceIdAsync();

    using var response = await admin.PutAsJsonAsync($"/api/v1/workspaces/{workspaceId}", new WorkspaceNameRequest("Acme"), Json.Options);
    var renamed = await response.Content.ReadFromJsonAsync<WorkspaceResponse>(Json.Options);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.OK);
    await Assert.That(renamed!.Name).IsEqualTo("Acme");
    await Assert.That(renamed.Role).IsEqualTo(WorkspaceRole.Admin);
    await Assert.That(renamed.MemberCount).IsEqualTo(2);
  }

  [Test]
  public async Task Rename_ByMember_ReturnsForbidden()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var member = await factory.CreateSignedInClientAsync("member@example.com");
    await factory.JoinAsync(owner, member, "member@example.com");

    using var response = await member.PutAsJsonAsync($"/api/v1/workspaces/{await owner.WorkspaceIdAsync()}", new WorkspaceNameRequest("Mine now"), Json.Options);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.Forbidden);
  }

  [Test]
  public async Task Rename_ByOutsider_ReturnsNotFound()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var outsider = await factory.CreateSignedInClientAsync("outsider@example.com");

    using var response = await outsider.PutAsJsonAsync($"/api/v1/workspaces/{await owner.WorkspaceIdAsync()}", new WorkspaceNameRequest("Mine now"), Json.Options);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
  }

  [Test]
  public async Task ListMembers_MixedRoles_ReturnsOwnerThenAdminsThenMembersByEmail()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync("owner@example.com");
    using var zed = await factory.CreateSignedInClientAsync("zed@example.com");
    using var amy = await factory.CreateSignedInClientAsync("amy@example.com");
    using var bob = await factory.CreateSignedInClientAsync("bob@example.com");
    await factory.JoinAsync(owner, zed, "zed@example.com");
    await factory.JoinAsync(owner, amy, "amy@example.com");
    await factory.JoinAsync(owner, bob, "bob@example.com", WorkspaceRole.Admin);

    var members = await ListMembersAsync(amy, await owner.WorkspaceIdAsync());

    await Assert.That(members.Select(m => (m.Email, m.Role))).IsEquivalentTo(
      [
        ("owner@example.com", WorkspaceRole.Owner),
        ("bob@example.com", WorkspaceRole.Admin),
        ("amy@example.com", WorkspaceRole.Member),
        ("zed@example.com", WorkspaceRole.Member),
      ],
      CollectionOrdering.Matching);
  }

  [Test]
  public async Task ListMembers_ByOutsider_ReturnsNotFound()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var outsider = await factory.CreateSignedInClientAsync("outsider@example.com");

    using var response = await outsider.GetAsync($"/api/v1/workspaces/{await owner.WorkspaceIdAsync()}/members");

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
  }

  [Test]
  public async Task ChangeRole_ByOwner_PromotesMemberToAdmin()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var member = await factory.CreateSignedInClientAsync("member@example.com");
    await factory.JoinAsync(owner, member, "member@example.com");
    var workspaceId = await owner.WorkspaceIdAsync();
    var memberId = await UserIdAsync(owner, workspaceId, "member@example.com");

    using var response = await owner.PutAsJsonAsync($"/api/v1/workspaces/{workspaceId}/members/{memberId}", new ChangeRoleRequest(WorkspaceRole.Admin), Json.Options);
    var changed = await response.Content.ReadFromJsonAsync<WorkspaceMemberResponse>(Json.Options);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.OK);
    await Assert.That(changed!.Role).IsEqualTo(WorkspaceRole.Admin);
    await Assert.That((await ListAsync(member)).Single(w => w.Id == workspaceId).Role).IsEqualTo(WorkspaceRole.Admin);
  }

  [Test]
  public async Task ChangeRole_ByMember_ReturnsForbidden()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var member = await factory.CreateSignedInClientAsync("member@example.com");
    await factory.JoinAsync(owner, member, "member@example.com");
    var workspaceId = await owner.WorkspaceIdAsync();
    var memberId = await UserIdAsync(owner, workspaceId, "member@example.com");

    using var response = await member.PutAsJsonAsync($"/api/v1/workspaces/{workspaceId}/members/{memberId}", new ChangeRoleRequest(WorkspaceRole.Admin), Json.Options);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.Forbidden);
  }

  [Test]
  public async Task ChangeRole_ToOwner_ReturnsValidationProblem()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var member = await factory.CreateSignedInClientAsync("member@example.com");
    await factory.JoinAsync(owner, member, "member@example.com");
    var workspaceId = await owner.WorkspaceIdAsync();
    var memberId = await UserIdAsync(owner, workspaceId, "member@example.com");

    using var response = await owner.PutAsJsonAsync($"/api/v1/workspaces/{workspaceId}/members/{memberId}", new ChangeRoleRequest(WorkspaceRole.Owner), Json.Options);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.BadRequest);
    await Assert.That((await response.ReadValidationErrorsAsync()).Keys).Contains("role");
  }

  [Test]
  public async Task ChangeRole_OfOwner_ReturnsConflict()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var admin = await factory.CreateSignedInClientAsync("admin@example.com");
    await factory.JoinAsync(owner, admin, "admin@example.com", WorkspaceRole.Admin);
    var workspaceId = await owner.WorkspaceIdAsync();
    var ownerId = await UserIdAsync(owner, workspaceId, "owner@example.com");

    using var response = await admin.PutAsJsonAsync($"/api/v1/workspaces/{workspaceId}/members/{ownerId}", new ChangeRoleRequest(WorkspaceRole.Member), Json.Options);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.Conflict);
  }

  [Test]
  public async Task RemoveMember_ByAdmin_RemovesThemFromWorkspaceAndIdeaTeams()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var admin = await factory.CreateSignedInClientAsync("admin@example.com");
    using var member = await factory.CreateSignedInClientAsync("member@example.com");
    await factory.JoinAsync(owner, admin, "admin@example.com", WorkspaceRole.Admin);
    await factory.JoinAsync(owner, member, "member@example.com");
    var workspaceId = await owner.WorkspaceIdAsync();
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();
    var added = await (await owner.AddMemberAsync(idea.Id, "member@example.com")).ReadMemberAsync();

    using var remove = await admin.DeleteAsync($"/api/v1/workspaces/{workspaceId}/members/{added.UserId}");
    using var memberView = await member.GetAsync($"/api/v1/ideas/{idea.Id}");
    var team = await (await owner.GetAsync($"/api/v1/ideas/{idea.Id}/members")).ReadMembersAsync();

    await Assert.That(remove.StatusCode).IsEqualTo(HttpStatusCode.NoContent);
    await Assert.That(memberView.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
    await Assert.That(team.Select(m => m.Email)).IsEquivalentTo(["owner@example.com"]);
    await Assert.That((await ListAsync(member)).Select(w => w.Id)).DoesNotContain(workspaceId);
  }

  [Test]
  public async Task RemoveMember_MemberRemovesThemselves_LeavesWorkspace()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var member = await factory.CreateSignedInClientAsync("member@example.com");
    await factory.JoinAsync(owner, member, "member@example.com");
    var workspaceId = await owner.WorkspaceIdAsync();
    var memberId = await UserIdAsync(owner, workspaceId, "member@example.com");

    using var response = await member.DeleteAsync($"/api/v1/workspaces/{workspaceId}/members/{memberId}");

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NoContent);
    await Assert.That((await ListMembersAsync(owner, workspaceId)).Select(m => m.Email)).IsEquivalentTo(["owner@example.com"]);
  }

  [Test]
  public async Task RemoveMember_MemberRemovesSomeoneElse_ReturnsForbidden()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var member = await factory.CreateSignedInClientAsync("member@example.com");
    using var third = await factory.CreateSignedInClientAsync("third@example.com");
    await factory.JoinAsync(owner, member, "member@example.com");
    await factory.JoinAsync(owner, third, "third@example.com");
    var workspaceId = await owner.WorkspaceIdAsync();
    var thirdId = await UserIdAsync(owner, workspaceId, "third@example.com");

    using var response = await member.DeleteAsync($"/api/v1/workspaces/{workspaceId}/members/{thirdId}");

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.Forbidden);
  }

  [Test]
  public async Task RemoveMember_Owner_ReturnsConflict()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    var workspaceId = await owner.WorkspaceIdAsync();
    var ownerId = await UserIdAsync(owner, workspaceId, "owner@example.com");

    using var response = await owner.DeleteAsync($"/api/v1/workspaces/{workspaceId}/members/{ownerId}");

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.Conflict);
  }

  [Test]
  public async Task RemoveMember_SomeoneNotInWorkspace_ReturnsNotFound()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();

    using var response = await owner.DeleteAsync($"/api/v1/workspaces/{await owner.WorkspaceIdAsync()}/members/{Guid.NewGuid()}");

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
  }

  [Test]
  public async Task ChangeRole_ByAdmin_DemotesAnotherAdmin()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var admin = await factory.CreateSignedInClientAsync("admin@example.com");
    using var other = await factory.CreateSignedInClientAsync("other@example.com");
    await factory.JoinAsync(owner, admin, "admin@example.com", WorkspaceRole.Admin);
    await factory.JoinAsync(owner, other, "other@example.com", WorkspaceRole.Admin);
    var workspaceId = await owner.WorkspaceIdAsync();
    var otherId = await UserIdAsync(owner, workspaceId, "other@example.com");

    using var response = await admin.PutAsJsonAsync($"/api/v1/workspaces/{workspaceId}/members/{otherId}", new ChangeRoleRequest(WorkspaceRole.Member), Json.Options);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.OK);
    await Assert.That((await ListMembersAsync(owner, workspaceId)).Single(m => m.Email == "other@example.com").Role).IsEqualTo(WorkspaceRole.Member);
  }

  [Test]
  public async Task ChangeRole_AdminToMember_RevokesTheInvitationsTheySent()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var admin = await factory.CreateSignedInClientAsync("admin@example.com");
    using var alt = await factory.CreateSignedInClientAsync("admin.alt@example.com", withWorkspace: false);
    await factory.JoinAsync(owner, admin, "admin@example.com", WorkspaceRole.Admin);
    var workspaceId = await owner.WorkspaceIdAsync();
    (await admin.PostAsJsonAsync($"/api/v1/workspaces/{workspaceId}/invitations", new InviteRequest("admin.alt@example.com", WorkspaceRole.Admin), Json.Options)).Dispose();
    var adminId = await UserIdAsync(owner, workspaceId, "admin@example.com");

    (await owner.PutAsJsonAsync($"/api/v1/workspaces/{workspaceId}/members/{adminId}", new ChangeRoleRequest(WorkspaceRole.Member), Json.Options)).Dispose();
    var received = await alt.GetFromJsonAsync<ReceivedInvitationResponse[]>("/api/v1/invitations", Json.Options);

    await Assert.That(received!).IsEmpty();
  }

  [Test]
  public async Task RemoveMember_AdminWithOpenInvitations_RevokesThem()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var admin = await factory.CreateSignedInClientAsync("admin@example.com");
    await factory.JoinAsync(owner, admin, "admin@example.com", WorkspaceRole.Admin);
    var workspaceId = await owner.WorkspaceIdAsync();
    (await admin.PostAsJsonAsync($"/api/v1/workspaces/{workspaceId}/invitations", new InviteRequest("friend@example.com"), Json.Options)).Dispose();
    (await owner.PostAsJsonAsync($"/api/v1/workspaces/{workspaceId}/invitations", new InviteRequest("colleague@example.com"), Json.Options)).Dispose();
    var adminId = await UserIdAsync(owner, workspaceId, "admin@example.com");

    (await owner.DeleteAsync($"/api/v1/workspaces/{workspaceId}/members/{adminId}")).Dispose();
    var open = await owner.GetFromJsonAsync<InvitationResponse[]>($"/api/v1/workspaces/{workspaceId}/invitations", Json.Options);

    await Assert.That(open!.Select(i => i.Email)).IsEquivalentTo(["colleague@example.com"]);
  }

  [Test]
  public async Task RemoveMember_IdeaOwner_LosesAccessWhileIdeaStaysInWorkspace()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var member = await factory.CreateSignedInClientAsync("member@example.com");
    await factory.JoinAsync(owner, member, "member@example.com");
    var workspaceId = await owner.WorkspaceIdAsync();
    var idea = await (await member.PostAsJsonAsync($"/api/v1/workspaces/{workspaceId}/ideas", new CreateIdeaRequest("Member's idea", null, Today.AddDays(5)), Json.Options)).ReadIdeaAsync();
    var memberId = await UserIdAsync(owner, workspaceId, "member@example.com");

    (await owner.DeleteAsync($"/api/v1/workspaces/{workspaceId}/members/{memberId}")).Dispose();
    using var asFormerMember = await member.GetAsync($"/api/v1/ideas/{idea.Id}");
    var asOwner = await (await owner.GetAsync($"/api/v1/ideas/{idea.Id}")).ReadIdeaAsync();

    await Assert.That(asFormerMember.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
    await Assert.That(asOwner.OwnerEmail).IsEqualTo("member@example.com");
    await Assert.That(asOwner.CanManage).IsTrue();
  }

  private static async Task<WorkspaceResponse[]> ListAsync(HttpClient client)
    => (await client.GetFromJsonAsync<WorkspaceResponse[]>("/api/v1/workspaces", Json.Options))!;

  private static async Task<WorkspaceMemberResponse[]> ListMembersAsync(HttpClient client, Guid workspaceId)
    => (await client.GetFromJsonAsync<WorkspaceMemberResponse[]>($"/api/v1/workspaces/{workspaceId}/members", Json.Options))!;

  private static async Task<string> UserIdAsync(HttpClient client, Guid workspaceId, string email)
    => (await ListMembersAsync(client, workspaceId)).Single(m => m.Email == email).UserId;
}
