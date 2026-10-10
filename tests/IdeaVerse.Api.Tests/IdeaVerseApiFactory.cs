namespace Pouspourika.IdeaVerse.Api.Tests;

using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Time.Testing;

using Pouspourika.IdeaVerse.Api.Data;
using Pouspourika.IdeaVerse.Api.Email;
using Pouspourika.IdeaVerse.Api.Invitations;
using Pouspourika.IdeaVerse.Api.Notifications;
using Pouspourika.IdeaVerse.Api.Workspaces;

/// <summary>
/// Hosts the API in memory against a private in-memory SQLite database and a controllable clock.
/// </summary>
/// <remarks>
/// The clock starts on today's real date: login cookies expire relative to the app's clock, and the test client drops cookies that are already expired by the real one.
/// </remarks>
/// <param name="webRoot">Optional folder to serve as the web app's <c>wwwroot</c>.</param>
/// <param name="settings">Optional configuration overrides, such as AI help settings.</param>
internal sealed class IdeaVerseApiFactory(string? webRoot = null, IReadOnlyDictionary<string, string?>? settings = null) : WebApplicationFactory<Program>
{
  public const string Password = "Passw0rd!";

  public const string AppUrl = "https://app.example.com";

  private readonly SqliteConnection connection = new("DataSource=:memory:");

  public static DateOnly Today { get; } = DateOnly.FromDateTime(DateTime.UtcNow);

  public FakeMailSender Mail { get; } = new();

  public FakeModelClient Model { get; } = new();

  public FakeTimeProvider Time { get; } = new(new DateTimeOffset(Today, new TimeOnly(9, 0), TimeSpan.Zero));

  // Signs in a new account that owns a workspace named after its email, as after signing up and creating a workspace.
  public async Task<HttpClient> CreateSignedInClientAsync(string email = "owner@example.com", bool withWorkspace = true)
  {
    var client = CreateClient();
    await RegisterAndConfirmAsync(client, email);

    using var login = await client.PostAsJsonAsync("/api/v1/auth/login?useCookies=true", new { email, password = Password });
    login.EnsureSuccessStatusCode();

    if (withWorkspace)
    {
      using var workspace = await client.PostAsJsonAsync("/api/v1/workspaces", new WorkspaceNameRequest(email), Json.Options);
      workspace.EnsureSuccessStatusCode();
    }

    return client;
  }

  // Brings the joiner into the inviter's workspace through an emailed invitation they accept, and removes that email.
  public async Task JoinAsync(HttpClient inviter, HttpClient joiner, string joinerEmail, WorkspaceRole role = WorkspaceRole.Member)
  {
    var workspace = await inviter.WorkspaceAsync();
    using var invite = await inviter.PostAsJsonAsync($"/api/v1/workspaces/{workspace.Id}/invitations", new InviteRequest(joinerEmail, role), Json.Options);
    invite.EnsureSuccessStatusCode();
    Mail.Take(joinerEmail, InvitationService.Subject(workspace.Name));

    var invitations = await joiner.GetFromJsonAsync<ReceivedInvitationResponse[]>("/api/v1/invitations", Json.Options);
    var invitation = invitations!.Single(i => i.WorkspaceId == workspace.Id);
    using var accept = await joiner.PostAsync($"/api/v1/invitations/{invitation.Id}/accept", content: null);
    accept.EnsureSuccessStatusCode();
  }

  // Confirms through the email link, as a user would, and removes that email so tests only see the email they cause.
  public async Task RegisterAndConfirmAsync(HttpClient client, string email)
  {
    using var register = await client.PostAsJsonAsync("/api/v1/auth/register", new { email, password = Password });
    register.EnsureSuccessStatusCode();

    var confirmation = Mail.Take(email, Auth.IdentityEmailSender.ConfirmationSubject);
    var link = FakeMailSender.LinkIn(confirmation, $"{AppUrl}/confirm-email");
    using var confirm = await client.GetAsync($"/api/v1/auth/confirmEmail{link.Query}");
    confirm.EnsureSuccessStatusCode();
  }

  public async Task<ReminderRunResult> RunRemindersAsync()
  {
    await using var scope = Services.CreateAsyncScope();
    return await scope.ServiceProvider.GetRequiredService<ReminderService>().RunAsync(CancellationToken.None);
  }

  protected override void ConfigureWebHost(IWebHostBuilder builder)
  {
    connection.Open();
    builder.UseEnvironment("Testing");
    builder.UseSetting("Reminders:Enabled", "false");
    builder.UseSetting("App:PublicUrl", AppUrl);
    builder.UseSetting(Ai.AiOptions.ApiKeySetting, "test-key");
    foreach (var (key, value) in settings ?? new Dictionary<string, string?>())
    {
      builder.UseSetting(key, value);
    }

    if (webRoot is not null)
    {
      builder.UseWebRoot(webRoot);
    }

    builder.ConfigureTestServices(services =>
    {
      services.RemoveAll<DbContextOptions<IdeaVerseDbContext>>();
      services.RemoveAll<IDbContextOptionsConfiguration<IdeaVerseDbContext>>();
      services.AddDbContext<IdeaVerseDbContext>(o => o.UseSqlite(connection));

      services.AddDataProtection().UseEphemeralDataProtectionProvider();

      services.RemoveAll<IMailSender>();
      services.AddSingleton<IMailSender>(Mail);

      services.RemoveAll<Agents.Infrastructure.IStructuredModelClient>();
      services.AddSingleton<Agents.Infrastructure.IStructuredModelClient>(Model);

      services.RemoveAll<TimeProvider>();
      services.AddSingleton<TimeProvider>(Time);
    });
  }

  protected override IHost CreateHost(IHostBuilder builder)
  {
    var host = base.CreateHost(builder);
    using var scope = host.Services.CreateScope();
    scope.ServiceProvider.GetRequiredService<IdeaVerseDbContext>().Database.EnsureCreated();
    return host;
  }

  protected override void Dispose(bool disposing)
  {
    base.Dispose(disposing);
    if (disposing)
    {
      connection.Dispose();
    }
  }
}
