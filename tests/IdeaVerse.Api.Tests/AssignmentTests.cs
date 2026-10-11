namespace Pouspourika.IdeaVerse.Api.Tests;

using System.Net;

using Pouspourika.IdeaVerse.Api.Accounts;
using Pouspourika.IdeaVerse.Api.Comments;
using Pouspourika.IdeaVerse.Api.Components;
using Pouspourika.IdeaVerse.Api.Ideas;
using Pouspourika.IdeaVerse.Api.Notifications;
using Pouspourika.IdeaVerse.Api.Workspaces;

using TUnit.Assertions.Enums;

public class AssignmentTests
{
  private static readonly DateOnly Today = IdeaVerseApiFactory.Today;

  [Test]
  public async Task Update_AssignToSomeoneInWorkspace_SavesAndNotifiesThem()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var viewer = await factory.CreateSignedInClientAsync("viewer@example.com");
    await factory.JoinAsync(owner, viewer, "viewer@example.com");
    (await viewer.PutAsJsonAsync("/api/v1/account/profile", new UpdateProfileRequest("Vic"), Json.Options)).Dispose();
    var (ideaId, component) = await IdeaWithComponentAsync(owner);
    var viewerId = await UserIdAsync(owner, "viewer@example.com");

    using var response = await owner.UpdateComponentAsync(ideaId, component.Id, new UpdateComponentRequest("Budget", null, IsDone: false, viewerId, Today.AddDays(3)));
    var saved = await response.ReadComponentAsync();
    var inbox = await NotificationsAsync(viewer);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.OK);
    await Assert.That(saved.AssigneeId).IsEqualTo(viewerId);
    await Assert.That(saved.AssigneeName).IsEqualTo("Vic");
    await Assert.That(saved.DueDate).IsEqualTo(Today.AddDays(3));
    await Assert.That(inbox.Items.Single().Kind).IsEqualTo(ReminderKind.Assigned);
    await Assert.That(inbox.Items.Single().Message).IsEqualTo("owner@example.com assigned “Budget” for “Launch” to you.");
  }

  [Test]
  public async Task Update_AssignToSomeoneOutsideWorkspace_ReturnsValidationProblem()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var outsider = await factory.CreateSignedInClientAsync("outsider@example.com");
    var (ideaId, component) = await IdeaWithComponentAsync(owner);
    var outsiderId = (await outsider.GetFromJsonAsync<WorkspaceMemberResponse[]>($"/api/v1/workspaces/{await outsider.WorkspaceIdAsync()}/members", Json.Options))!.Single().UserId;

    using var response = await owner.UpdateComponentAsync(ideaId, component.Id, new UpdateComponentRequest("Budget", null, IsDone: false, outsiderId));

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.BadRequest);
    await Assert.That((await response.ReadValidationErrorsAsync()).Keys).Contains("assigneeId");
  }

  [Test]
  public async Task Update_AssignToThemselves_SendsNoNotification()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    var (ideaId, component) = await IdeaWithComponentAsync(owner);

    (await owner.UpdateComponentAsync(ideaId, component.Id, new UpdateComponentRequest("Budget", null, IsDone: false, await UserIdAsync(owner, "owner@example.com")))).Dispose();

    await Assert.That((await NotificationsAsync(owner)).Items).IsEmpty();
  }

  [Test]
  public async Task RunReminders_AssignedComponentDueTomorrow_RemindsTheAssigneeEvenOffTheTeam()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var viewer = await factory.CreateSignedInClientAsync("viewer@example.com");
    await factory.JoinAsync(owner, viewer, "viewer@example.com");
    var (ideaId, component) = await IdeaWithComponentAsync(owner, Today.AddDays(30));
    (await owner.UpdateComponentAsync(ideaId, component.Id, new UpdateComponentRequest("Budget", null, IsDone: false, await UserIdAsync(owner, "viewer@example.com"), Today.AddDays(1)))).Dispose();

    var first = await factory.RunRemindersAsync();
    var again = await factory.RunRemindersAsync();
    var inbox = await NotificationsAsync(viewer);

    await Assert.That(first.Raised).IsEqualTo(1);
    await Assert.That(again.Raised).IsEqualTo(0);
    await Assert.That(factory.Mail.Sent.Where(m => m.To == "viewer@example.com").Select(m => m.Subject)).IsEquivalentTo(
      ["Assigned to you: Budget (Launch)", "Due tomorrow: Budget (Launch)"]);
    await Assert.That(inbox.Items.Select(n => n.Message)).Contains(m => m.StartsWith("“Budget” for “Launch” is due tomorrow", StringComparison.Ordinal));
  }

  [Test]
  public async Task RunReminders_AssignedComponentOfArchivedIdea_RaisesNothing()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var viewer = await factory.CreateSignedInClientAsync("viewer@example.com");
    await factory.JoinAsync(owner, viewer, "viewer@example.com");
    var (ideaId, component) = await IdeaWithComponentAsync(owner, Today.AddDays(30));
    (await owner.UpdateComponentAsync(ideaId, component.Id, new UpdateComponentRequest("Budget", null, IsDone: false, await UserIdAsync(owner, "viewer@example.com"), Today.AddDays(1)))).Dispose();
    (await owner.PostAsync($"/api/v1/ideas/{ideaId}/archive", null)).Dispose();

    var run = await factory.RunRemindersAsync();

    await Assert.That(run).IsEqualTo(new ReminderRunResult(0, 0));
  }

  [Test]
  public async Task RunReminders_ComponentDoneOrStageTurnedOff_RaisesNothing()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    var ownerId = await UserIdAsync(owner, "owner@example.com");
    var (ideaId, done) = await IdeaWithComponentAsync(owner, Today.AddDays(30));
    var muted = await (await owner.CreateComponentAsync(ideaId, "Venue")).ReadComponentAsync();
    (await owner.UpdateComponentAsync(ideaId, done.Id, new UpdateComponentRequest("Budget", null, IsDone: true, ownerId, Today))).Dispose();
    (await owner.UpdateComponentAsync(ideaId, muted.Id, new UpdateComponentRequest("Venue", null, IsDone: false, ownerId, Today))).Dispose();
    (await owner.PutAsJsonAsync("/api/v1/account/reminders", new UpdateRemindersRequest(true, [ReminderKind.Overdue]), Json.Options)).Dispose();

    var result = await factory.RunRemindersAsync();

    await Assert.That(result.Raised).IsEqualTo(0);
  }

  [Test]
  public async Task Notifications_AfterBeingUnassigned_AreHidden()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var viewer = await factory.CreateSignedInClientAsync("viewer@example.com");
    await factory.JoinAsync(owner, viewer, "viewer@example.com");
    var (ideaId, component) = await IdeaWithComponentAsync(owner);
    (await owner.UpdateComponentAsync(ideaId, component.Id, new UpdateComponentRequest("Budget", null, IsDone: false, await UserIdAsync(owner, "viewer@example.com")))).Dispose();

    (await owner.UpdateComponentAsync(ideaId, component.Id, new UpdateComponentRequest("Budget", null, IsDone: false))).Dispose();

    await Assert.That((await NotificationsAsync(viewer)).Items).IsEmpty();
  }

  [Test]
  public async Task Comment_OnIdea_NotifiesOwnerAndTeamButNotTheAuthor()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var member = await factory.CreateSignedInClientAsync("member@example.com");
    using var viewer = await factory.CreateSignedInClientAsync("viewer@example.com");
    await factory.JoinAsync(owner, member, "member@example.com");
    await factory.JoinAsync(owner, viewer, "viewer@example.com");
    var (ideaId, _) = await IdeaWithComponentAsync(owner);
    (await owner.AddMemberAsync(ideaId, "member@example.com")).Dispose();

    (await viewer.PostAsJsonAsync($"/api/v1/ideas/{ideaId}/comments", new CommentRequest(new string('x', 250)), Json.Options)).Dispose();
    var ownerInbox = await NotificationsAsync(owner);
    var memberInbox = await NotificationsAsync(member);
    var viewerInbox = await NotificationsAsync(viewer);

    var comment = ownerInbox.Items.Single(n => n.Kind == ReminderKind.Commented);
    await Assert.That(comment.Message).StartsWith("viewer@example.com commented on “Launch”: “xxx");
    await Assert.That(comment.Message).EndsWith("x…”");
    await Assert.That(memberInbox.Items.Select(n => n.Kind)).IsEquivalentTo([ReminderKind.Commented, ReminderKind.AddedToTeam]);
    await Assert.That(viewerInbox.Items).IsEmpty();
  }

  [Test]
  public async Task AddMember_ToTeam_NotifiesThem()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var member = await factory.CreateSignedInClientAsync("member@example.com");
    await factory.JoinAsync(owner, member, "member@example.com");
    (await owner.PutAsJsonAsync("/api/v1/account/profile", new UpdateProfileRequest("Kat"), Json.Options)).Dispose();
    var (ideaId, _) = await IdeaWithComponentAsync(owner);

    (await owner.AddMemberAsync(ideaId, "member@example.com")).Dispose();

    await Assert.That((await NotificationsAsync(member)).Items.Single().Message).IsEqualTo("Kat added you to the team of “Launch”.");
  }

  [Test]
  public async Task Assignments_ComponentsAssignedToUser_ListsUnfinishedOnesSoonestDueFirst()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var viewer = await factory.CreateSignedInClientAsync("viewer@example.com");
    await factory.JoinAsync(owner, viewer, "viewer@example.com");
    var viewerId = await UserIdAsync(owner, "viewer@example.com");
    var (ideaId, budget) = await IdeaWithComponentAsync(owner, Today.AddDays(30));
    var venue = await (await owner.CreateComponentAsync(ideaId, "Venue")).ReadComponentAsync();
    var poster = await (await owner.CreateComponentAsync(ideaId, "Poster")).ReadComponentAsync();
    var flyers = await (await owner.CreateComponentAsync(ideaId, "Flyers")).ReadComponentAsync();
    (await owner.UpdateComponentAsync(ideaId, budget.Id, new UpdateComponentRequest("Budget", null, IsDone: false, viewerId, Today.AddDays(9)))).Dispose();
    (await owner.UpdateComponentAsync(ideaId, venue.Id, new UpdateComponentRequest("Venue", null, IsDone: false, viewerId))).Dispose();
    (await owner.UpdateComponentAsync(ideaId, poster.Id, new UpdateComponentRequest("Poster", null, IsDone: false, viewerId, Today.AddDays(2)))).Dispose();
    (await owner.UpdateComponentAsync(ideaId, flyers.Id, new UpdateComponentRequest("Flyers", null, IsDone: true, viewerId, Today.AddDays(1)))).Dispose();

    var assignments = await viewer.GetFromJsonAsync<AssignmentResponse[]>($"/api/v1/workspaces/{await owner.WorkspaceIdAsync()}/assignments", Json.Options);
    var ownersOwn = await owner.GetFromJsonAsync<AssignmentResponse[]>($"/api/v1/workspaces/{await owner.WorkspaceIdAsync()}/assignments", Json.Options);

    await Assert.That(assignments!.Select(a => a.Title)).IsEquivalentTo(["Poster", "Budget", "Venue"], CollectionOrdering.Matching);
    await Assert.That(assignments![0].IdeaTitle).IsEqualTo("Launch");
    await Assert.That(ownersOwn!).IsEmpty();
  }

  [Test]
  public async Task Assignments_ArchivedIdea_AreLeftOut()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    var ownerId = await UserIdAsync(owner, "owner@example.com");
    var (ideaId, budget) = await IdeaWithComponentAsync(owner);
    (await owner.UpdateComponentAsync(ideaId, budget.Id, new UpdateComponentRequest("Budget", null, IsDone: false, ownerId, Today.AddDays(2)))).Dispose();
    (await owner.PostAsync($"/api/v1/ideas/{ideaId}/archive", null)).Dispose();

    var assignments = await owner.GetFromJsonAsync<AssignmentResponse[]>($"/api/v1/workspaces/{await owner.WorkspaceIdAsync()}/assignments", Json.Options);

    await Assert.That(assignments!).IsEmpty();
  }

  [Test]
  public async Task Assignments_DoneIdea_AreLeftOut()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    var ownerId = await UserIdAsync(owner, "owner@example.com");
    var (ideaId, budget) = await IdeaWithComponentAsync(owner);
    (await owner.UpdateComponentAsync(ideaId, budget.Id, new UpdateComponentRequest("Budget", null, IsDone: false, ownerId, Today.AddDays(2)))).Dispose();
    var idea = await owner.GetFromJsonAsync<IdeaResponse>($"/api/v1/ideas/{ideaId}", Json.Options);
    (await owner.PutAsJsonAsync($"/api/v1/ideas/{ideaId}", new UpdateIdeaRequest(idea!.Title, null, idea.TargetDate, IdeaStatus.Done), Json.Options)).Dispose();

    var assignments = await owner.GetFromJsonAsync<AssignmentResponse[]>($"/api/v1/workspaces/{await owner.WorkspaceIdAsync()}/assignments", Json.Options);

    await Assert.That(assignments!).IsEmpty();
  }

  [Test]
  public async Task Assignments_WorkspaceUserIsNotIn_ReturnsNotFound()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var other = await factory.CreateSignedInClientAsync("other@example.com");

    using var response = await other.GetAsync($"/api/v1/workspaces/{await owner.WorkspaceIdAsync()}/assignments");

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
  }

  private static async Task<(Guid IdeaId, ComponentResponse Component)> IdeaWithComponentAsync(HttpClient client, DateOnly? targetDate = null)
  {
    var idea = await (await client.CreateIdeaAsync("Launch", targetDate ?? Today.AddDays(5))).ReadIdeaAsync();
    var component = await (await client.CreateComponentAsync(idea.Id, "Budget")).ReadComponentAsync();
    return (IdeaId: idea.Id, Component: component);
  }

  private static async Task<string> UserIdAsync(HttpClient client, string email)
    => (await client.GetFromJsonAsync<WorkspaceMemberResponse[]>($"/api/v1/workspaces/{await client.WorkspaceIdAsync()}/members", Json.Options))!
      .Single(m => m.Email == email).UserId;

  private static async Task<NotificationsResponse> NotificationsAsync(HttpClient client)
    => (await client.GetFromJsonAsync<NotificationsResponse>("/api/v1/notifications", Json.Options))!;
}
