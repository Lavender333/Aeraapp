# App Store Submission Guide (iOS)

This repository is a **web app (React + Vite)** and **Node API**. To ship on the Apple App Store you must first wrap the web app in an iOS container, then complete Apple’s compliance items and TestFlight distribution.

---

## 1) Choose an iOS Wrapper

### Recommended: Capacitor (best fit for Vite)
- Native iOS shell that loads your Vite build
- Lets you access device APIs (camera, location, push, etc.)

**High-level steps:**
1. Install Capacitor packages
2. Initialize Capacitor
3. Build web assets
4. Add iOS platform
5. Open Xcode and configure

> If you prefer React Native, you’ll need a full React Native project and a web-to-native migration. That is a larger effort than wrapping the existing Vite build.

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
- Device identifiers (if used for analytics)

**Artifacts required:**
- Privacy policy URL
- Data collection disclosure answers in App Store Connect

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

1. Add Capacitor to the repo
2. Generate iOS project
3. Wire production environment variables
4. Provide privacy policy URL and app metadata
5. Produce TestFlight build

If you want, I can implement the Capacitor wrapper and add the iOS project files next.