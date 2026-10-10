namespace Pouspourika.IdeaVerse.Api.Tests;

using System.Net;

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

using Pouspourika.IdeaVerse.Api.Components;
using Pouspourika.IdeaVerse.Api.Data;

using TUnit.Assertions.Enums;

public class ComponentEndpointsTests
{
  private static readonly DateOnly Today = IdeaVerseApiFactory.Today;

  [Test]
  public async Task Create_ValidRequest_ReturnsCreatedComponentAtEndOfList()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    var idea = await (await client.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();
    (await client.CreateComponentAsync(idea.Id, "Budget")).Dispose();

    using var response = await client.CreateComponentAsync(idea.Id, "  Video crew  ", "Two-day shoot");
    var component = await response.ReadComponentAsync();

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.Created);
    await Assert.That(response.Headers.Location!.ToString()).IsEqualTo($"/api/v1/ideas/{idea.Id}/components/{component.Id}");
    await Assert.That(component.Title).IsEqualTo("Video crew");
    await Assert.That(component.Notes).IsEqualTo("Two-day shoot");
    await Assert.That(component.IsDone).IsFalse();
    await Assert.That(component.Position).IsEqualTo(1);
    await Assert.That(component.CompletedAt).IsNull();
  }

  [Test]
  [Arguments("")]
  [Arguments("   ")]
  public async Task Create_BlankTitle_ReturnsValidationProblem(string title)
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    var idea = await (await client.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();

    using var response = await client.CreateComponentAsync(idea.Id, title);

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.BadRequest);
    await Assert.That((await response.ReadValidationErrorsAsync()).Keys).Contains("title");
  }

  [Test]
  public async Task Create_NotesTooLong_ReturnsValidationProblem()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    var idea = await (await client.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();

    using var response = await client.CreateComponentAsync(idea.Id, "Budget", new string('a', Component.NotesMaxLength + 1));

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.BadRequest);
    await Assert.That((await response.ReadValidationErrorsAsync()).Keys).Contains("notes");
  }

  [Test]
  public async Task Create_IdeaInAnotherWorkspace_ReturnsNotFound()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var other = await factory.CreateSignedInClientAsync("other@example.com");
    var idea = await (await owner.CreateIdeaAsync("Private", Today.AddDays(5))).ReadIdeaAsync();

    using var response = await other.CreateComponentAsync(idea.Id, "Budget");

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
  }

  [Test]
  public async Task Create_MissingIdea_ReturnsNotFound()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();

    using var response = await client.CreateComponentAsync(Guid.NewGuid(), "Budget");

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
  }

  [Test]
  public async Task List_SeveralComponents_ReturnsThemInPositionOrder()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    var idea = await (await client.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();
    var other = await (await client.CreateIdeaAsync("Other", Today.AddDays(5))).ReadIdeaAsync();
    (await client.CreateComponentAsync(idea.Id, "Budget")).Dispose();
    (await client.CreateComponentAsync(idea.Id, "Designer")).Dispose();
    (await client.CreateComponentAsync(other.Id, "Unrelated")).Dispose();
    (await client.CreateComponentAsync(idea.Id, "Venue")).Dispose();

    using var response = await client.GetAsync($"/api/v1/ideas/{idea.Id}/components");
    var components = await response.ReadComponentsAsync();

    await Assert.That(components.Select(c => c.Title)).IsEquivalentTo(["Budget", "Designer", "Venue"], CollectionOrdering.Matching);
    await Assert.That(components.Select(c => c.Position)).IsEquivalentTo([0, 1, 2], CollectionOrdering.Matching);
  }

  [Test]
  public async Task List_IdeaInAnotherWorkspace_ReturnsNotFound()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var other = await factory.CreateSignedInClientAsync("other@example.com");
    var idea = await (await owner.CreateIdeaAsync("Private", Today.AddDays(5))).ReadIdeaAsync();

    using var response = await other.GetAsync($"/api/v1/ideas/{idea.Id}/components");

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
  }

  [Test]
  public async Task Update_MarkedDone_StampsCompletionTime()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    var idea = await (await client.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();
    var component = await (await client.CreateComponentAsync(idea.Id, "Budget")).ReadComponentAsync();
    factory.Time.Advance(TimeSpan.FromHours(2));

    using var response = await client.UpdateComponentAsync(idea.Id, component.Id, new UpdateComponentRequest("Budget approved", "  ", IsDone: true));
    var updated = await response.ReadComponentAsync();

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.OK);
    await Assert.That(updated.Title).IsEqualTo("Budget approved");
    await Assert.That(updated.Notes).IsNull();
    await Assert.That(updated.IsDone).IsTrue();
    await Assert.That(updated.CompletedAt).IsEqualTo(factory.Time.GetUtcNow());
  }

  [Test]
  public async Task Update_MarkedNotDone_ClearsCompletionTime()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    var idea = await (await client.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();
    var component = await (await client.CreateComponentAsync(idea.Id, "Budget")).ReadComponentAsync();
    (await client.UpdateComponentAsync(idea.Id, component.Id, new UpdateComponentRequest("Budget", null, IsDone: true))).Dispose();

    using var response = await client.UpdateComponentAsync(idea.Id, component.Id, new UpdateComponentRequest("Budget", null, IsDone: false));
    var updated = await response.ReadComponentAsync();

    await Assert.That(updated.IsDone).IsFalse();
    await Assert.That(updated.CompletedAt).IsNull();
  }

  [Test]
  public async Task Update_StillDone_KeepsOriginalCompletionTime()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    var idea = await (await client.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();
    var component = await (await client.CreateComponentAsync(idea.Id, "Budget")).ReadComponentAsync();
    var done = await (await client.UpdateComponentAsync(idea.Id, component.Id, new UpdateComponentRequest("Budget", null, IsDone: true))).ReadComponentAsync();
    factory.Time.Advance(TimeSpan.FromDays(1));

    using var response = await client.UpdateComponentAsync(idea.Id, component.Id, new UpdateComponentRequest("Budget (signed)", null, IsDone: true));

    await Assert.That((await response.ReadComponentAsync()).CompletedAt).IsEqualTo(done.CompletedAt);
  }

  [Test]
  public async Task Update_ComponentUnderDifferentIdea_ReturnsNotFound()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    var idea = await (await client.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();
    var other = await (await client.CreateIdeaAsync("Other", Today.AddDays(5))).ReadIdeaAsync();
    var component = await (await client.CreateComponentAsync(idea.Id, "Budget")).ReadComponentAsync();

    using var response = await client.UpdateComponentAsync(other.Id, component.Id, new UpdateComponentRequest("Budget", null, IsDone: true));

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
  }

  [Test]
  public async Task Update_ComponentInAnotherWorkspace_ReturnsNotFound()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var other = await factory.CreateSignedInClientAsync("other@example.com");
    var idea = await (await owner.CreateIdeaAsync("Private", Today.AddDays(5))).ReadIdeaAsync();
    var component = await (await owner.CreateComponentAsync(idea.Id, "Budget")).ReadComponentAsync();

    using var response = await other.UpdateComponentAsync(idea.Id, component.Id, new UpdateComponentRequest("Hijacked", null, IsDone: true));

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
  }

  [Test]
  public async Task Delete_OwnComponent_RemovesIt()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    var idea = await (await client.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();
    var component = await (await client.CreateComponentAsync(idea.Id, "Budget")).ReadComponentAsync();

    using var delete = await client.DeleteAsync($"/api/v1/ideas/{idea.Id}/components/{component.Id}");
    using var list = await client.GetAsync($"/api/v1/ideas/{idea.Id}/components");

    await Assert.That(delete.StatusCode).IsEqualTo(HttpStatusCode.NoContent);
    await Assert.That(await list.ReadComponentsAsync()).IsEmpty();
  }

  [Test]
  public async Task Delete_ComponentInAnotherWorkspace_ReturnsNotFoundAndKeepsIt()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var other = await factory.CreateSignedInClientAsync("other@example.com");
    var idea = await (await owner.CreateIdeaAsync("Private", Today.AddDays(5))).ReadIdeaAsync();
    var component = await (await owner.CreateComponentAsync(idea.Id, "Budget")).ReadComponentAsync();

    using var delete = await other.DeleteAsync($"/api/v1/ideas/{idea.Id}/components/{component.Id}");
    using var list = await owner.GetAsync($"/api/v1/ideas/{idea.Id}/components");

    await Assert.That(delete.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
    await Assert.That(await list.ReadComponentsAsync()).Count().IsEqualTo(1);
  }

  [Test]
  public async Task Viewer_ListsComponentsButCannotChangeThem()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var owner = await factory.CreateSignedInClientAsync();
    using var viewer = await factory.CreateSignedInClientAsync("viewer@example.com");
    await factory.JoinAsync(owner, viewer, "viewer@example.com");
    var idea = await (await owner.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();
    var component = await (await owner.CreateComponentAsync(idea.Id, "Budget")).ReadComponentAsync();

    using var list = await viewer.GetAsync($"/api/v1/ideas/{idea.Id}/components");
    using var create = await viewer.CreateComponentAsync(idea.Id, "Venue");
    using var update = await viewer.UpdateComponentAsync(idea.Id, component.Id, new UpdateComponentRequest("Budget", null, IsDone: true));
    using var delete = await viewer.DeleteAsync($"/api/v1/ideas/{idea.Id}/components/{component.Id}");
    using var missing = await viewer.DeleteAsync($"/api/v1/ideas/{idea.Id}/components/{Guid.NewGuid()}");

    await Assert.That((await list.ReadComponentsAsync()).Select(c => c.Title)).IsEquivalentTo(["Budget"]);
    await Assert.That(create.StatusCode).IsEqualTo(HttpStatusCode.Forbidden);
    await Assert.That(update.StatusCode).IsEqualTo(HttpStatusCode.Forbidden);
    await Assert.That(delete.StatusCode).IsEqualTo(HttpStatusCode.Forbidden);
    await Assert.That(missing.StatusCode).IsEqualTo(HttpStatusCode.Forbidden);
  }

  [Test]
  public async Task Update_MissingComponentOfEditableIdea_ReturnsNotFound()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    var idea = await (await client.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();

    using var response = await client.UpdateComponentAsync(idea.Id, Guid.NewGuid(), new UpdateComponentRequest("Budget", null, IsDone: true));

    await Assert.That(response.StatusCode).IsEqualTo(HttpStatusCode.NotFound);
  }

  [Test]
  public async Task DeleteIdea_WithComponents_RemovesItsComponents()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    var idea = await (await client.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();
    (await client.CreateComponentAsync(idea.Id, "Budget")).Dispose();

    (await client.DeleteAsync($"/api/v1/ideas/{idea.Id}")).Dispose();

    using var scope = factory.Services.CreateScope();
    var remaining = await scope.ServiceProvider.GetRequiredService<IdeaVerseDbContext>().Components.CountAsync();
    await Assert.That(remaining).IsEqualTo(0);
  }

  [Test]
  public async Task GetIdea_WithComponents_ReportsProgress()
  {
    await using var factory = new IdeaVerseApiFactory();
    using var client = await factory.CreateSignedInClientAsync();
    var idea = await (await client.CreateIdeaAsync("Launch", Today.AddDays(5))).ReadIdeaAsync();
    var budget = await (await client.CreateComponentAsync(idea.Id, "Budget")).ReadComponentAsync();
    (await client.CreateComponentAsync(idea.Id, "Designer")).Dispose();
    (await client.CreateComponentAsync(idea.Id, "Venue")).Dispose();
    (await client.UpdateComponentAsync(idea.Id, budget.Id, new UpdateComponentRequest("Budget", null, IsDone: true))).Dispose();

    using var get = await client.GetAsync($"/api/v1/ideas/{idea.Id}");
    using var list = await client.ListIdeasAsync(await client.WorkspaceIdAsync());
    var fromGet = await get.ReadIdeaAsync();
    var fromList = (await list.ReadIdeasAsync()).Single();

    await Assert.That(fromGet.ComponentCount).IsEqualTo(3);
    await Assert.That(fromGet.CompletedComponentCount).IsEqualTo(1);
    await Assert.That(fromList.ComponentCount).IsEqualTo(3);
    await Assert.That(fromList.CompletedComponentCount).IsEqualTo(1);
  }
}
