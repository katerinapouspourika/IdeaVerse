using System.Text.Json.Serialization;

using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

using Pouspourika.IdeaVerse.Api;
using Pouspourika.IdeaVerse.Api.Auth;
using Pouspourika.IdeaVerse.Api.Components;
using Pouspourika.IdeaVerse.Api.Data;
using Pouspourika.IdeaVerse.Api.Email;
using Pouspourika.IdeaVerse.Api.Ideas;
using Pouspourika.IdeaVerse.Api.Members;
using Pouspourika.IdeaVerse.Api.Notifications;
using Pouspourika.IdeaVerse.Api.Web;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddProblemDetails();
builder.Services.AddOpenApi();
builder.Services.ConfigureHttpJsonOptions(o => o.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddSingleton(TimeProvider.System);

builder.Services.AddDbContext<IdeaVerseDbContext>(o => o.UseNpgsql(builder.Configuration.GetConnectionString("IdeaVerse")));
builder.Services.AddAuthorization();
builder.Services
  .AddIdentityApiEndpoints<User>(o =>
  {
    o.User.RequireUniqueEmail = true;
    o.SignIn.RequireConfirmedEmail = builder.Configuration.GetValue("Auth:RequireConfirmedEmail", defaultValue: true);
  })
  .AddEntityFrameworkStores<IdeaVerseDbContext>();
builder.Services.AddTransient<IEmailSender<User>, IdentityEmailSender>();
builder.Services.ConfigureApplicationCookie(o =>
{
  o.Cookie.Name = "IdeaVerse.Auth";
  o.Cookie.SameSite = SameSiteMode.Strict;
});

builder.Services.AddScoped<IdeaService>();
builder.Services.AddScoped<ComponentService>();
builder.Services.AddScoped<MemberService>();
builder.Services.AddScoped<NotificationService>();

builder.Services.AddEmail();
builder.Services.AddOptions<AppOptions>().BindConfiguration(AppOptions.SectionName).ValidateDataAnnotations().ValidateOnStart();
builder.Services.AddOptions<ReminderOptions>().BindConfiguration(ReminderOptions.SectionName).ValidateDataAnnotations().ValidateOnStart();
builder.Services.AddScoped<ReminderService>();
builder.Services.AddHostedService<ReminderWorker>();

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
app.MapNotificationEndpoints();
app.MapWebAppFallback();

await app.MigrateDatabaseIfEnabledAsync();
await app.RunAsync();
