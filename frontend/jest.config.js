const path = require('path');
const rootNodeModules = path.resolve(__dirname, '..', 'node_modules');

module.exports = {
  preset: 'jest-preset-angular',
  setupFilesAfterEnv: [path.resolve(__dirname, 'setup-jest.js')],
  testMatch: ['**/*.spec.ts'],
  collectCoverage: false,
  coverageReporters: ['lcov', 'text'],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/src/app/api/generated/',
  ],
  moduleDirectories: ['node_modules', path.resolve(__dirname, 'node_modules'), rootNodeModules],
  transformIgnorePatterns: [
    `node_modules/(?!.*\\.mjs$|lodash-es|ng2-charts)`,
  ],
};
