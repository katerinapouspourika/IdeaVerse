using System.Text.Json.Serialization;

using Microsoft.EntityFrameworkCore;

using Pouspourika.IdeaVerse.Api.Auth;
using Pouspourika.IdeaVerse.Api.Components;
using Pouspourika.IdeaVerse.Api.Data;
using Pouspourika.IdeaVerse.Api.Ideas;
using Pouspourika.IdeaVerse.Api.Members;
using Pouspourika.IdeaVerse.Api.Web;

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
builder.Services.AddScoped<ComponentService>();
builder.Services.AddScoped<MemberService>();

var app = builder.Build();

app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseWebAppFiles();

if (app.Environment.IsDevelopment())
{
  app.MapOpenApi();
}

app.UseAuthentication();
app.UseAuthorization();

app.MapAuthEndpoints();
app.MapIdeaEndpoints();
app.MapComponentEndpoints();
app.MapMemberEndpoints();
app.MapWebAppFallback();

await app.MigrateDatabaseIfEnabledAsync();
await app.RunAsync();
