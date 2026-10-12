using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pouspourika.IdeaVerse.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddsCommentEmailSetting : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "EmailComments",
                table: "AspNetUsers",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EmailComments",
                table: "AspNetUsers");
        }
    }
}
