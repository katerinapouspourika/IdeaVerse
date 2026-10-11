namespace Pouspourika.IdeaVerse.Api.Data;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

/// <summary>
/// Database mapping for the IdeaVerse fields of <see cref="User"/>; Identity maps the rest.
/// </summary>
internal sealed class UserConfiguration : IEntityTypeConfiguration<User>
{
  /// <inheritdoc/>
  public void Configure(EntityTypeBuilder<User> builder)
  {
    builder.Property(u => u.DisplayName).HasMaxLength(User.DisplayNameMaxLength);
    builder.Property(u => u.TimeZone).HasMaxLength(User.TimeZoneMaxLength);
  }
}
