namespace Pouspourika.IdeaVerse.Api.Invitations;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

/// <summary>
/// Database mapping for <see cref="Invitation"/>.
/// </summary>
internal sealed class InvitationConfiguration : IEntityTypeConfiguration<Invitation>
{
  /// <inheritdoc/>
  public void Configure(EntityTypeBuilder<Invitation> builder)
  {
    builder.Property(i => i.Email).HasMaxLength(Invitation.EmailMaxLength);
    builder.Property(i => i.NormalizedEmail).HasMaxLength(Invitation.EmailMaxLength);
    builder.Property(i => i.Role).HasConversion<string>().HasMaxLength(20);
    builder.HasOne(i => i.Workspace).WithMany().HasForeignKey(i => i.WorkspaceId).OnDelete(DeleteBehavior.Cascade);
    builder.HasOne(i => i.InvitedBy).WithMany().HasForeignKey(i => i.InvitedById).OnDelete(DeleteBehavior.Cascade);
    builder.HasIndex(i => new { i.WorkspaceId, i.NormalizedEmail }).IsUnique();
    builder.HasIndex(i => i.NormalizedEmail);
  }
}
