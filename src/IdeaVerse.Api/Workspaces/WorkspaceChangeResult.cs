namespace Pouspourika.IdeaVerse.Api.Workspaces;

/// <summary>
/// Outcome of an operation that changes a workspace or its people.
/// </summary>
/// <param name="Outcome">What happened.</param>
/// <param name="Workspace">The changed workspace, when the workspace itself changed.</param>
/// <param name="Member">The changed person, when a role changed.</param>
/// <param name="Field">The request field at fault, when <paramref name="Outcome"/> is <see cref="ChangeOutcome.Invalid"/>.</param>
/// <param name="Message">Why the change was rejected.</param>
public sealed record WorkspaceChangeResult(
  ChangeOutcome Outcome,
  WorkspaceResponse? Workspace = null,
  WorkspaceMemberResponse? Member = null,
  string? Field = null,
  string? Message = null)
{
  /// <summary>
  /// Why a member may not manage the workspace.
  /// </summary>
  public const string AdminsOnlyMessage = "Only the workspace's owner and admins can do this.";

  /// <summary>
  /// Creates a result for a workspace the user is not in, or a person who is not in it.
  /// </summary>
  /// <returns>The result.</returns>
  public static WorkspaceChangeResult NotFound() => new(ChangeOutcome.NotFound);

  /// <summary>
  /// Creates a result for a change the user's role does not allow.
  /// </summary>
  /// <param name="message">Why the change is not allowed.</param>
  /// <returns>The result.</returns>
  public static WorkspaceChangeResult Forbidden(string message = AdminsOnlyMessage) => new(ChangeOutcome.Forbidden, Message: message);

  /// <summary>
  /// Creates a result for an invalid request value.
  /// </summary>
  /// <param name="field">The request field at fault.</param>
  /// <param name="message">Why the value is invalid.</param>
  /// <returns>The result.</returns>
  public static WorkspaceChangeResult Invalid(string field, string message) => new(ChangeOutcome.Invalid, Field: field, Message: message);

  /// <summary>
  /// Creates a result for a change the workspace's current state does not allow.
  /// </summary>
  /// <param name="message">Why the change is not allowed.</param>
  /// <returns>The result.</returns>
  public static WorkspaceChangeResult Conflict(string message) => new(ChangeOutcome.Conflict, Message: message);
}
