namespace Pouspourika.IdeaVerse.Api.Tests;

using Pouspourika.IdeaVerse.Api.Deployment;

public class DeploymentOptionsTests
{
  [Test]
  public async Task Validate_EmptyLocalConfiguration_AcceptsSettings()
  {
    var options = new DeploymentOptions();

    var failures = options.Validate(requireKeyRing: false).ToArray();

    await Assert.That(failures).IsEmpty();
  }

  [Test]
  [Arguments("missing-keyring")]
  [Arguments("unpaired-key-path")]
  [Arguments("unpaired-certificate-path")]
  [Arguments("relative-keyring")]
  [Arguments("relative-certificate")]
  [Arguments("invalid-proxy")]
  public async Task Validate_InvalidDeploymentConfiguration_ReportsFailuresWithoutSecrets(string scenario)
  {
    const string password = "deployment-secret-that-must-not-leak";
    var options = new DeploymentOptions { CertificatePassword = password };
    var requireKeyRing = true;
    switch (scenario)
    {
      case "missing-keyring":
        break;
      case "unpaired-key-path":
        options.KeyRingPath = Path.GetFullPath("key-ring");
        break;
      case "unpaired-certificate-path":
        options.CertificatePath = Path.GetFullPath("certificate.pfx");
        break;
      case "relative-keyring":
        options.KeyRingPath = "key-ring";
        options.CertificatePath = Path.GetFullPath("certificate.pfx");
        requireKeyRing = false;
        break;
      case "relative-certificate":
        options.KeyRingPath = Path.GetFullPath("key-ring");
        options.CertificatePath = "certificate.pfx";
        requireKeyRing = false;
        break;
      case "invalid-proxy":
        options.TrustedProxies = ["not-an-ip"];
        requireKeyRing = false;
        break;
      default:
        throw new ArgumentOutOfRangeException(nameof(scenario));
    }

    var failures = options.Validate(requireKeyRing).ToArray();

    await Assert.That(failures).IsNotEmpty();
    await Assert.That(string.Join(Environment.NewLine, failures)).DoesNotContain(password);
  }

  [Test]
  [Arguments("127.0.0.1")]
  [Arguments("2001:db8::1")]
  public async Task Validate_ExactProxyIp_AcceptsAddress(string proxy)
  {
    var options = new DeploymentOptions { TrustedProxies = [proxy] };

    var failures = options.Validate(requireKeyRing: false).ToArray();

    await Assert.That(failures).IsEmpty();
  }
}
