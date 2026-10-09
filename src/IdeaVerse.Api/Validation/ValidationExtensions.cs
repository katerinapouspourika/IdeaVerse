namespace Pouspourika.IdeaVerse.Api.Validation;

/// <summary>
/// Registers request validation on endpoints.
/// </summary>
internal static class ValidationExtensions
{
  /// <summary>
  /// Validates the endpoint's <typeparamref name="TRequest"/> argument and documents the validation problem response.
  /// </summary>
  /// <typeparam name="TRequest">The request type to validate.</typeparam>
  /// <param name="builder">The endpoint builder.</param>
  /// <returns>The same builder.</returns>
  public static RouteHandlerBuilder WithValidation<TRequest>(this RouteHandlerBuilder builder)
    where TRequest : class
    => builder.AddEndpointFilter<ValidationFilter<TRequest>>().ProducesValidationProblem();
}
