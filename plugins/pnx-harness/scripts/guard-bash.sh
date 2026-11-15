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

# A command that only prints or searches text cannot change anything, so a blocked phrase inside
# its arguments (git grep "gcloud run deploy" docs) is no reason to refuse it. The local-machine
# rules at the bottom still apply to it. A pipe, redirect, chain, background or substitution
# means it is not text-only, and neither do options that make the tool run another command.
textonly=0
if printf '%s' "$cmd" | grep -Eq '^[[:space:]]*(git[[:space:]]+grep|grep|egrep|fgrep|rg|ag|cat|echo|printf|head|tail|wc|ls|less|more)([[:space:]]|$)' \
   && ! printf '%s' "$cmd" | grep -Eq '[;&|<>`]|\$\(' \
   && ! printf '%s' "$cmd" | grep -Eq '[[:space:]]-O|--open-files-in-pager|--pre([[:space:]=]|$)|--hostname-bin'; then
  textonly=1
fi
hasx() { [ "$textonly" = 1 ] && return 1; has "$@"; }

# --- git: history and review integrity ---
hasx 'git[[:space:]]+push[^;&|]*[[:space:]](--force([[:space:]]|$)|-f([[:space:]]|$)|--force-with-lease)' && block "force push"
hasx 'git[[:space:]]+push[^;&|]*[[:space:]:](main|master)([[:space:]]|$)' && block "direct push to the default branch"
hasx 'git[[:space:]]+push[^;&|]*refs/heads/(main|master)([[:space:]]|$)' && block "direct push to the default branch"
hasx 'git[[:space:]]+push[^;&|]*[[:space:]]\+[^[:space:]]' && block "force push through a + refspec"
hasx 'git[[:space:]]+push[^;&|]*[[:space:]]-[a-zA-Z]*f[a-zA-Z]*([[:space:]]|$)' && block "force push"
hasx 'git[[:space:]]+(commit|push|merge)[^;&|]*--no-verify' && block "skipping git hooks (--no-verify)"
hasx 'git[[:space:]]+commit[^;&|]*--no-gpg-sign' && block "unsigned commit"
hasx 'git[[:space:]]+config[^;&|]*(commit\.gpgsign|core\.hooksPath)' && block "changing signing or hook configuration"
hasx 'git[[:space:]]+commit[^;&|]*\[(skip ci|ci skip)\]' && block "[skip ci] hides a change from the build"
hasx 'gh[[:space:]]+pr[[:space:]]+(merge|review)' && block "agents do not approve or merge pull requests"
hasx 'gh[[:space:]]+(repo[[:space:]]+(delete|edit)|secret|auth[[:space:]]+token|ruleset)' && block "GitHub admin or token operation"
hasx 'gh[[:space:]]+api[^;&|]*(rulesets|branches/[^[:space:]]*/protection|collaborators|/teams)' && block "changing GitHub protections or access"
hasx 'gh[[:space:]]+release[[:space:]]+(create|delete|edit)' && block "release tags are created by the PlatformNEX Release flow"

# --- release path: build -> GitOps -> Argo CD, started from a PlatformNEX release session ---
hasx '(terraform|tofu)[[:space:]]+(apply|destroy|import|state[[:space:]]+(rm|mv|push))' && block "infrastructure changes go through an IaC pull request and its pipeline"
hasx 'gcloud[[:space:]]+(deploy|run[[:space:]]+(deploy|services[[:space:]]+(update|delete|replace|set-iam-policy|add-iam-policy-binding)))' && block "deploys go through the PlatformNEX Release flow"
hasx 'gcloud[[:space:]]+(beta[[:space:]]+)?builds[[:space:]]+(submit|triggers[[:space:]]+(run|create|delete|update|import))' && block "builds are started by PlatformNEX triggers, not by hand"
hasx 'kubectl[^;&|]*[[:space:]](apply|delete|edit|patch|replace|create|scale|autoscale|set|annotate|label|taint|drain|cordon|uncordon|rollout[[:space:]]+(restart|undo|pause|resume))([[:space:]]|$)' && block "cluster changes go through the GitOps repository and Argo CD"
hasx 'argocd[[:space:]]+(app[[:space:]]+(sync|rollback|set|delete|create|patch|terminate-op|actions)|proj|repo|cluster|account)' && block "Argo CD is changed through the GitOps repository; roll back from a PlatformNEX release session"
hasx 'helm[[:space:]]+(install|upgrade|rollback|uninstall|delete)' && block "releases go through the PlatformNEX Release flow"
hasx 'make[[:space:]]+[^;&|]*promote' && block "promotion happens in a PlatformNEX release session"

# --- access and secrets ---
hasx 'gcloud[^;&|]*(add-iam-policy-binding|set-iam-policy|remove-iam-policy-binding)' && block "IAM changes go through an IaC pull request"
hasx 'gcloud[^;&|]*service-accounts[[:space:]]+keys' && block "service account keys are prohibited"
hasx 'gcloud[[:space:]]+secrets[[:space:]]+(versions[[:space:]]+(access|add|destroy|disable)|create|delete|update)' && block "secrets are read and changed in a release's Configuration phase"
hasx 'gcloud[[:space:]]+auth[[:space:]]+(print-access-token|print-identity-token|application-default[[:space:]]+print-access-token)' && block "printing credentials"
hasx 'kubectl[^;&|]*[[:space:]]get[[:space:]]+secrets?([[:space:]/]|$)[^;&|]*(-o|--output)' && block "reading cluster secrets"
hasx '(gcloud|gsutil|bq|kubectl|argocd|helm)[^;&|]*[-_./=[:space:]](prod|production|stg)([^a-z0-9]|$)' && block "command targets staging or production"
hasx 'pnx[[:space:]]+dev[^;&|]*--env[=[:space:]]+(prod|production)([^a-z0-9]|$)' && block "pnx dev sessions never target production"

# --- local machine ---
has '(curl|wget)[^;&]*\|[[:space:]]*(sudo[[:space:]]+)?(ba|z|da)?sh([[:space:]]|$)' && block "piping a download into a shell"
has 'base64[^;&|]*(-d|--decode)[^;&]*\|[[:space:]]*(sudo[[:space:]]+)?(ba|z|da)?sh([[:space:]]|$)' && block "decoding text into a shell"
# shellcheck disable=SC2016
has 'rm[[:space:]]+(-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r)[a-z]*[[:space:]]+(/|~|\$HOME|\.git)([[:space:]/]|$)' && block "destructive rm"
has '(^|[[:space:];&|])sudo[[:space:]]' && block "sudo"
has '(cat|less|more|head|tail|grep|awk|sed|cp|base64|xxd)[^;&|]*[[:space:]/]\.env(\.local|\.pnx)?([^a-zA-Z0-9._-]|$)' && block "reading .env"
has '(cat|less|head|tail|cp|base64|scp)[^;&|]*(\.ssh/|\.config/(gcloud|pnx)|id_(rsa|ed25519)|\.pem([[:space:]]|$)|\.tfstate)' && block "reading keys, credentials, or state"
has '(^|[[:space:];&|])(printenv|env)[[:space:]]*($|[|>;&])' && block "dumping the environment"

exit 0
