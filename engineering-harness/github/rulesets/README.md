# Rulesets

`bootstrap-github.sh` applies these per repository and sets the approval count
from `REQUIRED_APPROVALS`.

**Required status checks** come from `REQUIRED_CHECKS` in `harness.config.env`
(comma separated, exactly as GitHub shows them). The default is
`PlatformNEX review`: the GitHub App check that passes when the pull request has
one approval given in PlatformNEX. Add `PlatformNEX tests` for a repository once
its TestOps trigger is bound:

```bash
REQUIRED_CHECKS="PlatformNEX review,PlatformNEX tests" ./scripts/bootstrap-github.sh --repo my-service
```

GitHub only accepts a required check after it has reported once, so make a
check required after its first run.

**Release tags.** `release-tags.json` stops anyone moving or deleting a release
tag. PlatformNEX creates them as `<app>-<env>-v<semver>` (or `rel-…`) from a
release session; the pattern also covers plain `v*` tags.

To apply at organisation level instead (Team/Enterprise), add
`"repository_name": { "include": ["~ALL"], "exclude": [] }` under `conditions`
and POST to `/orgs/<org>/rulesets`.
