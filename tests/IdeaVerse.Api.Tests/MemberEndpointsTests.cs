namespace Pouspourika.IdeaVerse.Api.Tests;

using System.Net;

using Pouspourika.IdeaVerse.Api.Components;
using Pouspourika.IdeaVerse.Api.Ideas;
using Pouspourika.IdeaVerse.Api.Workspaces;

using TUnit.Assertions.Enums;

public class MemberEndpointsTests
{
  private const string MemberEmail = "member@example.com";

  private static readonly DateOnly Today = IdeaVerseApiFactory.Today;

  [Test]
  public async Task Add_EmailOfSomeoneInWorkspace_ReturnsCreatedMember()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var member = await factory.CreateSignedInClientAsync(MemberEmail);
    await factory.JoinAsync(owner, member, MemberEmail);
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();

    using var response = await owner.AddMemberAsync(idea.Id, "  MEMBER@example.com ");
    var added = await response.ReadMemberAsync();

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.Created);
    await Assert.That(added.Email).IsEqualTo(MemberEmail);
    await Assert.That(added.Role).IsEqualTo(IdeaRole.Member);
    await Assert.That(response.Headers.Location!.ToString()).IsEqualTo($"/api/v1/ideas/{idea.Id}/members/{added.UserId}");
  }

  [Test]
  public async Task Add_UnregisteredEmail_ReturnsValidationProblem()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();

    using var response = await owner.AddMemberAsync(idea.Id, "nobody@example.com");

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.BadRequest);
    await Assert.That((await response.ReadValidationErrorsAsync()).Keys).Contains("email");
  }

  [Test]
  public async Task Add_RegisteredEmailOutsideWorkspace_ReturnsValidationProblem()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var outsider = await factory.CreateSignedInClientAsync("outsider@example.com");
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();

    using var response = await owner.AddMemberAsync(idea.Id, "outsider@example.com");

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.BadRequest);
    await Assert.That((await response.ReadValidationErrorsAsync())["email"].Single()).Contains("Invite them to the workspace first");
  }

  [Test]
  public async Task Add_ByWorkspaceAdminNotOnIdea_ReturnsCreated()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var admin = await factory.CreateSignedInClientAsync("admin@example.com");
    using var member = await factory.CreateSignedInClientAsync(MemberEmail);
    await factory.JoinAsync(owner, admin, "admin@example.com", WorkspaceRole.Admin);
    await factory.JoinAsync(owner, member, MemberEmail);
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();

    using var response = await admin.AddMemberAsync(idea.Id, MemberEmail);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.Created);
  }

  [Test]
  [Arguments("")]
  [Arguments("not-an-email")]
  public async Task Add_MalformedEmail_ReturnsValidationProblem(string email)
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();

    using var response = await owner.AddMemberAsync(idea.Id, email);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.BadRequest);
    await Assert.That((await response.ReadValidationErrorsAsync()).Keys).Contains("email");
  }

  [Test]
  public async Task Add_OwnersOwnEmail_ReturnsValidationProblem()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();

    using var response = await owner.AddMemberAsync(idea.Id, "owner@example.com");

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.BadRequest);
  }

  [Test]
  public async Task Add_ExistingMember_ReturnsConflict()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var member = await factory.CreateSignedInClientAsync(MemberEmail);
    await factory.JoinAsync(owner, member, MemberEmail);
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();
    (await owner.AddMemberAsync(idea.Id, MemberEmail)).Dispose();

    using var response = await owner.AddMemberAsync(idea.Id, MemberEmail);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.Conflict);
  }

  [Test]
  public async Task Add_ByMember_ReturnsForbidden()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var member = await factory.CreateSignedInClientAsync(MemberEmail);
    await factory.JoinAsync(owner, member, MemberEmail);
    using var third = await factory.CreateSignedInClientAsync("third@example.com");
    await factory.JoinAsync(owner, third, "third@example.com");
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();
    (await owner.AddMemberAsync(idea.Id, MemberEmail)).Dispose();

    using var response = await member.AddMemberAsync(idea.Id, "third@example.com");

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.Forbidden);
  }

  [Test]
  public async Task Add_ByOutsider_ReturnsNotFound()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var outsider = await factory.CreateSignedInClientAsync("outsider@example.com");
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();

    using var response = await outsider.AddMemberAsync(idea.Id, "outsider@example.com");

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
  }

  [Test]
  public async Task List_TeamWithMembers_ReturnsOwnerFirstThenMembersByEmail()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var zed = await factory.CreateSignedInClientAsync("zed@example.com");
    using var amy = await factory.CreateSignedInClientAsync("amy@example.com");
    await factory.JoinAsync(owner, zed, "zed@example.com");
    await factory.JoinAsync(owner, amy, "amy@example.com");
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();
    (await owner.AddMemberAsync(idea.Id, "zed@example.com")).Dispose();
    (await owner.AddMemberAsync(idea.Id, "amy@example.com")).Dispose();

    using var response = await zed.GetAsync($"/api/v1/ideas/{idea.Id}/members");
    var team = await response.ReadMembersAsync();

    await Assert.That(team.Select(m => m.Email)).IsEquivalentTo(["owner@example.com", "amy@example.com", "zed@example.com"], CollectionOrdering.Matching);
    await Assert.That(team.Select(m => m.Role)).IsEquivalentTo([IdeaRole.Owner, IdeaRole.Member, IdeaRole.Member], CollectionOrdering.Matching);
  }

  [Test]
  public async Task List_ByOutsider_ReturnsNotFound()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var outsider = await factory.CreateSignedInClientAsync("outsider@example.com");
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();

    using var response = await outsider.GetAsync($"/api/v1/ideas/{idea.Id}/members");

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
  }

  [Test]
  public async Task List_AsTeamMember_ShowsTeamIdeaAsMemberAndOthersAsViewer()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var member = await factory.CreateSignedInClientAsync(MemberEmail);
    await factory.JoinAsync(owner, member, MemberEmail);
    var shared = await (await owner.CreateIdeaAsync("Shared", Today.AddDays(5))).ReadIdeaAsync();
    (await owner.CreateIdeaAsync("Owner only", Today.AddDays(6))).Dispose();
    (await member.CreateIdeaAsync("In member's own workspace", Today.AddDays(7))).Dispose();
    (await owner.AddMemberAsync(shared.Id, MemberEmail)).Dispose();

    using var memberList = await member.ListIdeasAsync(await owner.WorkspaceIdAsync());
    using var ownerView = await owner.GetAsync($"/api/v1/ideas/{shared.Id}");
    var ideas = await memberList.ReadIdeasAsync();
    var asOwner = await ownerView.ReadIdeaAsync();

    await Assert.That(ideas.Select(i => (i.Title, i.Role, i.CanEdit))).IsEquivalentTo(
      [("Shared", IdeaRole.Member, true), ("Owner only", IdeaRole.Viewer, false)],
      CollectionOrdering.Matching);
    await Assert.That(asOwner.Role).IsEqualTo(IdeaRole.Owner);
    await Assert.That(asOwner.MemberCount).IsEqualTo(1);
  }

  [Test]
  public async Task UpdateAndPostpone_ByTeamMember_Succeed()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var member = await factory.CreateSignedInClientAsync(MemberEmail);
    await factory.JoinAsync(owner, member, MemberEmail);
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();
    (await owner.AddMemberAsync(idea.Id, MemberEmail)).Dispose();

    using var update = await member.PutAsJsonAsync($"/api/v1/ideas/{idea.Id}", new UpdateIdeaRequest("Launch v2", null, Today.AddDays(5), IdeaStatus.InProgress), Json.Options);
    using var postpone = await member.PostAsJsonAsync($"/api/v1/ideas/{idea.Id}/postpone", new PostponeIdeaRequest(Today.AddDays(9)), Json.Options);
    var postponed = await postpone.ReadIdeaAsync();

    await Assert.That(update.StatusCode).IsEqualTo(HttpStatusCode.OK);
    await Assert.That(postpone.StatusCode).IsEqualTo(HttpStatusCode.OK);
    await Assert.That(postponed.Title).IsEqualTo("Launch v2");
    await Assert.That(postponed.Role).IsEqualTo(IdeaRole.Member);
  }

  [Test]
  public async Task ChangeComponents_ByTeamMember_Succeed()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var member = await factory.CreateSignedInClientAsync(MemberEmail);
    await factory.JoinAsync(owner, member, MemberEmail);
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();
    (await owner.AddMemberAsync(idea.Id, MemberEmail)).Dispose();

    using var create = await member.CreateComponentAsync(idea.Id, "Budget");
    var component = await create.ReadComponentAsync();
    using var update = await member.UpdateComponentAsync(idea.Id, component.Id, new UpdateComponentRequest("Budget", null, IsDone: true));

    await Assert.That(create.StatusCode).IsEqualTo(HttpStatusCode.Created);
    await Assert.That(update.StatusCode).IsEqualTo(HttpStatusCode.OK);
  }

  [Test]
  public async Task DeleteIdea_ByTeamMember_ReturnsForbiddenAndKeepsIt()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var member = await factory.CreateSignedInClientAsync(MemberEmail);
    await factory.JoinAsync(owner, member, MemberEmail);
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();
    (await owner.AddMemberAsync(idea.Id, MemberEmail)).Dispose();

    using var delete = await member.DeleteAsync($"/api/v1/ideas/{idea.Id}");
    using var get = await owner.GetAsync($"/api/v1/ideas/{idea.Id}");

    await Assert.That(delete.StatusCode).IsEqualTo(HttpStatusCode.Forbidden);
    await Assert.That(get.StatusCode).IsEqualTo(HttpStatusCode.OK);
  }

  [Test]
  public async Task Remove_ByOwner_TakesMemberOffTeamButLeavesIdeaVisible()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var member = await factory.CreateSignedInClientAsync(MemberEmail);
    await factory.JoinAsync(owner, member, MemberEmail);
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();
    var added = await (await owner.AddMemberAsync(idea.Id, MemberEmail)).ReadMemberAsync();

    using var remove = await owner.DeleteAsync($"/api/v1/ideas/{idea.Id}/members/{added.UserId}");
    using var get = await member.GetAsync($"/api/v1/ideas/{idea.Id}");
    var asMember = await get.ReadIdeaAsync();

    await Assert.That(remove.StatusCode).IsEqualTo(HttpStatusCode.NoContent);
    await Assert.That(asMember.Role).IsEqualTo(IdeaRole.Viewer);
    await Assert.That(asMember.CanEdit).IsFalse();
  }

  [Test]
  public async Task Remove_MemberRemovesThemselves_LeavesIdea()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var member = await factory.CreateSignedInClientAsync(MemberEmail);
    await factory.JoinAsync(owner, member, MemberEmail);
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();
    var added = await (await owner.AddMemberAsync(idea.Id, MemberEmail)).ReadMemberAsync();

    using var leave = await member.DeleteAsync($"/api/v1/ideas/{idea.Id}/members/{added.UserId}");
    using var team = await owner.GetAsync($"/api/v1/ideas/{idea.Id}/members");

    await Assert.That(leave.StatusCode).IsEqualTo(HttpStatusCode.NoContent);
    await Assert.That((await team.ReadMembersAsync()).Select(m => m.Email)).IsEquivalentTo(["owner@example.com"]);
  }

  [Test]
  public async Task Remove_MemberRemovesAnotherMember_ReturnsForbidden()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var member = await factory.CreateSignedInClientAsync(MemberEmail);
    await factory.JoinAsync(owner, member, MemberEmail);
    using var third = await factory.CreateSignedInClientAsync("third@example.com");
    await factory.JoinAsync(owner, third, "third@example.com");
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();
    (await owner.AddMemberAsync(idea.Id, MemberEmail)).Dispose();
    var other = await (await owner.AddMemberAsync(idea.Id, "third@example.com")).ReadMemberAsync();

    using var response = await member.DeleteAsync($"/api/v1/ideas/{idea.Id}/members/{other.UserId}");

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.Forbidden);
  }

  [Test]
  public async Task Remove_ByWorkspaceAdminNotOnIdea_RemovesMember()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var admin = await factory.CreateSignedInClientAsync("admin@example.com");
    using var member = await factory.CreateSignedInClientAsync(MemberEmail);
    await factory.JoinAsync(owner, admin, "admin@example.com", WorkspaceRole.Admin);
    await factory.JoinAsync(owner, member, MemberEmail);
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();
    var added = await (await owner.AddMemberAsync(idea.Id, MemberEmail)).ReadMemberAsync();

    using var response = await admin.DeleteAsync($"/api/v1/ideas/{idea.Id}/members/{added.UserId}");

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NoContent);
  }

  [Test]
  public async Task Remove_Owner_ReturnsConflict()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();
    var ownerEntry = (await (await owner.GetAsync($"/api/v1/ideas/{idea.Id}/members")).ReadMembersAsync()).Single();

    using var response = await owner.DeleteAsync($"/api/v1/ideas/{idea.Id}/members/{ownerEntry.UserId}");

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.Conflict);
  }

  [Test]
  public async Task Remove_UserNotOnTeam_ReturnsNotFound()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();

    using var response = await owner.DeleteAsync($"/api/v1/ideas/{idea.Id}/members/{Guid.NewGuid()}");

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
  }
}
