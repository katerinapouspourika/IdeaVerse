namespace Pouspourika.IdeaVerse.Api.Data;

using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

using Pouspourika.IdeaVerse.Api.Components;
using Pouspourika.IdeaVerse.Api.Ideas;
using Pouspourika.IdeaVerse.Api.Members;

/// <summary>
/// Database context holding Identity accounts, ideas, their components, and their team members.
/// </summary>
/// <param name="options">The context options.</param>
public sealed class IdeaVerseDbContext(DbContextOptions<IdeaVerseDbContext> options) : IdentityDbContext<User>(options)
{
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

  /// <inheritdoc/>
  protected override void OnModelCreating(ModelBuilder builder)
  {
    ArgumentNullException.ThrowIfNull(builder);
    base.OnModelCreating(builder);
    builder.ApplyConfigurationsFromAssembly(typeof(IdeaVerseDbContext).Assembly);
  }
}
