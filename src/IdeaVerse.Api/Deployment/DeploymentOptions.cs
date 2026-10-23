namespace Pouspourika.IdeaVerse.Api.Deployment;

using System.Net;

/// <summary>
/// Portable hosting settings for persistent encrypted keys and explicitly trusted reverse proxies.
/// </summary>
internal sealed class DeploymentOptions
{
  /// <summary>
  /// Configuration section containing deployment settings.
  /// </summary>
  public const string SectionName = "Deployment";

  /// <summary>
  /// Gets or sets the absolute path to the persistent key ring directory.
  /// </summary>
  public string? KeyRingPath { get; set; }

  /// <summary>
  /// Gets or sets the absolute path to the PKCS#12 certificate protecting the key ring.
  /// </summary>
  public string? CertificatePath { get; set; }

  /// <summary>
  /// Gets or sets the certificate password, supplied through a secret provider.
  /// </summary>
  public string? CertificatePassword { get; set; }

  /// <summary>
  /// Gets or sets the exact IP addresses trusted to supply forwarded client and scheme headers.
  /// </summary>
  public string[] TrustedProxies { get; set; } = [];

  /// <summary>
  /// Checks configuration without accessing the file system or exposing secrets in errors.
  /// </summary>
  /// <param name="requireKeyRing">Whether durable encrypted keys are required.</param>
  /// <returns>Validation failures.</returns>
  internal IEnumerable<string> Validate(bool requireKeyRing)
  {
    var hasKeys = !string.IsNullOrWhiteSpace(KeyRingPath);
    var hasCertificate = !string.IsNullOrWhiteSpace(CertificatePath);
    if (requireKeyRing && !hasKeys)
    {
      yield return "Deployment:KeyRingPath is required in Production and Staging.";
    }

    if (hasKeys != hasCertificate)
    {
      yield return "Deployment:KeyRingPath and Deployment:CertificatePath must be configured together.";
    }

    if (!string.IsNullOrWhiteSpace(KeyRingPath) && !Path.IsPathFullyQualified(KeyRingPath))
    {
      yield return "Deployment:KeyRingPath must be an absolute path.";
    }

    if (!string.IsNullOrWhiteSpace(CertificatePath) && !Path.IsPathFullyQualified(CertificatePath))
    {
      yield return "Deployment:CertificatePath must be an absolute path.";
    }

    if (TrustedProxies.Any(proxy => !IPAddress.TryParse(proxy, out _)))
    {
      yield return "Deployment:TrustedProxies must contain only exact IP addresses.";
    }
  }
}
