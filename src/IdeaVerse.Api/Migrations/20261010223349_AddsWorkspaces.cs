using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pouspourika.IdeaVerse.Api.Migrations
{
    /// <summary>
    /// Adds workspaces, their members and invitations, and moves every idea into a workspace.
    /// </summary>
    /// <remarks>
    /// Each existing account gets a workspace of its own, which it owns, with the same identifier as the account (Identity account
    /// identifiers are GUIDs). Its ideas move there, and the people on their teams join that workspace as members, so everyone keeps
    /// seeing the ideas they saw before.
    /// </remarks>
    public partial class AddsWorkspaces : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "WorkspaceId",
                table: "Ideas",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.CreateTable(
                name: "Workspaces",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Workspaces", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Invitations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    WorkspaceId = table.Column<Guid>(type: "uuid", nullable: false),
                    Email = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    NormalizedEmail = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    Role = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    InvitedById = table.Column<string>(type: "text", nullable: false),
                    SentAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Invitations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Invitations_AspNetUsers_InvitedById",
                        column: x => x.InvitedById,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Invitations_Workspaces_WorkspaceId",
                        column: x => x.WorkspaceId,
                        principalTable: "Workspaces",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "WorkspaceMembers",
                columns: table => new
                {
                    WorkspaceId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<string>(type: "text", nullable: false),
                    Role = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    JoinedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkspaceMembers", x => new { x.WorkspaceId, x.UserId });
                    table.ForeignKey(
                        name: "FK_WorkspaceMembers_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_WorkspaceMembers_Workspaces_WorkspaceId",
                        column: x => x.WorkspaceId,
                        principalTable: "Workspaces",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.Sql(
                """
                INSERT INTO "Workspaces" ("Id", "Name", "CreatedAt")
                SELECT u."Id"::uuid, left(coalesce(split_part(u."Email", '@', 1) || '''s workspace', 'My workspace'), 100), now()
                FROM "AspNetUsers" u;

                INSERT INTO "WorkspaceMembers" ("WorkspaceId", "UserId", "Role", "JoinedAt")
                SELECT u."Id"::uuid, u."Id", 'Owner', now()
                FROM "AspNetUsers" u;

                UPDATE "Ideas" SET "WorkspaceId" = "OwnerId"::uuid;

                INSERT INTO "WorkspaceMembers" ("WorkspaceId", "UserId", "Role", "JoinedAt")
                SELECT DISTINCT i."WorkspaceId", m."UserId", 'Member', now()
                FROM "IdeaMembers" m
                JOIN "Ideas" i ON i."Id" = m."IdeaId"
                WHERE m."UserId" <> i."OwnerId";
                """);

            migrationBuilder.CreateIndex(
                name: "IX_Ideas_WorkspaceId_TargetDate",
                table: "Ideas",
                columns: new[] { "WorkspaceId", "TargetDate" });

            migrationBuilder.CreateIndex(
                name: "IX_Invitations_InvitedById",
                table: "Invitations",
                column: "InvitedById");

            migrationBuilder.CreateIndex(
                name: "IX_Invitations_NormalizedEmail",
                table: "Invitations",
                column: "NormalizedEmail");

            migrationBuilder.CreateIndex(
                name: "IX_Invitations_WorkspaceId_NormalizedEmail",
                table: "Invitations",
                columns: new[] { "WorkspaceId", "NormalizedEmail" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_WorkspaceMembers_UserId",
                table: "WorkspaceMembers",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_Ideas_Workspaces_WorkspaceId",
                table: "Ideas",
                column: "WorkspaceId",
                principalTable: "Workspaces",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Ideas_Workspaces_WorkspaceId",
                table: "Ideas");

            migrationBuilder.DropTable(
                name: "Invitations");

            migrationBuilder.DropTable(
                name: "WorkspaceMembers");

            migrationBuilder.DropTable(
                name: "Workspaces");

            migrationBuilder.DropIndex(
                name: "IX_Ideas_WorkspaceId_TargetDate",
                table: "Ideas");

            migrationBuilder.DropColumn(
                name: "WorkspaceId",
                table: "Ideas");
        }
    }
}
