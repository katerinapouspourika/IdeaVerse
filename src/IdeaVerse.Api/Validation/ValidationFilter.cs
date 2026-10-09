namespace Pouspourika.IdeaVerse.Api.Validation;

using System.ComponentModel.DataAnnotations;
using System.Text.Json;

/// <summary>
/// Validates the <typeparamref name="TRequest"/> argument with data annotations and <see cref="IValidatableObject"/> before the endpoint runs.
/// </summary>
/// <typeparam name="TRequest">The request type to validate.</typeparam>
internal sealed class ValidationFilter<TRequest> : IEndpointFilter
  where TRequest : class
{
  /// <inheritdoc/>
  public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
  {
    ArgumentNullException.ThrowIfNull(context);
    ArgumentNullException.ThrowIfNull(next);

    var request = context.Arguments.OfType<TRequest>().FirstOrDefault();
    if (request is null)
    {
      return TypedResults.Problem(detail: "A request body is required.", statusCode: StatusCodes.Status400BadRequest);
    }

    var results = new List<ValidationResult>();
    var validationContext = new ValidationContext(request, context.HttpContext.RequestServices, items: null);
    return Validator.TryValidateObject(request, validationContext, results, validateAllProperties: true)
      ? await next(context).ConfigureAwait(false)
      : TypedResults.ValidationProblem(ToErrors(results));
  }

  /// <summary>
  /// Groups validation results by camelCase member name, matching the JSON field names.
  /// </summary>
  /// <param name="results">The failed validation results.</param>
  /// <returns>Error messages keyed by field.</returns>
  private static Dictionary<string, string[]> ToErrors(IEnumerable<ValidationResult> results)
    => results
      .SelectMany(r => (r.MemberNames.Any() ? r.MemberNames : [string.Empty]).Select(m => (Member: m, Message: r.ErrorMessage ?? "Invalid value.")))
      .GroupBy(e => JsonNamingPolicy.CamelCase.ConvertName(e.Member), StringComparer.Ordinal)
      .ToDictionary(g => g.Key, g => g.Select(e => e.Message).ToArray(), StringComparer.Ordinal);
}
