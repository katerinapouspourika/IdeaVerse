namespace Pouspourika.IdeaVerse.Api.Data;

using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

using Pouspourika.IdeaVerse.Api.Ideas;

/// <summary>
/// Database context holding Identity accounts and ideas.
/// </summary>
/// <param name="options">The context options.</param>
public sealed class IdeaVerseDbContext(DbContextOptions<IdeaVerseDbContext> options) : IdentityDbContext<User>(options)
{
  /// <summary>
  /// Gets the ideas.
  /// </summary>
  public DbSet<Idea> Ideas => Set<Idea>();

  /// <inheritdoc/>
  protected override void OnModelCreating(ModelBuilder builder)
  {
    ArgumentNullException.ThrowIfNull(builder);
    base.OnModelCreating(builder);
    builder.ApplyConfigurationsFromAssembly(typeof(IdeaVerseDbContext).Assembly);
  }
}
