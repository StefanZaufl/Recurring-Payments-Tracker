const path = require('path');
const { setupZoneTestEnv } = require(path.resolve(__dirname, '..', 'node_modules', 'jest-preset-angular', 'setup-env', 'zone'));

setupZoneTestEnv();
