namespace Pouspourika.IdeaVerse.Api.Data;

using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

using Pouspourika.IdeaVerse.Api.Components;
using Pouspourika.IdeaVerse.Api.Ideas;
using Pouspourika.IdeaVerse.Api.Members;
using Pouspourika.IdeaVerse.Api.Notifications;

/// <summary>
/// Database context holding Identity accounts, ideas, their components and team members, and reminders.
/// </summary>
/// <param name="options">The context options.</param>
public sealed class IdeaVerseDbContext(DbContextOptions<IdeaVerseDbContext> options) : IdentityDbContext<User>(options)
{
  /// <summary>
  /// EF Core's SQLite provider name, compared by value so the API does not depend on the SQLite package.
  /// </summary>
  private const string SqliteProviderName = "Microsoft.EntityFrameworkCore.Sqlite";

  /// <summary>
  /// Gets the ideas.
  /// </summary>
  public DbSet<Idea> Ideas => Set<Idea>();

  /// <summary>
  /// Gets the components of all ideas.
  /// </summary>
  public DbSet<Component> Components => Set<Component>();

  /// <summary>
  /// Gets the team members of all ideas.
  /// </summary>
  public DbSet<IdeaMember> IdeaMembers => Set<IdeaMember>();

  /// <summary>
  /// Gets the reminders raised for all users.
  /// </summary>
  public DbSet<Notification> Notifications => Set<Notification>();

  /// <inheritdoc/>
  /// <remarks>
  /// SQLite, used by the integration tests, cannot compare or sort <see cref="DateTimeOffset"/> columns, so there they are stored as sortable numbers.
  /// PostgreSQL keeps its native <c>timestamp with time zone</c>.
  /// </remarks>
  protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
  {
    ArgumentNullException.ThrowIfNull(configurationBuilder);
    if (Database.ProviderName == SqliteProviderName)
    {
      configurationBuilder.Properties<DateTimeOffset>().HaveConversion<DateTimeOffsetToBinaryConverter>();
    }
  }

  /// <inheritdoc/>
  protected override void OnModelCreating(ModelBuilder builder)
  {
    ArgumentNullException.ThrowIfNull(builder);
    base.OnModelCreating(builder);
    builder.ApplyConfigurationsFromAssembly(typeof(IdeaVerseDbContext).Assembly);
  }
}
