namespace Pouspourika.IdeaVerse.Api.Tests;

using System.Net;

using Pouspourika.IdeaVerse.Api.Ideas;

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
  public async Task List_SeveralIdeas_ReturnsOwnIdeasSoonestFirst()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var other = await factory.CreateSignedInClientAsync("other@example.com");
    (await owner.CreateIdeaAsync("Later", Today.AddDays(20))).Dispose();
    (await owner.CreateIdeaAsync("Sooner", Today.AddDays(5))).Dispose();
    (await other.CreateIdeaAsync("Not mine", Today.AddDays(1))).Dispose();

    using var response = await owner.GetAsync("/api/v1/ideas");
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

    using var response = await client.GetAsync("/api/v1/ideas?status=Postponed");
    var ideas = await response.ReadIdeasAsync();

    await Assert.That(ideas.Select(i => i.Title)).IsEquivalentTo(["Postponed"]);
  }

  [Test]
  public async Task Get_AnotherUsersIdea_ReturnsNotFound()
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
  public async Task Update_AnotherUsersIdea_ReturnsNotFound()
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
  public async Task Delete_AnotherUsersIdea_ReturnsNotFoundAndKeepsIt()
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
