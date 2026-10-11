namespace Pouspourika.IdeaVerse.Api.Components;

using System.ComponentModel.DataAnnotations;

/// <summary>
/// Request to put an idea's components in a new order.
/// </summary>
/// <param name="ComponentIds">Every component of the idea, once each, in the new order.</param>
public sealed record ReorderComponentsRequest([property: Required] IReadOnlyList<Guid> ComponentIds);
