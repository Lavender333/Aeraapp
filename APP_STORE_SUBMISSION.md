# App Store Submission Guide (iOS)

This repository contains a **React + Vite web app**, a **Node API**, and an existing **Capacitor iOS app**. The native project is at `ios/App/App.xcodeproj` and uses bundle identifier `com.aera.emergencyresponse`.

## Current Release Status

- [x] Capacitor iOS wrapper created
- [x] Production web build succeeds
- [x] Automated test suite passes
- [x] 1024×1024 App Store icon present with no transparency
- [x] iOS permissions include purpose strings for location, camera, microphone, and photos
- [x] Version set to 1.0 with build number 1
- [x] Non-exempt encryption declaration set to false
- [x] Apple Developer team selected in Xcode
- [x] Bundle identifier configured for the selected Apple Developer team
- [ ] Production environment values verified on a physical device
- [ ] App Store Connect metadata, privacy answers, and screenshots supplied
- [ ] Archive uploaded to TestFlight and smoke-tested

---

## 1) iOS Wrapper

### Implemented: Capacitor
- Native iOS shell that loads your Vite build
- Lets you access device APIs (camera, location, push, etc.)

Use `npm run ios:build` to build and sync web assets, then `npm run ios:open` to open the native project in Xcode.

---

## 2) Build & Wrap the Web App (Capacitor)

**Checklist:**
- Build the web app (`npm run build`)
- Ensure Vite output directory matches the Capacitor `webDir` (typically `dist`)
- Add the iOS platform and open in Xcode

**Key configuration items:**
- App name and bundle identifier
- iOS deployment target
- App icons and launch screen

---

## 3) Apple Compliance Items

### Privacy & Data Collection
You must declare the data you collect and why:
- Location (precise) for SOS and responder mapping
- Contact info (email/phone) if required by your auth flow
- Device identifiers or usage data (if used for analytics such as the Google tag / Google Analytics)

**Artifacts required:**
- Privacy policy URL
- Data collection disclosure answers in App Store Connect
- Analytics disclosure that reflects the Google tag measurement configuration in the web experience

### Permissions (Info.plist)
If you access any iOS capability, you must add a usage string:
- Location: `NSLocationWhenInUseUsageDescription`
- Camera: `NSCameraUsageDescription` (if used for ID or damage photos)
- Photos: `NSPhotoLibraryUsageDescription` (if uploads are allowed)
- Microphone: `NSMicrophoneUsageDescription` (if used)

Only include permissions that the app actually uses.

---

## 4) App Store Metadata Checklist

Prepare the following:
- App name, subtitle, and keywords
- App description and “What’s New”
- Support URL and marketing URL
- Privacy policy URL
- Screenshots for required device sizes
- Age rating questionnaire
- App category

---

## 5) TestFlight Builds

**High-level steps:**
1. Archive the iOS build in Xcode
2. Upload to App Store Connect
3. Create a TestFlight build
4. Add internal testers
5. (Optional) Submit for external testing review

---

## 6) Production Release Gate

Before submitting to App Review:
- Confirm production API endpoints and environment variables
- Confirm authentication and offline behavior
- Run smoke tests on a physical device
- Validate crash-free sessions (if using analytics)

---

## 7) Recommended Next Actions

1. Select the Apple Developer team in Xcode under **Signing & Capabilities**.
2. Confirm that `com.aera.emergencyresponse` is available and registered to that team.
3. Verify production environment values and complete a physical-device smoke test.
4. Supply the privacy policy URL, support URL, and final App Store metadata.
5. Archive in Xcode, upload to App Store Connect, and test through TestFlight.
