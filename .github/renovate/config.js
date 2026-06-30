module.exports = {
  platform: "github",
  platformCommit: "enabled",
  repositories: ["pj-hoakari/tolo-web"],
  hostRules: [
    {
      hostType: "npm",
      matchHost: "npm.pkg.github.com",
      token: process.env.RENOVATE_PACKAGES_TOKEN,
    },
  ],
};
