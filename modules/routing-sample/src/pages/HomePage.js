const React = require("react");

function listItem(href, label) {
  return React.createElement(
    "li",
    { key: href },
    React.createElement("a", { href }, label),
  );
}

function HomePage() {
  return React.createElement(
    "main",
    { style: { maxWidth: 900, margin: "24px auto", padding: "0 16px" } },
    React.createElement("h1", null, "Routing Sample Module"),
    React.createElement(
      "p",
      null,
      "Use these links to verify core catch-all routing and prefix matching.",
    ),
    React.createElement(
      "ul",
      null,
      [
        listItem("/routing-sample", "Home route"),
        listItem("/routing-sample/settings", "Settings route"),
        listItem("/routing-sample/settings/advanced", "Advanced settings route"),
        listItem("/routing-sample/unknown", "Unknown route (should 404)"),
      ],
    ),
  );
}

module.exports = HomePage;
