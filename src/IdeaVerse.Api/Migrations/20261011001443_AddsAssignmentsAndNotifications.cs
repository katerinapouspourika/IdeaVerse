using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pouspourika.IdeaVerse.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddsAssignmentsAndNotifications : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Notifications_IdeaId_UserId_Kind_TargetDate",
                table: "Notifications");

            migrationBuilder.AddColumn<string>(
                name: "ActorId",
                table: "Notifications",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ComponentId",
                table: "Notifications",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Detail",
                table: "Notifications",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AssigneeId",
                table: "Components",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "DueDate",
                table: "Components",
                type: "date",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_ActorId",
                table: "Notifications",
                column: "ActorId");

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_ComponentId_UserId_Kind_TargetDate",
                table: "Notifications",
                columns: new[] { "ComponentId", "UserId", "Kind", "TargetDate" },
                unique: true,
                filter: "\"ComponentId\" IS NOT NULL AND \"Kind\" IN ('ComingUp', 'Tomorrow', 'Today', 'Overdue')");

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_IdeaId_UserId_Kind_TargetDate",
                table: "Notifications",
                columns: new[] { "IdeaId", "UserId", "Kind", "TargetDate" },
                unique: true,
                filter: "\"ComponentId\" IS NULL AND \"Kind\" IN ('ComingUp', 'Tomorrow', 'Today', 'Overdue')");

            migrationBuilder.CreateIndex(
                name: "IX_Components_AssigneeId_DueDate",
                table: "Components",
                columns: new[] { "AssigneeId", "DueDate" });

            migrationBuilder.AddForeignKey(
                name: "FK_Components_AspNetUsers_AssigneeId",
                table: "Components",
                column: "AssigneeId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Notifications_AspNetUsers_ActorId",
                table: "Notifications",
                column: "ActorId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Notifications_Components_ComponentId",
                table: "Notifications",
                column: "ComponentId",
                principalTable: "Components",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Components_AspNetUsers_AssigneeId",
                table: "Components");

            migrationBuilder.DropForeignKey(
                name: "FK_Notifications_AspNetUsers_ActorId",
                table: "Notifications");

            migrationBuilder.DropForeignKey(
                name: "FK_Notifications_Components_ComponentId",
                table: "Notifications");

            migrationBuilder.DropIndex(
                name: "IX_Notifications_ActorId",
                table: "Notifications");

            migrationBuilder.DropIndex(
                name: "IX_Notifications_ComponentId_UserId_Kind_TargetDate",
                table: "Notifications");

            migrationBuilder.DropIndex(
                name: "IX_Notifications_IdeaId_UserId_Kind_TargetDate",
                table: "Notifications");

            migrationBuilder.DropIndex(
                name: "IX_Components_AssigneeId_DueDate",
                table: "Components");

            migrationBuilder.DropColumn(
                name: "ActorId",
                table: "Notifications");

            migrationBuilder.DropColumn(
                name: "ComponentId",
                table: "Notifications");

            migrationBuilder.DropColumn(
                name: "Detail",
                table: "Notifications");

            migrationBuilder.DropColumn(
                name: "AssigneeId",
                table: "Components");

            migrationBuilder.DropColumn(
                name: "DueDate",
                table: "Components");

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_IdeaId_UserId_Kind_TargetDate",
                table: "Notifications",
                columns: new[] { "IdeaId", "UserId", "Kind", "TargetDate" },
                unique: true);
        }
    }
}
