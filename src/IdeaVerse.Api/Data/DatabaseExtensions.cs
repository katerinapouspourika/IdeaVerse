namespace Pouspourika.IdeaVerse.Api.Data;

using Microsoft.EntityFrameworkCore;

/// <summary>
/// Database setup helpers for the application host.
/// </summary>
internal static class DatabaseExtensions
{
  /// <summary>
  /// Configuration key that enables applying migrations when the application starts.
  /// </summary>
  public const string MigrateOnStartupKey = "Database:MigrateOnStartup";

  /// <summary>
  /// Applies pending migrations when <see cref="MigrateOnStartupKey"/> is enabled.
  /// </summary>
  /// <remarks>
  /// Meant for local development; deployed environments apply migrations with the Docker <c>migrations</c> target instead.
  /// </remarks>
  /// <param name="app">The application.</param>
  /// <returns>A task that completes when migrations have been applied.</returns>
  public static async Task MigrateDatabaseIfEnabledAsync(this WebApplication app)
  {
    if (!app.Configuration.GetValue<bool>(MigrateOnStartupKey))
    {
      return;
    }

    await using var scope = app.Services.CreateAsyncScope();
    var context = scope.ServiceProvider.GetRequiredService<IdeaVerseDbContext>();
    await context.Database.MigrateAsync().ConfigureAwait(false);
  }
}
