#!/usr/bin/env bash
# PreToolUse hook for Bash. Reads the tool call as JSON on stdin.
# Exit 2 blocks the command and shows stderr to the agent. Exit 0 allows it.
# This is an accident-prevention layer. The real controls are PlatformNEX
# approvals and IAM: developer credentials cannot change production.
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib.sh
. "$here/lib.sh"

cmd="$(json_field command)"
if [ $? -eq 3 ]; then
  echo "pnx-harness guard-bash: neither jq nor python3 is installed, so commands cannot be checked. Install jq." >&2
  exit 2
fi
[ -z "$cmd" ] && exit 0

block() {
  echo "Blocked by the pnx-harness guard (guard-bash): $1" >&2
  echo "If this is legitimate, stop and ask the human to run it." >&2
  exit 2
}

has() { printf '%s' "$cmd" | grep -Eiq -- "$1"; }

# --- git: history and review integrity ---
has 'git[[:space:]]+push[^;&|]*[[:space:]](--force([[:space:]]|$)|-f([[:space:]]|$)|--force-with-lease)' && block "force push"
has 'git[[:space:]]+push[^;&|]*[[:space:]:](main|master)([[:space:]]|$)' && block "direct push to the default branch"
has 'git[[:space:]]+(commit|push|merge)[^;&|]*--no-verify' && block "skipping git hooks (--no-verify)"
has 'git[[:space:]]+commit[^;&|]*--no-gpg-sign' && block "unsigned commit"
has 'git[[:space:]]+config[^;&|]*(commit\.gpgsign|core\.hooksPath)' && block "changing signing or hook configuration"
has 'git[[:space:]]+commit[^;&|]*\[(skip ci|ci skip)\]' && block "[skip ci] hides a change from the build"
has 'gh[[:space:]]+pr[[:space:]]+(merge|review)' && block "agents do not approve or merge pull requests"
has 'gh[[:space:]]+(repo[[:space:]]+(delete|edit)|secret|auth[[:space:]]+token|ruleset)' && block "GitHub admin or token operation"
has 'gh[[:space:]]+api[^;&|]*(rulesets|branches/[^[:space:]]*/protection|collaborators|/teams)' && block "changing GitHub protections or access"
has 'gh[[:space:]]+release[[:space:]]+(create|delete|edit)' && block "release tags are created by the PlatformNEX Release flow"

# --- release path: build -> GitOps -> Argo CD, started from a PlatformNEX release session ---
has '(terraform|tofu)[[:space:]]+(apply|destroy|import|state[[:space:]]+(rm|mv|push))' && block "infrastructure changes go through an IaC pull request and its pipeline"
has 'gcloud[[:space:]]+(deploy|run[[:space:]]+(deploy|services[[:space:]]+(update|delete|replace|set-iam-policy|add-iam-policy-binding)))' && block "deploys go through the PlatformNEX Release flow"
has 'gcloud[[:space:]]+(beta[[:space:]]+)?builds[[:space:]]+(submit|triggers[[:space:]]+(run|create|delete|update|import))' && block "builds are started by PlatformNEX triggers, not by hand"
has 'kubectl[^;&|]*[[:space:]](apply|delete|edit|patch|replace|create|scale|autoscale|set|annotate|label|taint|drain|cordon|uncordon|rollout[[:space:]]+(restart|undo|pause|resume))([[:space:]]|$)' && block "cluster changes go through the GitOps repository and Argo CD"
has 'argocd[[:space:]]+(app[[:space:]]+(sync|rollback|set|delete|create|patch|terminate-op|actions)|proj|repo|cluster|account)' && block "Argo CD is changed through the GitOps repository; roll back from a PlatformNEX release session"
has 'helm[[:space:]]+(install|upgrade|rollback|uninstall|delete)' && block "releases go through the PlatformNEX Release flow"
has 'make[[:space:]]+[^;&|]*promote' && block "promotion happens in a PlatformNEX release session"

# --- access and secrets ---
has 'gcloud[^;&|]*(add-iam-policy-binding|set-iam-policy|remove-iam-policy-binding)' && block "IAM changes go through an IaC pull request"
has 'gcloud[^;&|]*service-accounts[[:space:]]+keys' && block "service account keys are prohibited"
has 'gcloud[[:space:]]+secrets[[:space:]]+(versions[[:space:]]+(access|add|destroy|disable)|create|delete|update)' && block "secrets are read and changed in a release's Configuration phase"
has 'gcloud[[:space:]]+auth[[:space:]]+(print-access-token|print-identity-token|application-default[[:space:]]+print-access-token)' && block "printing credentials"
has 'kubectl[^;&|]*[[:space:]]get[[:space:]]+secrets?([[:space:]/]|$)[^;&|]*(-o|--output)' && block "reading cluster secrets"
has '(gcloud|gsutil|bq|kubectl|argocd|helm)[^;&|]*[-_./=[:space:]](prod|production|stg)([^a-z0-9]|$)' && block "command targets staging or production"
has 'pnx[[:space:]]+dev[^;&|]*--env[=[:space:]]+(prod|production)([^a-z0-9]|$)' && block "pnx dev sessions never target production"

# --- local machine ---
has '(curl|wget)[^;&]*\|[[:space:]]*(sudo[[:space:]]+)?(ba|z|da)?sh([[:space:]]|$)' && block "piping a download into a shell"
# shellcheck disable=SC2016
has 'rm[[:space:]]+(-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r)[a-z]*[[:space:]]+(/|~|\$HOME|\.git)([[:space:]/]|$)' && block "destructive rm"
has '(^|[[:space:];&|])sudo[[:space:]]' && block "sudo"
has '(cat|less|more|head|tail|grep|awk|sed|cp|base64|xxd)[^;&|]*[[:space:]/]\.env(\.local|\.pnx)?([[:space:]]|$)' && block "reading .env"
has '(cat|less|head|tail|cp|base64|scp)[^;&|]*(\.ssh/|\.config/(gcloud|pnx)|id_(rsa|ed25519)|\.pem([[:space:]]|$)|\.tfstate)' && block "reading keys, credentials, or state"
has '(^|[[:space:];&|])(printenv|env)[[:space:]]*($|[|>;&])' && block "dumping the environment"

exit 0
