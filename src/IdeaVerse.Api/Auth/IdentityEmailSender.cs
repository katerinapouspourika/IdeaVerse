namespace Pouspourika.IdeaVerse.Api.Auth;

using System.Net;

using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;

using Pouspourika.IdeaVerse.Api.Data;
using Pouspourika.IdeaVerse.Api.Email;

/// <summary>
/// Sends ASP.NET Core Identity's account emails, with links that open the web app's pages rather than API endpoints.
/// </summary>
/// <remarks>
/// Identity HTML-encodes the links and codes it passes in, so they are decoded before being placed in plain-text email.
/// </remarks>
/// <param name="mailSender">Sends the email.</param>
/// <param name="app">Application settings, for the web app's address.</param>
internal sealed class IdentityEmailSender(IMailSender mailSender, IOptions<AppOptions> app) : IEmailSender<User>
{
  /// <summary>
  /// Subject of the email confirming a new account's address.
  /// </summary>
  public const string ConfirmationSubject = "Confirm your IdeaVerse email";

  /// <summary>
  /// Subject of the password reset email.
  /// </summary>
  public const string PasswordResetSubject = "Reset your IdeaVerse password";

  /// <inheritdoc/>
  /// <remarks>
  /// Keeps the query of Identity's confirmation link (user id, code, and any changed email) and points it at the web app's
  /// <c>/confirm-email</c> page, which calls the API to confirm.
  /// </remarks>
  public Task SendConfirmationLinkAsync(User user, string email, string confirmationLink)
  {
    var query = new Uri(WebUtility.HtmlDecode(confirmationLink)).Query;
    var link = app.Value.Link($"/confirm-email{query}");
    return mailSender.SendAsync(
      new MailMessage(
        email,
        ConfirmationSubject,
        $"Welcome to IdeaVerse!\n\nConfirm your email address to start using your account:\n{link}\n\nIf you didn't sign up, you can ignore this email."),
      CancellationToken.None);
  }

  /// <inheritdoc/>
  public Task SendPasswordResetCodeAsync(User user, string email, string resetCode)
  {
    var code = WebUtility.HtmlDecode(resetCode);
    var link = app.Value.Link($"/reset-password?email={Uri.EscapeDataString(email)}&code={Uri.EscapeDataString(code)}");
    return SendResetAsync(email, link);
  }

  /// <inheritdoc/>
  public Task SendPasswordResetLinkAsync(User user, string email, string resetLink)
    => SendResetAsync(email, WebUtility.HtmlDecode(resetLink));

  /// <summary>
  /// Sends the password reset email.
  /// </summary>
  /// <param name="email">The recipient.</param>
  /// <param name="link">The link to the reset page.</param>
  /// <returns>A task that completes when the email is sent.</returns>
  private Task SendResetAsync(string email, string link)
    => mailSender.SendAsync(
      new MailMessage(
        email,
        PasswordResetSubject,
        $"Someone asked to reset the password for your IdeaVerse account.\n\nChoose a new password here:\n{link}\n\nThe link works for one day. If you didn't ask for this, ignore this email; your password stays the same."),
      CancellationToken.None);
}
