namespace Pouspourika.IdeaVerse.Api.Branding;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

/// <summary>
/// Database mapping for <see cref="WorkspaceLogo"/>.
/// </summary>
internal sealed class WorkspaceLogoConfiguration : IEntityTypeConfiguration<WorkspaceLogo>
{
  /// <inheritdoc/>
  public void Configure(EntityTypeBuilder<WorkspaceLogo> builder)
  {
    builder.HasKey(l => l.WorkspaceId);
    builder.Property(l => l.ContentType).HasMaxLength(20);
    builder.HasOne(l => l.Workspace).WithOne().HasForeignKey<WorkspaceLogo>(l => l.WorkspaceId).OnDelete(DeleteBehavior.Cascade);
  }
}
