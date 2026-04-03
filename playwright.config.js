'use strict';

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/specs',

  // 2-minute budget per test (extension interception + Aria2 round-trip can be slow)
  timeout: 120_000,

  // Mock servers bind to fixed ports — run one file at a time to avoid conflicts.
  workers: 1,
  fullyParallel: false,
  retries: 0,

  reporter: [
    ['list'],
    // Native GitHub Actions annotations when running in CI
    ...(process.env.CI ? [['github']] : []),
    // JUnit XML consumed by test-summary/action in the workflow
    ['junit', { outputFile: 'test-results/junit.xml' }],
    // HTML report for local debugging (separate dir to avoid clashing with JUnit)
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],

  projects: [
    {
      name: 'chrome',
      testMatch: '**/chrome/**/*.test.js',
      // Chrome binary is specified via executablePath in the test's beforeAll.
      // CHROME_BIN env var overrides the default path for CI environments.
    },
    {
      name: 'firefox',
      testMatch: '**/firefox/**/*.test.js',
    },
  ],
});
