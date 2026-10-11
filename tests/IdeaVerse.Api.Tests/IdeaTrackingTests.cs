namespace Pouspourika.IdeaVerse.Api.Tests;

using System.Net;

using Pouspourika.IdeaVerse.Api.Activity;
using Pouspourika.IdeaVerse.Api.Ideas;
using Pouspourika.IdeaVerse.Api.Workspaces;

using TUnit.Assertions.Enums;

public class IdeaTrackingTests
{
  private static readonly DateOnly Today = IdeaVerseApiFactory.Today;

  [Test]
  public async Task Create_WithTags_StoresThemTrimmedLowerCaseAndDistinct()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();

    var idea = await CreateAsync(client, "Launch", Today.AddDays(5), [" Marketing ", "Q4  launch", "marketing", " "]);

    await Assert.That(idea.Tags).IsEquivalentTo(["marketing", "q4 launch"], CollectionOrdering.Matching);
  }

  [Test]
  public async Task Create_TagTooLong_ReturnsValidationProblem()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();

    using var response = await client.PostAsJsonAsync(
      $"/api/v1/workspaces/{await client.WorkspaceIdAsync()}/ideas",
      new CreateIdeaRequest("Launch", null, Today.AddDays(5), [new string('a', Idea.TagMaxLength + 1)]),
      Json.Options);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.BadRequest);
    await Assert.That((await response.ReadValidationErrorsAsync()).Keys).Contains("tags");
  }

  [Test]
  public async Task Create_TooManyTags_ReturnsValidationProblem()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();

    using var response = await client.PostAsJsonAsync(
      $"/api/v1/workspaces/{await client.WorkspaceIdAsync()}/ideas",
      new CreateIdeaRequest("Launch", null, Today.AddDays(5), [.. Enumerable.Range(0, Idea.MaxTags + 1).Select(n => $"tag{n}")]),
      Json.Options);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.BadRequest);
  }

  [Test]
  public async Task Update_WithoutTags_KeepsThemAndWithTagsRecordsTheChange()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    var idea = await CreateAsync(client, "Launch", Today.AddDays(5), ["marketing"]);

    using var kept = await client.PutAsJsonAsync($"/api/v1/ideas/{idea.Id}", new UpdateIdeaRequest("Launch v2", null, idea.TargetDate, idea.Status), Json.Options);
    using var changed = await client.PutAsJsonAsync($"/api/v1/ideas/{idea.Id}", new UpdateIdeaRequest("Launch v2", null, idea.TargetDate, idea.Status, ["Design"]), Json.Options);
    var activity = await client.GetFromJsonAsync<ActivityResponse[]>($"/api/v1/ideas/{idea.Id}/activity", Json.Options);

    await Assert.That((await kept.ReadIdeaAsync()).Tags).IsEquivalentTo(["marketing"]);
    await Assert.That((await changed.ReadIdeaAsync()).Tags).IsEquivalentTo(["design"]);
    await Assert.That(activity!.Where(a => a.Kind == ActivityKind.TagsChanged).Select(a => a.Detail)).IsEquivalentTo(["design"]);
  }

  [Test]
  public async Task List_BySearchAndTag_ReturnsOnlyMatchingIdeas()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    var workspaceId = await client.WorkspaceIdAsync();
    await CreateAsync(client, "Spring Campaign", Today.AddDays(5), ["marketing"]);
    await CreateAsync(client, "Office move", Today.AddDays(6), ["ops"], "Plan the new CAMPAIGN room");
    await CreateAsync(client, "Hiring", Today.AddDays(7), ["ops"]);

    var bySearch = await (await client.ListIdeasAsync(workspaceId, "?search=campaign")).ReadIdeasAsync();
    var byTag = await (await client.ListIdeasAsync(workspaceId, "?tag=OPS")).ReadIdeasAsync();
    var byBoth = await (await client.ListIdeasAsync(workspaceId, "?search=campaign&tag=ops")).ReadIdeasAsync();

    await Assert.That(bySearch.Select(i => i.Title)).IsEquivalentTo(["Spring Campaign", "Office move"], CollectionOrdering.Matching);
    await Assert.That(byTag.Select(i => i.Title)).IsEquivalentTo(["Office move", "Hiring"], CollectionOrdering.Matching);
    await Assert.That(byBoth.Select(i => i.Title)).IsEquivalentTo(["Office move"]);
  }

  [Test]
  [Arguments("", new[] { "Bravo", "Alpha", "Charlie" })]
  [Arguments("?sort=Title", new[] { "Alpha", "Bravo", "Charlie" })]
  [Arguments("?sort=Created", new[] { "Charlie", "Bravo", "Alpha" })]
  [Arguments("?sort=Updated", new[] { "Bravo", "Charlie", "Alpha" })]
  public async Task List_WithSort_OrdersIdeas(string query, string[] expected)
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    var workspaceId = await client.WorkspaceIdAsync();
    await CreateAsync(client, "Alpha", Today.AddDays(9));
    factory.Time.Advance(TimeSpan.FromMinutes(1));
    var bravo = await CreateAsync(client, "Bravo", Today.AddDays(3));
    factory.Time.Advance(TimeSpan.FromMinutes(1));
    await CreateAsync(client, "Charlie", Today.AddDays(12));
    factory.Time.Advance(TimeSpan.FromMinutes(1));
    (await client.PutAsJsonAsync($"/api/v1/ideas/{bravo.Id}", new UpdateIdeaRequest("Bravo", "Touched", bravo.TargetDate, bravo.Status), Json.Options)).Dispose();

    var ideas = await (await client.ListIdeasAsync(workspaceId, query)).ReadIdeasAsync();

    await Assert.That(ideas.Select(i => i.Title)).IsEquivalentTo(expected, CollectionOrdering.Matching);
  }

  [Test]
  public async Task Tags_ListsTagsInUseAlphabetically()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    await CreateAsync(client, "Launch", Today.AddDays(5), ["ops", "marketing"]);
    await CreateAsync(client, "Hiring", Today.AddDays(6), ["ops", "people"]);

    var tags = await client.GetFromJsonAsync<string[]>($"/api/v1/workspaces/{await client.WorkspaceIdAsync()}/tags", Json.Options);

    await Assert.That(tags!).IsEquivalentTo(["marketing", "ops", "people"], CollectionOrdering.Matching);
  }

  [Test]
  public async Task Tags_WorkspaceUserIsNotIn_ReturnsNotFound()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var other = await factory.CreateSignedInClientAsync("other@example.com");

    using var response = await other.GetAsync($"/api/v1/workspaces/{await owner.WorkspaceIdAsync()}/tags");

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
  }

  [Test]
  public async Task Archive_ByOwner_MovesIdeaToTheArchiveAndRestoreBringsItBack()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    var workspaceId = await client.WorkspaceIdAsync();
    var idea = await CreateAsync(client, "Launch", Today.AddDays(5));

    using var archived = await client.PostAsync($"/api/v1/ideas/{idea.Id}/archive", null);
    var active = await (await client.ListIdeasAsync(workspaceId)).ReadIdeasAsync();
    var archive = await (await client.ListIdeasAsync(workspaceId, "?archived=true")).ReadIdeasAsync();
    using var again = await client.PostAsync($"/api/v1/ideas/{idea.Id}/archive", null);
    using var restored = await client.PostAsync($"/api/v1/ideas/{idea.Id}/restore", null);
    var activity = await client.GetFromJsonAsync<ActivityResponse[]>($"/api/v1/ideas/{idea.Id}/activity", Json.Options);

    await Assert.That(archived.StatusCode).IsEqualTo(HttpStatusCode.OK);
    await Assert.That((await archived.ReadIdeaAsync()).ArchivedAt).IsEqualTo(factory.Time.GetUtcNow());
    await Assert.That(active).IsEmpty();
    await Assert.That(archive.Select(i => i.Id)).IsEquivalentTo([idea.Id]);
    await Assert.That(again.StatusCode).IsEqualTo(HttpStatusCode.Conflict);
    await Assert.That((await restored.ReadIdeaAsync()).ArchivedAt).IsNull();
    await Assert.That(activity!.Select(a => a.Kind)).Contains(ActivityKind.Archived).And.Contains(ActivityKind.Restored);
  }

  [Test]
  public async Task Archive_ByTeamMember_ReturnsForbidden()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var member = await factory.CreateSignedInClientAsync("member@example.com");
    await factory.JoinAsync(owner, member, "member@example.com");
    var idea = await CreateAsync(owner, "Launch", Today.AddDays(5));
    (await owner.AddMemberAsync(idea.Id, "member@example.com")).Dispose();

    using var response = await member.PostAsync($"/api/v1/ideas/{idea.Id}/archive", null);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.Forbidden);
  }

  [Test]
  public async Task Archive_ByWorkspaceAdmin_Succeeds()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var admin = await factory.CreateSignedInClientAsync("admin@example.com");
    await factory.JoinAsync(owner, admin, "admin@example.com", WorkspaceRole.Admin);
    var idea = await CreateAsync(owner, "Launch", Today.AddDays(5));

    using var response = await admin.PostAsync($"/api/v1/ideas/{idea.Id}/archive", null);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.OK);
  }

  [Test]
  public async Task Archive_OverdueIdea_IsNoLongerOverdueAndGetsNoReminders()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    var idea = await CreateAsync(client, "Launch", Today.AddDays(1));
    factory.Time.Advance(TimeSpan.FromDays(3));

    var archived = await (await client.PostAsync($"/api/v1/ideas/{idea.Id}/archive", null)).ReadIdeaAsync();
    var run = await factory.RunRemindersAsync();

    await Assert.That(archived.IsOverdue).IsFalse();
    await Assert.That(run.Raised).IsEqualTo(0);
  }

  private static async Task<IdeaResponse> CreateAsync(HttpClient client, string title, DateOnly targetDate, string[]? tags = null, string? description = null)
  {
    using var response = await client.PostAsJsonAsync(
      $"/api/v1/workspaces/{await client.WorkspaceIdAsync()}/ideas",
      new CreateIdeaRequest(title, description, targetDate, tags),
      Json.Options);
    return await response.ReadIdeaAsync();
  }
}
