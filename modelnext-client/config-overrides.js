module.exports = function override(config) {
  const mediaPipeModulePattern = /@mediapipe[\\/]tasks-vision/i;
  const mediaPipeMessagePattern =
    /Critical dependency: the request of a dependency is an expression|Failed to parse source map from .*vision_bundle_mjs\.js\.map.*ENOENT/i;

  config.ignoreWarnings = [
    ...(config.ignoreWarnings || []),
    {
      module: mediaPipeModulePattern,
      message: mediaPipeMessagePattern,
    },
  ];

  return config;
};

// Jest 27 does not resolve React Router 7 package exports. Keep this test-only;
// webpack and application routing continue to use their existing configuration.
module.exports.jest = config => {
  const path = require('path');
  const cjsEntry = (name, subpath = '.') => {
    const manifestPath = require.resolve(name + '/package.json');
    const manifest = require(manifestPath);
    return path.resolve(path.dirname(manifestPath), manifest.exports[subpath].node.default);
  };
  config.moduleNameMapper = {
    ...config.moduleNameMapper,
    '^react-router-dom$': cjsEntry('react-router-dom'),
    '^react-router/dom$': cjsEntry('react-router', './dom'),
    '^react-router$': cjsEntry('react-router'),
  };
  return config;
};
