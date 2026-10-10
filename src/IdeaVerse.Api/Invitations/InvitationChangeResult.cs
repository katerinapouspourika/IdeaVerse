namespace Pouspourika.IdeaVerse.Api.Invitations;

/// <summary>
/// Outcome of sending an invitation.
/// </summary>
/// <param name="Outcome">What happened.</param>
/// <param name="Invitation">The sent invitation, when it was sent.</param>
/// <param name="IsNew">Whether the invitation is new, rather than an open one sent again.</param>
/// <param name="Field">The request field at fault, when <paramref name="Outcome"/> is <see cref="ChangeOutcome.Invalid"/>.</param>
/// <param name="Message">Why the invitation was not sent.</param>
public sealed record InvitationChangeResult(
  ChangeOutcome Outcome,
  InvitationResponse? Invitation = null,
  bool IsNew = false,
  string? Field = null,
  string? Message = null);
