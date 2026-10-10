using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pouspourika.IdeaVerse.Api.Migrations
{
    /// <summary>
    /// Adds each account's reminder preferences: whether reminders are emailed, and which kinds are turned off.
    /// </summary>
    /// <remarks>
    /// Existing accounts keep getting every reminder by email.
    /// </remarks>
    public partial class AddsReminderPreferences : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "EmailReminders",
                table: "AspNetUsers",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<int>(
                name: "MutedReminderKinds",
                table: "AspNetUsers",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EmailReminders",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "MutedReminderKinds",
                table: "AspNetUsers");
        }
    }
}
