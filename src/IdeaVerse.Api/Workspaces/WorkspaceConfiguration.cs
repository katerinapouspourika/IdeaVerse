namespace Pouspourika.IdeaVerse.Api.Workspaces;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

/// <summary>
/// Database mapping for <see cref="Workspace"/>.
/// </summary>
internal sealed class WorkspaceConfiguration : IEntityTypeConfiguration<Workspace>
{
  /// <inheritdoc/>
  public void Configure(EntityTypeBuilder<Workspace> builder)
  {
    builder.Property(w => w.Name).HasMaxLength(Workspace.NameMaxLength);
    builder.Property(w => w.InviteToken).HasMaxLength(Workspace.InviteTokenLength);
    builder.HasIndex(w => w.InviteToken).IsUnique();
  }
}
