namespace Pouspourika.IdeaVerse.Api.Ideas;

using Microsoft.EntityFrameworkCore;

using Pouspourika.IdeaVerse.Api.Auth;
using Pouspourika.IdeaVerse.Api.Data;

/// <summary>
/// Refuses a change to an archived idea with 409 before the endpoint runs, so an archived idea stays read-only until it is restored.
/// </summary>
/// <remarks>
/// The idea comes from the <c>ideaId</c> or <c>id</c> route value. The filter answers only for an archived idea the user could otherwise
/// change, found through <see cref="IdeaAccess.EditableIdeas"/>; anything else goes on to the endpoint, which reports a missing or forbidden idea as usual.
/// </remarks>
internal sealed class ArchivedIdeaFilter : IEndpointFilter
{
  /// <summary>
  /// Why a change to an archived idea was refused.
  /// </summary>
  public const string ArchivedMessage = "This idea is archived. Restore it to make changes.";

  /// <inheritdoc/>
  public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
  {
    ArgumentNullException.ThrowIfNull(context);
    ArgumentNullException.ThrowIfNull(next);

    var http = context.HttpContext;
    var routeValues = http.Request.RouteValues;
    if ((routeValues.TryGetValue("ideaId", out var raw) || routeValues.TryGetValue("id", out raw))
      && Guid.TryParse(raw?.ToString(), out var ideaId))
    {
      var database = http.RequestServices.GetRequiredService<IdeaVerseDbContext>();
      var userId = http.User.GetUserId();
      if (await database.EditableIdeas(userId).AnyAsync(i => i.Id == ideaId && i.ArchivedAt != null, http.RequestAborted).ConfigureAwait(false))
      {
        return TypedResults.Problem(detail: ArchivedMessage, statusCode: StatusCodes.Status409Conflict);
      }
    }

    return await next(context).ConfigureAwait(false);
  }
}
