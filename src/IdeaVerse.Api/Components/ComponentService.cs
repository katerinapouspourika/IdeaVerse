namespace Pouspourika.IdeaVerse.Api.Components;

using Microsoft.EntityFrameworkCore;

using Pouspourika.IdeaVerse.Api.Data;
using Pouspourika.IdeaVerse.Api.Ideas;

/// <summary>
/// Manages the components of ideas the user can access.
/// </summary>
/// <remarks>
/// A component is reachable only through an idea from <see cref="IdeaAccess.AccessibleIdeas"/>, so an inaccessible idea and its components behave as missing.
/// </remarks>
/// <param name="context">The database context.</param>
/// <param name="timeProvider">Clock used for timestamps.</param>
public sealed class ComponentService(IdeaVerseDbContext context, TimeProvider timeProvider)
{
  /// <summary>
  /// Lists an idea's components in position order.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="ideaId">The idea identifier.</param>
  /// <param name="cancellationToken">Token to cancel the query.</param>
  /// <returns>The components, or <see langword="null"/> when the user cannot access the idea.</returns>
  public async Task<IReadOnlyList<Component>?> ListAsync(string userId, Guid ideaId, CancellationToken cancellationToken)
  {
    if (!await CanAccessAsync(userId, ideaId, cancellationToken).ConfigureAwait(false))
    {
      return null;
    }

    return await context.Components
      .AsNoTracking()
      .Where(c => c.IdeaId == ideaId)
      .OrderBy(c => c.Position)
      .ToListAsync(cancellationToken)
      .ConfigureAwait(false);
  }

  /// <summary>
  /// Adds a component to the end of an idea's list.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="ideaId">The idea identifier.</param>
  /// <param name="request">The validated request.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>The created component, or <see langword="null"/> when the user cannot access the idea.</returns>
  public async Task<Component?> CreateAsync(string userId, Guid ideaId, CreateComponentRequest request, CancellationToken cancellationToken)
  {
    ArgumentNullException.ThrowIfNull(request);

    if (!await CanAccessAsync(userId, ideaId, cancellationToken).ConfigureAwait(false))
    {
      return null;
    }

    var lastPosition = await context.Components
      .Where(c => c.IdeaId == ideaId)
      .MaxAsync(c => (int?)c.Position, cancellationToken)
      .ConfigureAwait(false);

    var component = new Component
    {
      IdeaId = ideaId,
      Title = request.Title.Trim(),
      Notes = Normalize(request.Notes),
      Position = (lastPosition ?? -1) + 1,
      CreatedAt = timeProvider.GetUtcNow(),
    };

    context.Components.Add(component);
    await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    return component;
  }

  /// <summary>
  /// Replaces a component's editable fields, stamping or clearing its completion time when <see cref="Component.IsDone"/> changes.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="ideaId">The idea identifier.</param>
  /// <param name="componentId">The component identifier.</param>
  /// <param name="request">The validated request.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns>The updated component, or <see langword="null"/> when it does not exist under an idea the user can access.</returns>
  public async Task<Component?> UpdateAsync(string userId, Guid ideaId, Guid componentId, UpdateComponentRequest request, CancellationToken cancellationToken)
  {
    ArgumentNullException.ThrowIfNull(request);

    var component = await Accessible(userId, ideaId)
      .FirstOrDefaultAsync(c => c.Id == componentId, cancellationToken)
      .ConfigureAwait(false);
    if (component is null)
    {
      return null;
    }

    if (request.IsDone != component.IsDone)
    {
      component.CompletedAt = request.IsDone ? timeProvider.GetUtcNow() : null;
    }

    component.Title = request.Title.Trim();
    component.Notes = Normalize(request.Notes);
    component.IsDone = request.IsDone;
    await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    return component;
  }

  /// <summary>
  /// Deletes a component.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="ideaId">The idea identifier.</param>
  /// <param name="componentId">The component identifier.</param>
  /// <param name="cancellationToken">Token to cancel the operation.</param>
  /// <returns><see langword="true"/> when the component existed under an idea the user can access and was deleted.</returns>
  public async Task<bool> DeleteAsync(string userId, Guid ideaId, Guid componentId, CancellationToken cancellationToken)
  {
    var deleted = await Accessible(userId, ideaId)
      .Where(c => c.Id == componentId)
      .ExecuteDeleteAsync(cancellationToken)
      .ConfigureAwait(false);
    return deleted > 0;
  }

  /// <summary>
  /// Trims notes, treating blank text as no notes.
  /// </summary>
  /// <param name="notes">The submitted notes.</param>
  /// <returns>The trimmed notes, or <see langword="null"/>.</returns>
  private static string? Normalize(string? notes)
    => string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();

  /// <summary>
  /// Returns whether the user can access the idea.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="ideaId">The idea identifier.</param>
  /// <param name="cancellationToken">Token to cancel the query.</param>
  /// <returns><see langword="true"/> when the idea exists and is accessible.</returns>
  private Task<bool> CanAccessAsync(string userId, Guid ideaId, CancellationToken cancellationToken)
    => context.AccessibleIdeas(userId).AnyAsync(i => i.Id == ideaId, cancellationToken);

  /// <summary>
  /// Queries the components of <paramref name="ideaId"/>, provided the user can access that idea.
  /// </summary>
  /// <param name="userId">The signed-in user's identifier.</param>
  /// <param name="ideaId">The idea identifier.</param>
  /// <returns>The accessible components of the idea.</returns>
  private IQueryable<Component> Accessible(string userId, Guid ideaId)
    => context.AccessibleIdeas(userId)
      .Where(i => i.Id == ideaId)
      .SelectMany(i => i.Components);
}
