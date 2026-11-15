---
name: release-check
description: Walks the release checklist (gate G5) against the repository and the PlatformNEX release state, and reports each item as verified, not verified or failed. Use when someone asks whether a component is ready to release or promote to an environment, especially production, or wants the state of a release session.
---

# Release readiness (gate G5)

## Overview

Releases on PlatformNEX run as a release session for one component to one environment: changes, configuration, readiness, impact, then deploy. A build updates the GitOps overlay and Argo CD syncs it. Production needs a tech lead's approval in the PlatformNEX Inbox. This skill gathers evidence for the checklist. It never starts, approves, promotes or rolls back a release; a person does that in the portal's Deliver tab.

## When to Use

- "Is this ready for prod?" or "can we promote?"
- Before someone opens a release session
- After a release, to check it is healthy

For the launch plan itself (flags, staged rollout, rollback thresholds), use harness-ship:shipping-and-launch. For checks after the deploy, use harness-operate:release-verification-and-canary.

## Process

1. Read the checklist: the repository's `docs/templates/release-checklist.md` if it exists, otherwise `template.md` in this skill's directory.
2. Gather evidence from the repository: merged pull requests since the last release (`git log`, `gh pr list --state merged`), open security or dependency issues, migration files, changed alerts or runbook, feature flags.
3. Gather evidence from PlatformNEX through the `platformnex` MCP server, which is read-only:

   | Question | Tool |
   |---|---|
   | Is a release session open, and in which phase? | `devops_list_release_sessions`, `devops_get_release_session` |
   | What will the release change, and with what config? | `devops_get_release_config`, `catalog_cd_candidates` |
   | What is running in each environment? | `catalog_get_system_environments`, `devops_get_deploy_events` |
   | Did the source environment's last release pass its post-deploy checks? | `devops_get_release_post_deploy` |
   | Are builds and tests green? | `devops_list_pipelines`, `testops_get_health` |
   | Are alerts firing or errors up in the source environment? | `sre_get_service_alerts`, `sre_get_error_counts`, `sre_get_latency` |

   If the server is not connected, say so and mark those items **not verified**. Do not substitute `kubectl`, `argocd` or `gcloud` commands.
4. Report each checklist item as **verified** (with the evidence), **not verified** (you could not see it; say who can), or **failed**.
5. End with a plain recommendation, the list of things a human must confirm, and the next step: open the release in the portal's Deliver tab. Developers request a production release; a tech lead approves it. Rollback is the same session type, choosing "Roll back".

## Verification

- [ ] Every checklist item has a status and, when verified, the evidence
- [ ] Nothing is marked verified on assumption
- [ ] The report names who must confirm each unverified item
- [ ] No release, promotion, approval or rollback was attempted
