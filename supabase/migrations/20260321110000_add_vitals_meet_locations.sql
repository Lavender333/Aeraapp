-- Add hazard-specific meet locations to preparedness vitals intake.

ALTER TABLE public.vitals
  ADD COLUMN IF NOT EXISTS fire_meet_location text,
  ADD COLUMN IF NOT EXISTS severe_weather_meet_location text;
