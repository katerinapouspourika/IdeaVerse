namespace Pouspourika.IdeaVerse.Api.Components;

using System.Diagnostics;
using System.Security.Claims;
using System.Text.Json;

using Microsoft.AspNetCore.Http.HttpResults;

using Pouspourika.IdeaVerse.Api.Auth;
using Pouspourika.IdeaVerse.Api.Validation;

/// <summary>
/// Component endpoints under <c>/api/v1/ideas/{ideaId}/components</c>.
/// </summary>
internal static class ComponentEndpoints
{
  /// <summary>
  /// Maps the component endpoints. All require a signed-in user in the idea's workspace; changes also require being able to edit the idea.
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

    var workspace = endpoints.MapGroup("/api/v1/workspaces/{workspaceId:guid}").WithTags("Components").RequireAuthorization();
    workspace.MapGet("/assignments", ListAssignedAsync);

    return endpoints;
  }

  /// <summary>
  /// Lists the signed-in user's unfinished assigned components in a workspace.
  /// </summary>
  /// <param name="workspaceId">The workspace identifier.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The component service.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>The assignments, or 404 when the user is not in the workspace.</returns>
  private static async Task<Results<Ok<AssignmentResponse[]>, NotFound>> ListAssignedAsync(
    Guid workspaceId,
    ClaimsPrincipal user,
    ComponentService service,
    CancellationToken cancellationToken)
  {
    var assignments = await service.ListAssignedAsync(user.GetUserId(), workspaceId, cancellationToken).ConfigureAwait(false);
    return assignments is null ? TypedResults.NotFound() : TypedResults.Ok(assignments.ToArray());
  }

  /// <summary>
  /// Lists an idea's components in position order.
  /// </summary>
  /// <param name="ideaId">The idea identifier.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The component service.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>The components, or 404 when the idea is not visible.</returns>
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
  /// <returns>201 with the component, 404 when the idea is not visible, or 403 when the user cannot edit it.</returns>
  private static async Task<Results<Created<ComponentResponse>, NotFound, ProblemHttpResult>> CreateAsync(
    Guid ideaId,
    CreateComponentRequest request,
    ClaimsPrincipal user,
    ComponentService service,
    CancellationToken cancellationToken)
  {
    var result = await service.CreateAsync(user.GetUserId(), ideaId, request, cancellationToken).ConfigureAwait(false);
    return result.Outcome switch
    {
      ChangeOutcome.Changed => TypedResults.Created($"/api/v1/ideas/{ideaId}/components/{result.Component!.Id}", ComponentResponse.From(result.Component)),
      ChangeOutcome.NotFound => TypedResults.NotFound(),
      ChangeOutcome.Forbidden => Forbidden(),
      ChangeOutcome.Invalid or ChangeOutcome.Conflict or _ => throw new UnreachableException($"Unhandled outcome {result.Outcome}."),
    };
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
  /// <returns>The updated component, 404, 403 when the user cannot edit the idea, or 400 for an assignee outside the workspace.</returns>
  private static async Task<Results<Ok<ComponentResponse>, NotFound, ValidationProblem, ProblemHttpResult>> UpdateAsync(
    Guid ideaId,
    Guid componentId,
    UpdateComponentRequest request,
    ClaimsPrincipal user,
    ComponentService service,
    CancellationToken cancellationToken)
  {
    var result = await service.UpdateAsync(user.GetUserId(), ideaId, componentId, request, cancellationToken).ConfigureAwait(false);
    return result switch
    {
      { Outcome: ChangeOutcome.Changed, Component: { } component } => TypedResults.Ok(ComponentResponse.From(component)),
      { Outcome: ChangeOutcome.NotFound } => TypedResults.NotFound(),
      { Outcome: ChangeOutcome.Forbidden } => Forbidden(),
      { Outcome: ChangeOutcome.Invalid, Field: { } field, Message: { } message } => TypedResults.ValidationProblem(
        new Dictionary<string, string[]>(StringComparer.Ordinal) { [JsonNamingPolicy.CamelCase.ConvertName(field)] = [message] }),
      _ => throw new UnreachableException($"Unhandled outcome {result.Outcome}."),
    };
  }

  /// <summary>
  /// Deletes a component.
  /// </summary>
  /// <param name="ideaId">The idea identifier.</param>
  /// <param name="componentId">The component identifier.</param>
  /// <param name="user">The signed-in user.</param>
  /// <param name="service">The component service.</param>
  /// <param name="cancellationToken">Token to cancel the request.</param>
  /// <returns>204, 404, or 403 when the user cannot edit the idea.</returns>
  private static async Task<Results<NoContent, NotFound, ProblemHttpResult>> DeleteAsync(
    Guid ideaId,
    Guid componentId,
    ClaimsPrincipal user,
    ComponentService service,
    CancellationToken cancellationToken)
    => (await service.DeleteAsync(user.GetUserId(), ideaId, componentId, cancellationToken).ConfigureAwait(false)).Outcome switch
    {
      ChangeOutcome.Changed => TypedResults.NoContent(),
      ChangeOutcome.NotFound => TypedResults.NotFound(),
      ChangeOutcome.Forbidden => Forbidden(),
      ChangeOutcome.Invalid or ChangeOutcome.Conflict or _ => throw new UnreachableException("Deleting a component is never invalid or conflicting."),
    };

  /// <summary>
  /// Builds the 403 response for a user who can see an idea but not change its components.
  /// </summary>
  /// <returns>The problem result.</returns>
  private static ProblemHttpResult Forbidden()
    => TypedResults.Problem(detail: ComponentChangeResult.ForbiddenMessage, statusCode: StatusCodes.Status403Forbidden);
}
