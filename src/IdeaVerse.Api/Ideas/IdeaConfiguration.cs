namespace Pouspourika.IdeaVerse.Api.Ideas;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

/// <summary>
/// Database mapping for <see cref="Idea"/>.
/// </summary>
internal sealed class IdeaConfiguration : IEntityTypeConfiguration<Idea>
{
  /// <inheritdoc/>
  public void Configure(EntityTypeBuilder<Idea> builder)
  {
    builder.Property(i => i.Title).HasMaxLength(Idea.TitleMaxLength);
    builder.Property(i => i.Description).HasMaxLength(Idea.DescriptionMaxLength);
    builder.Property(i => i.Status).HasConversion<string>().HasMaxLength(20);
    builder.HasOne(i => i.Owner).WithMany().HasForeignKey(i => i.OwnerId).OnDelete(DeleteBehavior.Cascade);
    builder.HasOne(i => i.Workspace).WithMany(w => w.Ideas).HasForeignKey(i => i.WorkspaceId).OnDelete(DeleteBehavior.Cascade);
    builder.HasIndex(i => new { i.OwnerId, i.TargetDate });
    builder.HasIndex(i => new { i.WorkspaceId, i.TargetDate });
  }
}
