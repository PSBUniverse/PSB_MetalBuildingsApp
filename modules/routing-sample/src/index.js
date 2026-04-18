const HomePage = require("./pages/HomePage");
const SettingsPage = require("./pages/SettingsPage");
const AdvancedSettingsPage = require("./pages/AdvancedSettingsPage");

const appId = String(process.env.ROUTING_SAMPLE_APP_ID || "1001").trim() || "1001";

module.exports = {
  key: "routing-sample",
  app_id: appId,
  name: "Routing Sample",
  description: "Minimal module used to validate core dynamic routing.",
  icon: "bi-signpost-split",
  group_name: "Core Validation",
  group_desc: "Use this module to test the core catch-all router.",
  order: 1,
  routes: [
    { path: "/routing-sample/settings/advanced", component: AdvancedSettingsPage },
    { path: "/routing-sample/settings", component: SettingsPage },
    { path: "/routing-sample", component: HomePage },
  ],
};
