namespace Pouspourika.IdeaVerse.Api.Deployment;

using System.Net;
using System.Net.Mail;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;

using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Extensions.Options;

using Pouspourika.IdeaVerse.Api.Email;

/// <summary>
/// Configures hosting safeguards without depending on a particular cloud provider.
/// </summary>
internal static class DeploymentExtensions
{
  /// <summary>
  /// Validates deployed settings and configures encrypted persistent keys and trusted proxy headers.
  /// </summary>
  /// <param name="builder">The application builder.</param>
  /// <returns>The key encryption certificate, owned by the caller until the application stops, or <see langword="null"/> locally.</returns>
  public static X509Certificate2? ConfigureDeployment(this WebApplicationBuilder builder)
  {
    var settings = builder.Configuration.GetSection(DeploymentOptions.SectionName).Get<DeploymentOptions>() ?? new();
    var deployed = builder.Environment.IsProduction() || builder.Environment.IsStaging();
    var failures = settings.Validate(requireKeyRing: false).ToList();
    if (failures.Count > 0)
    {
      throw new OptionsValidationException(DeploymentOptions.SectionName, typeof(DeploymentOptions), failures);
    }

    if (deployed)
    {
      builder.Services.AddOptions<DeploymentOptions>()
        .BindConfiguration(DeploymentOptions.SectionName)
        .Validate(o => !string.IsNullOrWhiteSpace(o.KeyRingPath), "Deployment:KeyRingPath is required in Production and Staging.")
        .Validate(
          _ => !string.IsNullOrWhiteSpace(builder.Configuration.GetConnectionString("IdeaVerse"))
            && !builder.Configuration.GetValue<bool>("Database:MigrateOnStartup"),
          "A database connection is required, and Database:MigrateOnStartup must be false in Production and Staging.")
        .ValidateOnStart();
      builder.Services.AddOptions<AppOptions>().Validate(
        o => o.PublicUrl.IsAbsoluteUri && o.PublicUrl.Scheme == Uri.UriSchemeHttps
          && string.IsNullOrEmpty(o.PublicUrl.UserInfo) && string.IsNullOrEmpty(o.PublicUrl.Query)
          && string.IsNullOrEmpty(o.PublicUrl.Fragment),
        "App:PublicUrl must be an absolute HTTPS URL without credentials, query, or fragment.");
      builder.Services.AddOptions<EmailOptions>()
        .Validate(o => !string.IsNullOrWhiteSpace(o.SmtpHost), "Email:SmtpHost is required in Production and Staging.")
        .Validate(o => o.RequireTls, "Email:RequireTls must be true in Production and Staging.")
        .Validate(
          o => MailAddress.TryCreate(o.From, out var from)
            && !from.Host.EndsWith(".local", StringComparison.OrdinalIgnoreCase)
            && !from.Host.EndsWith(".example", StringComparison.OrdinalIgnoreCase)
            && !from.Host.EndsWith(".invalid", StringComparison.OrdinalIgnoreCase)
            && !from.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase),
          "Email:From must be a valid, non-placeholder sender address in Production and Staging.");
      builder.Services.ConfigureApplicationCookie(o => o.Cookie.SecurePolicy = CookieSecurePolicy.Always);
      builder.Services.AddHsts(o => o.MaxAge = TimeSpan.FromDays(30));
    }

    builder.Services.Configure<ForwardedHeadersOptions>(o =>
    {
      o.ForwardedHeaders = settings.TrustedProxies.Length == 0
        ? ForwardedHeaders.None
        : ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
      o.ForwardLimit = 1;
      o.KnownIPNetworks.Clear();
      o.KnownProxies.Clear();
      foreach (var proxy in settings.TrustedProxies)
      {
        o.KnownProxies.Add(IPAddress.Parse(proxy));
      }
    });

    if (string.IsNullOrWhiteSpace(settings.KeyRingPath) || string.IsNullOrWhiteSpace(settings.CertificatePath))
    {
      return null;
    }

    var certificate = X509CertificateLoader.LoadPkcs12FromFile(
      settings.CertificatePath,
      settings.CertificatePassword,
      X509KeyStorageFlags.EphemeralKeySet);
    using var privateKey = certificate.GetRSAPrivateKey();
    if (privateKey is null)
    {
      certificate.Dispose();
      throw new CryptographicException("Deployment:CertificatePath must contain a certificate with its RSA private key.");
    }

    builder.Services.AddDataProtection()
      .SetApplicationName("IdeaVerse")
      .PersistKeysToFileSystem(new DirectoryInfo(settings.KeyRingPath))
      .ProtectKeysWithCertificate(certificate);
    return certificate;
  }
}
