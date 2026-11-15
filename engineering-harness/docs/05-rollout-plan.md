# Rollout plan

Do this in order. Each phase is usable on its own.

## Phase 0: decisions (day 1)

- [ ] Name the platform owner, security lead, and who holds the tech lead role in PlatformNEX (they approve production releases)
- [ ] Confirm the PlatformNEX portal, the System this product belongs to, and its environments (dit1 … prod)
- [ ] Choose region(s) and fill in `harness.config.env`
- [ ] Confirm GitHub plan (Team or Enterprise recommended) and Google Workspace / Cloud Identity
- [ ] Create the Google groups listed in the config
- [ ] Decide audit scope and target date (SOC 2 Type I, then Type II; ISO 27001 stage 1)

## Phase 1: identity and GitHub (week 1)

- [ ] Work through `github/org-settings-checklist.md`
- [ ] `./scripts/bootstrap-github.sh`
- [ ] Push `docs/`, `policies/`, `compliance/`, `templates/` to the handbook repo
- [ ] Push `repo-template/` to the template repo and mark it as a template
- [ ] Ask the Claude Code admin to enable `pnx-harness` in managed settings (the guard hooks do not run until then)
- [ ] Everyone completes `docs/04-onboarding.md`

## Phase 2: GCP foundation and PlatformNEX settings (week 1 to 2)

- [ ] `./scripts/bootstrap-gcp.sh` then review the plan line by line before apply
- [ ] Install the Cloud Build GitHub app and create the connection (see `infra/bootstrap/README.md`)
- [ ] Enter the `platformnex_cloud_build_settings` output in PlatformNEX (System › Settings › Cloud Build) for each environment
- [ ] Install the PlatformNEX review GitHub App and turn on review enforcement for the System
- [ ] Confirm org policies took effect: try to create a bucket in another region and a service account key; both must fail
- [ ] Confirm audit logs arrive in the locked bucket

## Phase 3: first service through every gate (week 2 to 3)

- [ ] `./scripts/new-service.sh <name>`, then onboard the repository in the PlatformNEX portal
- [ ] Bind the TestOps trigger for the component and make "PlatformNEX tests" a required check
- [ ] Take one real feature from idea brief to prod, using every template once
- [ ] Confirm "PlatformNEX review" is a required check on the default branch
- [ ] Run one rollback (release session › Roll back) and one break-glass drill

## Phase 4: compliance operations (week 3 to 6)

- [ ] Management approves the policies (PR approval by the named approver is the record)
- [ ] Fill the `owner` column in `compliance/control-matrix.csv`
- [ ] First risk register review
- [ ] Schedule quarterly access review and restore test as recurring issues
- [ ] Security awareness and secure-coding onboarding for everyone
- [ ] Start the SOC 2 observation window only once phases 1 to 3 are stable

## Phase 5: keep it alive

- [ ] `harness` label for friction; fix the harness rather than bypass it
- [ ] Quarterly: prune permissions, review rulesets, update pinned tool versions
