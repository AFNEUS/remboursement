# TODO – Claim Creation & Reimbursement Audit

## Frontend (`app/claims/new/page.tsx`)
- [ ] Clarify UX: either restrict to **one expense per claim** or implement proper multi-line support (loop through `expenses` and persist each line in DB or metadata). Back-end only uses the first expense right now.
- [ ] Wire `selectedBnMember` to the payload so admins can actually create a claim for another BN member (requires API support).
- [ ] Persist car-specific data per expense (distance, fiscal power, passengers) and propagate into the API payload for every claim, not only the first item.
- [ ] Compute train distances from journey segments (use SNCF API distance or geocoding fallback) so that SQL `calculate_train_refund` can apply train barèmes.
- [ ] Store `trainSegments` / supporting data into `metadata` when creating the claim, making validation easier.
- [ ] Replace `localStorage` tariff cache (`admin_tarifs`) by a secure fetch from Supabase to avoid stale/forged ceilings.
- [ ] Harden justificatif upload workflow: prevent duplicate uploads, show progress/errors, and associate files to their expense line in metadata.

## API (`app/api/claims/create/route.ts`)
- [ ] Support an optional `acted_for_user_id` that admins can pass (after role check) to create claims on behalf of BN members.
- [ ] Validate the expenses array: ensure required fields exist per expense type, verify IBAN only once, and include per-expense metadata when storing the claim.
- [ ] Persist the submitted expenses into `metadata.expense_details` and mark `has_justificatifs` when uploads succeed.
- [ ] Call `detectDuplicates` and flag suspicious requests before insert.
- [ ] Enforce role-based ceilings (event-specific vs global) and return actionable error messages.

## SQL / Automations (`supabase/migrations/FINAL_PERFECT_SETUP.sql`)
- [ ] Extend `calculate_claim_amount` to consume per-expense metadata when multi-line claims are supported (e.g., sum reimbursements per line instead of using a single `expense_type`).
- [ ] Expose an RPC (e.g., `submit_claim_with_items`) that safely writes the claim + its expense lines + justificatifs in a single transaction.
- [ ] Add history/audit entries for tariff changes so reimbursement calculations remain explainable over time.

## Validation & QA
- [ ] Create Cypress/Playwright journeys that cover car, train, hotel, and meal claim submissions end-to-end (including justificatif upload).
- [ ] Seed Supabase with realistic baremes/taux/plafonds for automated regression tests.
- [ ] Add Jest tests for `lib/reimbursement.ts` covering car (all CV), train (distance buckets), and ceiling edge cases (> 500€ second validation, IBAN missing, etc.).

