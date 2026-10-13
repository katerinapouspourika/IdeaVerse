using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pouspourika.IdeaVerse.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddsIdeaStartDates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "DueAt",
                table: "Notifications",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "EmailFailedAt",
                table: "Notifications",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "StartsAt",
                table: "Notifications",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "StartDate",
                table: "Ideas",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "StartSetAt",
                table: "Ideas",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<TimeOnly>(
                name: "StartTime",
                table: "Ideas",
                type: "time without time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "StartsAt",
                table: "Ideas",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_IdeaId_UserId_Kind_DueAt",
                table: "Notifications",
                columns: new[] { "IdeaId", "UserId", "Kind", "DueAt" },
                unique: true,
                filter: "\"Kind\" IN ('StartingSoon', 'AddComponents')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Notifications_IdeaId_UserId_Kind_DueAt",
                table: "Notifications");

            migrationBuilder.DropColumn(
                name: "DueAt",
                table: "Notifications");

            migrationBuilder.DropColumn(
                name: "EmailFailedAt",
                table: "Notifications");

            migrationBuilder.DropColumn(
                name: "StartsAt",
                table: "Notifications");

            migrationBuilder.DropColumn(
                name: "StartDate",
                table: "Ideas");

            migrationBuilder.DropColumn(
                name: "StartSetAt",
                table: "Ideas");

            migrationBuilder.DropColumn(
                name: "StartTime",
                table: "Ideas");

            migrationBuilder.DropColumn(
                name: "StartsAt",
                table: "Ideas");
        }
    }
}
