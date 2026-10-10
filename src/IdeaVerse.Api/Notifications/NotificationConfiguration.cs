namespace Pouspourika.IdeaVerse.Api.Notifications;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

/// <summary>
/// Database mapping for <see cref="Notification"/>.
/// </summary>
internal sealed class NotificationConfiguration : IEntityTypeConfiguration<Notification>
{
  /// <inheritdoc/>
  public void Configure(EntityTypeBuilder<Notification> builder)
  {
    builder.Property(n => n.Kind).HasConversion<string>().HasMaxLength(20);
    builder.HasOne(n => n.Idea).WithMany().HasForeignKey(n => n.IdeaId).OnDelete(DeleteBehavior.Cascade);
    builder.HasOne(n => n.User).WithMany().HasForeignKey(n => n.UserId).OnDelete(DeleteBehavior.Cascade);
    builder.HasIndex(n => new { n.IdeaId, n.UserId, n.Kind, n.TargetDate }).IsUnique();
    builder.HasIndex(n => new { n.UserId, n.CreatedAt });
  }
}
