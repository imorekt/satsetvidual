const fs = require('fs-extra');
const path = require('path');

exports.default = async function(context) {
  const standaloneModulesPath = path.join(context.appOutDir, 'resources', 'standalone', 'node_modules');
  const sourceModulesPath = path.join(context.packager.projectDir, '.next', 'standalone', 'node_modules');

  try {
    if (await fs.pathExists(sourceModulesPath)) {
      console.log("\\n[afterPack] Copying source node_modules to unpacked resources...");
      await fs.copy(sourceModulesPath, standaloneModulesPath, {
        overwrite: true,
        errorOnExist: false
      });
      console.log("[afterPack] Successfully copied standalone node_modules!");
    } else {
      console.warn("[afterPack] WARNING: Source node_modules not found at " + sourceModulesPath);
    }
  } catch (error) {
    console.error("[afterPack] ERROR copying node_modules: " + error.message);
  }
};