# Decision Checklist (Locked)

Date: 2026-02-13
Status: Active product defaults for current implementation phase

## Final Decisions

1. **Age groups**: User enters DOB in `MM/DD/YYYY`; app derives age group automatically.
2. **Invitations**: Manual household code only.
3. **Spouse permissions**: View-only by default.
4. **Mobility/medical flags**: Required for each household member.
5. **Readiness items**: Standardized template (not blank slate).
6. **Score calculation**: Auto-update whenever readiness data changes.
7. **Member logins**: Optional per person (default: no login required).
8. **Homes per account**: Support multiple homes when needed; keep one primary home UX.
9. **Org join**: Available at signup and in Settings; user can disconnect/reconnect in Settings.
10. **Item quantities**: Auto-scale by household size/composition.

## Implementation Notes

- Keep household codes strictly separate from organization codes.
- Preserve privacy defaults: orgs should only receive aggregate readiness unless explicit consent is granted.
- Use derived age bands for quantity scaling and readiness recommendations.
