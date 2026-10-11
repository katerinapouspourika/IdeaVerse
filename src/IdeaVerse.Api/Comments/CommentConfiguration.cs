namespace Pouspourika.IdeaVerse.Api.Comments;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

/// <summary>
/// Database mapping for <see cref="Comment"/>.
/// </summary>
internal sealed class CommentConfiguration : IEntityTypeConfiguration<Comment>
{
  /// <inheritdoc/>
  public void Configure(EntityTypeBuilder<Comment> builder)
  {
    builder.Property(c => c.Body).HasMaxLength(Comment.BodyMaxLength);
    builder.HasOne(c => c.Idea).WithMany().HasForeignKey(c => c.IdeaId).OnDelete(DeleteBehavior.Cascade);
    builder.HasOne(c => c.Author).WithMany().HasForeignKey(c => c.AuthorId).OnDelete(DeleteBehavior.SetNull);
    builder.HasIndex(c => new { c.IdeaId, c.CreatedAt });
  }
}
