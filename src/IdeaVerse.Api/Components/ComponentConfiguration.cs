namespace Pouspourika.IdeaVerse.Api.Components;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

/// <summary>
/// Database mapping for <see cref="Component"/>.
/// </summary>
internal sealed class ComponentConfiguration : IEntityTypeConfiguration<Component>
{
  /// <inheritdoc/>
  public void Configure(EntityTypeBuilder<Component> builder)
  {
    builder.Property(c => c.Title).HasMaxLength(Component.TitleMaxLength);
    builder.Property(c => c.Notes).HasMaxLength(Component.NotesMaxLength);
    builder.HasOne(c => c.Idea).WithMany(i => i.Components).HasForeignKey(c => c.IdeaId).OnDelete(DeleteBehavior.Cascade);
    builder.HasIndex(c => new { c.IdeaId, c.Position });
  }
}
