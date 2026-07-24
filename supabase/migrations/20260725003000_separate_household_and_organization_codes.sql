-- AERA code-domain hardening.
-- Household codes and organization codes are intentionally separate systems.
-- Household activity must never create, release, or consume organization seats.

create extension if not exists pgcrypto;

-- Remove an old compatibility view whose name can be confused with the new
-- organization membership table