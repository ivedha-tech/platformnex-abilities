# GitHub organisation settings checklist

These are set once in the UI (Organisation > Settings). The script cannot set
most of them. Tick them off in an issue labelled `compliance` and attach
screenshots; that issue is your evidence for control C06 / C12.

## Authentication and members
- [ ] Require two-factor authentication for everyone
- [ ] SAML SSO with Google Workspace enabled and **required** (Enterprise Cloud); otherwise enforce 2FA and verify emails on the company domain
- [ ] Base permissions: **No permission** (access only through teams)
- [ ] Members cannot create public repositories; private/internal only
- [ ] Members cannot delete or transfer repositories, or change repository visibility
- [ ] Outside collaborators: only owners can invite
- [ ] At least two and at most three organisation owners; owners use security keys / passkeys
- [ ] Verified domain added; restrict email notifications to it

## Code security (Settings > Advanced Security > Configurations)
- [ ] Apply a security configuration to all repos, new repos by default:
  - [ ] Dependency graph, Dependabot alerts, Dependabot security updates
  - [ ] Secret scanning + **push protection**
  - [ ] Private vulnerability reporting
  - [ ] Code scanning default setup where licensed

## Repository defaults
- [ ] Default branch name `main`
- [ ] Allow squash merging only; automatically delete head branches
- [ ] Rulesets applied (script) and no bypass actors
- [ ] Forking of private repos disabled

## Third-party access
- [ ] OAuth app access restrictions enabled; apps approved by an owner
- [ ] Personal access tokens: fine-grained only, approval required, max lifetime 90 days; classic tokens blocked
- [ ] GitHub Apps installed (selected repositories only): the PlatformNEX review app, and Google Cloud Build for the connection PlatformNEX's triggers use
- [ ] Org ruleset requiring the "PlatformNEX review" check on repositories of enforced Systems
- [ ] Copilot / AI features: set according to the AI policy

## Audit
- [ ] Audit log export scheduled monthly (or streaming to GCS on Enterprise)
- [ ] IP allow list, if you have fixed egress (optional)

## Plan notes
Org-level rulesets, required SSO, and audit log streaming need Team or
Enterprise. On lower plans the bootstrap script applies the same rules per
repository, which works but must be re-run for each new repo
(`new-service.sh` does this for you).
