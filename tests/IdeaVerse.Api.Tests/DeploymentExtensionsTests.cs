namespace Pouspourika.IdeaVerse.Api.Tests;

using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Xml.Linq;

using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

using Pouspourika.IdeaVerse.Api;
using Pouspourika.IdeaVerse.Api.Deployment;
using Pouspourika.IdeaVerse.Api.Email;

public class DeploymentExtensionsTests
{
  private const string PfxPassword = "test-certificate-password";

  [Test]
  [Arguments("Staging", "")]
  [Arguments("Production", "")]
  [Arguments("Staging", "Host=localhost;Database=ideaverse")]
  [Arguments("Production", "Host=localhost;Database=ideaverse")]
  public async Task ConfigureDeployment_InvalidDatabaseSettings_ThrowsWhenOptionsAreAccessed(string environment, string connectionString)
  {
    var builder = CreateBuilder(environment, new Dictionary<string, string?>
    {
      ["ConnectionStrings:IdeaVerse"] = connectionString,
      ["Database:MigrateOnStartup"] = string.IsNullOrEmpty(connectionString) ? "false" : "true",
    });
    builder.ConfigureDeployment();
    using var provider = builder.Services.BuildServiceProvider();

    var exception = await Assert.That(() => provider.GetRequiredService<IOptions<DeploymentOptions>>().Value)
      .Throws<OptionsValidationException>();

    await Assert.That(exception.Message).Contains("database connection");
  }

  [Test]
  [Arguments("Staging")]
  [Arguments("Production")]
  public async Task ConfigureDeployment_MissingKeyRing_ThrowsWhenOptionsAreAccessed(string environment)
  {
    var builder = CreateBuilder(environment, new Dictionary<string, string?>
    {
      ["ConnectionStrings:IdeaVerse"] = "Host=localhost;Database=ideaverse",
      ["Database:MigrateOnStartup"] = "false",
    });
    builder.ConfigureDeployment();
    using var provider = builder.Services.BuildServiceProvider();

    var exception = await Assert.That(() => provider.GetRequiredService<IOptions<DeploymentOptions>>().Value)
      .Throws<OptionsValidationException>();

    await Assert.That(exception.Message).Contains("KeyRingPath is required");
  }

  [Test]
  [Arguments("http://app.example.com")]
  [Arguments("https://account@app.example.com")]
  [Arguments("https://app.example.com?token=private")]
  [Arguments("https://app.example.com#private")]
  [Arguments("relative/path")]
  public async Task ConfigureDeployment_InvalidPublicUrl_ThrowsWhenOptionsAreAccessed(string value)
  {
    using var certificateFile = new DeploymentCertificateFile();
    var builder = CreateValidDeployedBuilder("Production", certificateFile, new Dictionary<string, string?>
    {
      ["App:PublicUrl"] = value,
    });
    using var keyCertificate = builder.ConfigureDeployment();
    using var provider = builder.Services.BuildServiceProvider();

    await Assert.That(() => provider.GetRequiredService<IOptions<AppOptions>>().Value)
      .Throws<OptionsValidationException>();
  }

  [Test]
  [Arguments("", "true")]
  [Arguments("smtp.example.com", "false")]
  public async Task ConfigureDeployment_MissingSmtpOrTls_ThrowsWhenOptionsAreAccessed(string smtpHost, string requireTls)
  {
    using var certificateFile = new DeploymentCertificateFile();
    var builder = CreateValidDeployedBuilder("Staging", certificateFile, new Dictionary<string, string?>
    {
      ["Email:SmtpHost"] = smtpHost,
      ["Email:RequireTls"] = requireTls,
    });
    using var keyCertificate = builder.ConfigureDeployment();
    using var provider = builder.Services.BuildServiceProvider();

    await Assert.That(() => provider.GetRequiredService<IOptions<EmailOptions>>().Value)
      .Throws<OptionsValidationException>();
  }

  [Test]
  [Arguments("Production", "IdeaVerse <no-reply@ideaverse.local>")]
  [Arguments("Staging", "no-reply@ideaverse.local")]
  [Arguments("Production", "IdeaVerse <no-reply@ideaverse.example>")]
  [Arguments("Staging", "no-reply@ideaverse.example")]
  [Arguments("Production", "not-an-email")]
  [Arguments("Staging", "")]
  public async Task ConfigureDeployment_InvalidSender_ThrowsWhenOptionsAreAccessed(string environment, string sender)
  {
    using var certificateFile = new DeploymentCertificateFile();
    var builder = CreateValidDeployedBuilder(environment, certificateFile, new Dictionary<string, string?>
    {
      ["Email:From"] = sender,
    });
    using var keyCertificate = builder.ConfigureDeployment();
    using var provider = builder.Services.BuildServiceProvider();

    await Assert.That(() => provider.GetRequiredService<IOptions<EmailOptions>>().Value)
      .Throws<OptionsValidationException>();
  }

  [Test]
  public async Task ConfigureDeployment_ValidDeploymentSettings_AcceptsOptions()
  {
    using var certificateFile = new DeploymentCertificateFile();
    var builder = CreateValidDeployedBuilder("Production", certificateFile);
    using var keyCertificate = builder.ConfigureDeployment();
    using var provider = builder.Services.BuildServiceProvider();

    var appOptions = provider.GetRequiredService<IOptions<AppOptions>>().Value;
    var emailOptions = provider.GetRequiredService<IOptions<EmailOptions>>().Value;

    await Assert.That(appOptions.PublicUrl).IsEqualTo(new Uri("https://app.example.com"));
    await Assert.That(emailOptions.SmtpHost).IsEqualTo("smtp.example.com");
    await Assert.That(emailOptions.RequireTls).IsTrue();
    await Assert.That(emailOptions.From).IsEqualTo("IdeaVerse <no-reply@ideaverse.com>");
  }

  [Test]
  public async Task ConfigureDeployment_EncryptedKeysPersistAcrossProviders_ProtectsKeyMaterial()
  {
    var directory = new TemporaryDeploymentDirectory();
    try
    {
      using var certificateFile = new DeploymentCertificateFile(directory.Path);
      const string plaintext = "deployment roundtrip payload";
      const string purpose = "deployment-tests";
      string protectedValue;

      var firstBuilder = CreateValidDeployedBuilder("Production", certificateFile, new Dictionary<string, string?>
      {
        ["Deployment:KeyRingPath"] = directory.Path,
      });
      var firstCertificate = firstBuilder.ConfigureDeployment();
      try
      {
        using var firstProvider = firstBuilder.Services.BuildServiceProvider();
        var protector = firstProvider.GetRequiredService<IDataProtectionProvider>().CreateProtector(purpose);
        protectedValue = protector.Protect(plaintext);
      }
      finally
      {
        firstCertificate?.Dispose();
      }

      var keyXmlFiles = Directory.GetFiles(directory.Path, "*.xml", SearchOption.TopDirectoryOnly);
      await Assert.That(keyXmlFiles).IsNotEmpty();
      foreach (var keyXmlFile in keyXmlFiles)
      {
        var keyXml = XDocument.Parse(await File.ReadAllTextAsync(keyXmlFile));

        await Assert.That(keyXml.Descendants().Any(element => element.Name.LocalName == "encryptedSecret")).IsTrue();
        await Assert.That(keyXml.Descendants().Any(element => element.Name.LocalName == "masterKey")).IsFalse();
        await Assert.That(keyXml.Descendants().Any(element => element.Name.LocalName == "value")).IsFalse();
      }

      var secondBuilder = CreateValidDeployedBuilder("Production", certificateFile, new Dictionary<string, string?>
      {
        ["Deployment:KeyRingPath"] = directory.Path,
      });
      var secondCertificate = secondBuilder.ConfigureDeployment();
      try
      {
        using var secondProvider = secondBuilder.Services.BuildServiceProvider();
        var protector = secondProvider.GetRequiredService<IDataProtectionProvider>().CreateProtector(purpose);
        var unprotectedValue = protector.Unprotect(protectedValue);

        await Assert.That(unprotectedValue).IsEqualTo(plaintext);
      }
      finally
      {
        secondCertificate?.Dispose();
      }
    }
    finally
    {
      directory.Dispose();
    }
  }

  [Test]
  public async Task ConfigureDeployment_CertificateWithoutPrivateKey_ThrowsCryptographicException()
  {
    using var directory = new TemporaryDeploymentDirectory();
    using var publicCertificateFile = new DeploymentCertificateFile(directory.Path, includePrivateKey: false);
    var builder = CreateValidDeployedBuilder("Production", publicCertificateFile);

    await Assert.That(() => builder.ConfigureDeployment()).Throws<CryptographicException>();
  }

  [Test]
  public async Task ConfigureDeployment_EcdsaCertificate_ThrowsCryptographicException()
  {
    using var directory = new TemporaryDeploymentDirectory();
    using var ecdsa = ECDsa.Create(ECCurve.NamedCurves.nistP256);
    var request = new CertificateRequest("CN=IdeaVerse ECDSA deployment test", ecdsa, HashAlgorithmName.SHA256);
    using var certificate = request.CreateSelfSigned(DateTimeOffset.UtcNow.AddMinutes(-1), DateTimeOffset.UtcNow.AddDays(1));
    var certificatePath = Path.Combine(directory.Path, "ecdsa.pfx");
    await File.WriteAllBytesAsync(certificatePath, certificate.Export(X509ContentType.Pfx, PfxPassword));
    var builder = CreateBuilder("Production", ValidDeployedConfiguration(directory.Path, certificatePath));

    await Assert.That(() => builder.ConfigureDeployment()).Throws<CryptographicException>();
  }

  [Test]
  public async Task ConfigureDeployment_MalformedCertificate_ThrowsCryptographicException()
  {
    using var directory = new TemporaryDeploymentDirectory();
    var malformedCertificatePath = Path.Combine(directory.Path, "malformed.pfx");
    await File.WriteAllTextAsync(malformedCertificatePath, "not a certificate");
    var builder = CreateBuilder("Production", ValidDeployedConfiguration(directory.Path, malformedCertificatePath));

    await Assert.That(() => builder.ConfigureDeployment()).Throws<CryptographicException>();
  }

  [Test]
  public async Task ConfigureDeployment_TrustedProxy_UsesExactIpAndOneForwardedHop()
  {
    var builder = CreateBuilder("Development", new Dictionary<string, string?>
    {
      ["Deployment:TrustedProxies:0"] = "10.0.0.1",
    });
    builder.ConfigureDeployment();
    using var provider = builder.Services.BuildServiceProvider();
    var options = provider.GetRequiredService<IOptions<ForwardedHeadersOptions>>().Value;

    await Assert.That(options.KnownProxies.Select(ip => ip.ToString())).Contains("10.0.0.1");
    await Assert.That(options.ForwardLimit).IsEqualTo(1);
  }

  [Test]
  [Arguments("10.0.0.1", "198.51.100.23", "https", "198.51.100.23", "https")]
  [Arguments("10.0.0.1", "198.51.100.23, 203.0.113.42", "https", "203.0.113.42", "https")]
  [Arguments("10.0.0.2", "198.51.100.23", "https", "10.0.0.2", "http")]
  public async Task ConfigureDeployment_ForwardedHeaders_TrustsOnlyConfiguredProxy(
    string remoteAddress,
    string forwardedAddress,
    string forwardedScheme,
    string expectedAddress,
    string expectedScheme)
  {
    var builder = CreateBuilder("Development", new Dictionary<string, string?>
    {
      ["Deployment:TrustedProxies:0"] = "10.0.0.1",
    });
    builder.ConfigureDeployment();
    using var provider = builder.Services.BuildServiceProvider();
    var options = provider.GetRequiredService<IOptions<ForwardedHeadersOptions>>();
    var context = new DefaultHttpContext();
    context.Connection.RemoteIpAddress = System.Net.IPAddress.Parse(remoteAddress);
    context.Request.Scheme = "http";
    context.Request.Headers["X-Forwarded-For"] = forwardedAddress;
    context.Request.Headers["X-Forwarded-Proto"] = forwardedScheme;
    var middleware = new ForwardedHeadersMiddleware(
      _ => Task.CompletedTask,
      provider.GetRequiredService<ILoggerFactory>(),
      options);

    await middleware.Invoke(context);

    await Assert.That(context.Connection.RemoteIpAddress?.ToString()).IsEqualTo(expectedAddress);
    await Assert.That(context.Request.Scheme).IsEqualTo(expectedScheme);
  }

  [Test]
  public async Task ConfigureDeployment_NoTrustedProxy_IgnoresForwardedHeaders()
  {
    var builder = CreateBuilder("Development", new Dictionary<string, string?>());
    builder.ConfigureDeployment();
    using var provider = builder.Services.BuildServiceProvider();
    var options = provider.GetRequiredService<IOptions<ForwardedHeadersOptions>>();
    var context = new DefaultHttpContext();
    context.Connection.RemoteIpAddress = System.Net.IPAddress.Parse("10.0.0.1");
    context.Request.Scheme = "http";
    context.Request.Headers["X-Forwarded-For"] = "198.51.100.23";
    context.Request.Headers["X-Forwarded-Proto"] = "https";
    var middleware = new ForwardedHeadersMiddleware(
      _ => Task.CompletedTask,
      provider.GetRequiredService<ILoggerFactory>(),
      options);

    await middleware.Invoke(context);

    await Assert.That(context.Connection.RemoteIpAddress?.ToString()).IsEqualTo("10.0.0.1");
    await Assert.That(context.Request.Scheme).IsEqualTo("http");
  }

  private static WebApplicationBuilder CreateValidDeployedBuilder(
    string environment,
    DeploymentCertificateFile certificateFile,
    IReadOnlyDictionary<string, string?>? overrides = null)
  {
    var settings = new Dictionary<string, string?>(StringComparer.Ordinal)
    {
      ["ConnectionStrings:IdeaVerse"] = "Host=localhost;Database=ideaverse",
      ["Database:MigrateOnStartup"] = "false",
      ["Deployment:KeyRingPath"] = Path.Combine(certificateFile.DirectoryPath, "key-ring"),
      ["Deployment:CertificatePath"] = certificateFile.Path,
      ["Deployment:CertificatePassword"] = PfxPassword,
      ["App:PublicUrl"] = "https://app.example.com",
      ["Email:SmtpHost"] = "smtp.example.com",
      ["Email:RequireTls"] = "true",
      ["Email:From"] = "IdeaVerse <no-reply@ideaverse.com>",
    };
    if (overrides is not null)
    {
      foreach (var (key, value) in overrides)
      {
        settings[key] = value;
      }
    }

    var builder = CreateBuilder(environment, settings);
    builder.Services.AddOptions<AppOptions>().BindConfiguration(AppOptions.SectionName).ValidateDataAnnotations().ValidateOnStart();
    builder.Services.AddEmail();
    return builder;
  }

  private static Dictionary<string, string?> ValidDeployedConfiguration(string keyRingPath, string certificatePath)
    => new(StringComparer.Ordinal)
    {
      ["ConnectionStrings:IdeaVerse"] = "Host=localhost;Database=ideaverse",
      ["Database:MigrateOnStartup"] = "false",
      ["Deployment:KeyRingPath"] = keyRingPath,
      ["Deployment:CertificatePath"] = certificatePath,
      ["Deployment:CertificatePassword"] = PfxPassword,
      ["Email:From"] = "IdeaVerse <no-reply@ideaverse.com>",
    };

  private static WebApplicationBuilder CreateBuilder(string environment, IReadOnlyDictionary<string, string?> settings)
  {
    var builder = WebApplication.CreateBuilder(new WebApplicationOptions { EnvironmentName = environment });
    builder.Configuration.AddInMemoryCollection(settings);
    return builder;
  }

  private sealed class DeploymentCertificateFile : IDisposable
  {
    private readonly TemporaryDeploymentDirectory? ownedDirectory;

    public DeploymentCertificateFile(string? directoryPath = null, bool includePrivateKey = true)
    {
      if (directoryPath is null)
      {
        this.ownedDirectory = new TemporaryDeploymentDirectory();
        directoryPath = this.ownedDirectory.Path;
      }

      this.DirectoryPath = directoryPath;
      Directory.CreateDirectory(directoryPath);
      this.Path = System.IO.Path.Combine(directoryPath, "certificate.pfx");
      using var rsa = RSA.Create(2048);
      var request = new CertificateRequest("CN=IdeaVerse deployment test", rsa, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
      using var certificate = request.CreateSelfSigned(DateTimeOffset.UtcNow.AddMinutes(-1), DateTimeOffset.UtcNow.AddDays(1));
      byte[] bytes;
      if (includePrivateKey)
      {
        bytes = certificate.Export(X509ContentType.Pfx, PfxPassword);
      }
      else
      {
        using var publicCertificate = X509CertificateLoader.LoadCertificate(certificate.RawData);
        bytes = publicCertificate.Export(X509ContentType.Pfx, PfxPassword);
      }

      File.WriteAllBytes(this.Path, bytes);
    }

    public string DirectoryPath { get; }

    public string Path { get; }

    public void Dispose()
      => this.ownedDirectory?.Dispose();
  }

  private sealed class TemporaryDeploymentDirectory : IDisposable
  {
    public TemporaryDeploymentDirectory()
    {
      this.Path = System.IO.Path.Combine(System.IO.Path.GetTempPath(), $"ideaverse-deployment-tests-{Guid.NewGuid():N}");
      Directory.CreateDirectory(this.Path);
    }

    public string Path { get; }

    public void Dispose()
    {
      if (Directory.Exists(this.Path))
      {
        Directory.Delete(this.Path, recursive: true);
      }
    }
  }
}
