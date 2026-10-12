namespace Pouspourika.IdeaVerse.Api.Branding;

/// <summary>
/// Recognizes the image formats accepted for logos from their first bytes, so a file's claimed type is never trusted and
/// formats that can carry script, such as SVG, are refused.
/// </summary>
public static class ImageFormats
{
  /// <summary>
  /// The media type of a PNG, JPEG, or WebP image.
  /// </summary>
  /// <param name="data">The file's bytes.</param>
  /// <returns>The media type, or <see langword="null"/> for anything else.</returns>
  public static string? Detect(ReadOnlySpan<byte> data)
  {
    if (data.StartsWith((ReadOnlySpan<byte>)[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))
    {
      return "image/png";
    }

    if (data.StartsWith((ReadOnlySpan<byte>)[0xFF, 0xD8, 0xFF]))
    {
      return "image/jpeg";
    }

    return data.Length >= 12 && data[..4].SequenceEqual("RIFF"u8) && data[8..12].SequenceEqual("WEBP"u8) ? "image/webp" : null;
  }
}
