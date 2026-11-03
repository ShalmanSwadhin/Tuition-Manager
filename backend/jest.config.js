/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  // .spec.ts files are Jest (HTTP/route-level, with mocked models).
  // .test.ts files are plain node:test (pure-function unit tests) and are
  // run separately via `npm test`, not through Jest.
  testMatch: ["**/*.spec.ts"],
};
