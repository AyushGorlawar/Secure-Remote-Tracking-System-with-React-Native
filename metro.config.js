const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Allow Metro to resolve modules from the src/ directory
config.watchFolders = [path.resolve(__dirname, 'src')];

// Add src/ to the resolver's node module paths
config.resolver.nodeModulesPaths = [
  ...(config.resolver.nodeModulesPaths || []),
  path.resolve(__dirname, 'src'),
];

module.exports = config;
