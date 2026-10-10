namespace Pouspourika.IdeaVerse.Api.Ideas;

using System.Linq.Expressions;

using Pouspourika.IdeaVerse.Api.Data;

/// <summary>
/// An idea as returned by the API.
/// </summary>
/// <param name="Id">The identifier.</param>
/// <param name="WorkspaceId">The workspace the idea belongs to.</param>
/// <param name="Title">The title.</param>
/// <param name="Description">The optional description.</param>
/// <param name="TargetDate">The date the idea should be implemented by.</param>
/// <param name="Status">The lifecycle status.</param>
/// <param name="PostponeCount">How many times the idea has been postponed.</param>
/// <param name="IsOverdue">Whether the target date has passed without the idea being done.</param>
/// <param name="Role">The signed-in user's relationship to the idea.</param>
/// <param name="CanEdit">Whether the signed-in user may edit the idea, postpone it, and change its components.</param>
/// <param name="CanManage">Whether the signed-in user may delete the idea and manage its team.</param>
/// <param name="OwnerEmail">The email address of the idea's owner.</param>
/// <param name="MemberCount">How many team members, besides the owner, the idea has.</param>
/// <param name="ComponentCount">How many components the idea has.</param>
/// <param name="CompletedComponentCount">How many of those components are done.</param>
/// <param name="CreatedAt">When the idea was created.</param>
/// <param name="UpdatedAt">When the idea was last changed.</param>
public sealed record IdeaResponse(
  Guid Id,
  Guid WorkspaceId,
  string Title,
  string? Description,
  DateOnly TargetDate,
  IdeaStatus Status,
  int PostponeCount,
  bool IsOverdue,
  IdeaRole Role,
  bool CanEdit,
  bool CanManage,
  string OwnerEmail,
  int MemberCount,
  int ComponentCount,
  int CompletedComponentCount,
  DateTimeOffset CreatedAt,
  DateTimeOffset UpdatedAt)
{
  /// <summary>
  /// Builds a query projection from <see cref="Idea"/> to its response, counting components and checking access in the database.
  /// </summary>
  /// <param name="context">The database context, whose <see cref="IdeaAccess"/> queries decide <see cref="CanEdit"/> and <see cref="CanManage"/>.</param>
  /// <param name="today">The current date, used to compute <see cref="IsOverdue"/>.</param>
  /// <param name="userId">The signed-in user, used to compute <see cref="Role"/> and access.</param>
  /// <returns>The projection expression.</returns>
  internal static Expression<Func<Idea, IdeaResponse>> Projection(IdeaVerseDbContext context, DateOnly today, string userId)
    => i => new IdeaResponse(
      i.Id,
      i.WorkspaceId,
      i.Title,
      i.Description,
      i.TargetDate,
      i.Status,
      i.PostponeCount,
      i.Status != IdeaStatus.Done && i.TargetDate < today,
      i.OwnerId == userId ? IdeaRole.Owner : i.Members.Any(m => m.UserId == userId) ? IdeaRole.Member : IdeaRole.Viewer,
      context.EditableIdeas(userId).Any(e => e.Id == i.Id),
      context.ManagedIdeas(userId).Any(e => e.Id == i.Id),
      i.Owner!.Email!,
      i.Members.Count,
      i.Components.Count,
      i.Components.Count(c => c.IsDone),
      i.CreatedAt,
      i.UpdatedAt);
}
