namespace Pouspourika.IdeaVerse.Api.Members;

using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

using Pouspourika.IdeaVerse.Api.Activity;
using Pouspourika.IdeaVerse.Api.Data;
using Pouspourika.IdeaVerse.Api.Ideas;
using Pouspourika.IdeaVerse.Api.Notifications;

/// <summary>
/// Manages who is on an idea's team.
/// </summary>
/// <remarks>
/// Everyone in the idea's workspace sees the team. The idea's owner and the workspace's owner and admins add and remove members,
/// who must already be in the workspace; a member may remove themselves.
/// </remarks>
/// <param name="context">The database context.</param>
/// <param name="userManager">Identity user manager, for normalizing email addresses.</param>
/// <param name="timeProvider">Clock used for timestamps.</param>
public sealed class MemberService(IdeaVerseDbContext context, UserManager<User> userManager, TimeProvider timeProvider)
{
  /// <summary>
  /// Name of the email field in validation errors.
  /// </summary>
  private const string EmailField = nameof(AddMemberRequest.Email);

  /// <summary>
  /// Lists an idea's team: the owner first, then members by name, or email for those without one.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="ideaId">The idea identifier.</param>
  /// <param name="cancellationToken">Token to cancel the query.</param>
  /// <returns>The team, or <see langword="null"/> when the user cannot see the idea.</returns>
  public async Task<IReadOnlyList<MemberResponse>?> ListAsync(string userId, Guid ideaId, CancellationToken cancellationToken)
  {
    var owner = await context.VisibleIdeas(userId)
      .Where(i => i.Id == ideaId)
      .Select(i => new MemberResponse(i.OwnerId, i.Owner!.Email!, i.Owner.DisplayName, IdeaRole.Owner, i.CreatedAt))
      .FirstOrDefaultAsync(cancellationToken)
      .ConfigureAwait(false);
    if (owner is null)
    {
      return null;
    }

    var members = await context.IdeaMembers
      .Where(m => m.IdeaId == ideaId)
      .OrderBy(m => m.User!.DisplayName ?? m.User.Email)
      .Select(m => new MemberResponse(m.UserId, m.User!.Email!, m.User.DisplayName, IdeaRole.Member, m.AddedAt))
      .ToListAsync(cancellationToken)
      .ConfigureAwait(false);

    return [owner, .. members];
  }

  /// <summary>
  /// Adds the person in the idea's workspace with the requested email to the idea's team.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier; must manage the idea.</param>
  /// <param name="ideaId">The idea identifier.</param>
  /// <param name="request">The validated request.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>The outcome, carrying the new member when added.</returns>
  public async Task<MemberChangeResult> AddAsync(string userId, Guid ideaId, AddMemberRequest request, CancellationToken cancellationToken)
  {
    ArgumentNullException.ThrowIfNull(request);

    var idea = await context.ManagedIdeas(userId)
      .Where(i => i.Id == ideaId)
      .Select(i => new { i.OwnerId, i.WorkspaceId, i.TargetDate })
      .FirstOrDefaultAsync(cancellationToken)
      .ConfigureAwait(false);
    if (idea is null)
    {
      return MemberChangeResult.Denied(
        await context.DenialAsync(userId, ideaId, cancellationToken).ConfigureAwait(false),
        "Only the idea's owner and the workspace's admins can add team members.");
    }

    var email = userManager.NormalizeEmail(request.Email.Trim());
    var account = await context.WorkspaceMembers
      .Where(m => m.WorkspaceId == idea.WorkspaceId && m.User!.NormalizedEmail == email)
      .Select(m => new { m.UserId, m.User!.Email, m.User.DisplayName })
      .FirstOrDefaultAsync(cancellationToken)
      .ConfigureAwait(false);
    if (account is null)
    {
      return MemberChangeResult.Invalid(EmailField, "No one in this workspace uses this email. Invite them to the workspace first.");
    }

    if (account.UserId == idea.OwnerId)
    {
      return MemberChangeResult.Invalid(EmailField, "The owner is already on the idea.");
    }

    if (await context.IdeaMembers.AnyAsync(m => m.IdeaId == ideaId && m.UserId == account.UserId, cancellationToken).ConfigureAwait(false))
    {
      return MemberChangeResult.Conflict("This person is already a team member.");
    }

    var member = new IdeaMember { IdeaId = ideaId, UserId = account.UserId, AddedAt = timeProvider.GetUtcNow() };
    context.IdeaMembers.Add(member);
    context.Record(ideaId, userId, ActivityKind.MemberAdded, member.AddedAt, account.DisplayName ?? account.Email);
    if (account.UserId != userId)
    {
      context.Notifications.Add(new Notification
      {
        UserId = account.UserId,
        IdeaId = ideaId,
        ActorId = userId,
        Kind = ReminderKind.AddedToTeam,
        TargetDate = idea.TargetDate,
        CreatedAt = member.AddedAt,
      });
    }

    await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    return MemberChangeResult.Changed(new MemberResponse(account.UserId, account.Email!, account.DisplayName, IdeaRole.Member, member.AddedAt));
  }

  /// <summary>
  /// Removes a member from the idea's team. Those who manage the idea may remove anyone but its owner; a member may remove only themselves.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="ideaId">The idea identifier.</param>
  /// <param name="memberUserId">The identifier of the member to remove.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>The outcome.</returns>
  public async Task<MemberChangeResult> RemoveAsync(string userId, Guid ideaId, string memberUserId, CancellationToken cancellationToken)
  {
    var idea = await context.VisibleIdeas(userId)
      .Where(i => i.Id == ideaId)
      .Select(i => new { i.OwnerId, CanManage = context.ManagedIdeas(userId).Any(m => m.Id == i.Id) })
      .FirstOrDefaultAsync(cancellationToken)
      .ConfigureAwait(false);
    if (idea is null)
    {
      return MemberChangeResult.NotFound();
    }

    if (memberUserId == idea.OwnerId)
    {
      return MemberChangeResult.Conflict("The owner cannot be removed from their idea.");
    }

    if (!idea.CanManage && userId != memberUserId)
    {
      return MemberChangeResult.Forbidden("Only the idea's owner and the workspace's admins can remove other team members.");
    }

    var member = await context.IdeaMembers
      .Include(m => m.User)
      .FirstOrDefaultAsync(m => m.IdeaId == ideaId && m.UserId == memberUserId, cancellationToken)
      .ConfigureAwait(false);
    if (member is null)
    {
      return MemberChangeResult.NotFound();
    }

    context.IdeaMembers.Remove(member);
    var now = timeProvider.GetUtcNow();
    if (userId == memberUserId)
    {
      context.Record(ideaId, userId, ActivityKind.MemberLeft, now);
    }
    else
    {
      context.Record(ideaId, userId, ActivityKind.MemberRemoved, now, member.User?.DisplayName ?? member.User?.Email);
    }

    await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    return MemberChangeResult.Changed();
  }
}
