# AERA StoreKit Purchase-Sheet Test

This test uses Xcode's local StoreKit environment. It verifies that AERA loads
the monthly subscription and presents Apple's purchase sheet without making a
real charge.

## Run the test

1. Open `App/App.xcodeproj` in Xcode.
2. Select the shared `App-StoreKit` scheme.
3. Select **iPad Air 11-inch (M3)** as the run destination.
4. Run the app.
5. Tap **Continue** and sign in with:
   - Email: `appreview.iap@getaeraapp.com`
   - Password: use the dedicated credentials stored privately in App Store Connect
6. Confirm that **AERA Membership** appears automatically.
7. Confirm the plan shows **AERA Monthly**, a one-month free trial, and the
   monthly renewal price.
8. Tap **Start my free month**.
9. Confirm Apple's local StoreKit purchase sheet appears for
   `com.aera.emergencyresponse.monthly`.
10. Confirm the purchase. Verify that the app opens the dashboard.
11. Relaunch the app and verify access remains unlocked.
12. Reinstall the app without clearing the StoreKit transaction history, sign
    in with the same account, and verify restored access. In Settings, use
    **AERA Membership → Restore** to verify the explicit restore action.
13. Test cancellation, expiration, and a temporary network failure. Expired
    access must return to the membership screen; **Try Again** must retry a
    failed product load.

Use the **App** scheme for the release archive. It has no local StoreKit
configuration, so the distributed app uses Apple's store environment.

## Expected result

- The product loads instead of showing "The App Store plan could not be loaded."
- The purchase button is enabled.
- Apple's purchase sheet displays the AERA Monthly subscription.
- Completing the transaction unlocks the dashboard.
- Restore Purchases recognizes the local StoreKit entitlement.

## TestFlight sandbox check

The local configuration validates the app flow, but it does not validate the
live App Store Connect record. Before replying to App Review, repeat steps 4-10
with the TestFlight build on an iPhone or iPad. TestFlight automatically uses
Apple's sandbox environment. The App Store Connect product ID must exactly match
`com.aera.emergencyresponse.monthly`.
