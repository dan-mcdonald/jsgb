/* eslint-env node */
require("./polyfetch");
global.window = {};
require("./index");
global.window.onload();
