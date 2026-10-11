namespace Pouspourika.IdeaVerse.Api.Activity;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

/// <summary>
/// Database mapping for <see cref="ActivityEntry"/>.
/// </summary>
internal sealed class ActivityEntryConfiguration : IEntityTypeConfiguration<ActivityEntry>
{
  /// <inheritdoc/>
  public void Configure(EntityTypeBuilder<ActivityEntry> builder)
  {
    builder.Property(a => a.Kind).HasConversion<string>().HasMaxLength(30);
    builder.Property(a => a.Detail).HasMaxLength(ActivityEntry.DetailMaxLength);
    builder.HasOne(a => a.Idea).WithMany().HasForeignKey(a => a.IdeaId).OnDelete(DeleteBehavior.Cascade);
    builder.HasOne(a => a.Actor).WithMany().HasForeignKey(a => a.ActorId).OnDelete(DeleteBehavior.SetNull);
    builder.HasIndex(a => new { a.IdeaId, a.CreatedAt });
  }
}
