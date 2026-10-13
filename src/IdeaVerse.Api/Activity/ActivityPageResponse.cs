namespace Pouspourika.IdeaVerse.Api.Activity;

/// <summary>
/// One page of an idea's history, newest first.
/// </summary>
/// <param name="Items">The entries on this page; empty past the last page.</param>
/// <param name="TotalCount">How many entries the idea's history holds in all.</param>
/// <param name="Page">The page number, from 1.</param>
/// <param name="PageSize">How many entries a page holds.</param>
public sealed record ActivityPageResponse(IReadOnlyList<ActivityResponse> Items, int TotalCount, int Page, int PageSize);
