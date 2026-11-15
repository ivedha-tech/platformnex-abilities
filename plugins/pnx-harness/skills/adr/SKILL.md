---
name: adr
description: Records an architecture decision (gate G2) as a numbered ADR in docs/adr/ with real options and the security, privacy and residency impact. Use when choosing between technologies or designs, adding a service, datastore or vendor, or changing auth or data flows.
---

# ADR (gate G2)

## Overview

An ADR records one decision, the options that were on the table and why one won. It stays Proposed until the tech lead approves the pull request.

## When to Use

- Choosing between technologies or designs
- Adding a component, datastore, queue or vendor
- Changing authentication, authorisation or a data flow across a trust or region boundary

## Process

1. Find the next number: list `docs/adr/` and add one. Use the repository's `docs/templates/adr.md` if it exists, otherwise `template.md` in this skill's directory.
2. Write `docs/adr/NNNN-<slug>.md`. Give at least two real options, including "do nothing" where it is plausible, with honest costs for the one you favour. harness-ship:documentation-and-adrs covers how to write the reasoning.
3. Fill "Security, privacy, residency impact". A new vendor or a cross-region data flow means security review; say so explicitly.
4. If the decision needs new infrastructure (a database, bucket, topic, identity), say that it arrives as an IaC pull request; PlatformNEX does not provision it and nobody applies it by hand.
5. Leave the status as **Proposed**.
6. If the decision changes a trust boundary, tell the user the threat model needs updating (`pnx-harness:threat-model`).

## Verification

- [ ] At least two options, each with costs
- [ ] The security, privacy and residency section is filled
- [ ] Status is Proposed
- [ ] New infrastructure is named, with the IaC pull request as the route
