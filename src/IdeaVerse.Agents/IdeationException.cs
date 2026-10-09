namespace Pouspourika.IdeaVerse.Agents;

/// <summary>
/// Thrown when an agent cannot produce a usable response.
/// </summary>
public sealed class IdeationException : Exception
{
  /// <summary>
  /// Initializes a new instance of the <see cref="IdeationException"/> class.
  /// </summary>
  public IdeationException()
  {
  }

  /// <summary>
  /// Initializes a new instance of the <see cref="IdeationException"/> class.
  /// </summary>
  /// <param name="message">The error message.</param>
  public IdeationException(string message)
    : base(message)
  {
  }

  /// <summary>
  /// Initializes a new instance of the <see cref="IdeationException"/> class.
  /// </summary>
  /// <param name="message">The error message.</param>
  /// <param name="innerException">The underlying cause.</param>
  public IdeationException(string message, Exception innerException)
    : base(message, innerException)
  {
  }
}
