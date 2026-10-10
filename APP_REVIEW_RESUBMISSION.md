# AERA 1.0 (19) — resubmission handoff

Prepared October 9, 2026. This is a local release candidate, not an App Store approval or a confirmed TestFlight upload.

## Completed

- Verified that `appreview.iap@getaeraapp.com` signs in to the configured live Supabase service using the supplied review credentials. The account is confirmed, active, role `GENERAL_USER`, has no organization, and has completed onboarding. No account data was changed.
- Fixed subscription restoration: account UUIDs now match the uppercase form required by the installed native purchase library. This applies to purchase, relaunch entitlement checks, and restore.
- Reject expired, revoked, unverified/ambiguous, or unrelated subscription results instead of treating a generic purchase status as active access.
- Added **Try Again** when App Store product loading fails; prevented duplicate purchase requests and repeated product loading caused by parent renders.
- Clear cached subscription access on logout and recheck it when the app returns to the foreground.
- Stop retry-signup from resetting an existing account's profile or organization. Direct existing users to Log In. Do not sync empty registration drafts or create a local signed-in profile before email confirmation.
- Respect an empty organization value from the server, so an old cached sponsorship cannot suppress the individual paywall.
- Use public HTTPS email-confirmation and recovery links for the native app. Added a built password-reset entrypoint for website deployment.
- Updated the listing draft with subscription disclosures and an Apple Standard EULA link.
- Added a shared **App** scheme without local StoreKit overrides. **App-StoreKit** remains for local purchase testing only.
- TypeScript check passed. Automated suite: 19 test files, 81 tests passed. Production web build, Capacitor sync, and Xcode Release archive passed.
- App Store IPA export passed. Verified version 1.0, build 19, iPhone/iPad support, a distribution provisioning profile with production push entitlements and debugging disabled, and no packaged local StoreKit configuration.
- Live privacy and support URLs returned HTTP 200. The live `/reset-password` URL returned HTTP 404; its corrected web build is local and still needs deployment.

## Artifacts

- Xcode archive: `build/AERA-1.0-19.xcarchive`
- App Store package: `build/AERA-1.0-19-AppStore/App.ipa` (SHA-256 `19ae0bc7455d2661bad29c2d8b35d75affd1c19f3c090ee1f4d7291339b49be8`)
- Web deployment files: `dist/`
- Listing copy: `APP_STORE_LISTING.md`
- Subscription review screenshot: `app-store-assets/subscription-review-aera-monthly.png`

## Required before resubmission

1. Upload build 19 through Xcode Organizer or Transporter. If Apple already has build 19, use the next unused build number and rebuild. Select the processed build in App Store Connect.
2. Install that exact build through TestFlight on an iPhone and an iPad. Test a fresh registration, any confirmation email, completion of setup, logout/login, and the dedicated IAP review login.
3. On the review account, confirm the monthly product loads; verify Apple's actual localized price and introductory offer. Complete the sandbox purchase, force-quit/reopen, reinstall/login/restore, and verify Manage Plan. A local StoreKit test cannot establish the App Store Connect product configuration.
4. Verify `com.aera.emergencyresponse.monthly` is available in the intended storefronts, in the AERA Membership group, duration one month, U.S. price $2.99, with the intended one-month trial. Confirm subscription screenshot/localization, payment agreements, tax/banking, and inclusion with this submission.
5. Deploy the updated website so `/reset-password` returns HTTP 200. Verify the auth provider allows the public confirmation and reset URLs, and test the actual emails end to end.
6. Confirm App Privacy answers, current age rating, screenshots, support details, and export compliance in App Store Connect. Copy the updated description including the EULA link.
7. Enter the dedicated account credentials in Apple's private App Review sign-in fields. Use the review note below after the corrected build is uploaded and the device tests pass. Do not describe the old demonstration account as organization-sponsored unless that is independently verified; the source contains an explicit demo exemption.

## Review note draft

Hello App Review,

AERA Monthly is an auto-renewable, one-month subscription for individual members who do not have organization-sponsored access. The previously supplied demonstration account bypasses the individual subscription screen. Please use the dedicated individual-member account in the App Review sign-in fields: appreview.iap@getaeraapp.com.

To review the purchase flow:

1. Open AERA, tap Continue, and choose Email Login.
2. Sign in with the dedicated account. Its onboarding is complete and it has no organization sponsorship.
3. AERA Membership appears when there is no active subscription for this account. It displays the monthly product and localized price returned by the App Store.
4. Tap Start my free month when the introductory offer is shown, or the Subscribe button, to open Apple's purchase sheet. Trial eligibility and purchase terms are confirmed by Apple.
5. Restore Purchases is available on the membership screen. After purchasing, Settings → AERA Membership includes Restore and Manage Plan.

Please do not select Enter Community Access Code when reviewing the individual purchase flow.

Product ID: com.aera.emergencyresponse.monthly
Subscription group: AERA Membership
Duration: one month

Build 19 includes corrections to registration handling, subscription restoration and product-loading recovery. AERA supports iPhone and iPad. It is a preparedness and coordination tool, not a replacement for emergency services.

Thank you.

## Session limitations

App Store Connect browser access was denied because the browser could not verify its admin-enforced security policy. No workaround was used. Computer-use permissions were also pending. No reviewer message was sent, no build was uploaded, and no TestFlight purchase or physical-device signup was performed in this session. The local release checks do not guarantee Apple's approval.
