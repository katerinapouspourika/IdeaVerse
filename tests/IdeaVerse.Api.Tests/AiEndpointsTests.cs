namespace Pouspourika.IdeaVerse.Api.Tests;

using System.Net;

using Pouspourika.IdeaVerse.Agents.Models;
using Pouspourika.IdeaVerse.Api.Ai;
using Pouspourika.IdeaVerse.Api.Workspaces;

using TUnit.Assertions.Enums;

public class AiEndpointsTests
{
  private const string Suggestions = """
    { "suggestions": [
      { "title": "Budget sign-off", "notes": "Already listed" },
      { "title": "Video editor", "notes": "Cuts the teasers" },
      { "title": "Posting calendar", "notes": "One teaser a day" }
    ] }
    """;

  private const string Improvement = """
    { "strengths": ["Timely"], "weaknesses": ["No measurable goal"], "title": "Black Friday countdown", "description": "Five daily TikToks building to the sale." }
    """;

  private const string GeneratedIdeas = """
    { "ideas": [
      { "title": "Webinar bingo", "summary": "Bingo cards", "target_audience": "Attendees", "differentiator": "Playful" },
      { "title": "Guest expert series", "summary": "Monthly guests", "target_audience": "Leads", "differentiator": "Authority" }
    ] }
    """;

  private const string Critiques = """
    { "critiques": [
      { "idea_title": "Webinar bingo", "strengths": ["Fun"], "weaknesses": ["Gimmicky"], "score": 4 },
      { "idea_title": "Guest expert series", "strengths": ["Credible"], "weaknesses": ["Booking guests"], "score": 8 }
    ] }
    """;

  private const string CritiquesReversed = """
    { "critiques": [
      { "idea_title": "Guest expert series", "strengths": ["Credible"], "weaknesses": ["Booking guests"], "score": 8 },
      { "idea_title": "Webinar bingo", "strengths": ["Fun"], "weaknesses": ["Gimmicky"], "score": 4 }
    ] }
    """;

  private static readonly DateOnly Today = IdeaVerseApiFactory.Today;

  [Test]
  public async Task Status_InWorkspace_ReportsEnabledWithFullAllowance()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();

    var status = await StatusAsync(client, await client.WorkspaceIdAsync());

    await Assert.That(status).IsEqualTo(new AiStatusResponse(true, 0, 50));
  }

  [Test]
  public async Task Status_WithoutApiKey_ReportsDisabled()
  {
    await using var factory = new IdeaVerseApiFactory(settings: new Dictionary<string, string?> { [AiOptions.ApiKeySetting] = string.Empty });
    using var client = await factory.CreateSignedInClientAsync();

    var status = await StatusAsync(client, await client.WorkspaceIdAsync());

    await Assert.That(status.Enabled).IsFalse();
  }

  [Test]
  public async Task SuggestComponents_IdeaWithComponents_ReturnsNewSuggestionsOnly()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    var idea = await (await client.CreateIdeaAsync("Black Friday teaser", Today.AddDays(30), "TikTok series")).ReadIdeaAsync();
    (await client.CreateComponentAsync(idea.Id, "Budget sign-off")).Dispose();
    factory.Model.Answer("SuggestComponents", Suggestions);

    using var response = await client.PostAsync($"/api/v1/ideas/{idea.Id}/ai/components", content: null);
    var suggestions = await response.Content.ReadFromJsonAsync<ComponentSuggestion[]>(Json.Options);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.OK);
    await Assert.That(suggestions!.Select(s => s.Title)).IsEquivalentTo(["Video editor", "Posting calendar"], CollectionOrdering.Matching);
    await Assert.That(factory.Model.Prompts.Single().User).Contains("TikTok series");
    await Assert.That((await StatusAsync(client, idea.WorkspaceId)).Used).IsEqualTo(1);
  }

  [Test]
  public async Task SuggestComponents_ByViewer_ReturnsForbiddenAndCallsNoModel()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var viewer = await factory.CreateSignedInClientAsync("viewer@example.com");
    await factory.JoinAsync(owner, viewer, "viewer@example.com");
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();

    using var response = await viewer.PostAsync($"/api/v1/ideas/{idea.Id}/ai/components", content: null);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.Forbidden);
    await Assert.That(factory.Model.Prompts).IsEmpty();
  }

  [Test]
  public async Task Improve_IdeaInAnotherWorkspace_ReturnsNotFound()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var other = await factory.CreateSignedInClientAsync("other@example.com");
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();

    using var response = await other.PostAsync($"/api/v1/ideas/{idea.Id}/ai/improve", content: null);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
  }

  [Test]
  public async Task Improve_EditableIdea_ReturnsProposalWithoutChangingTheIdea()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    var idea = await (await client.CreateIdeaAsync("Black Friday teaser", Today.AddDays(30), "TikTok series")).ReadIdeaAsync();
    factory.Model.Answer("ImproveIdea", Improvement);

    using var response = await client.PostAsync($"/api/v1/ideas/{idea.Id}/ai/improve", content: null);
    var improvement = await response.Content.ReadFromJsonAsync<IdeaImprovement>(Json.Options);
    var unchanged = await (await client.GetAsync($"/api/v1/ideas/{idea.Id}")).ReadIdeaAsync();

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.OK);
    await Assert.That(improvement!.Title).IsEqualTo("Black Friday countdown");
    await Assert.That(improvement.Weaknesses).IsEquivalentTo(["No measurable goal"]);
    await Assert.That(unchanged.Title).IsEqualTo("Black Friday teaser");
  }

  [Test]
  public async Task Brainstorm_Brief_ReturnsScoredIdeasBestFirst()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    factory.Model.Answer("GenerateIdeas", GeneratedIdeas);
    factory.Model.Answer("CritiqueIdeas", Critiques);

    using var response = await client.PostAsJsonAsync(
      $"/api/v1/workspaces/{await client.WorkspaceIdAsync()}/ai/brainstorm",
      new BrainstormRequest("Grow sign-ups for our spring webinars"),
      Json.Options);
    var ideas = (await response.Content.ReadFromJsonAsync<BrainstormedIdea[]>(Json.Options))!;

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.OK);
    await Assert.That(ideas.Select(i => (i.Title, i.Score))).IsEquivalentTo([("Guest expert series", 8), ("Webinar bingo", 4)], CollectionOrdering.Matching);
    await Assert.That(ideas[0].TargetAudience).IsEqualTo("Leads");
    await Assert.That(factory.Model.Prompts[0].User).Contains("Grow sign-ups for our spring webinars");
    await Assert.That((await StatusAsync(client, await client.WorkspaceIdAsync())).Used).IsEqualTo(1);
  }

  [Test]
  public async Task Brainstorm_CritiquesInAnotherOrder_PairsThemByTitle()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    factory.Model.Answer("GenerateIdeas", GeneratedIdeas);
    factory.Model.Answer("CritiqueIdeas", CritiquesReversed);

    using var response = await client.PostAsJsonAsync($"/api/v1/workspaces/{await client.WorkspaceIdAsync()}/ai/brainstorm", new BrainstormRequest("Webinars"), Json.Options);
    var ideas = (await response.Content.ReadFromJsonAsync<BrainstormedIdea[]>(Json.Options))!;

    await Assert.That(ideas.Select(i => (i.Title, i.Score, i.Strengths[0]))).IsEquivalentTo(
      [("Guest expert series", 8, "Credible"), ("Webinar bingo", 4, "Fun")],
      CollectionOrdering.Matching);
  }

  [Test]
  [Arguments(BrainstormRequest.BriefMaxLength, HttpStatusCode.OK)]
  [Arguments(BrainstormRequest.BriefMaxLength + 1, HttpStatusCode.BadRequest)]
  public async Task Brainstorm_BriefAtAndPastMaxLength_AcceptsOnlyUpToTheLimit(int length, HttpStatusCode expected)
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    factory.Model.Answer("GenerateIdeas", GeneratedIdeas);
    factory.Model.Answer("CritiqueIdeas", Critiques);

    using var response = await client.PostAsJsonAsync($"/api/v1/workspaces/{await client.WorkspaceIdAsync()}/ai/brainstorm", new BrainstormRequest(new string('a', length)), Json.Options);

    await Assert.That(response.StatusCode).IsEqualTo(expected);
  }

  [Test]
  public async Task Brainstorm_BlankBrief_ReturnsValidationProblem()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();

    using var response = await client.PostAsJsonAsync($"/api/v1/workspaces/{await client.WorkspaceIdAsync()}/ai/brainstorm", new BrainstormRequest(" "), Json.Options);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.BadRequest);
    await Assert.That((await response.ReadValidationErrorsAsync()).Keys).Contains("brief");
  }

  [Test]
  public async Task Brainstorm_WorkspaceUserIsNotIn_ReturnsNotFound()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var other = await factory.CreateSignedInClientAsync("other@example.com");

    using var response = await other.PostAsJsonAsync($"/api/v1/workspaces/{await owner.WorkspaceIdAsync()}/ai/brainstorm", new BrainstormRequest("Anything"), Json.Options);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
  }

  [Test]
  public async Task Improve_DailyLimitReached_ReturnsTooManyRequestsUntilTheNextDay()
  {
    await using var factory = new IdeaVerseApiFactory(settings: new Dictionary<string, string?> { ["Ai:DailyLimitPerWorkspace"] = "2" });
    using var client = await factory.CreateSignedInClientAsync();
    var idea = await (await client.CreateIdeaAsync("Launch", Today.AddDays(30))).ReadIdeaAsync();
    factory.Model.Answer("ImproveIdea", Improvement);
    (await client.PostAsync($"/api/v1/ideas/{idea.Id}/ai/improve", content: null)).Dispose();
    (await client.PostAsync($"/api/v1/ideas/{idea.Id}/ai/improve", content: null)).Dispose();

    using var third = await client.PostAsync($"/api/v1/ideas/{idea.Id}/ai/improve", content: null);
    factory.Time.Advance(TimeSpan.FromDays(1));
    using var nextDay = await client.PostAsync($"/api/v1/ideas/{idea.Id}/ai/improve", content: null);

    await Assert.That(third.StatusCode).IsEqualTo(HttpStatusCode.TooManyRequests);
    await Assert.That(await third.Content.ReadAsStringAsync()).Contains("used its 2 AI requests for today");
    await Assert.That(nextDay.StatusCode).IsEqualTo(HttpStatusCode.OK);
    await Assert.That(factory.Model.Prompts.Count).IsEqualTo(3);
  }

  [Test]
  public async Task Improve_LimitIsPerWorkspace_OtherWorkspacesAreUnaffected()
  {
    await using var factory = new IdeaVerseApiFactory(settings: new Dictionary<string, string?> { ["Ai:DailyLimitPerWorkspace"] = "1" });
    using var client = await factory.CreateSignedInClientAsync();
    var first = await (await client.CreateIdeaAsync("Launch", Today.AddDays(30))).ReadIdeaAsync();
    using var second = await client.PostAsJsonAsync("/api/v1/workspaces", new WorkspaceNameRequest("Second"), Json.Options);
    var secondId = (await second.Content.ReadFromJsonAsync<WorkspaceResponse>(Json.Options))!.Id;
    var other = await (await client.PostAsJsonAsync($"/api/v1/workspaces/{secondId}/ideas", new Ideas.CreateIdeaRequest("Other", null, Today.AddDays(30)), Json.Options)).ReadIdeaAsync();
    factory.Model.Answer("ImproveIdea", Improvement);
    (await client.PostAsync($"/api/v1/ideas/{first.Id}/ai/improve", content: null)).Dispose();

    using var response = await client.PostAsync($"/api/v1/ideas/{other.Id}/ai/improve", content: null);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.OK);
  }

  [Test]
  public async Task Improve_ModelFails_ReturnsBadGatewayAndDoesNotCountIt()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    var idea = await (await client.CreateIdeaAsync("Launch", Today.AddDays(30))).ReadIdeaAsync();
    factory.Model.Fail = true;

    using var response = await client.PostAsync($"/api/v1/ideas/{idea.Id}/ai/improve", content: null);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.BadGateway);
    await Assert.That((await StatusAsync(client, idea.WorkspaceId)).Used).IsEqualTo(0);
  }

  [Test]
  public async Task Improve_WithoutApiKey_ReturnsServiceUnavailableAndCallsNoModel()
  {
    await using var factory = new IdeaVerseApiFactory(settings: new Dictionary<string, string?> { [AiOptions.ApiKeySetting] = string.Empty });
    using var client = await factory.CreateSignedInClientAsync();
    var idea = await (await client.CreateIdeaAsync("Launch", Today.AddDays(30))).ReadIdeaAsync();

    using var response = await client.PostAsync($"/api/v1/ideas/{idea.Id}/ai/improve", content: null);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.ServiceUnavailable);
    await Assert.That(factory.Model.Prompts).IsEmpty();
  }

  [Test]
  public async Task Status_WorkspaceUserIsNotIn_ReturnsNotFound()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var other = await factory.CreateSignedInClientAsync("other@example.com");

    using var response = await other.GetAsync($"/api/v1/workspaces/{await owner.WorkspaceIdAsync()}/ai");

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
  }

  [Test]
  public async Task Improve_TurnedOffInSettings_ReportsDisabledAndCallsNoModel()
  {
    await using var factory = new IdeaVerseApiFactory(settings: new Dictionary<string, string?> { ["Ai:Enabled"] = "false" });
    using var client = await factory.CreateSignedInClientAsync();
    var idea = await (await client.CreateIdeaAsync("Launch", Today.AddDays(30))).ReadIdeaAsync();

    using var response = await client.PostAsync($"/api/v1/ideas/{idea.Id}/ai/improve", content: null);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.ServiceUnavailable);
    await Assert.That((await StatusAsync(client, idea.WorkspaceId)).Enabled).IsFalse();
    await Assert.That(factory.Model.Prompts).IsEmpty();
  }

  [Test]
  public async Task Improve_ByViewer_ReturnsForbidden()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var viewer = await factory.CreateSignedInClientAsync("viewer@example.com");
    await factory.JoinAsync(owner, viewer, "viewer@example.com");
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();

    using var response = await viewer.PostAsync($"/api/v1/ideas/{idea.Id}/ai/improve", content: null);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.Forbidden);
    await Assert.That(factory.Model.Prompts).IsEmpty();
  }

  [Test]
  public async Task SuggestComponents_IdeaInAnotherWorkspace_ReturnsNotFound()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var other = await factory.CreateSignedInClientAsync("other@example.com");
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();

    using var response = await other.PostAsync($"/api/v1/ideas/{idea.Id}/ai/components", content: null);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
  }

  [Test]
  public async Task Improve_ModelWritesTooMuch_CutsItToWhatAnIdeaAccepts()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    var idea = await (await client.CreateIdeaAsync("Launch", Today.AddDays(30))).ReadIdeaAsync();
    var tooLong = $$"""{ "strengths": [], "weaknesses": [], "title": "{{new string('t', 300)}}", "description": "{{new string('d', 5000)}}" }""";
    factory.Model.Answer("ImproveIdea", tooLong);

    var improvement = await (await client.PostAsync($"/api/v1/ideas/{idea.Id}/ai/improve", content: null)).Content.ReadFromJsonAsync<IdeaImprovement>(Json.Options);
    using var save = await client.PutAsJsonAsync(
      $"/api/v1/ideas/{idea.Id}",
      new Ideas.UpdateIdeaRequest(improvement!.Title, improvement.Description, idea.TargetDate, idea.Status),
      Json.Options);

    await Assert.That(improvement.Title.Length).IsEqualTo(Ideas.Idea.TitleMaxLength);
    await Assert.That(improvement.Description.Length).IsEqualTo(Ideas.Idea.DescriptionMaxLength);
    await Assert.That(save.StatusCode).IsEqualTo(HttpStatusCode.OK);
  }

  [Test]
  public async Task SuggestComponents_ModelRepeatsATitle_ReturnsItOnce()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    var idea = await (await client.CreateIdeaAsync("Launch", Today.AddDays(30))).ReadIdeaAsync();
    factory.Model.Answer("SuggestComponents", """{ "suggestions": [ { "title": "Video editor", "notes": "One" }, { "title": " video EDITOR ", "notes": "Two" } ] }""");

    var suggestions = await (await client.PostAsync($"/api/v1/ideas/{idea.Id}/ai/components", content: null)).Content.ReadFromJsonAsync<ComponentSuggestion[]>(Json.Options);

    await Assert.That(suggestions!.Select(s => s.Title)).IsEquivalentTo(["Video editor"]);
  }

  private static async Task<AiStatusResponse> StatusAsync(HttpClient client, Guid workspaceId)
    => (await client.GetFromJsonAsync<AiStatusResponse>($"/api/v1/workspaces/{workspaceId}/ai", Json.Options))!;
}
