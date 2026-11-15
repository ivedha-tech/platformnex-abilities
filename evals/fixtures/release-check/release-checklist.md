# Release checklist: billing-api to uat

## Before opening the release session
- [ ] All pull requests in the release are merged with the "PlatformNEX review" check passed
- [ ] The build for the commit being released succeeded
- [ ] The release is healthy in the source environment; smoke tests pass
- [ ] No open Critical/High vulnerabilities, or an approved exception is linked
- [ ] Database migrations are backward compatible; rollback tested in a non-production environment
- [ ] Configuration and secrets for the target environment are set in the Configuration phase
- [ ] Feature flags set to the intended state per environment
- [ ] Dashboards and alerts exist for anything new
- [ ] Runbook updated; on-call knows what is shipping
