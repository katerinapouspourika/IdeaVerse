namespace Pouspourika.IdeaVerse.Api.Discovery;

using System.Diagnostics.CodeAnalysis;

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

using Pouspourika.IdeaVerse.Api.Data;
using Pouspourika.IdeaVerse.Api.Email;
using Pouspourika.IdeaVerse.Api.Workspaces;

/// <summary>
/// Lets people find their company's workspaces by email domain and ask to join, and lets each workspace's owner and admins
/// choose its domain, hide it, and answer requests.
/// </summary>
/// <remarks>
/// A workspace can only take the domain of the email of the owner or admin setting it, and never a public email provider's,
/// so no one can claim another company's people. Accounts confirm their email before signing in, so an address's domain
/// shows where its owner works. Joining always waits for an owner or admin to approve, and makes the person a member.
/// </remarks>
/// <param name="context">The database context.</param>
/// <param name="mailSender">Sends the request and approval emails.</param>
/// <param name="throttle">Limits how often one person's requests are emailed.</param>
/// <param name="app">Application settings, for links in emails.</param>
/// <param name="timeProvider">The clock.</param>
public sealed class DiscoveryService(IdeaVerseDbContext context, IMailSender mailSender, EmailThrottle throttle, IOptions<AppOptions> app, TimeProvider timeProvider)
{
  /// <summary>
  /// How many times a day a workspace's owner and admins are emailed about one person's requests to join it.
  /// </summary>
  public const int RequestEmailsPerDay = 3;

  /// <summary>
  /// Builds the subject of the email telling a workspace's owner and admins that someone asked to join.
  /// </summary>
  /// <param name="workspaceName">The workspace's name.</param>
  /// <returns>The subject.</returns>
  public static string RequestSubject(string workspaceName) => $"Someone asked to join {workspaceName} on IdeaVerse";

  /// <summary>
  /// Builds the subject of the email telling someone their request was approved.
  /// </summary>
  /// <param name="workspaceName">The workspace's name.</param>
  /// <returns>The subject.</returns>
  public static string ApprovedSubject(string workspaceName) => $"You've joined {workspaceName} on IdeaVerse";

  /// <summary>
  /// Gets which company's people can find a workspace.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>The settings, or why the user may not see them.</returns>
  public async Task<DiscoverySettingsResult> GetSettingsAsync(string userId, Guid workspaceId, CancellationToken cancellationToken)
  {
    var outcome = await CheckManagerAsync(userId, workspaceId, cancellationToken).ConfigureAwait(false);
    return outcome != ChangeOutcome.Changed
      ? new DiscoverySettingsResult(outcome)
      : new DiscoverySettingsResult(ChangeOutcome.Changed, await SettingsAsync(userId, workspaceId, cancellationToken).ConfigureAwait(false));
  }

  /// <summary>
  /// Sets a workspace's company domain and whether its people can find the workspace.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="request">The new settings.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>The settings, or why they were not changed.</returns>
  public async Task<DiscoverySettingsResult> SetSettingsAsync(string userId, Guid workspaceId, DiscoverySettingsRequest request, CancellationToken cancellationToken)
  {
    ArgumentNullException.ThrowIfNull(request);
    var outcome = await CheckManagerAsync(userId, workspaceId, cancellationToken).ConfigureAwait(false);
    if (outcome != ChangeOutcome.Changed)
    {
      return new DiscoverySettingsResult(outcome);
    }

    var domain = Normalize(request.Domain);
    if (domain is not null)
    {
      var own = EmailDomains.CompanyOf(await EmailOfAsync(userId, cancellationToken).ConfigureAwait(false));
      if (own is null)
      {
        return new DiscoverySettingsResult(ChangeOutcome.Invalid, Message: "Your email is at a public email provider, so it can’t show which company you work for. Sign in with your work email to set a company domain.");
      }

      if (!string.Equals(domain, own, StringComparison.Ordinal))
      {
        return new DiscoverySettingsResult(ChangeOutcome.Invalid, Message: $"Use the domain of your own work email, {own}.");
      }
    }

    await context.Workspaces
      .Where(w => w.Id == workspaceId)
      .ExecuteUpdateAsync(
        set => set.SetProperty(w => w.CompanyDomain, domain).SetProperty(w => w.Discoverable, domain != null && request.Discoverable),
        cancellationToken)
      .ConfigureAwait(false);
    return new DiscoverySettingsResult(ChangeOutcome.Changed, await SettingsAsync(userId, workspaceId, cancellationToken).ConfigureAwait(false));
  }

  /// <summary>
  /// Lists the workspaces at the user's company they are not in and can ask to join.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>The workspaces, by name; none for an address at a public email provider.</returns>
  public async Task<IReadOnlyList<DiscoveredWorkspaceResponse>> DiscoverAsync(string userId, CancellationToken cancellationToken)
  {
    var domain = EmailDomains.CompanyOf(await EmailOfAsync(userId, cancellationToken).ConfigureAwait(false));
    if (domain is null)
    {
      return [];
    }

    return await Findable(userId, domain)
      .OrderBy(w => w.Name)
      .Select(w => new DiscoveredWorkspaceResponse(w.Id, w.Name, w.Members.Count, context.JoinRequests.Any(r => r.WorkspaceId == w.Id && r.UserId == userId)))
      .ToListAsync(cancellationToken)
      .ConfigureAwait(false);
  }

  /// <summary>
  /// Asks to join a workspace at the user's company, telling its owner and admins by email. Asking again changes nothing.
  /// </summary>
  /// <remarks>
  /// Withdrawing and asking again makes a new request, but the owner and admins are emailed about one person's requests
  /// to a workspace at most <see cref="RequestEmailsPerDay"/> times a day; the requests still show on the People page.
  /// </remarks>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns><see langword="true"/> when the request stands; <see langword="false"/> when the workspace isn't one they can find.</returns>
  public async Task<bool> RequestAsync(string userId, Guid workspaceId, CancellationToken cancellationToken)
  {
    var email = await EmailOfAsync(userId, cancellationToken).ConfigureAwait(false);
    if (EmailDomains.CompanyOf(email) is not { } domain)
    {
      return false;
    }

    var workspace = await Findable(userId, domain)
      .Where(w => w.Id == workspaceId)
      .Select(w => new { w.Name, Requested = context.JoinRequests.Any(r => r.WorkspaceId == w.Id && r.UserId == userId) })
      .SingleOrDefaultAsync(cancellationToken)
      .ConfigureAwait(false);
    if (workspace is null)
    {
      return false;
    }

    if (!workspace.Requested)
    {
      context.JoinRequests.Add(new JoinRequest { WorkspaceId = workspaceId, UserId = userId, CreatedAt = timeProvider.GetUtcNow() });
      await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
      if (throttle.TryAcquire($"joinRequest:{workspaceId}:{userId}", RequestEmailsPerDay, TimeSpan.FromDays(1)))
      {
        await EmailManagersAsync(workspaceId, workspace.Name, email!, cancellationToken).ConfigureAwait(false);
      }
    }

    return true;
  }

  /// <summary>
  /// Withdraws the user's request to join a workspace.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns><see langword="true"/> when there was such a request.</returns>
  public async Task<bool> WithdrawAsync(string userId, Guid workspaceId, CancellationToken cancellationToken)
    => await context.JoinRequests
      .Where(r => r.WorkspaceId == workspaceId && r.UserId == userId)
      .ExecuteDeleteAsync(cancellationToken)
      .ConfigureAwait(false) > 0;

  /// <summary>
  /// Lists the requests to join a workspace, oldest first.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>The requests, or why the user may not see them.</returns>
  public async Task<(ChangeOutcome Outcome, IReadOnlyList<JoinRequestResponse> Requests)> ListRequestsAsync(string userId, Guid workspaceId, CancellationToken cancellationToken)
  {
    var outcome = await CheckManagerAsync(userId, workspaceId, cancellationToken).ConfigureAwait(false);
    if (outcome != ChangeOutcome.Changed)
    {
      return (Outcome: outcome, Requests: []);
    }

    var requests = await context.JoinRequests
      .Where(r => r.WorkspaceId == workspaceId)
      .OrderBy(r => r.CreatedAt)
      .Select(r => new JoinRequestResponse(r.Id, r.User!.Email!, r.User.DisplayName, r.CreatedAt))
      .ToListAsync(cancellationToken)
      .ConfigureAwait(false);
    return (Outcome: ChangeOutcome.Changed, Requests: requests);
  }

  /// <summary>
  /// Approves a request to join: the person joins as a member and is told by email.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="requestId">The request identifier.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>Whether it was approved, or why not.</returns>
  public async Task<ChangeOutcome> ApproveAsync(string userId, Guid workspaceId, Guid requestId, CancellationToken cancellationToken)
  {
    var outcome = await CheckManagerAsync(userId, workspaceId, cancellationToken).ConfigureAwait(false);
    if (outcome != ChangeOutcome.Changed)
    {
      return outcome;
    }

    var request = await context.JoinRequests
      .Where(r => r.Id == requestId && r.WorkspaceId == workspaceId)
      .Select(r => new { r.UserId, r.User!.Email, WorkspaceName = r.Workspace!.Name })
      .SingleOrDefaultAsync(cancellationToken)
      .ConfigureAwait(false);
    if (request is null)
    {
      return ChangeOutcome.NotFound;
    }

    if (!await context.WorkspaceMembers.AnyAsync(m => m.WorkspaceId == workspaceId && m.UserId == request.UserId, cancellationToken).ConfigureAwait(false))
    {
      context.WorkspaceMembers.Add(new WorkspaceMember { WorkspaceId = workspaceId, UserId = request.UserId, Role = WorkspaceRole.Member, JoinedAt = timeProvider.GetUtcNow() });
      await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }

    await context.JoinRequests.Where(r => r.Id == requestId).ExecuteDeleteAsync(cancellationToken).ConfigureAwait(false);
    if (request.Email is { } email)
    {
      await mailSender.SendAsync(ApprovedEmail(email, request.WorkspaceName), cancellationToken).ConfigureAwait(false);
    }

    return ChangeOutcome.Changed;
  }

  /// <summary>
  /// Declines a request to join. The person can ask again.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="requestId">The request identifier.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>Whether it was declined, or why not.</returns>
  public async Task<ChangeOutcome> DeclineAsync(string userId, Guid workspaceId, Guid requestId, CancellationToken cancellationToken)
  {
    var outcome = await CheckManagerAsync(userId, workspaceId, cancellationToken).ConfigureAwait(false);
    if (outcome != ChangeOutcome.Changed)
    {
      return outcome;
    }

    var deleted = await context.JoinRequests
      .Where(r => r.Id == requestId && r.WorkspaceId == workspaceId)
      .ExecuteDeleteAsync(cancellationToken)
      .ConfigureAwait(false);
    return deleted > 0 ? ChangeOutcome.Changed : ChangeOutcome.NotFound;
  }

  /// <summary>
  /// Normalizes a domain as typed: trimmed, lower-cased, without a leading <c>@</c>.
  /// </summary>
  /// <param name="domain">The domain as typed.</param>
  /// <returns>The domain, or <see langword="null"/> when blank.</returns>
  [SuppressMessage("Globalization", "CA1308:Normalize strings to uppercase", Justification = "Domains are shown as stored, and are written in lower case.")]
  private static string? Normalize(string? domain)
  {
    var trimmed = domain?.Trim().TrimStart('@').ToLowerInvariant();
    return string.IsNullOrEmpty(trimmed) ? null : trimmed;
  }

  /// <summary>
  /// The workspaces at a company domain that are not hidden and that the user is not in.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="domain">The user's company domain.</param>
  /// <returns>The query.</returns>
  private IQueryable<Workspace> Findable(string userId, string domain)
    => context.Workspaces.Where(w => w.Discoverable && w.CompanyDomain == domain && !w.Members.Any(m => m.UserId == userId));

  /// <summary>
  /// Reads a workspace's settings for the user changing them, with their own company domain to offer.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>The settings.</returns>
  private async Task<DiscoverySettingsResponse> SettingsAsync(string userId, Guid workspaceId, CancellationToken cancellationToken)
  {
    var workspace = await context.Workspaces
      .Where(w => w.Id == workspaceId)
      .Select(w => new { w.CompanyDomain, w.Discoverable })
      .SingleAsync(cancellationToken)
      .ConfigureAwait(false);
    var suggested = EmailDomains.CompanyOf(await EmailOfAsync(userId, cancellationToken).ConfigureAwait(false));
    return new DiscoverySettingsResponse(workspace.CompanyDomain, workspace.Discoverable, suggested);
  }

  /// <summary>
  /// Reads a user's email.
  /// </summary>
  /// <param name="userId">The user's identifier.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>The email.</returns>
  private Task<string?> EmailOfAsync(string userId, CancellationToken cancellationToken)
    => context.Users.Where(u => u.Id == userId).Select(u => u.Email).SingleOrDefaultAsync(cancellationToken);

  /// <summary>
  /// Emails a workspace's owner and admins that someone asked to join.
  /// </summary>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="workspaceName">The workspace's name.</param>
  /// <param name="requester">The email of the person asking.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>A task that completes when the emails are sent.</returns>
  private async Task EmailManagersAsync(Guid workspaceId, string workspaceName, string requester, CancellationToken cancellationToken)
  {
    var managers = await context.WorkspaceMembers
      .Where(m => m.WorkspaceId == workspaceId && (m.Role == WorkspaceRole.Owner || m.Role == WorkspaceRole.Admin))
      .Select(m => m.User!.Email)
      .ToListAsync(cancellationToken)
      .ConfigureAwait(false);
    var content = new EmailContent(
      $"{requester} asked to join {workspaceName}",
      [$"{requester} works at your company and found {workspaceName} on IdeaVerse. Approve to add them as a member, or decline."],
      new EmailAction("Review requests", new Uri(app.Value.Link($"/people?workspace={workspaceId}"))),
      "You get this because you are an owner or admin of this workspace. You can hide it from your company on the People page.");
    foreach (var manager in managers.OfType<string>())
    {
      await mailSender.SendAsync(EmailLayout.Compose(manager, RequestSubject(workspaceName), content, app.Value), cancellationToken).ConfigureAwait(false);
    }
  }

  /// <summary>
  /// Builds the email telling someone their request was approved.
  /// </summary>
  /// <param name="email">Their email.</param>
  /// <param name="workspaceName">The workspace's name.</param>
  /// <returns>The email.</returns>
  private MailMessage ApprovedEmail(string email, string workspaceName)
    => EmailLayout.Compose(
      email,
      ApprovedSubject(workspaceName),
      new EmailContent(
        $"You're in {workspaceName}",
        [$"Your request to join {workspaceName} was approved. You can now see and plan its ideas with the team."],
        new EmailAction("Open IdeaVerse", new Uri(app.Value.Link("/ideas")))),
      app.Value);

  /// <summary>
  /// Checks that the user may manage the workspace: its owner or an admin.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns><see cref="ChangeOutcome.Changed"/> when they may, otherwise why not.</returns>
  private async Task<ChangeOutcome> CheckManagerAsync(string userId, Guid workspaceId, CancellationToken cancellationToken)
  {
    var role = await context.RoleInAsync(userId, workspaceId, cancellationToken).ConfigureAwait(false);
    if (role is null)
    {
      return ChangeOutcome.NotFound;
    }

    return role.Value.CanManage() ? ChangeOutcome.Changed : ChangeOutcome.Forbidden;
  }
}
