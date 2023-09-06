'use strict';

module.exports = {
  require: ['ts-node/register'],
  spec: ['test/**/*.spec.ts'],
  'watch-files': ['src/**/*.ts', 'test/**/*.ts'],
  timeout: '30000',
  parallel: true,
};
