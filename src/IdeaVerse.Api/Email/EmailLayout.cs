namespace Pouspourika.IdeaVerse.Api.Email;

using System.Globalization;
using System.Net;
using System.Text;

/// <summary>
/// Lays out IdeaVerse's emails: a plain-text version, and a branded HTML version with the action as a button.
/// </summary>
/// <remarks>
/// The HTML uses tables and inline styles only, since many email clients ignore stylesheets and modern layout. Every
/// value is HTML-encoded, as names, titles, and comments come from users.
/// </remarks>
public static class EmailLayout
{
  /// <summary>
  /// The brand blue used for the header bar and the button, dark enough for white text.
  /// </summary>
  private const string Brand = "#232b8f";

  /// <summary>
  /// Builds an email in both versions.
  /// </summary>
  /// <param name="to">The recipient.</param>
  /// <param name="subject">The subject line.</param>
  /// <param name="content">What it says.</param>
  /// <param name="app">Application settings, for links to the logo and to the settings page.</param>
  /// <param name="replyTo">Where replies should go, when not to the sender.</param>
  /// <returns>The email.</returns>
  public static MailMessage Compose(string to, string subject, EmailContent content, AppOptions app, string? replyTo = null)
  {
    ArgumentNullException.ThrowIfNull(content);
    ArgumentNullException.ThrowIfNull(app);
    return new MailMessage(to, subject, Text(content), replyTo, Html(subject, content, app));
  }

  /// <summary>
  /// The plain-text version: the paragraphs, each section's title and items with their links on lines of their own, the
  /// action's label with its link on a line of its own, and the footnote.
  /// </summary>
  /// <param name="content">What the email says.</param>
  /// <returns>The plain-text body.</returns>
  public static string Text(EmailContent content)
  {
    ArgumentNullException.ThrowIfNull(content);
    var parts = new List<string>(content.Paragraphs);
    foreach (var section in content.Sections ?? [])
    {
      parts.Add(string.Join("\n\n", section.Items.Select(i => $"- {i.Text}\n  {i.Link.Url.AbsoluteUri}").Prepend(section.Heading)));
    }

    if (content.Action is { } action)
    {
      parts.Add($"{action.Label}:\n{action.Url.AbsoluteUri}");
    }

    if (content.Footnote is { } footnote)
    {
      parts.Add(footnote);
    }

    return string.Join("\n\n", parts);
  }

  /// <summary>
  /// The HTML version: a header bar with the logo, a card with the heading, paragraphs, sections, button, and the link written out
  /// for when the button doesn't work, then the footnote and a link to the reader's settings.
  /// </summary>
  /// <param name="subject">The subject line, used as the document's title.</param>
  /// <param name="content">What the email says.</param>
  /// <param name="app">Application settings, for links to the logo and to the settings page.</param>
  /// <returns>The HTML body.</returns>
  private static string Html(string subject, EmailContent content, AppOptions app)
  {
    var html = new StringBuilder();
    var header = $$"""
      <!doctype html>
      <html lang="en">
      <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <meta name="color-scheme" content="light dark">
      <meta name="supported-color-schemes" content="light dark">
      <title>{{E(subject)}}</title>
      <style>
      @media (prefers-color-scheme: dark) {
        .page { background: #0e1230 !important; }
        .card { background: #171d48 !important; }
        .text { color: #e6e9ff !important; }
        .muted { color: #a7afd6 !important; }
        .link { color: #7ec8ff !important; }
        .button { background: #3a44c9 !important; }
      }
      </style>
      </head>
      <body style="margin:0;padding:0;background:#f6f1e7;">
      <table role="presentation" class="page" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f1e7;">
      <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
      <tr><td style="background:{{Brand}};border-radius:16px 16px 0 0;padding:18px 28px;">
      <img src="{{E(app.Link("/logo.png"))}}" width="32" height="32" alt="" style="vertical-align:middle;border-radius:8px;background:#ffffff;">
      <span style="vertical-align:middle;margin-left:10px;font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:bold;color:#ffffff;">IdeaVerse</span>
      </td></tr>
      <tr><td class="card" style="background:#ffffff;border-radius:0 0 16px 16px;padding:28px;font-family:Arial,Helvetica,sans-serif;">
      <h1 class="text" style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#1b2150;">{{E(content.Heading)}}</h1>
      """;
    html.Append(header);
    foreach (var paragraph in content.Paragraphs)
    {
      html.Append(CultureInfo.InvariantCulture, $"""<p class="text" style="margin:0 0 14px;font-size:16px;line-height:1.5;color:#1b2150;">{E(paragraph)}</p>""");
    }

    foreach (var section in content.Sections ?? [])
    {
      html.Append(CultureInfo.InvariantCulture, $"""<h2 class="text" style="margin:24px 0 12px;font-size:18px;line-height:1.3;color:#1b2150;">{E(section.Heading)}</h2>""");
      foreach (var item in section.Items)
      {
        var line = $"""
          <p class="text" style="margin:0 0 14px;padding-left:12px;border-left:3px solid #c9cdea;font-size:16px;line-height:1.5;color:#1b2150;">{E(item.Text)}<br>
          <a class="link" href="{E(item.Link.Url.AbsoluteUri)}" style="font-size:14px;font-weight:bold;color:#2b35b0;">{E(item.Link.Label)}</a></p>
          """;
        html.Append(line);
      }
    }

    if (content.Action is { } action)
    {
      var button = $"""
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0;"><tr>
        <td class="button" style="background:{Brand};border-radius:999px;">
        <a href="{E(action.Url.AbsoluteUri)}" style="display:inline-block;padding:13px 26px;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:999px;">{E(action.Label)}</a>
        </td></tr></table>
        <p class="muted" style="margin:0 0 14px;font-size:13px;line-height:1.5;color:#5b6585;">Button not working? Copy this link into your browser:<br>
        <a class="link" href="{E(action.Url.AbsoluteUri)}" style="color:#2b35b0;word-break:break-all;">{E(action.Url.AbsoluteUri)}</a></p>
        """;
      html.Append(button);
    }

    if (content.Footnote is { } footnote)
    {
      html.Append(CultureInfo.InvariantCulture, $"""<p class="muted" style="margin:18px 0 0;font-size:13px;line-height:1.5;color:#5b6585;">{E(footnote)}</p>""");
    }

    var footer = $"""
      </td></tr>
      <tr><td align="center" style="padding:18px 28px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#5b6585;">
      IdeaVerse · Plan ideas, together, on time.<br>
      <a href="{E(app.Link("/settings"))}" style="color:#5b6585;">Choose which emails you get</a>
      </td></tr>
      </table>
      </td></tr>
      </table>
      </body>
      </html>
      """;
    html.Append(footer);
    return html.ToString();
  }

  /// <summary>
  /// HTML-encodes a value for the email.
  /// </summary>
  /// <param name="value">The value.</param>
  /// <returns>The encoded value.</returns>
  private static string E(string value) => WebUtility.HtmlEncode(value);
}
