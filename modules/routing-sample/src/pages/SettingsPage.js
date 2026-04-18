const React = require("react");

function SettingsPage() {
  return React.createElement(
    "main",
    { style: { maxWidth: 900, margin: "24px auto", padding: "0 16px" } },
    React.createElement("h1", null, "Routing Sample - Settings"),
    React.createElement(
      "p",
      null,
      "If you can see this page, /routing-sample/settings matched before /routing-sample.",
    ),
    React.createElement("a", { href: "/routing-sample" }, "Back to module home"),
  );
}

module.exports = SettingsPage;
