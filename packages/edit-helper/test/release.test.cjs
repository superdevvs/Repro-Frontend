'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { releaseOptions } = require('../release.cjs');
test('release fails closed without real platform acceptance and signing', () => {
  assert.throws(() => releaseOptions('win32', 'x64', false, {}), /acceptance/);
  assert.throws(() => releaseOptions('win32', 'x64', false, { EDIT_HELPER_PLATFORM_ACCEPTED: 'true' }), /certificate/);
  assert.throws(() => releaseOptions('darwin', 'arm64', false, { EDIT_HELPER_PLATFORM_ACCEPTED: 'true' }), /notarization/);
  const signed = releaseOptions('darwin', 'arm64', false, { EDIT_HELPER_PLATFORM_ACCEPTED: 'true', CSC_NAME: 'Developer ID', APPLE_ID: 'account', APPLE_APP_SPECIFIC_PASSWORD: 'secret', APPLE_TEAM_ID: 'team' });
  assert.equal(signed.forceCodeSigning, true); assert.equal(signed.mac.notarize, true);
  assert.deepEqual(signed.mac.target[0].arch, ['x64', 'arm64']);
});
test('private QA is unpacked, isolated and cannot claim production protocol', () => {
  const qa = releaseOptions('win32', 'x64', true, {});
  assert.equal(qa.appId, 'com.reprophotos.edithelper.qa');
  assert.deepEqual(qa.protocols, []); assert.equal(qa.win.target[0].target, 'dir');
  assert.equal(qa.publish, null); assert.equal(qa.extraMetadata.reproQa, true);
});
