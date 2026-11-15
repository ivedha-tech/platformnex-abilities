# Release checklist: <component> to <environment>

## Before opening the release session
- [ ] All pull requests in the release are merged with the "PlatformNEX review" check passed
- [ ] The build for the commit being released succeeded
- [ ] The release is healthy in the source environment (uat, else qa); smoke tests pass
- [ ] No open Critical/High vulnerabilities, or an approved exception is linked
- [ ] Database migrations are backward compatible; rollback tested in a non-production environment
- [ ] Configuration and secrets for the target environment are set in the release's Configuration phase
- [ ] Feature flags set to the intended state per environment
- [ ] Dashboards and alerts exist for anything new
- [ ] Runbook updated; on-call knows what is shipping
- [ ] PRD compliance section still true (data class, region, retention, vendors)
- [ ] Customer / support comms ready if behaviour changes

## Approval
- [ ] Production: a tech lead who is not the author approved the release in the PlatformNEX Inbox
- [ ] Change ticket linked, if the environment requires one

## After
- [ ] The deployed version is the intended one (Deliver tab)
- [ ] Error rate and latency normal 30 minutes after the release
- [ ] Release notes posted
- [ ] Follow-up issues filed (flag removal, cleanup)

## Rollback
Open a release session for the same component and environment and choose "Roll back". It restores the previous image through a GitOps pull request and needs the same approval as a release.
