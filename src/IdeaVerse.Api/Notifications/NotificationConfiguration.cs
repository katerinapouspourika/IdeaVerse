namespace Pouspourika.IdeaVerse.Api.Notifications;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

/// <summary>
/// Database mapping for <see cref="Notification"/>.
/// </summary>
internal sealed class NotificationConfiguration : IEntityTypeConfiguration<Notification>
{
  /// <summary>
  /// SQL condition matching countdown reminders, which are raised at most once per stage; teammates' actions may repeat.
  /// </summary>
  private const string CountdownFilter = "\"Kind\" IN ('ComingUp', 'Tomorrow', 'Today', 'Overdue')";

  /// <inheritdoc/>
  /// <remarks>
  /// Two partial unique indexes keep each countdown stage to one reminder per person: one for ideas and one for components.
  /// </remarks>
  public void Configure(EntityTypeBuilder<Notification> builder)
  {
    builder.Property(n => n.Kind).HasConversion<string>().HasMaxLength(20);
    builder.Property(n => n.Detail).HasMaxLength(Notification.DetailMaxLength);
    builder.HasOne(n => n.Idea).WithMany().HasForeignKey(n => n.IdeaId).OnDelete(DeleteBehavior.Cascade);
    builder.HasOne(n => n.User).WithMany().HasForeignKey(n => n.UserId).OnDelete(DeleteBehavior.Cascade);
    builder.HasOne(n => n.Component).WithMany().HasForeignKey(n => n.ComponentId).OnDelete(DeleteBehavior.Cascade);
    builder.HasOne(n => n.Actor).WithMany().HasForeignKey(n => n.ActorId).OnDelete(DeleteBehavior.SetNull);
    builder.HasIndex(n => new { n.IdeaId, n.UserId, n.Kind, n.TargetDate })
      .IsUnique()
      .HasFilter($"\"ComponentId\" IS NULL AND {CountdownFilter}");
    builder.HasIndex(n => new { n.ComponentId, n.UserId, n.Kind, n.TargetDate })
      .IsUnique()
      .HasFilter($"\"ComponentId\" IS NOT NULL AND {CountdownFilter}");
    builder.HasIndex(n => new { n.UserId, n.CreatedAt });
  }
}
