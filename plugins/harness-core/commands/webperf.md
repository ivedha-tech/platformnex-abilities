---
description: Run a web performance audit via the web-performance-auditor persona
disable-model-invocation: true
---

`/webperf` is for web applications. Do not use it for utility libraries, CLIs, or server-only code with no browser-facing output.

## Pick the mode

**Deep mode** when any of these is available:
- A Lighthouse JSON report
- A PageSpeed Insights JSON response (lab plus field data)
- A CrUX field-data response
- A browser performance trace
- A live URL plus browser devtools tooling the harness can drive (the agent can then capture metrics itself)

**Quick mode** when none are available. The agent scans source for structural anti-patterns and labels every finding `potential impact`.

## Run the audit

Spawn the `web-performance-auditor` subagent (in a plugin install it may appear namespaced, for example `harness-core:web-performance-auditor`). Pass it explicitly:

- The files, components or diff under review
- Any artifact paths or pasted JSON
- The target URL or page name when known
- Which mode you expect, so it can flag missing inputs if Deep was intended

It returns a scorecard (only sourced values), ranked findings, positive observations and recommendations.

## Output

Return the full audit report to the user. No merge step; this is a single-persona command.
