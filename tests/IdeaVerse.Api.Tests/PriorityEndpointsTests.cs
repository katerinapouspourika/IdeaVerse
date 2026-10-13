namespace Pouspourika.IdeaVerse.Api.Tests;

using System.Net;

using Pouspourika.IdeaVerse.Api.Activity;
using Pouspourika.IdeaVerse.Api.Ideas;
using Pouspourika.IdeaVerse.Api.Workspaces;

using TUnit.Assertions.Enums;

public class PriorityEndpointsTests
{
  private static readonly DateOnly Today = IdeaVerseApiFactory.Today;

  [Test]
  public async Task Vote_TwiceByOneUserAndOnceByAnother_CountsEachUserOnce()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var viewer = await factory.CreateSignedInClientAsync("viewer@example.com");
    await factory.JoinAsync(owner, viewer, "viewer@example.com");
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();

    (await viewer.PutAsync($"/api/v1/ideas/{idea.Id}/vote", null)).Dispose();
    using var again = await viewer.PutAsync($"/api/v1/ideas/{idea.Id}/vote", null);
    (await owner.PutAsync($"/api/v1/ideas/{idea.Id}/vote", null)).Dispose();
    var seenByViewer = await (await viewer.GetAsync($"/api/v1/ideas/{idea.Id}")).ReadIdeaAsync();

    await Assert.That(again.StatusCode).IsEqualTo(HttpStatusCode.OK);
    await Assert.That(seenByViewer.VoteCount).IsEqualTo(2);
    await Assert.That(seenByViewer.HasVoted).IsTrue();
  }

  [Test]
  public async Task WithdrawVote_RemovesOnlyTheUsersVoteAndIsIdempotent()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var viewer = await factory.CreateSignedInClientAsync("viewer@example.com");
    await factory.JoinAsync(owner, viewer, "viewer@example.com");
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();
    (await owner.PutAsync($"/api/v1/ideas/{idea.Id}/vote", null)).Dispose();
    (await viewer.PutAsync($"/api/v1/ideas/{idea.Id}/vote", null)).Dispose();

    (await viewer.DeleteAsync($"/api/v1/ideas/{idea.Id}/vote")).Dispose();
    using var again = await viewer.DeleteAsync($"/api/v1/ideas/{idea.Id}/vote");
    var seen = await again.ReadIdeaAsync();

    await Assert.That(again.StatusCode).IsEqualTo(HttpStatusCode.OK);
    await Assert.That(seen.VoteCount).IsEqualTo(1);
    await Assert.That(seen.HasVoted).IsFalse();
  }

  [Test]
  [Arguments("PUT")]
  [Arguments("DELETE")]
  public async Task Vote_OutsideUsersWorkspaces_ReturnsNotFound(string method)
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var other = await factory.CreateSignedInClientAsync("other@example.com");
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();
    using var request = new HttpRequestMessage(new HttpMethod(method), $"/api/v1/ideas/{idea.Id}/vote");

    using var response = await other.SendAsync(request);
    var kept = await (await owner.GetAsync($"/api/v1/ideas/{idea.Id}")).ReadIdeaAsync();

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
    await Assert.That(kept.VoteCount).IsEqualTo(0);
  }

  [Test]
  public async Task Vote_ArchivedIdea_IsCounted()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    var idea = await (await client.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();
    (await client.PostAsync($"/api/v1/ideas/{idea.Id}/archive", null)).Dispose();

    using var response = await client.PutAsync($"/api/v1/ideas/{idea.Id}/vote", null);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.OK);
    await Assert.That((await response.ReadIdeaAsync()).VoteCount).IsEqualTo(1);
  }

  [Test]
  public async Task Vote_BySomeoneRemovedFromTheWorkspace_StopsCounting()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var member = await factory.CreateSignedInClientAsync("member@example.com");
    await factory.JoinAsync(owner, member, "member@example.com");
    var workspaceId = await owner.WorkspaceIdAsync();
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();
    (await member.PutAsync($"/api/v1/ideas/{idea.Id}/vote", null)).Dispose();
    var people = await owner.GetFromJsonAsync<WorkspaceMemberResponse[]>($"/api/v1/workspaces/{workspaceId}/members", Json.Options);

    using var removal = await owner.DeleteAsync($"/api/v1/workspaces/{workspaceId}/members/{people!.Single(p => p.Email == "member@example.com").UserId}");
    var seen = await (await owner.GetAsync($"/api/v1/ideas/{idea.Id}")).ReadIdeaAsync();

    await Assert.That(removal.IsSuccessStatusCode).IsTrue();
    await Assert.That(seen.VoteCount).IsEqualTo(0);
  }

  [Test]
  public async Task SetPriority_ByOwner_StoresScoresAndRecordsTheChange()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    var idea = await (await client.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();

    using var response = await client.PutAsJsonAsync($"/api/v1/ideas/{idea.Id}/priority", new SetPriorityRequest(4, 2), Json.Options);
    (await client.PutAsJsonAsync($"/api/v1/ideas/{idea.Id}/priority", new SetPriorityRequest(4, 2), Json.Options)).Dispose();
    var scored = await response.ReadIdeaAsync();
    var activity = (await client.ActivityAsync(idea.Id)).Items;

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.OK);
    await Assert.That(scored.Impact).IsEqualTo(4);
    await Assert.That(scored.Effort).IsEqualTo(2);
    await Assert.That(activity!.Where(a => a.Kind == ActivityKind.Rescored).Select(a => a.Detail ?? string.Empty)).IsEquivalentTo(["Impact 4, effort 2"]);
  }

  [Test]
  public async Task SetPriority_Cleared_RemovesScores()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    var idea = await (await client.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();
    (await client.PutAsJsonAsync($"/api/v1/ideas/{idea.Id}/priority", new SetPriorityRequest(4, 2), Json.Options)).Dispose();

    using var response = await client.PutAsJsonAsync($"/api/v1/ideas/{idea.Id}/priority", new SetPriorityRequest(null, null), Json.Options);
    var cleared = await response.ReadIdeaAsync();

    await Assert.That(cleared.Impact).IsNull();
    await Assert.That(cleared.Effort).IsNull();
  }

  [Test]
  public async Task SetPriority_OneScoreCleared_RecordsWhichScoreIsMissing()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    var idea = await (await client.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();
    (await client.PutAsJsonAsync($"/api/v1/ideas/{idea.Id}/priority", new SetPriorityRequest(4, 2), Json.Options)).Dispose();

    (await client.PutAsJsonAsync($"/api/v1/ideas/{idea.Id}/priority", new SetPriorityRequest(4, null), Json.Options)).Dispose();
    var activity = (await client.ActivityAsync(idea.Id)).Items;

    await Assert.That(activity!.Where(a => a.Kind == ActivityKind.Rescored).Select(a => a.Detail ?? string.Empty))
      .IsEquivalentTo(["Impact 4, effort 2", "Impact 4, effort not scored"]);
  }

  [Test]
  [Arguments(WorkspaceRole.Admin, false)]
  [Arguments(WorkspaceRole.Member, true)]
  public async Task SetPriority_ByWorkspaceAdminOrTeamMember_Succeeds(WorkspaceRole role, bool onTeam)
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var other = await factory.CreateSignedInClientAsync("other@example.com");
    await factory.JoinAsync(owner, other, "other@example.com", role);
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();
    if (onTeam)
    {
      (await owner.AddMemberAsync(idea.Id, "other@example.com")).Dispose();
    }

    using var response = await other.PutAsJsonAsync($"/api/v1/ideas/{idea.Id}/priority", new SetPriorityRequest(3, 3), Json.Options);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.OK);
  }

  [Test]
  public async Task SetPriority_ByViewer_ReturnsForbiddenAndKeepsScores()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var viewer = await factory.CreateSignedInClientAsync("viewer@example.com");
    await factory.JoinAsync(owner, viewer, "viewer@example.com");
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();

    using var response = await viewer.PutAsJsonAsync($"/api/v1/ideas/{idea.Id}/priority", new SetPriorityRequest(5, 1), Json.Options);
    var kept = await (await owner.GetAsync($"/api/v1/ideas/{idea.Id}")).ReadIdeaAsync();

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.Forbidden);
    await Assert.That(kept.Impact).IsNull();
  }

  [Test]
  public async Task SetPriority_OutsideUsersWorkspaces_ReturnsNotFound()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var other = await factory.CreateSignedInClientAsync("other@example.com");
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();

    using var response = await other.PutAsJsonAsync($"/api/v1/ideas/{idea.Id}/priority", new SetPriorityRequest(5, 1), Json.Options);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
  }

  [Test]
  [Arguments(0, 3, "impact")]
  [Arguments(3, 6, "effort")]
  public async Task SetPriority_ScoreOutOfRange_ReturnsValidationProblem(int impact, int effort, string field)
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    var idea = await (await client.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();

    using var response = await client.PutAsJsonAsync($"/api/v1/ideas/{idea.Id}/priority", new SetPriorityRequest(impact, effort), Json.Options);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.BadRequest);
    await Assert.That((await response.ReadValidationErrorsAsync()).Keys).Contains(field);
  }

  [Test]
  public async Task List_SortedByVotes_PutsMostVotedFirst()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var viewer = await factory.CreateSignedInClientAsync("viewer@example.com");
    await factory.JoinAsync(owner, viewer, "viewer@example.com");
    var workspaceId = await owner.WorkspaceIdAsync();
    await owner.CreateIdeaAsync("Alpha", Today.AddDays(3));
    var bravo = await (await owner.CreateIdeaAsync("Bravo", Today.AddDays(9))).ReadIdeaAsync();
    var charlie = await (await owner.CreateIdeaAsync("Charlie", Today.AddDays(12))).ReadIdeaAsync();
    (await owner.PutAsync($"/api/v1/ideas/{bravo.Id}/vote", null)).Dispose();
    (await viewer.PutAsync($"/api/v1/ideas/{bravo.Id}/vote", null)).Dispose();
    (await viewer.PutAsync($"/api/v1/ideas/{charlie.Id}/vote", null)).Dispose();

    var ideas = await (await owner.ListIdeasAsync(workspaceId, "?sort=Votes")).ReadIdeasAsync();

    await Assert.That(ideas.Select(i => i.Title)).IsEquivalentTo(["Bravo", "Charlie", "Alpha"], CollectionOrdering.Matching);
  }

  [Test]
  public async Task List_SortedByPriority_PutsBestImpactForEffortFirstAndPartlyScoredByImpactLast()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    var workspaceId = await client.WorkspaceIdAsync();
    await client.CreateIdeaAsync("Unscored", Today.AddDays(1));
    var partial = await (await client.CreateIdeaAsync("Impact only", Today.AddDays(2))).ReadIdeaAsync();
    (await client.PutAsJsonAsync($"/api/v1/ideas/{partial.Id}/priority", new SetPriorityRequest(5, null), Json.Options)).Dispose();
    await ScoreAsync(client, "Time sink", 1, 5);
    await ScoreAsync(client, "Quick win", 5, 1);
    await ScoreAsync(client, "Big bet", 5, 4);

    var ideas = await (await client.ListIdeasAsync(workspaceId, "?sort=Priority")).ReadIdeasAsync();

    await Assert.That(ideas.Select(i => i.Title)).IsEquivalentTo(["Quick win", "Big bet", "Time sink", "Impact only", "Unscored"], CollectionOrdering.Matching);
  }

  private static async Task ScoreAsync(HttpClient client, string title, int impact, int effort)
  {
    var idea = await (await client.CreateIdeaAsync(title, Today.AddDays(5))).ReadIdeaAsync();
    using var response = await client.PutAsJsonAsync($"/api/v1/ideas/{idea.Id}/priority", new SetPriorityRequest(impact, effort), Json.Options);
    response.EnsureSuccessStatusCode();
  }
}
