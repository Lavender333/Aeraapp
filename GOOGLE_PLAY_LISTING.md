# AERA Google Play Listing — Version 1.0

## Store listing

- **App name:** AERA Emergency Response
- **Default language:** English (United States)
- **App or game:** App
- **Free or paid:** Free
- **Category:** Tools
- **Support email:** aerapp369@gmail.com
- **Website:** https://getaeraapp.com
- **Privacy policy:** https://getaeraapp.com/privacy

### Short description

Prepare households and coordinate community emergency-response information.

### Full description

AERA helps households, volunteers, and community organizations prepare for emergencies and coordinate disaster-response information in one place.

Use AERA to maintain household readiness information, locate nearby resources, share safety status, request assistance, and help authorized organizations understand community needs. Role-based dashboards support residents, volunteers, coordinators, and organizational administrators.

Key features include:

- Household preparedness and readiness tracking
- Emergency help requests and safety-status updates
- Location-assisted resource and shelter discovery
- Community events, volunteer intake, and QR-based registration
- Inventory, logistics, and distribution coordination
- Organization dashboards and operational reporting
- In-app privacy controls and account closure

AERA is a safety-support and information-sharing platform. It does not provide emergency, medical, or rescue services and does not guarantee a response. For an immediate or life-threatening emergency, call 911 or your local emergency services.

## Release details

- **Package name:** `com.aera.emergencyresponse`
- **Version name:** `1.0`
- **Version code:** `1`
- **Release name:** `1.0 — Initial release`
- **Release notes:** Initial release of AERA Emergency Response for household preparedness, safety-status sharing, emergency assistance requests, volunteer coordination, and organization response tools.

## Data safety working answers

Confirm these answers against the production database, analytics setup, and retention practices before publishing.

### Data collected

- Personal info: name, email address, phone number, physical address, user IDs
- Health info: medical needs or conditions voluntarily submitted by a user
- Location: approximate and precise location
- Photos and videos: evidence or other attachments submitted by a user
- App activity: product interaction from consent-based analytics
- Other user-generated content: household, emergency-contact, readiness, safety-status, assistance-request, and support information

### Handling and purposes

- Collected for app functionality, account management, safety coordination, support, and consent-based analytics
- Data associated with an account or submitted request should be declared as linked to the user
- The current privacy policy says data is not sold and is not used for third-party advertising or advertising profiles
- Declare encryption in transit only after confirming every production endpoint uses HTTPS
- Declare deletion support only after verifying the in-app account-closure flow and operational deletion process end to end

## Content rating and app access

- Complete the IARC questionnaire as a utility/tools app with user-generated emergency information
- The app may contain user-submitted photos and medical-needs information but does not provide medical treatment advice
- Provide a stable review account and clear navigation instructions if reviewers cannot access core features without signing in
- Use synthetic review data only; never supply a real person's emergency or health information

## Required graphics

- App icon: generated Android launcher icons from `assets/logo.png`
- Feature graphic: still required, 1024 × 500 px, JPG or 24-bit PNG without transparency
- Phone screenshots: still required; upload at least two current Android phone screenshots
- Tablet screenshots: recommended if the app is intended for tablets

## Final Play Console gate

- Production API and environment settings verified on a physical Android device
- Camera, location, attachment upload, authentication, account closure, and privacy-policy access smoke-tested
- Signed Android App Bundle uploaded to an internal testing track
- Play App Signing enrolled and the upload key stored securely outside the repository
- Data safety, content rating, target audience, ads, app access, and account-deletion declarations completed
- Support inbox monitored and public privacy policy reachable without signing in
- Internal-test installation completed from Google Play before production rollout
