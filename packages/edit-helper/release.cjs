'use strict';
const path = require('node:path');

function releaseOptions(platform, arch, qa, env) {
  if (!['darwin', 'win32'].includes(platform)) throw new Error('Build the helper on Mac or Windows.');
  if (platform === 'win32' && arch !== 'x64') throw new Error('Windows builds require x64.');
  if (!qa) {
    if (env.EDIT_HELPER_PLATFORM_ACCEPTED !== 'true') throw new Error('Record real Photoshop platform acceptance before producing a release.');
    if (platform === 'darwin' && !((env.CSC_LINK || env.CSC_NAME) && env.APPLE_ID && env.APPLE_APP_SPECIFIC_PASSWORD && env.APPLE_TEAM_ID)) {
      throw new Error('Mac release requires a Developer ID signing identity and notarization credentials.');
    }
    if (platform === 'win32' && !(env.WIN_CSC_LINK || env.CSC_LINK)) throw new Error('Windows release requires a code-signing certificate.');
  }
  return {
    appId: qa ? 'com.reprophotos.edithelper.qa' : 'com.reprophotos.edithelper',
    productName: qa ? 'RePro Edit Helper QA' : 'RePro Edit Helper',
    directories: { output: qa ? 'artifact/qa' : 'artifact/release' },
    files: ['main.cjs', 'core.cjs', 'api.cjs', 'policy.cjs', 'preload.cjs', 'renderer.js', 'renderer.css', 'index.html', 'package.json'],
    asar: true,
    forceCodeSigning: !qa,
    // QA does not register production links and must not be distributed as an installer.
    protocols: qa ? [] : [{ name: 'RePro editing session', schemes: ['repro-edit'] }],
    extraMetadata: { reproQa: qa },
    artifactName: '${productName}-${version}-${os}-${arch}.${ext}',
    publish: null,
    mac: { target: [{ target: qa ? 'dir' : 'dmg', arch: ['x64', 'arm64'] }],
      category: 'public.app-category.photography', hardenedRuntime: true,
      entitlements: 'entitlements.mac.plist', entitlementsInherit: 'entitlements.mac.plist',
      notarize: !qa, ...(qa ? { identity: null } : {}) },
    win: { target: [{ target: qa ? 'dir' : 'nsis', arch: ['x64'] }] },
    nsis: { oneClick: false, perMachine: false, allowToChangeInstallationDirectory: true, deleteAppDataOnUninstall: false },
  };
}
async function main() {
  const qa = process.argv.includes('--qa');
  const config = releaseOptions(process.platform, process.arch, qa, process.env);
  const { build, Platform } = require('electron-builder');
  await build({ projectDir: __dirname, config, publish: 'never',
    targets: (process.platform === 'darwin' ? Platform.MAC : Platform.WINDOWS).createTarget(qa ? 'dir' : undefined) });
  console.log(qa ? 'Private unsigned QA build only. Signing, notarization and platform acceptance remain required.' : 'Signed artifact built. Verify signatures and platform acceptance before enabling download URLs.');
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { releaseOptions };
