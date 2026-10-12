namespace Pouspourika.IdeaVerse.Api.Tests;

using System.Net;

using Pouspourika.IdeaVerse.Api.InviteLinks;
using Pouspourika.IdeaVerse.Api.Workspaces;

public class InviteLinkEndpointsTests
{
  [Test]
  public async Task Get_NewWorkspace_HasTheLinkTurnedOff()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    var workspaceId = await owner.WorkspaceIdAsync();

    var link = await owner.GetFromJsonAsync<InviteLinkResponse>($"/api/v1/workspaces/{workspaceId}/invite-link", Json.Options);

    await Assert.That(link!.Url).IsNull();
  }

  [Test]
  public async Task Join_ThroughTheLink_AddsAMemberWhoSeesTheWorkspace()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var joiner = await factory.CreateSignedInClientAsync("joiner@example.com", withWorkspace: false);
    var workspace = await owner.WorkspaceAsync();
    var token = await CreateLinkAsync(owner, workspace.Id);

    var preview = await joiner.GetFromJsonAsync<JoinPreviewResponse>($"/api/v1/join/{token}", Json.Options);
    using var join = await joiner.PostAsync($"/api/v1/join/{token}", content: null);
    var joined = await join.Content.ReadFromJsonAsync<WorkspaceResponse>(Json.Options);

    await Assert.That(preview).IsEqualTo(new JoinPreviewResponse(workspace.Id, workspace.Name, 1, AlreadyMember: false));
    await Assert.That(join.StatusCode).IsEqualTo(HttpStatusCode.OK);
    await Assert.That(joined!.Role).IsEqualTo(WorkspaceRole.Member);
    await Assert.That(joined.MemberCount).IsEqualTo(2);
    var mine = await joiner.GetFromJsonAsync<WorkspaceResponse[]>("/api/v1/workspaces", Json.Options);
    await Assert.That(mine!.Single().Id).IsEqualTo(workspace.Id);
  }

  [Test]
  public async Task Join_SomeoneAlreadyIn_KeepsTheirRole()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    var workspaceId = await owner.WorkspaceIdAsync();
    var token = await CreateLinkAsync(owner, workspaceId);

    var preview = await owner.GetFromJsonAsync<JoinPreviewResponse>($"/api/v1/join/{token}", Json.Options);
    using var join = await owner.PostAsync($"/api/v1/join/{token}", content: null);
    var joined = await join.Content.ReadFromJsonAsync<WorkspaceResponse>(Json.Options);

    await Assert.That(preview!.AlreadyMember).IsTrue();
    await Assert.That(joined!.Role).IsEqualTo(WorkspaceRole.Owner);
    await Assert.That(joined.MemberCount).IsEqualTo(1);
  }

  [Test]
  [Arguments("replaced")]
  [Arguments("turned-off")]
  [Arguments("made-up")]
  public async Task Join_LinkNoLongerValid_ReturnsNotFound(string problem)
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var joiner = await factory.CreateSignedInClientAsync("joiner@example.com", withWorkspace: false);
    var workspaceId = await owner.WorkspaceIdAsync();
    var token = await CreateLinkAsync(owner, workspaceId);
    switch (problem)
    {
      case "replaced":
        await CreateLinkAsync(owner, workspaceId);
        break;
      case "turned-off":
        (await owner.DeleteAsync($"/api/v1/workspaces/{workspaceId}/invite-link")).Dispose();
        break;
      default:
        token = "AAAAAAAAAAAAAAAAAAAAAA";
        break;
    }

    using var preview = await joiner.GetAsync($"/api/v1/join/{token}");
    using var join = await joiner.PostAsync($"/api/v1/join/{token}", content: null);
    using var workspaces = await joiner.GetAsync("/api/v1/workspaces");

    await Assert.That(preview.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
    await Assert.That(join.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
    await Assert.That(await workspaces.Content.ReadFromJsonAsync<WorkspaceResponse[]>(Json.Options)).IsEmpty();
  }

  [Test]
  public async Task Create_Member_IsForbidden()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var member = await factory.CreateSignedInClientAsync("member@example.com", withWorkspace: false);
    await factory.JoinAsync(owner, member, "member@example.com");
    var workspaceId = await owner.WorkspaceIdAsync();

    using var create = await member.PostAsync($"/api/v1/workspaces/{workspaceId}/invite-link", content: null);
    using var get = await member.GetAsync($"/api/v1/workspaces/{workspaceId}/invite-link");

    await Assert.That(create.StatusCode).IsEqualTo(HttpStatusCode.Forbidden);
    await Assert.That(get.StatusCode).IsEqualTo(HttpStatusCode.Forbidden);
  }

  [Test]
  public async Task Create_WorkspaceOfSomeoneElse_ReturnsNotFound()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var stranger = await factory.CreateSignedInClientAsync("stranger@example.com");
    var workspaceId = await owner.WorkspaceIdAsync();

    using var create = await stranger.PostAsync($"/api/v1/workspaces/{workspaceId}/invite-link", content: null);

    await Assert.That(create.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
  }

  [Test]
  public async Task Join_SignedOut_ReturnsUnauthorized()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    var token = await CreateLinkAsync(owner, await owner.WorkspaceIdAsync());
    using var visitor = factory.CreateClient();

    using var join = await visitor.PostAsync($"/api/v1/join/{token}", content: null);

    await Assert.That(join.StatusCode).IsEqualTo(HttpStatusCode.Unauthorized);
  }

  private static async Task<string> CreateLinkAsync(HttpClient client, Guid workspaceId)
  {
    using var response = await client.PostAsync($"/api/v1/workspaces/{workspaceId}/invite-link", content: null);
    response.EnsureSuccessStatusCode();
    var link = await response.Content.ReadFromJsonAsync<InviteLinkResponse>(Json.Options);
    return link!.Url!.Segments[^1];
  }
}
