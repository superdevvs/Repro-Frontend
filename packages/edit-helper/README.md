# RePro Edit Helper

Implementation is gated from public installation. No signing accounts are configured and real Photoshop testing on Windows, Intel Mac and Apple Silicon Mac is pending. Dashboard manual download/upload remains available.

Use the repository's Node 24 runtime (at least Node 22.12). Run `npm ci` at the repository root, then `npm run check -w @repro/edit-helper`. For private local testing on a Mac/Windows machine, use `npm run start -w @repro/edit-helper` or `npm run package:qa -w @repro/edit-helper`. QA builds are unpacked, have a separate application identity and do not register production application links. Never distribute these as public installers.

Pairing and launch are disabled in production until `EDIT_HELPER_RELEASE_READY=true` and all three HTTPS installer URLs are configured. Use a disposable test account and isolated test backend to verify pairing, authorized downloads and saved uploads. The helper API origin is fixed in `policy.cjs`; a QA build must explicitly change it to that test deployment. Do not test saves against customer media.

## Release prerequisites

- Apple Developer ID Application certificate (`CSC_LINK` + `CSC_KEY_PASSWORD`, or `CSC_NAME` on a secured build keychain), plus `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` and `APPLE_TEAM_ID` for notarization.
- Windows signing certificate (`WIN_CSC_LINK` + `WIN_CSC_KEY_PASSWORD`, or builder's `CSC_LINK` + `CSC_KEY_PASSWORD`). Azure Trusted Signing can be added after an account is selected; it is not configured by this package.
- Real acceptance recorded for Windows x64, Mac Intel and Mac Apple Silicon before setting `EDIT_HELPER_PLATFORM_ACCEPTED=true` on the release runner. Build Mac artifacts on macOS and Windows artifacts on Windows with `npm run package -w @repro/edit-helper`. Publishing is always manual; the build fails if signing or notarization fails.
- Verify Windows Authenticode with `Get-AuthenticodeSignature`, and Mac identity/notarization with `codesign --verify --deep --strict`, `spctl --assess --type execute`, and `xcrun stapler validate`. Install cleanly, verify the application link and secure-storage persistence after an upgrade.
- Record checksums, exact frontend/backend/helper revisions, signing identities and platform results with the artifacts. Set `EDIT_HELPER_WINDOWS_URL`, `EDIT_HELPER_MAC_INTEL_URL`, `EDIT_HELPER_MAC_ARM_URL` only to verified signed HTTPS artifacts, then enable the feature.

## Required platform acceptance (all pending)

For each platform, test Photoshop detection/custom installation; pairing comparison code and repeated/expired links; opening full resolution; manual upload default and opt-in auto-save; JPEG/PNG/TIFF; rapid/atomic saves; Save As inside Exports and explicit import from elsewhere; PSD staying local; network interruption/restart/response loss; expired/revoked devices; two competing edits with Replace latest/Save as copy; restore; unsuccessful scan preserving current bytes; uninstall preserving unsent files. Use intercepted notifications and disposable shoots. Unit tests do not replace these platform checks.

Working copies and immutable queued exports stay under Electron's user-data directory. Device credentials and pairing proof use Electron safeStorage. Closing the app preserves local work; reopening resumes pending uploads. Use Quit to stop watching. The app never deletes old gallery versions or local unsent work automatically.

References: [Electron signing](https://www.electronjs.org/docs/latest/tutorial/code-signing), [application links](https://www.electronjs.org/docs/latest/tutorial/launch-app-from-url-in-another-app), [builder signing](https://www.electron.build/v26/docs/features/code-signing/).
