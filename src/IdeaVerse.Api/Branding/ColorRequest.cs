namespace Pouspourika.IdeaVerse.Api.Branding;

/// <summary>
/// Request to set a workspace's colour.
/// </summary>
/// <param name="Color">One of <see cref="WorkspaceColors.All"/>, or <see langword="null"/> for the default.</param>
public sealed record ColorRequest(string? Color);
