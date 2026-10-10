namespace Pouspourika.IdeaVerse.Api.Members;

using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

using Pouspourika.IdeaVerse.Api.Data;
using Pouspourika.IdeaVerse.Api.Ideas;

/// <summary>
/// Manages who is on an idea's team.
/// </summary>
/// <remarks>
/// Anyone on the team can see it; only the owner adds or removes members, and a member may remove themselves.
/// </remarks>
/// <param name="context">The database context.</param>
/// <param name="userManager">Identity user manager, for finding accounts by email.</param>
/// <param name="timeProvider">Clock used for timestamps.</param>
public sealed class MemberService(IdeaVerseDbContext context, UserManager<User> userManager, TimeProvider timeProvider)
{
  /// <summary>
  /// Name of the email field in validation errors.
  /// </summary>
  private const string EmailField = nameof(AddMemberRequest.Email);

  /// <summary>
  /// Lists an idea's team: the owner first, then members by email.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="ideaId">The idea identifier.</param>
  /// <param name="cancellationToken">Token to cancel the query.</param>
  /// <returns>The team, or <see langword="null"/> when the user cannot access the idea.</returns>
  public async Task<IReadOnlyList<MemberResponse>?> ListAsync(string userId, Guid ideaId, CancellationToken cancellationToken)
  {
    var owner = await context.AccessibleIdeas(userId)
      .Where(i => i.Id == ideaId)
      .Select(i => new MemberResponse(i.OwnerId, i.Owner!.Email!, IdeaRole.Owner, i.CreatedAt))
      .FirstOrDefaultAsync(cancellationToken)
      .ConfigureAwait(false);
    if (owner is null)
    {
      return null;
    }

    var members = await context.IdeaMembers
      .Where(m => m.IdeaId == ideaId)
      .OrderBy(m => m.User!.Email)
      .Select(m => new MemberResponse(m.UserId, m.User!.Email!, IdeaRole.Member, m.AddedAt))
      .ToListAsync(cancellationToken)
      .ConfigureAwait(false);

    return [owner, .. members];
  }

  /// <summary>
  /// Adds the account registered with the requested email to the idea's team.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier; must own the idea.</param>
  /// <param name="ideaId">The idea identifier.</param>
  /// <param name="request">The validated request.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>The outcome, carrying the new member when added.</returns>
  public async Task<MemberChangeResult> AddAsync(string userId, Guid ideaId, AddMemberRequest request, CancellationToken cancellationToken)
  {
    ArgumentNullException.ThrowIfNull(request);

    var ownerId = await FindOwnerIdAsync(userId, ideaId, cancellationToken).ConfigureAwait(false);
    if (ownerId is null)
    {
      return MemberChangeResult.NotFound();
    }

    if (ownerId != userId)
    {
      return MemberChangeResult.Forbidden("Only the idea's owner can add team members.");
    }

    var account = await userManager.FindByEmailAsync(request.Email.Trim()).ConfigureAwait(false);
    if (account is null)
    {
      return MemberChangeResult.Invalid(EmailField, "No IdeaVerse account uses this email. Ask them to sign up first.");
    }

    if (account.Id == ownerId)
    {
      return MemberChangeResult.Invalid(EmailField, "The owner is already on the idea.");
    }

    if (await context.IdeaMembers.AnyAsync(m => m.IdeaId == ideaId && m.UserId == account.Id, cancellationToken).ConfigureAwait(false))
    {
      return MemberChangeResult.Conflict("This person is already a team member.");
    }

    var member = new IdeaMember { IdeaId = ideaId, UserId = account.Id, AddedAt = timeProvider.GetUtcNow() };
    context.IdeaMembers.Add(member);
    await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    return MemberChangeResult.Changed(new MemberResponse(account.Id, account.Email!, IdeaRole.Member, member.AddedAt));
  }

  /// <summary>
  /// Removes a member from the idea's team. The owner may remove anyone; a member may remove only themselves.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="ideaId">The idea identifier.</param>
  /// <param name="memberUserId">The identifier of the member to remove.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>The outcome.</returns>
  public async Task<MemberChangeResult> RemoveAsync(string userId, Guid ideaId, string memberUserId, CancellationToken cancellationToken)
  {
    var ownerId = await FindOwnerIdAsync(userId, ideaId, cancellationToken).ConfigureAwait(false);
    if (ownerId is null)
    {
      return MemberChangeResult.NotFound();
    }

    if (memberUserId == ownerId)
    {
      return MemberChangeResult.Conflict("The owner cannot be removed from their idea.");
    }

    if (userId != ownerId && userId != memberUserId)
    {
      return MemberChangeResult.Forbidden("Only the idea's owner can remove other team members.");
    }

    var removed = await context.IdeaMembers
      .Where(m => m.IdeaId == ideaId && m.UserId == memberUserId)
      .ExecuteDeleteAsync(cancellationToken)
      .ConfigureAwait(false);
    return removed > 0 ? MemberChangeResult.Changed() : MemberChangeResult.NotFound();
  }

  /// <summary>
  /// Finds the owner of an idea the user can access.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="ideaId">The idea identifier.</param>
  /// <param name="cancellationToken">Token to cancel the query.</param>
  /// <returns>The owner's identifier, or <see langword="null"/> when the user cannot access the idea.</returns>
  private Task<string?> FindOwnerIdAsync(string userId, Guid ideaId, CancellationToken cancellationToken)
    => context.AccessibleIdeas(userId)
      .Where(i => i.Id == ideaId)
      .Select(i => i.OwnerId)
      .FirstOrDefaultAsync(cancellationToken);
}
