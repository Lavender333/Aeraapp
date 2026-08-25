# Google Play Submission Guide (Android)

This repository now includes a Capacitor Android app at `android/` using package name `com.aera.emergencyresponse`.

## Current release status

- [x] Capacitor Android platform added
- [x] Production web build connected to the Android app
- [x] Version set to 1.0 with version code 1
- [x] Target and compile SDK set to API 36
- [x] Camera and location permissions declared for features that use them
- [x] Android launcher icons and splash assets generated from the AERA logo
- [x] Google Play listing copy and preliminary Data safety mapping prepared
- [x] Java 21 and Android Studio installed on the release Mac
- [x] Production client configuration embedded and locally smoke-tested on an API 36 Android emulator
- [x] 1024 × 500 feature graphic and two Android phone screenshots supplied
- [ ] Data safety and policy declarations confirmed by the organization
- [x] Upload key created outside this repository; password stored in macOS Keychain
- [x] Signed App Bundle generated and locally verified
- [ ] Signed App Bundle uploaded and smoke-tested through Google Play internal testing

## Build workflow

1. Install the current stable Android Studio and its bundled Java runtime.
2. From the project directory, run `npm run android:build`.
3. Run `npm run android:open` and let Android Studio finish its first Gradle sync.
4. Test a release-equivalent build on a physical Android phone.
5. In Android Studio, select **Build > Generate Signed Bundle / APK > Android App Bundle**.
6. Create or select the upload key, choose the `release` variant, and generate the `.aab` file.

The release build supports signing through the `AERA_UPLOAD_STORE_FILE`, `AERA_UPLOAD_STORE_PASSWORD`, `AERA_UPLOAD_KEY_ALIAS`, and `AERA_UPLOAD_KEY_PASSWORD` environment variables. The private values must be retrieved from the approved secrets store at build time and must never be committed.

## Versioning

Version values live in `android/app/build.gradle`:

- Increase `versionCode` for every Play Console upload.
- Change `versionName` for the user-visible release number.
- Never change the application ID after the first Play Console release.

## Permissions

The manifest declares only the Android permissions currently required by observed app behavior:

- Internet for API and map access
- Camera for QR scanning and damage/evidence capture
- Approximate and precise location for incident coordinates and nearby resources

The app currently requests camera and location only when a user activates a related feature. If microphone recording is added later, update both the Android manifest and the Data safety declaration before release.

## Signing safety

- Enroll in Play App Signing.
- Keep the upload keystore, passwords, and credentials outside Git and outside shared project folders.
- Back up the upload key in the organization's approved secrets store.
- Do not place secrets in `gradle.properties`, source files, or documentation committed to this repository.

## Play Console sequence

1. Create the app and reserve `com.aera.emergencyresponse`.
2. Complete Store settings, App content, target audience, content rating, ads, app access, Data safety, privacy policy, and account-deletion sections.
3. Add the listing copy from `GOOGLE_PLAY_LISTING.md` plus final graphics and screenshots.
4. Upload the signed `.aab` to **Internal testing**.
5. Install from the Play test link and run the physical-device smoke test.
6. Fix any pre-launch report findings, then promote the tested build to production with a staged rollout.
