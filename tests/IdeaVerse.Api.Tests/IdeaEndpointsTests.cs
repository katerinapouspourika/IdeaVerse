namespace Pouspourika.IdeaVerse.Api.Tests;

using System.Net;

using Pouspourika.IdeaVerse.Api.Ideas;
using Pouspourika.IdeaVerse.Api.Workspaces;

using TUnit.Assertions.Enums;

public class IdeaEndpointsTests
{
  private static readonly DateOnly Today = IdeaVerseApiFactory.Today;

  [Test]
  public async Task Create_ValidRequest_ReturnsCreatedPlannedIdea()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();

    using var response = await client.CreateIdeaAsync("  Spring campaign  ", Today.AddDays(30), "Social-first launch");
    var idea = await response.ReadIdeaAsync();

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.Created);
    await Assert.That(response.Headers.Location!.ToString()).EndsWith($"/api/v1/ideas/{idea.Id}");
    await Assert.That(idea.Title).IsEqualTo("Spring campaign");
    await Assert.That(idea.Description).IsEqualTo("Social-first launch");
    await Assert.That(idea.TargetDate).IsEqualTo(Today.AddDays(30));
    await Assert.That(idea.Status).IsEqualTo(IdeaStatus.Planned);
    await Assert.That(idea.IsOverdue).IsFalse();
  }

  [Test]
  public async Task Create_ByOwner_ReportsWorkspaceOwnerAndFullAccess()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    var workspaceId = await client.WorkspaceIdAsync();

    var idea = await (await client.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();

    await Assert.That(idea.WorkspaceId).IsEqualTo(workspaceId);
    await Assert.That(idea.OwnerEmail).IsEqualTo("owner@example.com");
    await Assert.That(idea.Role).IsEqualTo(IdeaRole.Owner);
    await Assert.That(idea.CanEdit).IsTrue();
    await Assert.That(idea.CanManage).IsTrue();
  }

  [Test]
  public async Task Create_InWorkspaceUserIsNotIn_ReturnsNotFound()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var other = await factory.CreateSignedInClientAsync("other@example.com");

    using var response = await other.PostAsJsonAsync(
      $"/api/v1/workspaces/{await owner.WorkspaceIdAsync()}/ideas",
      new CreateIdeaRequest("Sneaky", null, Today.AddDays(5)),
      Json.Options);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
  }

  [Test]
  public async Task List_WorkspaceUserIsNotIn_ReturnsNotFound()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var other = await factory.CreateSignedInClientAsync("other@example.com");

    using var response = await other.ListIdeasAsync(await owner.WorkspaceIdAsync());

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
  }

  [Test]
  public async Task Change_ByViewer_ReturnsForbiddenAndKeepsIdea()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var viewer = await factory.CreateSignedInClientAsync("viewer@example.com");
    await factory.JoinAsync(owner, viewer, "viewer@example.com");
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();

    using var get = await viewer.GetAsync($"/api/v1/ideas/{idea.Id}");
    using var update = await viewer.PutAsJsonAsync($"/api/v1/ideas/{idea.Id}", new UpdateIdeaRequest("Changed", null, Today.AddDays(5), IdeaStatus.Planned), Json.Options);
    using var postpone = await viewer.PostAsJsonAsync($"/api/v1/ideas/{idea.Id}/postpone", new PostponeIdeaRequest(Today.AddDays(9)), Json.Options);
    using var delete = await viewer.DeleteAsync($"/api/v1/ideas/{idea.Id}");
    var seen = await get.ReadIdeaAsync();
    var kept = await (await owner.GetAsync($"/api/v1/ideas/{idea.Id}")).ReadIdeaAsync();

    await Assert.That(seen.Role).IsEqualTo(IdeaRole.Viewer);
    await Assert.That(seen.CanEdit).IsFalse();
    await Assert.That(seen.CanManage).IsFalse();
    await Assert.That(update.StatusCode).IsEqualTo(HttpStatusCode.Forbidden);
    await Assert.That(postpone.StatusCode).IsEqualTo(HttpStatusCode.Forbidden);
    await Assert.That(delete.StatusCode).IsEqualTo(HttpStatusCode.Forbidden);
    await Assert.That(kept.Title).IsEqualTo("Launch");
    await Assert.That(kept.TargetDate).IsEqualTo(Today.AddDays(5));
  }

  [Test]
  public async Task UpdateAndDelete_ByWorkspaceAdminNotOnTeam_Succeed()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var admin = await factory.CreateSignedInClientAsync("admin@example.com");
    await factory.JoinAsync(owner, admin, "admin@example.com", WorkspaceRole.Admin);
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();

    var seen = await (await admin.GetAsync($"/api/v1/ideas/{idea.Id}")).ReadIdeaAsync();
    using var update = await admin.PutAsJsonAsync($"/api/v1/ideas/{idea.Id}", new UpdateIdeaRequest("Launch v2", null, Today.AddDays(5), IdeaStatus.InProgress), Json.Options);
    using var delete = await admin.DeleteAsync($"/api/v1/ideas/{idea.Id}");

    await Assert.That(seen.Role).IsEqualTo(IdeaRole.Viewer);
    await Assert.That(seen.CanEdit).IsTrue();
    await Assert.That(seen.CanManage).IsTrue();
    await Assert.That(update.StatusCode).IsEqualTo(HttpStatusCode.OK);
    await Assert.That(delete.StatusCode).IsEqualTo(HttpStatusCode.NoContent);
  }

  [Test]
  public async Task Create_DateBeforeUtcTodayButTodayInUsersZone_ReturnsCreated()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    await client.SetTimeZoneAsync("Pacific/Honolulu");

    using var response = await client.CreateIdeaAsync("Launch", Today.AddDays(-1));

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.Created);
  }

  [Test]
  public async Task Get_DueTodayInUtcButYesterdayInUsersZone_ReportsOverdueForThatUserOnly()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var ahead = await factory.CreateSignedInClientAsync("ahead@example.com");
    await factory.JoinAsync(owner, ahead, "ahead@example.com");
    await ahead.SetTimeZoneAsync("Pacific/Kiritimati");
    var idea = await (await owner.CreateIdeaAsync("Launch", Today)).ReadIdeaAsync();
    factory.Time.Advance(TimeSpan.FromHours(12));

    var forOwner = await (await owner.GetAsync($"/api/v1/ideas/{idea.Id}")).ReadIdeaAsync();
    var forAhead = await (await ahead.GetAsync($"/api/v1/ideas/{idea.Id}")).ReadIdeaAsync();

    await Assert.That(forOwner.IsOverdue).IsFalse();
    await Assert.That(forAhead.IsOverdue).IsTrue();
  }

  [Test]
  public async Task Create_TargetDateToday_ReturnsCreated()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();

    using var response = await client.CreateIdeaAsync("Launch", Today);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.Created);
  }

  [Test]
  public async Task Create_TargetDateInPast_ReturnsValidationProblem()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();

    using var response = await client.CreateIdeaAsync("Launch", Today.AddDays(-1));

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.BadRequest);
    await Assert.That((await response.ReadValidationErrorsAsync()).Keys).Contains("targetDate");
  }

  [Test]
  [Arguments("")]
  [Arguments("   ")]
  public async Task Create_BlankTitle_ReturnsValidationProblem(string title)
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();

    using var response = await client.CreateIdeaAsync(title, Today.AddDays(1));

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.BadRequest);
    await Assert.That((await response.ReadValidationErrorsAsync()).Keys).Contains("title");
  }

  [Test]
  public async Task Create_TitleTooLong_ReturnsValidationProblem()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();

    using var response = await client.CreateIdeaAsync(new string('a', Idea.TitleMaxLength + 1), Today.AddDays(1));

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.BadRequest);
    await Assert.That((await response.ReadValidationErrorsAsync()).Keys).Contains("title");
  }

  [Test]
  public async Task List_SeveralIdeas_ReturnsWorkspaceIdeasSoonestFirst()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var other = await factory.CreateSignedInClientAsync("other@example.com");
    (await owner.CreateIdeaAsync("Later", Today.AddDays(20))).Dispose();
    (await owner.CreateIdeaAsync("Sooner", Today.AddDays(5))).Dispose();
    (await other.CreateIdeaAsync("In another workspace", Today.AddDays(1))).Dispose();

    using var response = await owner.ListIdeasAsync(await owner.WorkspaceIdAsync());
    var ideas = await response.ReadIdeasAsync();

    await Assert.That(ideas.Select(i => i.Title)).IsEquivalentTo(["Sooner", "Later"], CollectionOrdering.Matching);
  }

  [Test]
  public async Task List_StatusFilter_ReturnsMatchingIdeasOnly()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    (await client.CreateIdeaAsync("Planned", Today.AddDays(5))).Dispose();
    var postponed = await (await client.CreateIdeaAsync("Postponed", Today.AddDays(5))).ReadIdeaAsync();
    (await client.PostAsJsonAsync($"/api/v1/ideas/{postponed.Id}/postpone", new PostponeIdeaRequest(Today.AddDays(9)), Json.Options)).Dispose();

    using var response = await client.ListIdeasAsync(await client.WorkspaceIdAsync(), "?status=Postponed");
    var ideas = await response.ReadIdeasAsync();

    await Assert.That(ideas.Select(i => i.Title)).IsEquivalentTo(["Postponed"]);
  }

  [Test]
  public async Task Get_IdeaInAnotherWorkspace_ReturnsNotFound()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var other = await factory.CreateSignedInClientAsync("other@example.com");
    var idea = await (await owner.CreateIdeaAsync("Private", Today.AddDays(5))).ReadIdeaAsync();

    using var response = await other.GetAsync($"/api/v1/ideas/{idea.Id}");

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
  }

  [Test]
  public async Task Get_TargetDatePassed_ReportsOverdue()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    var idea = await (await client.CreateIdeaAsync("Launch", Today.AddDays(1))).ReadIdeaAsync();
    factory.Time.Advance(TimeSpan.FromDays(2));

    using var response = await client.GetAsync($"/api/v1/ideas/{idea.Id}");

    await Assert.That((await response.ReadIdeaAsync()).IsOverdue).IsTrue();
  }

  [Test]
  public async Task Update_ValidRequest_ReplacesFields()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    var idea = await (await client.CreateIdeaAsync("Draft", Today.AddDays(5))).ReadIdeaAsync();
    factory.Time.Advance(TimeSpan.FromHours(1));

    using var response = await client.PutAsJsonAsync(
      $"/api/v1/ideas/{idea.Id}",
      new UpdateIdeaRequest("Final", "  ", Today.AddDays(7), IdeaStatus.InProgress),
      Json.Options);
    var updated = await response.ReadIdeaAsync();

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.OK);
    await Assert.That(updated.Title).IsEqualTo("Final");
    await Assert.That(updated.Description).IsNull();
    await Assert.That(updated.TargetDate).IsEqualTo(Today.AddDays(7));
    await Assert.That(updated.Status).IsEqualTo(IdeaStatus.InProgress);
    await Assert.That(updated.UpdatedAt).IsGreaterThan(updated.CreatedAt);
  }

  [Test]
  public async Task Update_OverdueIdeaKeepingItsDate_Succeeds()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    var idea = await (await client.CreateIdeaAsync("Launch", Today)).ReadIdeaAsync();
    factory.Time.Advance(TimeSpan.FromDays(3));

    using var response = await client.PutAsJsonAsync(
      $"/api/v1/ideas/{idea.Id}",
      new UpdateIdeaRequest("Launch", null, Today, IdeaStatus.Done),
      Json.Options);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.OK);
    await Assert.That((await response.ReadIdeaAsync()).IsOverdue).IsFalse();
  }

  [Test]
  public async Task Update_NewTargetDateInPast_ReturnsValidationProblem()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    var idea = await (await client.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();

    using var response = await client.PutAsJsonAsync(
      $"/api/v1/ideas/{idea.Id}",
      new UpdateIdeaRequest("Launch", null, Today.AddDays(-1), IdeaStatus.Planned),
      Json.Options);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.BadRequest);
    await Assert.That((await response.ReadValidationErrorsAsync()).Keys).Contains("targetDate");
  }

  [Test]
  public async Task Update_IdeaInAnotherWorkspace_ReturnsNotFound()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var other = await factory.CreateSignedInClientAsync("other@example.com");
    var idea = await (await owner.CreateIdeaAsync("Private", Today.AddDays(5))).ReadIdeaAsync();

    using var response = await other.PutAsJsonAsync(
      $"/api/v1/ideas/{idea.Id}",
      new UpdateIdeaRequest("Hijacked", null, Today.AddDays(5), IdeaStatus.Planned),
      Json.Options);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
  }

  [Test]
  public async Task Postpone_LaterDate_MovesDateAndCountsPostponement()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    var idea = await (await client.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();

    (await client.PostAsJsonAsync($"/api/v1/ideas/{idea.Id}/postpone", new PostponeIdeaRequest(Today.AddDays(10)), Json.Options)).Dispose();
    using var response = await client.PostAsJsonAsync($"/api/v1/ideas/{idea.Id}/postpone", new PostponeIdeaRequest(Today.AddDays(20)), Json.Options);
    var postponed = await response.ReadIdeaAsync();

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.OK);
    await Assert.That(postponed.TargetDate).IsEqualTo(Today.AddDays(20));
    await Assert.That(postponed.Status).IsEqualTo(IdeaStatus.Postponed);
    await Assert.That(postponed.PostponeCount).IsEqualTo(2);
  }

  [Test]
  public async Task Postpone_OverdueIdea_Succeeds()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    var idea = await (await client.CreateIdeaAsync("Launch", Today)).ReadIdeaAsync();
    factory.Time.Advance(TimeSpan.FromDays(3));

    using var response = await client.PostAsJsonAsync($"/api/v1/ideas/{idea.Id}/postpone", new PostponeIdeaRequest(Today.AddDays(10)), Json.Options);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.OK);
    await Assert.That((await response.ReadIdeaAsync()).IsOverdue).IsFalse();
  }

  [Test]
  [Arguments(0)]
  [Arguments(-2)]
  public async Task Postpone_DateNotLaterThanCurrent_ReturnsValidationProblem(int daysFromCurrent)
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    var idea = await (await client.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();

    using var response = await client.PostAsJsonAsync(
      $"/api/v1/ideas/{idea.Id}/postpone",
      new PostponeIdeaRequest(Today.AddDays(5 + daysFromCurrent)),
      Json.Options);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.BadRequest);
    await Assert.That((await response.ReadValidationErrorsAsync()).Keys).Contains("targetDate");
  }

  [Test]
  public async Task Postpone_DoneIdea_ReturnsConflict()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    var idea = await (await client.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();
    (await client.PutAsJsonAsync($"/api/v1/ideas/{idea.Id}", new UpdateIdeaRequest("Launch", null, Today.AddDays(5), IdeaStatus.Done), Json.Options)).Dispose();

    using var response = await client.PostAsJsonAsync($"/api/v1/ideas/{idea.Id}/postpone", new PostponeIdeaRequest(Today.AddDays(10)), Json.Options);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.Conflict);
  }

  [Test]
  public async Task Delete_OwnIdea_RemovesIt()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    var idea = await (await client.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();

    using var delete = await client.DeleteAsync($"/api/v1/ideas/{idea.Id}");
    using var get = await client.GetAsync($"/api/v1/ideas/{idea.Id}");

    await Assert.That(delete.StatusCode).IsEqualTo(HttpStatusCode.NoContent);
    await Assert.That(get.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
  }

  [Test]
  public async Task Delete_IdeaInAnotherWorkspace_ReturnsNotFoundAndKeepsIt()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var other = await factory.CreateSignedInClientAsync("other@example.com");
    var idea = await (await owner.CreateIdeaAsync("Private", Today.AddDays(5))).ReadIdeaAsync();

    using var delete = await other.DeleteAsync($"/api/v1/ideas/{idea.Id}");
    using var get = await owner.GetAsync($"/api/v1/ideas/{idea.Id}");

    await Assert.That(delete.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
    await Assert.That(get.StatusCode).IsEqualTo(HttpStatusCode.OK);
  }
}
