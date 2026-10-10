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
using Pouspourika.IdeaVerse.Api.Notifications;

/// <summary>
/// Hosts the API in memory against a private in-memory SQLite database and a controllable clock.
/// </summary>
/// <remarks>
/// The clock starts on today's real date: login cookies expire relative to the app's clock, and the test client drops cookies that are already expired by the real one.
/// </remarks>
/// <param name="webRoot">Optional folder to serve as the web app's <c>wwwroot</c>.</param>
internal sealed class IdeaVerseApiFactory(string? webRoot = null) : WebApplicationFactory<Program>
{
  public const string Password = "Passw0rd!";

  private readonly SqliteConnection connection = new("DataSource=:memory:");

  public static DateOnly Today { get; } = DateOnly.FromDateTime(DateTime.UtcNow);

  public FakeMailSender Mail { get; } = new();

  public FakeTimeProvider Time { get; } = new(new DateTimeOffset(Today, new TimeOnly(9, 0), TimeSpan.Zero));

  public async Task<HttpClient> CreateSignedInClientAsync(string email = "owner@example.com")
  {
    var client = CreateClient();
    var credentials = new { email, password = Password };

    using var register = await client.PostAsJsonAsync("/api/v1/auth/register", credentials);
    register.EnsureSuccessStatusCode();

    using var login = await client.PostAsJsonAsync("/api/v1/auth/login?useCookies=true", credentials);
    login.EnsureSuccessStatusCode();

    return client;
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
    builder.UseSetting("Reminders:AppUrl", "https://app.example.com");
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
