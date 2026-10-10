namespace Pouspourika.IdeaVerse.Api.Invitations;

using System.Globalization;

using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

using Pouspourika.IdeaVerse.Api.Data;
using Pouspourika.IdeaVerse.Api.Email;
using Pouspourika.IdeaVerse.Api.Workspaces;

/// <summary>
/// Invites people to workspaces by email, and lets the invited accept or decline.
/// </summary>
/// <remarks>
/// A workspace's owner and admins send and revoke its invitations. An invitation belongs to an email address, so whoever signs in
/// with that confirmed address sees it, including someone who signs up after being invited.
/// </remarks>
/// <param name="context">The database context.</param>
/// <param name="userManager">Identity user manager, for normalizing emails and reading the signed-in account.</param>
/// <param name="mailSender">Sends the invitation emails.</param>
/// <param name="app">Application settings, for the web app's address.</param>
/// <param name="timeProvider">Clock used for timestamps and expiry.</param>
public sealed class InvitationService(
  IdeaVerseDbContext context,
  UserManager<User> userManager,
  IMailSender mailSender,
  IOptions<AppOptions> app,
  TimeProvider timeProvider)
{
  /// <summary>
  /// Name of the email field in validation errors.
  /// </summary>
  private const string EmailField = nameof(InviteRequest.Email);

  /// <summary>
  /// Name of the role field in validation errors.
  /// </summary>
  private const string RoleField = nameof(InviteRequest.Role);

  /// <summary>
  /// Builds the subject of an invitation email.
  /// </summary>
  /// <param name="workspaceName">The workspace's name.</param>
  /// <returns>The subject.</returns>
  public static string Subject(string workspaceName) => $"You're invited to {workspaceName} on IdeaVerse";

  /// <summary>
  /// Lists a workspace's open invitations, newest first.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier; must be an owner or admin.</param>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="cancellationToken">Token to cancel the query.</param>
  /// <returns>The outcome and, when allowed, the invitations.</returns>
  public async Task<(ChangeOutcome Outcome, IReadOnlyList<InvitationResponse> Invitations)> ListAsync(string userId, Guid workspaceId, CancellationToken cancellationToken)
  {
    var outcome = await CheckManagerAsync(userId, workspaceId, cancellationToken).ConfigureAwait(false);
    if (outcome != ChangeOutcome.Changed)
    {
      return (Outcome: outcome, Invitations: []);
    }

    var now = timeProvider.GetUtcNow();
    var invitations = await context.Invitations
      .Where(i => i.WorkspaceId == workspaceId && i.ExpiresAt > now)
      .OrderByDescending(i => i.SentAt)
      .Select(i => new InvitationResponse(i.Id, i.Email, i.Role, i.InvitedBy!.Email!, i.SentAt, i.ExpiresAt))
      .ToListAsync(cancellationToken)
      .ConfigureAwait(false);
    return (Outcome: ChangeOutcome.Changed, Invitations: invitations);
  }

  /// <summary>
  /// Invites an email address to a workspace and emails them, or sends an open invitation for it again with a fresh expiry.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier; must be an owner or admin.</param>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="request">The validated request.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>The outcome, carrying the invitation when sent.</returns>
  public async Task<InvitationChangeResult> InviteAsync(string userId, Guid workspaceId, InviteRequest request, CancellationToken cancellationToken)
  {
    ArgumentNullException.ThrowIfNull(request);

    var outcome = await CheckManagerAsync(userId, workspaceId, cancellationToken).ConfigureAwait(false);
    if (outcome != ChangeOutcome.Changed)
    {
      return new InvitationChangeResult(outcome, Message: WorkspaceChangeResult.AdminsOnlyMessage);
    }

    if (request.Role is not (WorkspaceRole.Admin or WorkspaceRole.Member))
    {
      return new InvitationChangeResult(ChangeOutcome.Invalid, Field: RoleField, Message: "Invite people as Admin or Member. A workspace has one owner.");
    }

    var email = request.Email.Trim();
    var normalizedEmail = userManager.NormalizeEmail(email);
    if (await context.WorkspaceMembers.AnyAsync(m => m.WorkspaceId == workspaceId && m.User!.NormalizedEmail == normalizedEmail, cancellationToken).ConfigureAwait(false))
    {
      return new InvitationChangeResult(ChangeOutcome.Invalid, Field: EmailField, Message: "This person is already in the workspace.");
    }

    var now = timeProvider.GetUtcNow();
    var invitation = await context.Invitations
      .FirstOrDefaultAsync(i => i.WorkspaceId == workspaceId && i.NormalizedEmail == normalizedEmail, cancellationToken)
      .ConfigureAwait(false);
    var isNew = invitation is null;
    if (invitation is null)
    {
      invitation = new Invitation { WorkspaceId = workspaceId, Email = email, NormalizedEmail = normalizedEmail, InvitedById = userId };
      context.Invitations.Add(invitation);
    }

    invitation.Role = request.Role;
    invitation.InvitedById = userId;
    invitation.SentAt = now;
    invitation.ExpiresAt = now + Invitation.Lifetime;

    var details = await context.Workspaces
      .Where(w => w.Id == workspaceId)
      .Select(w => new { w.Name, InviterEmail = context.Users.Where(u => u.Id == userId).Select(u => u.Email).Single() })
      .SingleAsync(cancellationToken)
      .ConfigureAwait(false);
    await mailSender.SendAsync(InvitationEmail(invitation, details.Name, details.InviterEmail!), cancellationToken).ConfigureAwait(false);
    await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

    var response = new InvitationResponse(invitation.Id, invitation.Email, invitation.Role, details.InviterEmail!, invitation.SentAt, invitation.ExpiresAt);
    return new InvitationChangeResult(ChangeOutcome.Changed, response, isNew);
  }

  /// <summary>
  /// Revokes an open invitation.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier; must be an owner or admin.</param>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="invitationId">The invitation identifier.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>The outcome.</returns>
  public async Task<ChangeOutcome> RevokeAsync(string userId, Guid workspaceId, Guid invitationId, CancellationToken cancellationToken)
  {
    var outcome = await CheckManagerAsync(userId, workspaceId, cancellationToken).ConfigureAwait(false);
    if (outcome != ChangeOutcome.Changed)
    {
      return outcome;
    }

    var deleted = await context.Invitations
      .Where(i => i.Id == invitationId && i.WorkspaceId == workspaceId)
      .ExecuteDeleteAsync(cancellationToken)
      .ConfigureAwait(false);
    return deleted > 0 ? ChangeOutcome.Changed : ChangeOutcome.NotFound;
  }

  /// <summary>
  /// Lists the open invitations for the signed-in user's confirmed email, soonest to expire first.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="cancellationToken">Token to cancel the query.</param>
  /// <returns>The invitations.</returns>
  public async Task<IReadOnlyList<ReceivedInvitationResponse>> ListReceivedAsync(string userId, CancellationToken cancellationToken)
    => await Received(userId)
      .OrderBy(i => i.ExpiresAt)
      .Select(i => new ReceivedInvitationResponse(i.Id, i.WorkspaceId, i.Workspace!.Name, i.Role, i.InvitedBy!.Email!, i.ExpiresAt))
      .ToListAsync(cancellationToken)
      .ConfigureAwait(false);

  /// <summary>
  /// Accepts an invitation, joining its workspace with the invited role.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="invitationId">The invitation identifier.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>The joined workspace, or <see langword="null"/> when the user has no such open invitation.</returns>
  /// <remarks>
  /// The invitation is deleted before the membership is added, in one transaction, so accepting it twice at once joins only once.
  /// Someone already in the workspace keeps their role.
  /// </remarks>
  public async Task<WorkspaceResponse?> AcceptAsync(string userId, Guid invitationId, CancellationToken cancellationToken)
  {
    var invitation = await Received(userId)
      .AsNoTracking()
      .Where(i => i.Id == invitationId)
      .Select(i => new { i.WorkspaceId, i.Role })
      .FirstOrDefaultAsync(cancellationToken)
      .ConfigureAwait(false);
    if (invitation is null)
    {
      return null;
    }

    var transaction = await context.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
    await using (transaction.ConfigureAwait(false))
    {
      var deleted = await context.Invitations
        .Where(i => i.Id == invitationId)
        .ExecuteDeleteAsync(cancellationToken)
        .ConfigureAwait(false);
      if (deleted == 0)
      {
        return null;
      }

      if (!await context.WorkspaceMembers.AnyAsync(m => m.WorkspaceId == invitation.WorkspaceId && m.UserId == userId, cancellationToken).ConfigureAwait(false))
      {
        context.WorkspaceMembers.Add(new WorkspaceMember
        {
          WorkspaceId = invitation.WorkspaceId,
          UserId = userId,
          Role = invitation.Role,
          JoinedAt = timeProvider.GetUtcNow(),
        });
        await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
      }

      await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
    }

    return await context.WorkspaceMembers
      .Where(m => m.WorkspaceId == invitation.WorkspaceId && m.UserId == userId)
      .Select(m => new WorkspaceResponse(m.WorkspaceId, m.Workspace!.Name, m.Role, m.Workspace.Members.Count, m.Workspace.CreatedAt))
      .SingleAsync(cancellationToken)
      .ConfigureAwait(false);
  }

  /// <summary>
  /// Declines an invitation.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="invitationId">The invitation identifier.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns><see langword="true"/> when the user had such an open invitation.</returns>
  public async Task<bool> DeclineAsync(string userId, Guid invitationId, CancellationToken cancellationToken)
    => await Received(userId)
      .Where(i => i.Id == invitationId)
      .ExecuteDeleteAsync(cancellationToken)
      .ConfigureAwait(false) > 0;

  /// <summary>
  /// Queries the open invitations for the user's email, provided the user has confirmed it.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <returns>The invitations.</returns>
  private IQueryable<Invitation> Received(string userId)
  {
    var now = timeProvider.GetUtcNow();
    return context.Invitations.Where(i =>
      i.ExpiresAt > now
      && context.Users.Any(u => u.Id == userId && u.EmailConfirmed && u.NormalizedEmail == i.NormalizedEmail));
  }

  /// <summary>
  /// Checks that the user is an owner or admin of the workspace.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="cancellationToken">Token to cancel the query.</param>
  /// <returns><see cref="ChangeOutcome.Changed"/> when allowed, <see cref="ChangeOutcome.Forbidden"/> for a member, otherwise <see cref="ChangeOutcome.NotFound"/>.</returns>
  private async Task<ChangeOutcome> CheckManagerAsync(string userId, Guid workspaceId, CancellationToken cancellationToken)
  {
    var role = await context.RoleInAsync(userId, workspaceId, cancellationToken).ConfigureAwait(false);
    if (role is null)
    {
      return ChangeOutcome.NotFound;
    }

    return role.Value.CanManage() ? ChangeOutcome.Changed : ChangeOutcome.Forbidden;
  }

  /// <summary>
  /// Builds the email inviting someone to a workspace.
  /// </summary>
  /// <param name="invitation">The invitation.</param>
  /// <param name="workspaceName">The workspace's name.</param>
  /// <param name="inviterEmail">The email address of who sent it.</param>
  /// <returns>The email.</returns>
  private MailMessage InvitationEmail(Invitation invitation, string workspaceName, string inviterEmail)
  {
    var link = app.Value.Link("/invitations");
    var expires = invitation.ExpiresAt.ToString("dddd d MMMM yyyy", CultureInfo.InvariantCulture);
    var body = $"{inviterEmail} invited you to join {workspaceName} on IdeaVerse, where the team plans its ideas together.\n\n"
      + $"Open your invitations to accept:\n{link}\n\n"
      + $"New to IdeaVerse? Create an account with this email address ({invitation.Email}) and the invitation will be waiting for you.\n\n"
      + $"The invitation expires on {expires}. If you weren't expecting it, you can ignore this email.";
    return new MailMessage(invitation.Email, Subject(workspaceName), body);
  }
}
