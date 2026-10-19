namespace Pouspourika.IdeaVerse.Api.Tests;

using System.Net;

using Pouspourika.IdeaVerse.Api.Activity;
using Pouspourika.IdeaVerse.Api.Ideas;
using Pouspourika.IdeaVerse.Api.Workspaces;

using TUnit.Assertions.Enums;

public class BulkIdeaEndpointsTests
{
  private static readonly DateOnly Today = IdeaVerseApiFactory.Today;

  [Test]
  public async Task Bulk_SetStatus_ChangesEveryIdeaAndRecordsEachChange()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    var first = await CreateAsync(client, "Launch", Today.AddDays(5));
    var second = await CreateAsync(client, "Webinar", Today.AddDays(8));

    using var response = await BulkAsync(client, new BulkIdeaRequest([first.Id, second.Id], BulkIdeaOperation.SetStatus, Status: IdeaStatus.InProgress));
    var results = await ReadResultsAsync(response);
    var activity = (await client.ActivityAsync(first.Id)).Items;

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.OK);
    await Assert.That(results.Select(r => r.Id)).IsEquivalentTo([first.Id, second.Id], CollectionOrdering.Matching);
    await Assert.That(results.Select(r => r.Outcome)).IsEquivalentTo([ChangeOutcome.Changed, ChangeOutcome.Changed]);
    await Assert.That(results.Select(r => r.Idea!.Status)).IsEquivalentTo([IdeaStatus.InProgress, IdeaStatus.InProgress]);
    await Assert.That(activity.Where(a => a.Kind == ActivityKind.StatusChanged).Select(a => a.Detail ?? string.Empty)).IsEquivalentTo(["InProgress"]);
  }

  [Test]
  public async Task Bulk_AddTag_AddsItOnceToEachIdea()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    var tagged = await CreateAsync(client, "Launch", Today.AddDays(5));
    (await client.PutAsJsonAsync($"/api/v1/ideas/{tagged.Id}", new UpdateIdeaRequest("Launch", null, Today.AddDays(5), IdeaStatus.Planned, ["q4", "design"]), Json.Options)).Dispose();
    var untagged = await CreateAsync(client, "Webinar", Today.AddDays(8));

    var results = await ReadResultsAsync(await BulkAsync(client, new BulkIdeaRequest([tagged.Id, untagged.Id], BulkIdeaOperation.AddTag, Tag: "  Design ")));

    await Assert.That(results[0].Idea!.Tags).IsEquivalentTo(["q4", "design"], CollectionOrdering.Matching);
    await Assert.That(results[1].Idea!.Tags).IsEquivalentTo(["design"]);
  }

  [Test]
  public async Task Bulk_RemoveTag_RemovesItWhereverItIs()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    var tagged = await CreateAsync(client, "Launch", Today.AddDays(5));
    (await client.PutAsJsonAsync($"/api/v1/ideas/{tagged.Id}", new UpdateIdeaRequest("Launch", null, Today.AddDays(5), IdeaStatus.Planned, ["q4", "design"]), Json.Options)).Dispose();
    var untagged = await CreateAsync(client, "Webinar", Today.AddDays(8));

    var results = await ReadResultsAsync(await BulkAsync(client, new BulkIdeaRequest([tagged.Id, untagged.Id], BulkIdeaOperation.RemoveTag, Tag: "Q4")));
    var activity = (await client.ActivityAsync(untagged.Id)).Items;

    await Assert.That(results.Select(r => r.Outcome)).IsEquivalentTo([ChangeOutcome.Changed, ChangeOutcome.Changed]);
    await Assert.That(results[0].Idea!.Tags).IsEquivalentTo(["design"]);
    await Assert.That(results[1].Idea!.Tags).IsEmpty();
    await Assert.That(activity.Select(a => a.Kind)).DoesNotContain(ActivityKind.TagsChanged);
  }

  [Test]
  public async Task Bulk_MoveTargetDateLater_PostponesEachAsPostponeDoes()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    var idea = await CreateAsync(client, "Launch", Today.AddDays(5));

    var results = await ReadResultsAsync(await BulkAsync(client, new BulkIdeaRequest([idea.Id], BulkIdeaOperation.MoveTargetDate, TargetDate: Today.AddDays(12))));
    var activity = (await client.ActivityAsync(idea.Id)).Items;

    await Assert.That(results[0].Idea!.TargetDate).IsEqualTo(Today.AddDays(12));
    await Assert.That(results[0].Idea!.Status).IsEqualTo(IdeaStatus.Postponed);
    await Assert.That(results[0].Idea!.PostponeCount).IsEqualTo(1);
    await Assert.That(activity.Where(a => a.Kind == ActivityKind.Postponed).Select(a => a.Detail ?? string.Empty)).IsEquivalentTo([Today.AddDays(12).ToString("O", System.Globalization.CultureInfo.InvariantCulture)]);
  }

  [Test]
  public async Task Bulk_MoveByDays_MovesEachIdeaFromItsOwnTargetDate()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    var first = await CreateAsync(client, "Launch", Today.AddDays(5));
    var second = await CreateAsync(client, "Webinar", Today.AddDays(8));

    var results = await ReadResultsAsync(await BulkAsync(client, new BulkIdeaRequest([first.Id, second.Id], BulkIdeaOperation.MoveTargetDate, Days: 7)));

    await Assert.That(results.Select(r => r.Idea!.TargetDate)).IsEquivalentTo([Today.AddDays(12), Today.AddDays(15)], CollectionOrdering.Matching);
    await Assert.That(results.Select(r => r.Idea!.PostponeCount)).IsEquivalentTo([1, 1]);
  }

  [Test]
  public async Task Bulk_MoveTargetDateEarlier_ReschedulesWithoutCountingAPostponement()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    var idea = await CreateAsync(client, "Launch", Today.AddDays(10));

    var results = await ReadResultsAsync(await BulkAsync(client, new BulkIdeaRequest([idea.Id], BulkIdeaOperation.MoveTargetDate, TargetDate: Today.AddDays(3))));
    var activity = (await client.ActivityAsync(idea.Id)).Items;

    await Assert.That(results[0].Idea!.TargetDate).IsEqualTo(Today.AddDays(3));
    await Assert.That(results[0].Idea!.Status).IsEqualTo(IdeaStatus.Planned);
    await Assert.That(results[0].Idea!.PostponeCount).IsEqualTo(0);
    await Assert.That(activity.Select(a => a.Kind)).Contains(ActivityKind.Rescheduled);
  }

  [Test]
  public async Task Bulk_SomeIdeasCannotMove_ReportsEachAndMovesTheRest()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    var open = await CreateAsync(client, "Launch", Today.AddDays(5));
    var done = await CreateAsync(client, "Webinar", Today.AddDays(5));
    (await client.PutAsJsonAsync($"/api/v1/ideas/{done.Id}", new UpdateIdeaRequest("Webinar", null, Today.AddDays(5), IdeaStatus.Done), Json.Options)).Dispose();
    var later = await CreateAsync(client, "Survey", Today.AddDays(30));

    using var response = await BulkAsync(client, new BulkIdeaRequest([open.Id, done.Id, later.Id], BulkIdeaOperation.MoveTargetDate, TargetDate: Today.AddDays(-1)));
    var results = await ReadResultsAsync(response);
    var afterDone = await (await client.GetAsync($"/api/v1/ideas/{done.Id}")).ReadIdeaAsync();

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.OK);
    await Assert.That(results.Select(r => r.Outcome)).IsEquivalentTo([ChangeOutcome.Invalid, ChangeOutcome.Invalid, ChangeOutcome.Invalid], CollectionOrdering.Matching);
    await Assert.That(results[0].Message).IsEqualTo("The target date cannot be in the past.");

    using var mixed = await BulkAsync(client, new BulkIdeaRequest([open.Id, done.Id, later.Id], BulkIdeaOperation.MoveTargetDate, TargetDate: Today.AddDays(20)));
    var mixedResults = await ReadResultsAsync(mixed);

    await Assert.That(mixedResults.Select(r => r.Outcome))
      .IsEquivalentTo([ChangeOutcome.Changed, ChangeOutcome.Conflict, ChangeOutcome.Changed], CollectionOrdering.Matching);
    await Assert.That(mixedResults[1].Message).IsEqualTo("A completed idea cannot be postponed.");
    await Assert.That(mixedResults[1].Idea).IsNull();
    await Assert.That(mixedResults[0].Idea!.PostponeCount).IsEqualTo(1);
    await Assert.That(mixedResults[2].Idea!.PostponeCount).IsEqualTo(0);
    await Assert.That(afterDone.TargetDate).IsEqualTo(Today.AddDays(5));
  }

  [Test]
  public async Task Bulk_DateBeforeUtcTodayButTodayInUsersZone_MovesTheIdea()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    await client.SetTimeZoneAsync("Pacific/Honolulu");
    var idea = await CreateAsync(client, "Launch", Today.AddDays(5));

    var results = await ReadResultsAsync(await BulkAsync(client, new BulkIdeaRequest([idea.Id], BulkIdeaOperation.MoveTargetDate, TargetDate: Today.AddDays(-1))));

    await Assert.That(results[0].Outcome).IsEqualTo(ChangeOutcome.Changed);
    await Assert.That(results[0].Idea!.TargetDate).IsEqualTo(Today.AddDays(-1));
  }

  [Test]
  public async Task Bulk_ArchivedIdea_RefusesEditsButCanBeRestored()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    var archived = await CreateAsync(client, "Launch", Today.AddDays(5));
    var active = await CreateAsync(client, "Webinar", Today.AddDays(5));
    (await client.PostAsync($"/api/v1/ideas/{archived.Id}/archive", null)).Dispose();

    var edit = await ReadResultsAsync(await BulkAsync(client, new BulkIdeaRequest([archived.Id, active.Id], BulkIdeaOperation.SetStatus, Status: IdeaStatus.Done)));
    var restore = await ReadResultsAsync(await BulkAsync(client, new BulkIdeaRequest([archived.Id, active.Id], BulkIdeaOperation.Restore)));
    var after = await (await client.GetAsync($"/api/v1/ideas/{archived.Id}")).ReadIdeaAsync();

    await Assert.That(edit.Select(r => r.Outcome)).IsEquivalentTo([ChangeOutcome.Conflict, ChangeOutcome.Changed], CollectionOrdering.Matching);
    await Assert.That(edit[0].Message).IsEqualTo("This idea is archived. Restore it to make changes.");
    await Assert.That(restore.Select(r => r.Outcome)).IsEquivalentTo([ChangeOutcome.Changed, ChangeOutcome.Conflict], CollectionOrdering.Matching);
    await Assert.That(after.ArchivedAt).IsNull();
    await Assert.That(after.Status).IsEqualTo(IdeaStatus.Planned);
  }

  [Test]
  public async Task Bulk_Archive_ArchivesEachIdea()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    var first = await CreateAsync(client, "Launch", Today.AddDays(5));
    var second = await CreateAsync(client, "Webinar", Today.AddDays(5));

    var results = await ReadResultsAsync(await BulkAsync(client, new BulkIdeaRequest([first.Id, second.Id], BulkIdeaOperation.Archive)));
    var list = await (await client.ListIdeasAsync(await client.WorkspaceIdAsync())).ReadIdeasAsync();

    await Assert.That(results.Select(r => r.Idea!.ArchivedAt ?? DateTimeOffset.MinValue)).IsEquivalentTo([factory.Time.GetUtcNow(), factory.Time.GetUtcNow()]);
    await Assert.That(list).IsEmpty();
  }

  [Test]
  public async Task Bulk_IdeasOutsideTheUsersWorkspaces_AreNotFoundAndUnchanged()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    using var stranger = await factory.CreateSignedInClientAsync("stranger@example.com");
    var theirs = await CreateAsync(stranger, "Secret plan", Today.AddDays(5));
    var mine = await CreateAsync(client, "Launch", Today.AddDays(5));
    var missing = Guid.NewGuid();

    using var response = await BulkAsync(client, new BulkIdeaRequest([theirs.Id, missing, mine.Id], BulkIdeaOperation.Archive));
    var body = await response.Content.ReadAsStringAsync();
    var results = await ReadResultsAsync(response);
    var after = await (await stranger.GetAsync($"/api/v1/ideas/{theirs.Id}")).ReadIdeaAsync();

    await Assert.That(results.Select(r => r.Id)).IsEquivalentTo([theirs.Id, missing, mine.Id], CollectionOrdering.Matching);
    await Assert.That(results.Select(r => r.Outcome)).IsEquivalentTo([ChangeOutcome.NotFound, ChangeOutcome.NotFound, ChangeOutcome.Changed], CollectionOrdering.Matching);
    await Assert.That(results[0]).IsEqualTo(results[1] with { Id = theirs.Id });
    await Assert.That(body).DoesNotContain("Secret plan");
    await Assert.That(after.ArchivedAt).IsNull();
  }

  [Test]
  public async Task Bulk_IdeasTheUserMayNotChange_AreForbidden()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var member = await factory.CreateSignedInClientAsync("member@example.com");
    await factory.JoinAsync(owner, member, "member@example.com", WorkspaceRole.Member);
    var offTeam = await CreateAsync(owner, "Launch", Today.AddDays(5));
    var onTeam = await CreateAsync(owner, "Webinar", Today.AddDays(5));
    (await owner.AddMemberAsync(onTeam.Id, "member@example.com")).Dispose();

    var status = await ReadResultsAsync(await BulkAsync(member, new BulkIdeaRequest([offTeam.Id, onTeam.Id], BulkIdeaOperation.SetStatus, Status: IdeaStatus.InProgress)));
    var archive = await ReadResultsAsync(await BulkAsync(member, new BulkIdeaRequest([onTeam.Id], BulkIdeaOperation.Archive)));
    var after = await (await owner.GetAsync($"/api/v1/ideas/{offTeam.Id}")).ReadIdeaAsync();

    await Assert.That(status.Select(r => r.Outcome)).IsEquivalentTo([ChangeOutcome.Forbidden, ChangeOutcome.Changed], CollectionOrdering.Matching);
    await Assert.That(status[0].Message).IsEqualTo("Only the idea's team and the workspace's admins can change this idea.");
    await Assert.That(archive[0].Outcome).IsEqualTo(ChangeOutcome.Forbidden);
    await Assert.That(after.Status).IsEqualTo(IdeaStatus.Planned);
  }

  [Test]
  public async Task Bulk_SameIdeaTwice_ChangesItOnce()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    var idea = await CreateAsync(client, "Launch", Today.AddDays(5));

    var results = await ReadResultsAsync(await BulkAsync(client, new BulkIdeaRequest([idea.Id, idea.Id], BulkIdeaOperation.MoveTargetDate, Days: 7)));

    await Assert.That(results.Length).IsEqualTo(1);
    await Assert.That(results[0].Idea!.TargetDate).IsEqualTo(Today.AddDays(12));
  }

  [Test]
  [Arguments("ids")]
  [Arguments("too many ids")]
  [Arguments("status")]
  [Arguments("tag")]
  [Arguments("tag with comma")]
  [Arguments("date and days")]
  [Arguments("no date")]
  [Arguments("days")]
  public async Task Bulk_IncompleteRequest_ReturnsValidationProblem(string problem)
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    var idea = await CreateAsync(client, "Launch", Today.AddDays(5));
    Guid[] ids = [idea.Id];
    var (request, field) = problem switch
    {
      "ids" => (new BulkIdeaRequest([], BulkIdeaOperation.Archive), "ids"),
      "too many ids" => (new BulkIdeaRequest([.. Enumerable.Range(0, BulkIdeaRequest.MaxIdeas + 1).Select(_ => Guid.NewGuid())], BulkIdeaOperation.Archive), "ids"),
      "status" => (new BulkIdeaRequest(ids, BulkIdeaOperation.SetStatus), "status"),
      "tag" => (new BulkIdeaRequest(ids, BulkIdeaOperation.AddTag, Tag: " "), "tag"),
      "tag with comma" => (new BulkIdeaRequest(ids, BulkIdeaOperation.RemoveTag, Tag: "a,b"), "tag"),
      "date and days" => (new BulkIdeaRequest(ids, BulkIdeaOperation.MoveTargetDate, TargetDate: Today.AddDays(9), Days: 7), "targetDate"),
      "no date" => (new BulkIdeaRequest(ids, BulkIdeaOperation.MoveTargetDate), "targetDate"),
      _ => (new BulkIdeaRequest(ids, BulkIdeaOperation.MoveTargetDate, Days: 0), "days"),
    };

    using var response = await BulkAsync(client, request);
    var after = await (await client.GetAsync($"/api/v1/ideas/{idea.Id}")).ReadIdeaAsync();

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.BadRequest);
    await Assert.That((await response.ReadValidationErrorsAsync()).Keys).Contains(field);
    await Assert.That(after.TargetDate).IsEqualTo(Today.AddDays(5));
  }

  [Test]
  public async Task Bulk_SignedOut_ReturnsUnauthorized()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = factory.CreateClient();

    using var response = await BulkAsync(client, new BulkIdeaRequest([Guid.NewGuid()], BulkIdeaOperation.Archive));

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.Unauthorized);
  }

  private static async Task<IdeaResponse> CreateAsync(HttpClient client, string title, DateOnly targetDate)
    => await (await client.CreateIdeaAsync(title, targetDate)).ReadIdeaAsync();

  private static Task<HttpResponseMessage> BulkAsync(HttpClient client, BulkIdeaRequest request)
    => client.PostAsJsonAsync("/api/v1/ideas/bulk", request, Json.Options);

  private static async Task<BulkIdeaResult[]> ReadResultsAsync(HttpResponseMessage response)
  {
    using (response)
    {
      return (await response.Content.ReadFromJsonAsync<BulkIdeaResult[]>(Json.Options))!;
    }
  }
}
