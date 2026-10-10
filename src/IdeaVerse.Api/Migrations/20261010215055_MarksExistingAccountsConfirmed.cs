using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pouspourika.IdeaVerse.Api.Migrations
{
    /// <summary>
    /// Marks accounts created before email confirmation was required as confirmed, so they can still sign in.
    /// </summary>
    /// <remarks>
    /// Which accounts this confirmed is not recorded, so <see cref="Down"/> leaves them confirmed.
    /// </remarks>
    public partial class MarksExistingAccountsConfirmed : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("UPDATE \"AspNetUsers\" SET \"EmailConfirmed\" = TRUE WHERE \"EmailConfirmed\" = FALSE;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}
