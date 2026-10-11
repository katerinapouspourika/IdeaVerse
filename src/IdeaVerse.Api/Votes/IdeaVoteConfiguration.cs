namespace Pouspourika.IdeaVerse.Api.Votes;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

/// <summary>
/// Database mapping for <see cref="IdeaVote"/>: one vote per person and idea, removed with either.
/// </summary>
internal sealed class IdeaVoteConfiguration : IEntityTypeConfiguration<IdeaVote>
{
  /// <inheritdoc/>
  public void Configure(EntityTypeBuilder<IdeaVote> builder)
  {
    builder.HasKey(v => new { v.IdeaId, v.UserId });
    builder.HasOne(v => v.Idea).WithMany(i => i.Votes).HasForeignKey(v => v.IdeaId).OnDelete(DeleteBehavior.Cascade);
    builder.HasOne(v => v.User).WithMany().HasForeignKey(v => v.UserId).OnDelete(DeleteBehavior.Cascade);
    builder.HasIndex(v => v.UserId);
  }
}
