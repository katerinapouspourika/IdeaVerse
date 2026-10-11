namespace Pouspourika.IdeaVerse.Api.Auth;

/// <summary>
/// The outcome of confirming an email address.
/// </summary>
/// <param name="SignedIn">Whether confirming signed the user in, which a new account's first confirmation does.</param>
public sealed record ConfirmEmailResponse(bool SignedIn);
