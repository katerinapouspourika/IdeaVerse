namespace Pouspourika.IdeaVerse.Api.Ai;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

/// <summary>
/// Database mapping for <see cref="AiUsage"/>.
/// </summary>
internal sealed class AiUsageConfiguration : IEntityTypeConfiguration<AiUsage>
{
  /// <inheritdoc/>
  public void Configure(EntityTypeBuilder<AiUsage> builder)
  {
    builder.HasKey(u => new { u.WorkspaceId, u.Day });
    builder.HasOne(u => u.Workspace).WithMany().HasForeignKey(u => u.WorkspaceId).OnDelete(DeleteBehavior.Cascade);
  }
}
