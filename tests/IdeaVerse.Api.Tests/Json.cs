namespace Pouspourika.IdeaVerse.Api.Tests;

using System.Text.Json;
using System.Text.Json.Serialization;

using Pouspourika.IdeaVerse.Api.Components;
using Pouspourika.IdeaVerse.Api.Ideas;

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

  public static async Task<Dictionary<string, string[]>> ReadValidationErrorsAsync(this HttpResponseMessage response)
  {
    using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
    return document.RootElement.GetProperty("errors").Deserialize<Dictionary<string, string[]>>(Options)!;
  }

  public static Task<HttpResponseMessage> CreateIdeaAsync(this HttpClient client, string title, DateOnly targetDate, string? description = null)
    => client.PostAsJsonAsync("/api/v1/ideas", new CreateIdeaRequest(title, description, targetDate), Options);

  public static Task<HttpResponseMessage> CreateComponentAsync(this HttpClient client, Guid ideaId, string title, string? notes = null)
    => client.PostAsJsonAsync($"/api/v1/ideas/{ideaId}/components", new CreateComponentRequest(title, notes), Options);

  public static Task<HttpResponseMessage> UpdateComponentAsync(this HttpClient client, Guid ideaId, Guid componentId, UpdateComponentRequest request)
    => client.PutAsJsonAsync($"/api/v1/ideas/{ideaId}/components/{componentId}", request, Options);
}
