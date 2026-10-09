namespace Pouspourika.IdeaVerse.Api.Components;

using System.Security.Claims;

using Microsoft.AspNetCore.Http.HttpResults;

using Pouspourika.IdeaVerse.Api.Auth;
using Pouspourika.IdeaVerse.Api.Validation;

/// <summary>
/// Component endpoints under <c>/api/v1/ideas/{ideaId}/components</c>.
/// </summary>
internal static class ComponentEndpoints
{
  /// <summary>
  /// Maps the component endpoints. All require a signed-in user who can access the idea.
  /// </summary>
  /// <param name="endpoints">The route builder.</param>
  /// <returns>The same route builder.</returns>
  public static IEndpointRouteBuilder MapComponentEndpoints(this IEndpointRouteBuilder endpoints)
  {
    var group = endpoints.MapGroup("/api/v1/ideas/{ideaId:guid}/components").WithTags("Components").RequireAuthorization();

    group.MapGet("/", ListAsync);
    group.MapPost("/", CreateAsync).WithValidation<CreateComponentRequest>();
    group.MapPut("/{componentId:guid}", UpdateAsync).WithValidation<UpdateComponentRequest>();
    group.MapDelete("/{componentId:guid}", DeleteAsync);

    return endpoints;
  }

  /// <summary>
  /// Lists an idea's components in position order.
  /// </summary>
  /// <param name="ideaId">The idea identifier.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The component service.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>The components, or 404 when the idea is not accessible.</returns>
  private static async Task<Results<Ok<ComponentResponse[]>, NotFound>> ListAsync(
    Guid ideaId,
    ClaimsPrincipal user,
    ComponentService service,
    CancellationToken cancellationToken)
  {
    var components = await service.ListAsync(user.GetUserId(), ideaId, cancellationToken).ConfigureAwait(false);
    return components is null
      ? TypedResults.NotFound()
      : TypedResults.Ok(components.Select(ComponentResponse.From).ToArray());
  }

  /// <summary>
  /// Adds a component to the end of an idea's list.
  /// </summary>
  /// <param name="ideaId">The idea identifier.</param>
  /// <param name="request">The validated request.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The component service.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>201 with the component, or 404 when the idea is not accessible.</returns>
  private static async Task<Results<Created<ComponentResponse>, NotFound>> CreateAsync(
    Guid ideaId,
    CreateComponentRequest request,
    ClaimsPrincipal user,
    ComponentService service,
    CancellationToken cancellationToken)
  {
    var component = await service.CreateAsync(user.GetUserId(), ideaId, request, cancellationToken).ConfigureAwait(false);
    return component is null
      ? TypedResults.NotFound()
      : TypedResults.Created($"/api/v1/ideas/{ideaId}/components/{component.Id}", ComponentResponse.From(component));
  }

  /// <summary>
  /// Replaces a component's editable fields.
  /// </summary>
  /// <param name="ideaId">The idea identifier.</param>
  /// <param name="componentId">The component identifier.</param>
  /// <param name="request">The validated request.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The component service.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>The updated component, or 404.</returns>
  private static async Task<Results<Ok<ComponentResponse>, NotFound>> UpdateAsync(
    Guid ideaId,
    Guid componentId,
    UpdateComponentRequest request,
    ClaimsPrincipal user,
    ComponentService service,
    CancellationToken cancellationToken)
  {
    var component = await service.UpdateAsync(user.GetUserId(), ideaId, componentId, request, cancellationToken).ConfigureAwait(false);
    return component is null ? TypedResults.NotFound() : TypedResults.Ok(ComponentResponse.From(component));
  }

  /// <summary>
  /// Deletes a component.
  /// </summary>
  /// <param name="ideaId">The idea identifier.</param>
  /// <param name="componentId">The component identifier.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The component service.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>204, or 404.</returns>
  private static async Task<Results<NoContent, NotFound>> DeleteAsync(
    Guid ideaId,
    Guid componentId,
    ClaimsPrincipal user,
    ComponentService service,
    CancellationToken cancellationToken)
    => await service.DeleteAsync(user.GetUserId(), ideaId, componentId, cancellationToken).ConfigureAwait(false)
      ? TypedResults.NoContent()
      : TypedResults.NotFound();
}
