using System.Text.Json.Serialization;

using Microsoft.EntityFrameworkCore;

using Pouspourika.IdeaVerse.Api.Auth;
using Pouspourika.IdeaVerse.Api.Data;
using Pouspourika.IdeaVerse.Api.Ideas;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddProblemDetails();
builder.Services.AddOpenApi();
builder.Services.ConfigureHttpJsonOptions(o => o.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddSingleton(TimeProvider.System);

builder.Services.AddDbContext<IdeaVerseDbContext>(o => o.UseNpgsql(builder.Configuration.GetConnectionString("IdeaVerse")));
builder.Services.AddAuthorization();
builder.Services
  .AddIdentityApiEndpoints<User>(o => o.User.RequireUniqueEmail = true)
  .AddEntityFrameworkStores<IdeaVerseDbContext>();
builder.Services.ConfigureApplicationCookie(o =>
{
  o.Cookie.Name = "IdeaVerse.Auth";
  o.Cookie.SameSite = SameSiteMode.Strict;
});

builder.Services.AddScoped<IdeaService>();

var app = builder.Build();

app.UseExceptionHandler();
app.UseStatusCodePages();

if (app.Environment.IsDevelopment())
{
  app.MapOpenApi();
}

app.UseAuthentication();
app.UseAuthorization();

app.MapAuthEndpoints();
app.MapIdeaEndpoints();

await app.MigrateDatabaseIfEnabledAsync();
await app.RunAsync();
