-- Bind household invites to a specific member phone for safer redemption.
ALTER TABLE household_invitations
ADD COLUMN IF NOT EXISTS invitee_phone VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_household_invitations_invitee_phone
  ON household_invitations(invitee_phone);
