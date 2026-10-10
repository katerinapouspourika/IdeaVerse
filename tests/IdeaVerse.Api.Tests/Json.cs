namespace Pouspourika.IdeaVerse.Api.Tests;

using System.Text.Json;
using System.Text.Json.Serialization;

using Pouspourika.IdeaVerse.Api.Components;
using Pouspourika.IdeaVerse.Api.Ideas;
using Pouspourika.IdeaVerse.Api.Members;
using Pouspourika.IdeaVerse.Api.Workspaces;

internal static class Json
{
  public static JsonSerializerOptions Options { get; } = new(JsonSerializerDefaults.Web)
  {
    Converters = { new JsonStringEnumConverter() },
  };

  public static async Task<IdeaResponse> ReadIdeaAsync(this HttpResponseMessage response)
    => (await response.Content.ReadFromJsonAsync<IdeaResponse>(Options))!;

  public static async Task<IdeaResponse[]> ReadIdeasAsync(this HttpResponseMessage response)
    => (await response.Content.ReadFromJsonAsync<IdeaResponse[]>(Options))!;

  public static async Task<ComponentResponse> ReadComponentAsync(this HttpResponseMessage response)
    => (await response.Content.ReadFromJsonAsync<ComponentResponse>(Options))!;

  public static async Task<ComponentResponse[]> ReadComponentsAsync(this HttpResponseMessage response)
    => (await response.Content.ReadFromJsonAsync<ComponentResponse[]>(Options))!;

  public static async Task<MemberResponse> ReadMemberAsync(this HttpResponseMessage response)
    => (await response.Content.ReadFromJsonAsync<MemberResponse>(Options))!;

  public static async Task<MemberResponse[]> ReadMembersAsync(this HttpResponseMessage response)
    => (await response.Content.ReadFromJsonAsync<MemberResponse[]>(Options))!;

  public static async Task<Dictionary<string, string[]>> ReadValidationErrorsAsync(this HttpResponseMessage response)
  {
    using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
    return document.RootElement.GetProperty("errors").Deserialize<Dictionary<string, string[]>>(Options)!;
  }

  // The workspace the client's user owns: the one CreateSignedInClientAsync made for them.
  public static async Task<WorkspaceResponse> WorkspaceAsync(this HttpClient client)
    => (await client.GetFromJsonAsync<WorkspaceResponse[]>("/api/v1/workspaces", Options))!.First(w => w.Role == WorkspaceRole.Owner);

  public static async Task<Guid> WorkspaceIdAsync(this HttpClient client) => (await client.WorkspaceAsync()).Id;

  public static async Task<HttpResponseMessage> CreateIdeaAsync(this HttpClient client, string title, DateOnly targetDate, string? description = null)
    => await client.PostAsJsonAsync($"/api/v1/workspaces/{await client.WorkspaceIdAsync()}/ideas", new CreateIdeaRequest(title, description, targetDate), Options);

  public static Task<HttpResponseMessage> ListIdeasAsync(this HttpClient client, Guid workspaceId, string query = "")
    => client.GetAsync($"/api/v1/workspaces/{workspaceId}/ideas{query}");

  public static Task<HttpResponseMessage> CreateComponentAsync(this HttpClient client, Guid ideaId, string title, string? notes = null)
    => client.PostAsJsonAsync($"/api/v1/ideas/{ideaId}/components", new CreateComponentRequest(title, notes), Options);

  public static Task<HttpResponseMessage> UpdateComponentAsync(this HttpClient client, Guid ideaId, Guid componentId, UpdateComponentRequest request)
    => client.PutAsJsonAsync($"/api/v1/ideas/{ideaId}/components/{componentId}", request, Options);

  public static Task<HttpResponseMessage> AddMemberAsync(this HttpClient client, Guid ideaId, string email)
    => client.PostAsJsonAsync($"/api/v1/ideas/{ideaId}/members", new AddMemberRequest(email), Options);
}
