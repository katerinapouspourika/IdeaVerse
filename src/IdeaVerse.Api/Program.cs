using System.Text.Json.Serialization;

using Anthropic;

using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

using Pouspourika.IdeaVerse.Agents;
using Pouspourika.IdeaVerse.Api;
using Pouspourika.IdeaVerse.Api.Accounts;
using Pouspourika.IdeaVerse.Api.Ai;
using Pouspourika.IdeaVerse.Api.Auth;
using Pouspourika.IdeaVerse.Api.Comments;
using Pouspourika.IdeaVerse.Api.Components;
using Pouspourika.IdeaVerse.Api.Data;
using Pouspourika.IdeaVerse.Api.Email;
using Pouspourika.IdeaVerse.Api.Ideas;
using Pouspourika.IdeaVerse.Api.Invitations;
using Pouspourika.IdeaVerse.Api.Members;
using Pouspourika.IdeaVerse.Api.Notifications;
using Pouspourika.IdeaVerse.Api.Web;
using Pouspourika.IdeaVerse.Api.Workspaces;

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

builder.Services.AddScoped<UserCalendar>();
builder.Services.AddScoped<AccountService>();
builder.Services.AddScoped<WorkspaceService>();
builder.Services.AddScoped<InvitationService>();
builder.Services.AddScoped<IdeaService>();
builder.Services.AddScoped<ComponentService>();
builder.Services.AddScoped<MemberService>();
builder.Services.AddScoped<CommentService>();
builder.Services.AddScoped<NotificationService>();

builder.Services.AddEmail();
builder.Services.AddOptions<AppOptions>().BindConfiguration(AppOptions.SectionName).ValidateDataAnnotations().ValidateOnStart();
builder.Services.AddOptions<ReminderOptions>().BindConfiguration(ReminderOptions.SectionName).ValidateDataAnnotations().ValidateOnStart();
builder.Services.AddScoped<ReminderService>();
builder.Services.AddSingleton<IAnthropicClient>(_ => AiOptions.CreateClient(builder.Configuration));
builder.Services.AddIdeationAgents().BindConfiguration(IdeationOptions.SectionName);
builder.Services.AddOptions<AiOptions>().BindConfiguration(AiOptions.SectionName).ValidateDataAnnotations().ValidateOnStart();
builder.Services.AddScoped<AiService>();
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
app.MapAccountEndpoints();
app.MapWorkspaceEndpoints();
app.MapInvitationEndpoints();
app.MapIdeaEndpoints();
app.MapComponentEndpoints();
app.MapMemberEndpoints();
app.MapCommentEndpoints();
app.MapNotificationEndpoints();
app.MapAiEndpoints();
app.MapWebAppFallback();

await app.MigrateDatabaseIfEnabledAsync();
await app.RunAsync();
