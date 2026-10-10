namespace Pouspourika.IdeaVerse.Api.Workspaces;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

/// <summary>
/// Database mapping for <see cref="WorkspaceMember"/>.
/// </summary>
internal sealed class WorkspaceMemberConfiguration : IEntityTypeConfiguration<WorkspaceMember>
{
  /// <inheritdoc/>
  public void Configure(EntityTypeBuilder<WorkspaceMember> builder)
  {
    builder.HasKey(m => new { m.WorkspaceId, m.UserId });
    builder.Property(m => m.Role).HasConversion<string>().HasMaxLength(20);
    builder.HasOne(m => m.Workspace).WithMany(w => w.Members).HasForeignKey(m => m.WorkspaceId).OnDelete(DeleteBehavior.Cascade);
    builder.HasOne(m => m.User).WithMany().HasForeignKey(m => m.UserId).OnDelete(DeleteBehavior.Cascade);
    builder.HasIndex(m => m.UserId);
  }
}
