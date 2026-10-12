namespace Pouspourika.IdeaVerse.Api.Branding;

using System.Diagnostics;
using System.Security.Claims;

using Microsoft.AspNetCore.Http.HttpResults;

using Pouspourika.IdeaVerse.Api.Auth;
using Pouspourika.IdeaVerse.Api.Workspaces;

/// <summary>
/// A workspace's colour and logo under <c>/api/v1/workspaces/{workspaceId}</c>.
/// </summary>
internal static class BrandingEndpoints
{
  /// <summary>
  /// Maps the branding endpoints. All require a signed-in user in the workspace; changes require its owner or an admin.
  /// </summary>
  /// <param name="endpoints">The route builder.</param>
  /// <returns>The same route builder.</returns>
  public static IEndpointRouteBuilder MapBrandingEndpoints(this IEndpointRouteBuilder endpoints)
  {
    var group = endpoints.MapGroup("/api/v1/workspaces/{workspaceId:guid}").WithTags("Branding").RequireAuthorization();
    group.MapPut("/color", SetColorAsync);
    group.MapGet("/logo", GetLogoAsync);
    group.MapPut("/logo", SetLogoAsync);
    group.MapDelete("/logo", RemoveLogoAsync);
    return endpoints;
  }

  /// <summary>
  /// Sets a workspace's colour.
  /// </summary>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="request">The colour.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The branding service.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>204, 400 for a colour outside the palette, 404, or 403 for a member.</returns>
  private static async Task<Results<NoContent, ValidationProblem, NotFound, ProblemHttpResult>> SetColorAsync(
    Guid workspaceId,
    ColorRequest request,
    ClaimsPrincipal user,
    BrandingService service,
    CancellationToken cancellationToken)
    => ToResult(
      await service.SetColorAsync(user.GetUserId(), workspaceId, request.Color, cancellationToken).ConfigureAwait(false),
      "color",
      $"Pick one of the workspace colours: {string.Join(", ", WorkspaceColors.All)}.");

  /// <summary>
  /// Replaces a workspace's logo with the image in the request body.
  /// </summary>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="http">The request, whose body is the image.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The branding service.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>204, 400 for another format or a file over 512 KB, 404, or 403 for a member.</returns>
  private static async Task<Results<NoContent, ValidationProblem, NotFound, ProblemHttpResult>> SetLogoAsync(
    Guid workspaceId,
    HttpRequest http,
    ClaimsPrincipal user,
    BrandingService service,
    CancellationToken cancellationToken)
  {
    var data = await ReadUpToAsync(http.Body, WorkspaceLogo.MaxBytes + 1, cancellationToken).ConfigureAwait(false);
    return ToResult(
      await service.SetLogoAsync(user.GetUserId(), workspaceId, data, cancellationToken).ConfigureAwait(false),
      "logo",
      "Upload a PNG, JPEG, or WebP image of up to 512 KB.");
  }

  /// <summary>
  /// Removes a workspace's logo.
  /// </summary>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The branding service.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>204, 404, or 403 for a member.</returns>
  private static async Task<Results<NoContent, ValidationProblem, NotFound, ProblemHttpResult>> RemoveLogoAsync(
    Guid workspaceId,
    ClaimsPrincipal user,
    BrandingService service,
    CancellationToken cancellationToken)
    => ToResult(await service.RemoveLogoAsync(user.GetUserId(), workspaceId, cancellationToken).ConfigureAwait(false), "logo", string.Empty);

  /// <summary>
  /// Serves a workspace's logo to someone in it. Its address carries the upload time, so it can be cached for good.
  /// </summary>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The branding service.</param>
  /// <param name="http">The response, for its caching headers.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>The image, or 404.</returns>
  private static async Task<Results<FileContentHttpResult, NotFound>> GetLogoAsync(
    Guid workspaceId,
    ClaimsPrincipal user,
    BrandingService service,
    HttpResponse http,
    CancellationToken cancellationToken)
  {
    var logo = await service.GetLogoAsync(user.GetUserId(), workspaceId, cancellationToken).ConfigureAwait(false);
    if (logo is null)
    {
      return TypedResults.NotFound();
    }

    http.Headers.CacheControl = "private, max-age=31536000, immutable";
    return TypedResults.File(logo.Data, logo.ContentType);
  }

  /// <summary>
  /// Reads a request body, stopping after <paramref name="limit"/> bytes so an oversized upload is refused without being read whole.
  /// </summary>
  /// <param name="body">The body.</param>
  /// <param name="limit">The most bytes to read.</param>
  /// <param name="cancellationToken">Token to cancel the read.</param>
  /// <returns>The bytes read.</returns>
  private static async Task<byte[]> ReadUpToAsync(Stream body, int limit, CancellationToken cancellationToken)
  {
    using var buffer = new MemoryStream();
    var chunk = new byte[16 * 1024];
    int read;
    while (buffer.Length < limit && (read = await body.ReadAsync(chunk.AsMemory(0, (int)Math.Min(chunk.Length, limit - buffer.Length)), cancellationToken).ConfigureAwait(false)) > 0)
    {
      await buffer.WriteAsync(chunk.AsMemory(0, read), cancellationToken).ConfigureAwait(false);
    }

    return buffer.ToArray();
  }

  /// <summary>
  /// Turns a branding outcome into a response.
  /// </summary>
  /// <param name="outcome">The outcome.</param>
  /// <param name="field">The field an invalid value belongs to.</param>
  /// <param name="message">Why a value is invalid.</param>
  /// <returns>204, a validation problem, 404, or 403.</returns>
  private static Results<NoContent, ValidationProblem, NotFound, ProblemHttpResult> ToResult(ChangeOutcome outcome, string field, string message)
    => outcome switch
    {
      ChangeOutcome.Changed => TypedResults.NoContent(),
      ChangeOutcome.Invalid => TypedResults.ValidationProblem(new Dictionary<string, string[]>(StringComparer.Ordinal) { [field] = [message] }),
      ChangeOutcome.NotFound => TypedResults.NotFound(),
      ChangeOutcome.Forbidden => TypedResults.Problem(detail: WorkspaceChangeResult.AdminsOnlyMessage, statusCode: StatusCodes.Status403Forbidden),
      ChangeOutcome.Conflict or _ => throw new UnreachableException($"Unhandled outcome {outcome}."),
    };
}
