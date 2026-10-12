namespace Pouspourika.IdeaVerse.Api.Discovery;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

/// <summary>
/// Database mapping for <see cref="JoinRequest"/>.
/// </summary>
internal sealed class JoinRequestConfiguration : IEntityTypeConfiguration<JoinRequest>
{
  /// <inheritdoc/>
  public void Configure(EntityTypeBuilder<JoinRequest> builder)
  {
    builder.HasOne(r => r.Workspace).WithMany().HasForeignKey(r => r.WorkspaceId).OnDelete(DeleteBehavior.Cascade);
    builder.HasOne(r => r.User).WithMany().HasForeignKey(r => r.UserId).OnDelete(DeleteBehavior.Cascade);
    builder.HasIndex(r => new { r.WorkspaceId, r.UserId }).IsUnique();
    builder.HasIndex(r => r.UserId);
  }
}
