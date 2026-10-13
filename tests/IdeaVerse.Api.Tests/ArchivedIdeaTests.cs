namespace Pouspourika.IdeaVerse.Api.Tests;

using System.Net;

using Pouspourika.IdeaVerse.Api.Comments;
using Pouspourika.IdeaVerse.Api.Components;
using Pouspourika.IdeaVerse.Api.Ideas;
using Pouspourika.IdeaVerse.Api.Workspaces;

public class ArchivedIdeaTests
{
  private static readonly DateOnly Today = IdeaVerseApiFactory.Today;

  [Test]
  [Arguments("update")]
  [Arguments("postpone")]
  [Arguments("priority")]
  [Arguments("add component")]
  [Arguments("update component")]
  [Arguments("reorder components")]
  [Arguments("delete component")]
  [Arguments("add member")]
  [Arguments("remove member")]
  [Arguments("suggest components")]
  [Arguments("improve")]
  public async Task Change_ArchivedIdea_ReturnsConflictAndChangesNothing(string change)
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    var (idea, component) = await ArrangeArchivedAsync(factory, owner);

    using var response = await SendAsync(owner, change, idea, component);
    var after = await (await owner.GetAsync($"/api/v1/ideas/{idea.Id}")).ReadIdeaAsync();
    var components = await (await owner.GetAsync($"/api/v1/ideas/{idea.Id}/components")).ReadComponentsAsync();
    var members = await (await owner.GetAsync($"/api/v1/ideas/{idea.Id}/members")).ReadMembersAsync();

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.Conflict);
    await Assert.That(await response.Content.ReadAsStringAsync()).Contains("This idea is archived. Restore it to make changes.");
    await Assert.That(after.Title).IsEqualTo("Launch");
    await Assert.That(after.Status).IsEqualTo(IdeaStatus.Planned);
    await Assert.That(after.TargetDate).IsEqualTo(Today.AddDays(5));
    await Assert.That(after.Impact).IsNull();
    await Assert.That(after.VoteCount).IsEqualTo(1);
    await Assert.That(components.Select(c => (c.Title, c.IsDone))).IsEquivalentTo([("Budget", false), ("Venue", false)]);
    await Assert.That(members.Select(m => m.Email)).Contains("member@example.com");
    await Assert.That(members.Select(m => m.Email)).DoesNotContain("other@example.com");
  }

  [Test]
  public async Task Update_ArchivedIdeaBySomeoneOffTheTeam_ReturnsForbidden()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    var (idea, _) = await ArrangeArchivedAsync(factory, owner);
    using var viewer = await factory.CreateSignedInClientAsync("viewer@example.com");
    await factory.JoinAsync(owner, viewer, "viewer@example.com");

    using var response = await SendAsync(viewer, "update", idea, component: null);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.Forbidden);
  }

  [Test]
  public async Task TeamChange_ArchivedIdeaByTeamMember_IsForbiddenButLeavingIsArchived()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var member = await factory.CreateSignedInClientAsync("member@example.com");
    await factory.JoinAsync(owner, member, "member@example.com", WorkspaceRole.Member);
    using var other = await factory.CreateSignedInClientAsync("other@example.com");
    await factory.JoinAsync(owner, other, "other@example.com", WorkspaceRole.Member);
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();
    var added = await (await owner.AddMemberAsync(idea.Id, "member@example.com")).ReadMemberAsync();
    (await owner.PostAsync($"/api/v1/ideas/{idea.Id}/archive", null)).Dispose();

    using var add = await member.AddMemberAsync(idea.Id, "other@example.com");
    using var leave = await member.DeleteAsync($"/api/v1/ideas/{idea.Id}/members/{added.UserId}");

    await Assert.That(add.StatusCode).IsEqualTo(HttpStatusCode.Forbidden);
    await Assert.That(leave.StatusCode).IsEqualTo(HttpStatusCode.Conflict);
  }

  [Test]
  public async Task Comment_OnArchivedIdea_IsStillAllowed()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    var (idea, _) = await ArrangeArchivedAsync(factory, owner);

    using var response = await owner.PostAsJsonAsync($"/api/v1/ideas/{idea.Id}/comments", new CommentRequest("Worth another look next year."), Json.Options);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.Created);
  }

  [Test]
  public async Task Delete_ArchivedIdea_IsStillAllowed()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    var (idea, _) = await ArrangeArchivedAsync(factory, owner);

    using var response = await owner.DeleteAsync($"/api/v1/ideas/{idea.Id}");

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NoContent);
  }

  [Test]
  public async Task Update_AfterRestore_Succeeds()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    var (idea, component) = await ArrangeArchivedAsync(factory, owner);

    using var restore = await owner.PostAsync($"/api/v1/ideas/{idea.Id}/restore", null);
    using var update = await SendAsync(owner, "update", idea, component);
    using var check = await SendAsync(owner, "update component", idea, component);

    await Assert.That(restore.StatusCode).IsEqualTo(HttpStatusCode.OK);
    await Assert.That((await update.ReadIdeaAsync()).Title).IsEqualTo("Renamed");
    await Assert.That((await check.ReadComponentAsync()).IsDone).IsTrue();
  }

  /// <summary>
  /// Creates an idea owned by <paramref name="owner"/> with two components, a team member, another person in the workspace, and the owner's vote, then archives it.
  /// </summary>
  private static async Task<(IdeaResponse Idea, ComponentResponse Component)> ArrangeArchivedAsync(IdeaVerseApiFactory factory, HttpClient owner)
  {
    using var member = await factory.CreateSignedInClientAsync("member@example.com");
    await factory.JoinAsync(owner, member, "member@example.com", WorkspaceRole.Member);
    using var other = await factory.CreateSignedInClientAsync("other@example.com");
    await factory.JoinAsync(owner, other, "other@example.com", WorkspaceRole.Member);
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();
    var component = await (await owner.CreateComponentAsync(idea.Id, "Budget")).ReadComponentAsync();
    (await owner.CreateComponentAsync(idea.Id, "Venue")).Dispose();
    (await owner.AddMemberAsync(idea.Id, "member@example.com")).Dispose();
    (await owner.PutAsync($"/api/v1/ideas/{idea.Id}/vote", null)).Dispose();
    (await owner.PostAsync($"/api/v1/ideas/{idea.Id}/archive", null)).Dispose();
    return (Idea: idea, Component: component);
  }

  private static async Task<HttpResponseMessage> SendAsync(HttpClient client, string change, IdeaResponse idea, ComponentResponse? component)
  {
    var ideaPath = $"/api/v1/ideas/{idea.Id}";
    var componentId = component?.Id ?? Guid.NewGuid();
    return change switch
    {
      "update" => await client.PutAsJsonAsync(ideaPath, new UpdateIdeaRequest("Renamed", null, Today.AddDays(5), IdeaStatus.InProgress), Json.Options),
      "postpone" => await client.PostAsJsonAsync($"{ideaPath}/postpone", new PostponeIdeaRequest(Today.AddDays(9)), Json.Options),
      "priority" => await client.PutAsJsonAsync($"{ideaPath}/priority", new SetPriorityRequest(4, 2), Json.Options),
      "add component" => await client.CreateComponentAsync(idea.Id, "Designer"),
      "update component" => await client.UpdateComponentAsync(idea.Id, componentId, new UpdateComponentRequest("Budget", null, IsDone: true)),
      "reorder components" => await ReorderAsync(client, idea.Id),
      "delete component" => await client.DeleteAsync($"{ideaPath}/components/{componentId}"),
      "add member" => await client.AddMemberAsync(idea.Id, "other@example.com"),
      "remove member" => await RemoveMemberAsync(client, idea.Id),
      "suggest components" => await client.PostAsync($"{ideaPath}/ai/components", null),
      "improve" => await client.PostAsync($"{ideaPath}/ai/improve", null),
      _ => throw new ArgumentOutOfRangeException(nameof(change), change, "Unknown change."),
    };
  }

  private static async Task<HttpResponseMessage> ReorderAsync(HttpClient client, Guid ideaId)
  {
    var components = await (await client.GetAsync($"/api/v1/ideas/{ideaId}/components")).ReadComponentsAsync();
    var reversed = components.Select(c => c.Id).Reverse().ToList();
    return await client.PutAsJsonAsync($"/api/v1/ideas/{ideaId}/components/order", new ReorderComponentsRequest(reversed), Json.Options);
  }

  private static async Task<HttpResponseMessage> RemoveMemberAsync(HttpClient client, Guid ideaId)
  {
    var members = await (await client.GetAsync($"/api/v1/ideas/{ideaId}/members")).ReadMembersAsync();
    return await client.DeleteAsync($"/api/v1/ideas/{ideaId}/members/{members.Single(m => m.Email == "member@example.com").UserId}");
  }
}
