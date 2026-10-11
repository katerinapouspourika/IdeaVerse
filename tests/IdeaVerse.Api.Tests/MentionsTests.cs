namespace Pouspourika.IdeaVerse.Api.Tests;

using Pouspourika.IdeaVerse.Api.Comments;

using TUnit.Assertions.Enums;

public class MentionsTests
{
  [Test]
  [Arguments("Hi @[Mia](u-1) and @[Mia again](u-1) and @[Leo](u-2)", new[] { "u-1", "u-2" })]
  [Arguments("Email me @ home, or [link](u-1)", new string[0])]
  [Arguments("@[](u-1) @[Name]() @[Na]me](u-1)", new string[0])]
  public async Task UserIds_Body_ReadsEachMentionedAccountOnce(string body, string[] expected)
    => await Assert.That(Mentions.UserIds(body)).IsEquivalentTo(expected, CollectionOrdering.Matching);

  [Test]
  public async Task ToPlainText_Mentions_WritesThemAsAtName()
    => await Assert.That(Mentions.ToPlainText("Ask @[Mia Chen](u-1) or @[Leo](u-2)!")).IsEqualTo("Ask @Mia Chen or @Leo!");

  [Test]
  public async Task Canonicalize_KnownAndUnknownAccounts_RenamesKnownAndUnwrapsUnknown()
  {
    var labels = new Dictionary<string, string>(StringComparer.Ordinal) { ["u-1"] = "Mia Chen" };

    var body = Mentions.Canonicalize("@[Boss](u-1) and @[Ghost](u-9)", labels);

    await Assert.That(body).IsEqualTo("@[Mia Chen](u-1) and @Ghost");
  }

  [Test]
  public async Task Labels_SharedOrMissingNames_UsesEmailToTellPeopleApart()
  {
    var labels = Mentions.Labels([("u-1", "Alex", "alex@a.com"), ("u-2", "alex", "alex@b.com"), ("u-3", null, "kim@c.com"), ("u-4", "Jo [ops]", "jo@d.com")]);

    await Assert.That(labels["u-1"]).IsEqualTo("Alex (alex@a.com)");
    await Assert.That(labels["u-2"]).IsEqualTo("alex (alex@b.com)");
    await Assert.That(labels["u-3"]).IsEqualTo("kim@c.com");
    await Assert.That(labels["u-4"]).IsEqualTo("Jo ops");
  }
}
