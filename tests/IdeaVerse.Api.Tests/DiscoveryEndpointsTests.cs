namespace Pouspourika.IdeaVerse.Api.Tests;

using System.Net;

using Pouspourika.IdeaVerse.Api.Discovery;
using Pouspourika.IdeaVerse.Api.Workspaces;

public class DiscoveryEndpointsTests
{
  [Test]
  public async Task SetSettings_OwnCompanyDomain_LetsColleaguesFindTheWorkspace()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync("owner@acme.test");
    using var colleague = await factory.CreateSignedInClientAsync("mia@acme.test", withWorkspace: false);
    using var outsider = await factory.CreateSignedInClientAsync("leo@globex.test", withWorkspace: false);
    var workspace = await owner.WorkspaceAsync();

    var settings = await SetAsync(owner, workspace.Id, "@ACME.test", discoverable: true);
    var found = await DiscoverAsync(colleague);
    var notFound = await DiscoverAsync(outsider);

    await Assert.That(settings).IsEqualTo(new DiscoverySettingsResponse("acme.test", true, "acme.test"));
    await Assert.That(found).IsEquivalentTo([new DiscoveredWorkspaceResponse(workspace.Id, workspace.Name, 1, Requested: false)]);
    await Assert.That(notFound).IsEmpty();
  }

  [Test]
  public async Task SetSettings_Hidden_KeepsTheDomainButNoOneFindsIt()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync("owner@acme.test");
    using var colleague = await factory.CreateSignedInClientAsync("mia@acme.test", withWorkspace: false);
    var workspaceId = await owner.WorkspaceIdAsync();

    var settings = await SetAsync(owner, workspaceId, "acme.test", discoverable: false);
    using var request = await colleague.PostAsync($"/api/v1/discover/{workspaceId}/request", content: null);

    await Assert.That(settings).IsEqualTo(new DiscoverySettingsResponse("acme.test", false, "acme.test"));
    await Assert.That(await DiscoverAsync(colleague)).IsEmpty();
    await Assert.That(request.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
  }

  [Test]
  [Arguments("owner@acme.test", "globex.test", "Use the domain of your own work email, acme.test.")]
  [Arguments("owner@gmail.com", "gmail.com", "public email provider")]
  public async Task SetSettings_DomainNotTheirCompanys_ReturnsValidationProblem(string ownerEmail, string domain, string reason)
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync(ownerEmail);
    var workspaceId = await owner.WorkspaceIdAsync();

    using var response = await owner.PutAsJsonAsync($"/api/v1/workspaces/{workspaceId}/discovery", new DiscoverySettingsRequest(domain, true), Json.Options);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.BadRequest);
    await Assert.That((await response.ReadValidationErrorsAsync())["domain"].Single()).Contains(reason);
  }

  [Test]
  public async Task SetSettings_Member_IsForbidden()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync("owner@acme.test");
    using var member = await factory.CreateSignedInClientAsync("mia@acme.test", withWorkspace: false);
    await factory.JoinAsync(owner, member, "mia@acme.test");
    var workspaceId = await owner.WorkspaceIdAsync();

    using var response = await member.PutAsJsonAsync($"/api/v1/workspaces/{workspaceId}/discovery", new DiscoverySettingsRequest("acme.test", true), Json.Options);
    using var requests = await member.GetAsync($"/api/v1/workspaces/{workspaceId}/join-requests");

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.Forbidden);
    await Assert.That(requests.StatusCode).IsEqualTo(HttpStatusCode.Forbidden);
  }

  [Test]
  public async Task Request_ThenApprove_AddsAMemberAndEmailsBothSides()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync("owner@acme.test");
    using var colleague = await factory.CreateSignedInClientAsync("mia@acme.test", withWorkspace: false);
    var workspace = await owner.WorkspaceAsync();
    await SetAsync(owner, workspace.Id, "acme.test", discoverable: true);

    using var request = await colleague.PostAsync($"/api/v1/discover/{workspace.Id}/request", content: null);
    using var again = await colleague.PostAsync($"/api/v1/discover/{workspace.Id}/request", content: null);
    var found = await DiscoverAsync(colleague);
    var pending = await owner.GetFromJsonAsync<JoinRequestResponse[]>($"/api/v1/workspaces/{workspace.Id}/join-requests", Json.Options);
    var notice = factory.Mail.Take("owner@acme.test", DiscoveryService.RequestSubject(workspace.Name));
    using var approve = await owner.PostAsync($"/api/v1/workspaces/{workspace.Id}/join-requests/{pending!.Single().Id}/approve", content: null);
    var welcome = factory.Mail.Take("mia@acme.test", DiscoveryService.ApprovedSubject(workspace.Name));
    var mine = await colleague.GetFromJsonAsync<WorkspaceResponse[]>("/api/v1/workspaces", Json.Options);
    var left = await owner.GetFromJsonAsync<JoinRequestResponse[]>($"/api/v1/workspaces/{workspace.Id}/join-requests", Json.Options);

    await Assert.That(request.StatusCode).IsEqualTo(HttpStatusCode.NoContent);
    await Assert.That(again.StatusCode).IsEqualTo(HttpStatusCode.NoContent);
    await Assert.That(found.Single().Requested).IsTrue();
    await Assert.That(pending.Single().Email).IsEqualTo("mia@acme.test");
    await Assert.That(notice.Body).Contains("mia@acme.test works at your company");
    await Assert.That(factory.Mail.Sent.Count(m => m.Subject == DiscoveryService.RequestSubject(workspace.Name))).IsEqualTo(0);
    await Assert.That(approve.StatusCode).IsEqualTo(HttpStatusCode.NoContent);
    await Assert.That(welcome.Body).Contains("was approved");
    await Assert.That(mine!.Single().Role).IsEqualTo(WorkspaceRole.Member);
    await Assert.That(left).IsEmpty();
    await Assert.That(await DiscoverAsync(colleague)).IsEmpty();
  }

  [Test]
  public async Task Decline_Request_RemovesItAndLetsThemAskAgain()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync("owner@acme.test");
    using var colleague = await factory.CreateSignedInClientAsync("mia@acme.test", withWorkspace: false);
    var workspaceId = await owner.WorkspaceIdAsync();
    await SetAsync(owner, workspaceId, "acme.test", discoverable: true);
    (await colleague.PostAsync($"/api/v1/discover/{workspaceId}/request", content: null)).Dispose();
    var pending = await owner.GetFromJsonAsync<JoinRequestResponse[]>($"/api/v1/workspaces/{workspaceId}/join-requests", Json.Options);

    using var decline = await owner.DeleteAsync($"/api/v1/workspaces/{workspaceId}/join-requests/{pending!.Single().Id}");
    var found = await DiscoverAsync(colleague);
    var mine = await colleague.GetFromJsonAsync<WorkspaceResponse[]>("/api/v1/workspaces", Json.Options);

    await Assert.That(decline.StatusCode).IsEqualTo(HttpStatusCode.NoContent);
    await Assert.That(found.Single().Requested).IsFalse();
    await Assert.That(mine).IsEmpty();
  }

  [Test]
  public async Task Withdraw_OwnRequest_RemovesIt()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync("owner@acme.test");
    using var colleague = await factory.CreateSignedInClientAsync("mia@acme.test", withWorkspace: false);
    var workspaceId = await owner.WorkspaceIdAsync();
    await SetAsync(owner, workspaceId, "acme.test", discoverable: true);
    (await colleague.PostAsync($"/api/v1/discover/{workspaceId}/request", content: null)).Dispose();

    using var withdraw = await colleague.DeleteAsync($"/api/v1/discover/{workspaceId}/request");
    var pending = await owner.GetFromJsonAsync<JoinRequestResponse[]>($"/api/v1/workspaces/{workspaceId}/join-requests", Json.Options);

    await Assert.That(withdraw.StatusCode).IsEqualTo(HttpStatusCode.NoContent);
    await Assert.That(pending).IsEmpty();
  }

  [Test]
  public async Task Discover_PublicEmailProvider_FindsNothing()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync("owner@acme.test");
    using var gmail = await factory.CreateSignedInClientAsync("someone@gmail.com", withWorkspace: false);
    await SetAsync(owner, await owner.WorkspaceIdAsync(), "acme.test", discoverable: true);

    await Assert.That(await DiscoverAsync(gmail)).IsEmpty();
  }

  private static async Task<DiscoverySettingsResponse> SetAsync(HttpClient client, Guid workspaceId, string domain, bool discoverable)
  {
    using var response = await client.PutAsJsonAsync($"/api/v1/workspaces/{workspaceId}/discovery", new DiscoverySettingsRequest(domain, discoverable), Json.Options);
    response.EnsureSuccessStatusCode();
    return (await response.Content.ReadFromJsonAsync<DiscoverySettingsResponse>(Json.Options))!;
  }

  private static async Task<DiscoveredWorkspaceResponse[]> DiscoverAsync(HttpClient client)
    => (await client.GetFromJsonAsync<DiscoveredWorkspaceResponse[]>("/api/v1/discover", Json.Options))!;
}
