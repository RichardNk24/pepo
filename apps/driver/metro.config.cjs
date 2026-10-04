require("../../packages/maps/sync-vehicle-catalog.cjs")();
const { getDefaultConfig } = require("expo/metro-config");
module.exports = getDefaultConfig(__dirname);
