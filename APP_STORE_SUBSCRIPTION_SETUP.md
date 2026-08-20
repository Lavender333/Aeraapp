# AERA App Store Subscription Setup

The app code expects this exact App Store Connect product:

| Field | Value |
| --- | --- |
| Type | Auto-Renewable Subscription |
| Reference name | AERA Monthly Membership |
| Product ID | `com.aera.emergencyresponse.monthly` |
| Subscription group | AERA Membership |
| Duration | 1 month |
| United States price | $1.99 USD |
| Introductory offer | Free trial, 1 month |

## App Store Connect steps

1. Open **AERA → Monetization → Subscriptions**.
2. Create the **AERA Membership** subscription group.
3. Create an auto-renewable subscription using the exact product ID above.
4. Set its duration to one month and choose the App Store price point that displays **$1.99 USD** in the United States. Apple supplies localized prices in other storefronts.
5. Add the localization:
   - Display name: **AERA Monthly Membership**
   - Description: **Household preparedness, trusted community updates, incident reporting, and recovery resources.**
6. Under introductory offers, add a **Free Trial** for **1 month** with no end date.
7. Upload the required subscription review screenshot showing the in-app membership screen.
8. Add the subscription to the next app version submission and submit it with the build.
9. Confirm Paid Apps agreements, banking, and tax information are active before testing or submission.

The app retrieves the title, localized price, and introductory-offer details directly from the App Store. It does not grant access merely because a button was pressed: StoreKit must return a current verified entitlement. Restoring purchases and opening Apple’s subscription-management screen are available in the app.

## Test before submission

Use an App Store Connect sandbox tester on a physical iPhone. Confirm:

- The membership screen says **1 month free** and shows Apple’s localized recurring price.
- The Apple purchase sheet also shows the free month and recurring price.
- Completing the purchase opens the app’s main screen.
- Force-quitting and reopening retains access.
- **Settings → AERA Membership → Restore** restores access after reinstalling.
- **Manage Plan** opens Apple’s subscription management page.
- Canceling leaves access active through the displayed expiration date.
- The permanent App Review demo account `david@example.com` can access the app without making a real purchase.

Organization-sponsored members with an activated community code do not receive the individual paywall because their access is funded by the organization’s seat contract.
