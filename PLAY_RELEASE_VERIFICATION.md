# Google Play Release Verification — 2026-08-16

## Verified build and configuration

- Package: `com.aera.emergencyresponse`
- Version: `1.0` (`versionCode` 1)
- Target SDK: API 36
- Signed bundle: `play-store-assets/aera-1.0-1-release.aab`
- SHA-256: `e8e4376bed75bddc1ee7d0bb615ebe8eacd0ac8968ee563512899201b02faf8c`
- Upload certificate SHA-256: `B1:25:C3:BD:7E:14:D3:4F:01:73:B5:CE:C9:39:18:F8:7B:A9:36:F8:F3:6E:A3:3F:69:93:7A:91:84:3E:8D:FD`
- Production Supabase project URL and public anonymous client key were recovered from the deployed `getaeraapp.com` web build and embedded in the final Android bundle.
- Bundle signing verification passed.
- The signed release APK installed and launched successfully on an API 36 Google Play emulator.
- Public home, privacy, and support URLs returned HTTP 200.
- Android screenshots were captured at 1080 × 2400.

The upload keystore is stored outside the repository at `~/.config/aera-release/aera-upload.jks`. Its password is stored in macOS Keychain under `AERA Google Play Upload Keystore Password` and `AERA Google Play Upload Key Password`.

## Data safety evidence

The following answers are supported by the reviewed app behavior and privacy policy:

- Data is collected for account operation, preparedness, emergency-assistance coordination, support, and consent-based product analytics.
- Personal information may include name, email, phone number, physical address, user ID, emergency contacts, and household information.
- Health information may be voluntarily entered as medical needs or conditions.
- Approximate and precise location may be collected when a user invokes location-assisted features.
- Photos and other user files may be submitted as evidence or attachments.
- Product interaction may be measured only after analytics consent.
- Data connected to an account or submitted request is linked to the user.
- The policy states that data is not sold and is not used for third-party advertising, ad personalization, or marketing profiling.
- Camera and location permissions are requested in context; no microphone permission is declared in the Android build.
- Account closure/deletion is exposed in the app and a server-side `delete-account` function exists.
- Production client traffic uses HTTPS endpoints.

## Organization confirmations still required

These statements cannot be proven from client source code alone and must be confirmed by the organization before the Play Console declaration is submitted:

- Whether every processor and backend retention policy matches the published privacy policy.
- Whether all collected data is encrypted at rest.
- Whether deletion requests remove or anonymize every retained copy within the stated operational period.
- Whether any production logging, monitoring, email, payment, or analytics processor collects additional device or diagnostic data.
- Whether children under 13 are permitted to create accounts and what age-screening process is used.
- Whether the app is offered entirely without ads.
- The correct target-audience age groups.

## Test result

Local release smoke test: **PASS** for installation, launch, production backend initialization, splash screen, and login-screen navigation on Android API 36.

Google Play internal-track installation remains pending until the app exists in the organization's Play Console and an authorized account completes any required declarations.
