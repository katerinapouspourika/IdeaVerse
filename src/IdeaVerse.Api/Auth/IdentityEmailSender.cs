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
/// Identity HTML-encodes the links and codes it passes in, so they are decoded before being placed in the email, which
/// <see cref="EmailLayout"/> encodes again for its HTML version.
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
  /// Subject of the email confirming a new address for an existing account.
  /// </summary>
  public const string ChangeEmailSubject = "Confirm your new IdeaVerse email";

  /// <summary>
  /// Subject of the password reset email.
  /// </summary>
  public const string PasswordResetSubject = "Reset your IdeaVerse password";

  /// <inheritdoc/>
  /// <remarks>
  /// Keeps the query of Identity's confirmation link (user id, code, and any changed email) and points it at the web app's
  /// <c>/confirm-email</c> page, which calls the API to confirm. A confirmed account asking for a different address gets
  /// a change-of-address email instead of the welcome.
  /// </remarks>
  public Task SendConfirmationLinkAsync(User user, string email, string confirmationLink)
  {
    ArgumentNullException.ThrowIfNull(user);
    var query = new Uri(WebUtility.HtmlDecode(confirmationLink)).Query;
    var link = app.Value.Link($"/confirm-email{query}");
    var changing = user.EmailConfirmed && !string.Equals(user.Email, email, StringComparison.OrdinalIgnoreCase);
    var message = changing
      ? EmailLayout.Compose(
        email,
        ChangeEmailSubject,
        new EmailContent(
          "Confirm your new email address",
          ["Someone asked to change the email address of an IdeaVerse account to this one. Confirm it to make the change."],
          new EmailAction("Confirm new email", new Uri(link)),
          "Until you do, the account keeps its current address. If this wasn't you, ignore this email."),
        app.Value)
      : EmailLayout.Compose(
        email,
        ConfirmationSubject,
        new EmailContent(
          "Welcome to IdeaVerse!",
          ["Confirm your email address to start using your account."],
          new EmailAction("Confirm your email", new Uri(link)),
          "If you didn't sign up, you can ignore this email."),
        app.Value);
    return mailSender.SendAsync(message, CancellationToken.None);
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
      EmailLayout.Compose(
        email,
        PasswordResetSubject,
        new EmailContent(
          "Reset your password",
          ["Someone asked to reset the password for your IdeaVerse account. The link works for one day."],
          new EmailAction("Choose a new password", new Uri(link)),
          "If you didn't ask for this, ignore this email; your password stays the same."),
        app.Value),
      CancellationToken.None);
}
