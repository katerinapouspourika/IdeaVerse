using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pouspourika.IdeaVerse.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddsWorkspaceInviteLinks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "InviteToken",
                table: "Workspaces",
                type: "character varying(22)",
                maxLength: 22,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Workspaces_InviteToken",
                table: "Workspaces",
                column: "InviteToken",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Workspaces_InviteToken",
                table: "Workspaces");

            migrationBuilder.DropColumn(
                name: "InviteToken",
                table: "Workspaces");
        }
    }
}
