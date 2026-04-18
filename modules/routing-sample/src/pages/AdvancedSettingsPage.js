const React = require("react");

function AdvancedSettingsPage() {
  return React.createElement(
    "main",
    { style: { maxWidth: 900, margin: "24px auto", padding: "0 16px" } },
    React.createElement("h1", null, "Routing Sample - Advanced Settings"),
    React.createElement(
      "p",
      null,
      "This deepest route verifies long-path priority in the module route sorter.",
    ),
    React.createElement("a", { href: "/routing-sample/settings" }, "Back to settings"),
  );
}

module.exports = AdvancedSettingsPage;
