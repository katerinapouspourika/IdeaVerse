namespace Pouspourika.IdeaVerse.Api.Members;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

/// <summary>
/// Database mapping for <see cref="IdeaMember"/>.
/// </summary>
internal sealed class IdeaMemberConfiguration : IEntityTypeConfiguration<IdeaMember>
{
  /// <inheritdoc/>
  public void Configure(EntityTypeBuilder<IdeaMember> builder)
  {
    builder.HasKey(m => new { m.IdeaId, m.UserId });
    builder.HasOne(m => m.Idea).WithMany(i => i.Members).HasForeignKey(m => m.IdeaId).OnDelete(DeleteBehavior.Cascade);
    builder.HasOne(m => m.User).WithMany().HasForeignKey(m => m.UserId).OnDelete(DeleteBehavior.Cascade);
    builder.HasIndex(m => m.UserId);
  }
}
