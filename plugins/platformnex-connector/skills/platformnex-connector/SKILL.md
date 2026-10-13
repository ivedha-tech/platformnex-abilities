---
name: platformnex-connector
description: Use when adding, wiring, or modifying a PlatformNEX integration (a new SaaS/cloud connector, plugin, or gateway route) in the platformnex-gateway monorepo — covers domain layering, the plugin scaffold, credential resolution (WIF-first for GCP), and env-var-only secrets. Also use when reviewing whether existing gateway/plugin code follows these conventions.
---

# PlatformNEX connector & gateway conventions

PlatformNEX is a pnpm/turbo monorepo (`platformnex-gateway`) of domain-scoped
Express gateways, each a thin orchestration layer over a set of **plugins** —
one plugin per external system (GitHub, Cloud Build, SonarQube, GCP
Monitoring, ...). This skill is the condensed rulebook for adding to it
correctly. It complements, not replaces, `docs/PLUGIN_SCAFFOLD.md` — read
that for the literal file template; this skill covers the architectural
rules that make a new connector fit the rest of the system.

## 1. Domain layering — a gateway runs exactly one domain

```
gateways/
  catalog-gateway/    owns Postgres (entities, environments, component config)
  devops-gateway/     domain: devops   (CI/CD, SCM, code quality, PM, AI code tools)
  sre-gateway/         domain: sre      (observability, monitoring, alerting)
  finops-gateway/      domain: finops   (cost, billing, forecasting)
  cloudops-gateway/    domain: cloudops (infra provisioning, IaC)
  data-aggregator-gateway/ domain: data (DORA metrics, cross-gateway aggregation)
```

Every plugin declares a single `domain` in its `PluginManifest`
(`@platformnex/shared-plugin-runtime`'s `PlatformDomain`). A gateway's
`PluginDomainRegistry` enforces that it can only register plugins matching
its own domain — a devops-gateway physically cannot run an SRE plugin. **When
adding a new connector, this is the first decision**: which one of
devops/sre/finops/cloudops/data does it belong to? That decides which
gateway's `src/index.ts` gets the new `import` + `.register(new XPlugin())`
line — never split a plugin across gateways, and never bypass the registry
to call a plugin from the wrong domain's gateway.

## 2. New connector = new package under `plugins/{capability}/{provider}/`

Follow `docs/PLUGIN_SCAFFOLD.md`'s directory/template exactly:
`plugins/{capability}/{provider}/src/{Provider}Plugin.ts`, package name
`@platformnex/plugin-{capability}-{provider}`, extends `BasePlugin`, declares
a `PluginManifest` (name, capability, provider, domain, credentialType,
credentialRequirements). This is the *only* place new third-party SDK
dependencies belong — gateways themselves stay "zero SDK imports," per every
gateway's `index.ts` header comment.

A plugin **never**: reads `process.env`, constructs its own logger,
resolves its own credentials, calls another plugin directly, or applies auth
middleware / formats HTTP responses. All of that is injected via
`PluginExecutionContext` (`ctx.logger`, `ctx.metadata`, `ctx.resolveCredential()`)
by the gateway's `PluginExecutor`. A plugin's `execute()` returns
`this.success(...)`/`this.failure(ErrorCodes.INTEGRATION_ERROR, ...)` — it
never throws to the executor. See `docs/PLUGIN_SCAFFOLD.md`'s "Rules Every
Plugin Must Follow" for the exhaustive ❌/✅ list.

Once built, wire it into exactly one gateway's `bootstrap()`:
```ts
const registry = new PluginDomainRegistry('devops')
  .register(new YourNewPlugin())
  // ...
```
and add a thin route in `src/routes/` that calls `executor.run(...)` —
routes stay orchestration-only, same as every existing route file.

## 3. Credentials — WIF-first for GCP, orchestrator-resolved for everything else

Every plugin **declares** what it needs (`credentialRequirements` in its
manifest); it never decides *how* that's supplied. The gateway's
`CredentialOrchestrator` (`@platformnex/platform-credentials`) resolves a
`CredentialRef` to a real value at call time via `ctx.resolveCredential()`,
trying providers in this priority order (`orchestrator.ts`'s
`DEFAULT_PROVIDERS`):

1. **`WorkloadIdentityFederationProvider`** (`wif://gcp/...`) — **preferred
   for every GCP-calling plugin.** Uses plain `new GoogleAuth()` with no key
   material: on Cloud Run this resolves via the service's attached SA
   through the metadata server; with no metadata server present (local dev)
   the same call transparently falls back to the operator's `gcloud auth
   application-default login` ADC — **one code path serves both
   environments**, no `if (dev) {...}` branch needed. Use
   `wif://gcp/<scope1>,<scope2>` for OAuth access tokens (Monitoring,
   BigQuery, Cloud Build, Cloud Run) or `wif://gcp/<audience>` (via
   `hints.targetAudience`) for ID tokens (service-to-service, e.g. NATS/
   orchestrator calls).
2. `ServiceAccountImpersonationProvider` — GCP migration stage only, not for
   new connectors.
3. `GitHubAppProvider`, `ApiKeyVaultProvider`, `OAuth2ClientCredentialsProvider`
   — non-GCP providers (GitHub App installation tokens, vault-stored API
   keys for SonarQube/Jira/etc., OAuth2 client-credentials M2M).
4. `LegacyCredentialAdapter` — **deprecated, inline-value fallback.** If a
   new connector's calls are landing here (check gateway logs for
   `CREDENTIAL_DEPRECATION`/`identityProviderType: legacy-adapter`), its
   `credentialRef` is malformed or it's being invoked with an ad-hoc
   inline value instead of a real ref — fix the ref, don't lean on this
   path.

Set a GCP plugin's manifest to `credentialType: 'gcp-workload-identity'`
(see `GcpMonitoringPlugin` for the reference shape) — not
`'gcp-service-account-key'`, which is the deprecated SA-JSON path being
phased out.

## 4. Secrets — env vars only, never hardcoded

- All real secrets (service URLs, bot creds, client id/secret, API keys)
  live in the **root `.env`** (gitignored — confirmed via `.gitignore`
  and `git check-ignore -v .env`), never in a tracked file.
- `docker-compose.yml` reads them via `${VAR_NAME}` interpolation — never a
  literal value inlined into a service's `environment:` block.
- Inside a gateway's `src/index.ts`/`src/routes/`, read env vars through
  `@platformnex/shared-config`'s `requireEnv(key, hint?)` /
  `optionalEnv(key, default)` / `optionalEnvBool(key, default)` — never
  `process.env[...]` directly, and never inside a plugin (rule 2).
- Adding a new secret: add it to `.env`, reference it via `${...}` in
  `docker-compose.yml` for whichever service needs it, read it with
  `requireEnv`/`optionalEnv` at the gateway layer, and pass it down as
  `PluginConfig.settings` at plugin `initialize()` if the plugin itself
  needs a non-credential setting (region, project id, ...) — credentials
  themselves still go through the orchestrator (rule 3), not `settings`.

## 5. Auth gating (JWT) is a separate concern from plugin credentials

`createJwtAuthMiddleware` (`@platformnex/shared-authentication`) gates *who can call
the gateway* (validates the caller's bearer JWT against
`AUTHORIZATION_SERVICE_URL`); the `CredentialOrchestrator` (rule 3) is about
*what the plugin uses to call the external system* on the caller's behalf.
Don't conflate them — a gateway can correctly validate a caller's JWT and
still fail with a real `INTEGRATION_ERROR` if the plugin's own GCP/GitHub/etc.
credential doesn't resolve. `AUTHORIZATION_SERVICE_URL` itself is the **bare
service host**, no `/api/v1` suffix — every caller (`jwt-middleware.ts`,
`rbac.ts`) appends its own `/api/v1/...` path; a URL that already includes
`/api/v1` double-prefixes and 404s.

## Quick checklist for "add connector X"

1. Pick the domain (devops/sre/finops/cloudops/data) → that's the gateway.
2. Scaffold `plugins/{capability}/{provider}/` per `docs/PLUGIN_SCAFFOLD.md`.
3. Manifest: `credentialType: 'gcp-workload-identity'` (+`credentialRequirements`
   with `wif://gcp/...`-shaped scopes) if it's a GCP API; otherwise the
   matching non-GCP `CredentialType`.
4. `execute()` uses only `ctx.resolveCredential()` / `ctx.logger` /
   `ctx.metadata` — no SDK-level env reads, no thrown errors.
5. Register the plugin in the target gateway's `bootstrap()`; add a thin
   route under `src/routes/` calling the executor.
6. Any new non-credential setting/secret → `.env` + `docker-compose.yml`
   `${VAR}` + `requireEnv`/`optionalEnv` at the gateway layer only.
7. Verify with a real token (see catalog-gateway's dev-only `GET /dev/token`)
   that the route returns real data or a real upstream error — never a 401
   from the JWT layer and never a `legacy-adapter` credential-audit log line.
