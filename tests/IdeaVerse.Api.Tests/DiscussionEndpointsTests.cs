namespace Pouspourika.IdeaVerse.Api.Tests;

using System.Net;

using Pouspourika.IdeaVerse.Api.Accounts;
using Pouspourika.IdeaVerse.Api.Activity;
using Pouspourika.IdeaVerse.Api.Comments;
using Pouspourika.IdeaVerse.Api.Components;
using Pouspourika.IdeaVerse.Api.Ideas;

using TUnit.Assertions.Enums;

public class DiscussionEndpointsTests
{
  private static readonly DateOnly Today = IdeaVerseApiFactory.Today;

  [Test]
  public async Task Create_ByViewer_PostsCommentEveryoneInWorkspaceSees()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var viewer = await factory.CreateSignedInClientAsync("viewer@example.com");
    await factory.JoinAsync(owner, viewer, "viewer@example.com");
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();

    using var response = await viewer.PostAsJsonAsync($"/api/v1/ideas/{idea.Id}/comments", new CommentRequest("  Love this!  "), Json.Options);
    var posted = await response.Content.ReadFromJsonAsync<CommentResponse>(Json.Options);
    var seenByOwner = await CommentsAsync(owner, idea.Id);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.Created);
    await Assert.That(posted!.Body).IsEqualTo("Love this!");
    await Assert.That(posted.CanEdit).IsTrue();
    await Assert.That(seenByOwner.Single().AuthorEmail).IsEqualTo("viewer@example.com");
    await Assert.That(seenByOwner.Single().CanEdit).IsFalse();
    await Assert.That(seenByOwner.Single().CanDelete).IsTrue();
  }

  [Test]
  public async Task Create_IdeaInAnotherWorkspace_ReturnsNotFound()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var other = await factory.CreateSignedInClientAsync("other@example.com");
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();

    using var post = await other.PostAsJsonAsync($"/api/v1/ideas/{idea.Id}/comments", new CommentRequest("Hi"), Json.Options);
    using var list = await other.GetAsync($"/api/v1/ideas/{idea.Id}/comments");

    await Assert.That(post.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
    await Assert.That(list.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
  }

  [Test]
  [Arguments("")]
  [Arguments("   ")]
  public async Task Create_BlankBody_ReturnsValidationProblem(string body)
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    var idea = await (await client.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();

    using var response = await client.PostAsJsonAsync($"/api/v1/ideas/{idea.Id}/comments", new CommentRequest(body), Json.Options);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.BadRequest);
  }

  [Test]
  public async Task Update_OwnComment_EditsItAndMarksItEdited()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    var idea = await (await client.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();
    var comment = await PostAsync(client, idea.Id, "Frist");

    using var response = await client.PutAsJsonAsync($"/api/v1/ideas/{idea.Id}/comments/{comment.Id}", new CommentRequest("First"), Json.Options);
    var edited = await response.Content.ReadFromJsonAsync<CommentResponse>(Json.Options);

    await Assert.That(edited!.Body).IsEqualTo("First");
    await Assert.That(edited.EditedAt).IsNotNull();
  }

  [Test]
  public async Task Update_SomeoneElsesComment_ReturnsForbiddenEvenForAdmins()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var member = await factory.CreateSignedInClientAsync("member@example.com");
    await factory.JoinAsync(owner, member, "member@example.com");
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();
    var comment = await PostAsync(member, idea.Id, "Mine");

    using var response = await owner.PutAsJsonAsync($"/api/v1/ideas/{idea.Id}/comments/{comment.Id}", new CommentRequest("Changed"), Json.Options);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.Forbidden);
  }

  [Test]
  public async Task Delete_ByWorkspaceAdmin_RemovesSomeoneElsesComment()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var member = await factory.CreateSignedInClientAsync("member@example.com");
    await factory.JoinAsync(owner, member, "member@example.com");
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();
    var comment = await PostAsync(member, idea.Id, "Off topic");

    using var response = await owner.DeleteAsync($"/api/v1/ideas/{idea.Id}/comments/{comment.Id}");

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NoContent);
    await Assert.That(await CommentsAsync(owner, idea.Id)).IsEmpty();
  }

  [Test]
  public async Task Delete_ByMemberOnSomeoneElsesComment_ReturnsForbidden()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var member = await factory.CreateSignedInClientAsync("member@example.com");
    await factory.JoinAsync(owner, member, "member@example.com");
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();
    var comment = await PostAsync(owner, idea.Id, "Owner's note");

    using var response = await member.DeleteAsync($"/api/v1/ideas/{idea.Id}/comments/{comment.Id}");

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.Forbidden);
  }

  [Test]
  public async Task List_AuthorDeletedTheirAccount_KeepsCommentWithoutAuthor()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var member = await factory.CreateSignedInClientAsync("member@example.com");
    await factory.JoinAsync(owner, member, "member@example.com");
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();
    await PostAsync(member, idea.Id, "Good luck!");

    (await member.PostAsJsonAsync("/api/v1/account/delete", new DeleteAccountRequest(IdeaVerseApiFactory.Password), Json.Options)).Dispose();
    var comments = await CommentsAsync(owner, idea.Id);

    await Assert.That(comments.Single().Body).IsEqualTo("Good luck!");
    await Assert.That(comments.Single().AuthorEmail).IsNull();
  }

  [Test]
  public async Task Activity_ChangesToAnIdea_AreListedNewestFirstWithWhoMadeThem()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var member = await factory.CreateSignedInClientAsync("member@example.com");
    await factory.JoinAsync(owner, member, "member@example.com");
    (await member.PutAsJsonAsync("/api/v1/account/profile", new UpdateProfileRequest("Mia"), Json.Options)).Dispose();
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();
    Tick(factory);
    (await owner.AddMemberAsync(idea.Id, "member@example.com")).Dispose();
    Tick(factory);
    var component = await (await member.CreateComponentAsync(idea.Id, "Budget")).ReadComponentAsync();
    Tick(factory);
    (await member.UpdateComponentAsync(idea.Id, component.Id, new UpdateComponentRequest("Budget", null, IsDone: true))).Dispose();
    Tick(factory);
    (await member.PutAsJsonAsync($"/api/v1/ideas/{idea.Id}", new UpdateIdeaRequest("Spring launch", null, Today.AddDays(5), IdeaStatus.Planned), Json.Options)).Dispose();
    Tick(factory);
    (await member.PutAsJsonAsync($"/api/v1/ideas/{idea.Id}", new UpdateIdeaRequest("Spring launch", null, Today.AddDays(5), IdeaStatus.InProgress), Json.Options)).Dispose();
    Tick(factory);
    (await member.PostAsJsonAsync($"/api/v1/ideas/{idea.Id}/postpone", new PostponeIdeaRequest(Today.AddDays(9)), Json.Options)).Dispose();
    Tick(factory);
    (await member.DeleteAsync($"/api/v1/ideas/{idea.Id}/components/{component.Id}")).Dispose();

    var activity = await owner.GetFromJsonAsync<ActivityResponse[]>($"/api/v1/ideas/{idea.Id}/activity", Json.Options);

    (ActivityKind Kind, string? Detail, string? Actor)[] expected =
      [
        (ActivityKind.ComponentRemoved, "Budget", "Mia"),
        (ActivityKind.Postponed, Today.AddDays(9).ToString("O", System.Globalization.CultureInfo.InvariantCulture), "Mia"),
        (ActivityKind.StatusChanged, "InProgress", "Mia"),
        (ActivityKind.Renamed, "Spring launch", "Mia"),
        (ActivityKind.ComponentCompleted, "Budget", "Mia"),
        (ActivityKind.ComponentAdded, "Budget", "Mia"),
        (ActivityKind.MemberAdded, "Mia", "owner@example.com"),
        (ActivityKind.Created, null, "owner@example.com"),
      ];
    await Assert.That(activity!.Select(a => (a.Kind, a.Detail, Actor: a.ActorName ?? a.ActorEmail))).IsEquivalentTo(expected, CollectionOrdering.Matching);
  }

  [Test]
  public async Task Activity_MemberLeaves_IsRecordedAsLeaving()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var member = await factory.CreateSignedInClientAsync("member@example.com");
    await factory.JoinAsync(owner, member, "member@example.com");
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();
    var added = await (await owner.AddMemberAsync(idea.Id, "member@example.com")).ReadMemberAsync();

    (await member.DeleteAsync($"/api/v1/ideas/{idea.Id}/members/{added.UserId}")).Dispose();
    var activity = await owner.GetFromJsonAsync<ActivityResponse[]>($"/api/v1/ideas/{idea.Id}/activity", Json.Options);

    await Assert.That(activity![0].Kind).IsEqualTo(ActivityKind.MemberLeft);
    await Assert.That(activity[0].ActorEmail).IsEqualTo("member@example.com");
  }

  [Test]
  public async Task Activity_IdeaInAnotherWorkspace_ReturnsNotFound()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var other = await factory.CreateSignedInClientAsync("other@example.com");
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();

    using var response = await other.GetAsync($"/api/v1/ideas/{idea.Id}/activity");

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
  }

  // Entries are ordered by time, so each step gets its own moment.
  private static void Tick(IdeaVerseApiFactory factory) => factory.Time.Advance(TimeSpan.FromMinutes(1));

  private static async Task<CommentResponse> PostAsync(HttpClient client, Guid ideaId, string body)
  {
    using var response = await client.PostAsJsonAsync($"/api/v1/ideas/{ideaId}/comments", new CommentRequest(body), Json.Options);
    return (await response.Content.ReadFromJsonAsync<CommentResponse>(Json.Options))!;
  }

  private static async Task<CommentResponse[]> CommentsAsync(HttpClient client, Guid ideaId)
    => (await client.GetFromJsonAsync<CommentResponse[]>($"/api/v1/ideas/{ideaId}/comments", Json.Options))!;
}
