# Supabase Edge Function: notify-emergency-contact

This function is designed for Supabase Edge runtime and will not run in local Node.js or browser environments.

## Usage
- Deploy via Supabase CLI: `supabase functions deploy notify-emergency-contact`
- Requires Deno runtime (provided by Supabase Edge).
- Set secrets in Supabase dashboard for TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_PHONE.

## Troubleshooting
- Ignore local build errors about `Deno` not found; these do not affect Edge deployment.
- Function will run correctly when deployed to Supabase Edge.
