namespace Pouspourika.IdeaVerse.Api.Email;

using Microsoft.Extensions.Options;

/// <summary>
/// Registers outgoing email.
/// </summary>
internal static class EmailServiceCollectionExtensions
{
  /// <summary>
  /// Registers <see cref="IMailSender"/>: SMTP when <see cref="EmailOptions.SmtpHost"/> is set, otherwise a sender that only logs.
  /// </summary>
  /// <param name="services">The service collection.</param>
  /// <returns>The same service collection.</returns>
  public static IServiceCollection AddEmail(this IServiceCollection services)
  {
    services.AddOptions<EmailOptions>().BindConfiguration(EmailOptions.SectionName).ValidateDataAnnotations().ValidateOnStart();
    services.AddSingleton<SmtpMailSender>();
    services.AddSingleton<LoggingMailSender>();
    services.AddSingleton<IMailSender>(provider => string.IsNullOrWhiteSpace(provider.GetRequiredService<IOptions<EmailOptions>>().Value.SmtpHost)
      ? provider.GetRequiredService<LoggingMailSender>()
      : provider.GetRequiredService<SmtpMailSender>());
    return services;
  }
}
