using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pouspourika.IdeaVerse.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddsWorkspaceBranding : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Color",
                table: "Workspaces",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "LogoUpdatedAt",
                table: "Workspaces",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "WorkspaceLogos",
                columns: table => new
                {
                    WorkspaceId = table.Column<Guid>(type: "uuid", nullable: false),
                    ContentType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Data = table.Column<byte[]>(type: "bytea", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkspaceLogos", x => x.WorkspaceId);
                    table.ForeignKey(
                        name: "FK_WorkspaceLogos_Workspaces_WorkspaceId",
                        column: x => x.WorkspaceId,
                        principalTable: "Workspaces",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "WorkspaceLogos");

            migrationBuilder.DropColumn(
                name: "Color",
                table: "Workspaces");

            migrationBuilder.DropColumn(
                name: "LogoUpdatedAt",
                table: "Workspaces");
        }
    }
}
