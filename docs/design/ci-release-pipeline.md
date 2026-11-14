# CI, Security & npm Release Pipeline: Implementation Plan

> Status: 🗺️ **Planned**. Nothing in this document exists yet unless a task in [§8](#8-prioritized-todo) is ticked.
> Tracked from [TODO.md](../../TODO.md) (Theme 7). Workflow rules: [AGENTS.md §0](../../AGENTS.md).

## 1. Decisions (approved)

| # | Decision | Choice |
|---|---|---|
| D1 | npm package name | **`@simorml/kid-lesson-games`** (scoped: cannot be squatted or typo-hijacked, tied to the owner account). Both names were free (404) on 2026-11-14. |
| D2 | New dev dependencies | **`publint`** and **`@arethetypeswrong/cli`** approved (CI-only, never shipped). Any other new dependency needs a fresh approval (AGENTS.md Gate 2). |
| D3 | Ordering | **Security basics first (P0–P1), npm shipping after (P2–P3).** Basics protect `main` at once and do not change what ships. |
| D4 | Local pre-commit secret hook | **Skipped.** Push protection plus CI gitleaks cover it, and hooks can be bypassed. |

## 2. Baseline (verified 2026-11-14)

- Only CI: [deploy-pages.yml](../../.github/workflows/deploy-pages.yml), on push to `main`. It does **not** test PRs. Actions pinned by tag (`@v4`), not SHA.
- GitHub (public repo): secret scanning, push protection and Dependabot security updates **disabled**; no rulesets or branch protection. `npm audit --omit=dev`: 0 vulnerabilities.
- Packaging: `"private": true`; no `LICENSE` file although `license: MIT`; `files` ships `src` + `games` (incl. 26 `*.test.ts`); `npm pack --dry-run` = 96 files, 467 kB; no `.d.ts` (`types` points to `src/index.ts`); `prepare` runs a full build on every install; no `engines`, `sideEffects`, `repository`.
- Missing: `SECURITY.md`, `.nvmrc`, `CODEOWNERS`, `dependabot.yml`, PR template, `.gitleaks.toml`.
- Pre-existing blocker (from [TODO.md](../../TODO.md) Theme 4): SSR import guard in `KidGameElement` (`src/`, needs its own approved PR) and `.d.ts` emission must land before un-privating.

## 3. Goals and non-goals

**Goals**: every PR is tested; secrets are blocked and detected; supply chain hardened; releases publish to npm with provenance, no long-lived token, human-approved, tag-triggered.

**Non-goals**: no game or `src/` logic changes (except the separate SSR guard PR, T-17); no monorepo/changesets tooling; no paid services; no lint/format tooling (separate decision).

## 4. Phase P0: repo settings (no code; owner approves each)

1. Enable **secret scanning + push protection** and **Dependabot security updates** (Settings → Code security).
2. Default workflow `GITHUB_TOKEN` permission: **read-only**; do not allow Actions to approve PRs.
3. **Ruleset on `main`**: PR required; required check `ci / verify` (added after P1 merges); linear history; block force-push and deletion; dismiss stale approvals; no direct pushes.
4. **Environment `npm-publish`** (created now, used in P3): required reviewer = owner; deployment restricted to `v*` tags.
5. npm account: 2FA enforced (auth-and-writes).

Verification: `gh api repos/SimoRML/kid-lesson-games --jq .security_and_analysis` shows `enabled`; a direct push to `main` is rejected.

## 5. Phase P1: PR CI and secret detection

### 5.1 `ci.yml`
- Triggers: `pull_request`, `push` to `main`. **Never `pull_request_target`.**
- `permissions: contents: read` at top; `concurrency` with cancel-in-progress; `timeout-minutes` on every job; `persist-credentials: false` on checkout.
- Matrix Node 22 and 24 (add `.nvmrc` = 24 and `engines.node`).
- Steps (mirror Gate 5): `npm ci --ignore-scripts` → `npx tsc --noEmit` → `npm test` → `npm run test:coverage` (artifact, no threshold yet) → `npm run build` → `npm run build:pages`.
- Soft warning (not failing, core PRs may legitimately touch it): `git diff --name-only origin/main -- src/`.
- Aggregate job **`verify`** (`if: always()`, fails if any `needs` failed/cancelled/skipped). It is the only check the ruleset requires, so job renames never lock out merges.
- **All actions pinned to a full commit SHA** with a `# vX.Y.Z` comment.

### 5.2 `security.yml` (secret + code scanning)
- **gitleaks**: pinned binary, checksum-verified (no org-licensed action); `fetch-depth: 0`; runs on PRs and weekly; fails on findings; SARIF to the Security tab.
- `.gitleaks.toml`: extend default rules; allowlist only lockfile integrity hashes and documented test fixtures (each entry commented).
- **CodeQL** (JS/TS) on PR + weekly; also catches the unsafe DOM sinks banned by AGENTS.md.
- **Dependency Review** on PRs: fail on high severity and GPL/AGPL licences.
- `npm audit --omit=dev --audit-level=high` as a failing check; full audit non-blocking.
- **OpenSSF Scorecard** weekly (report only).

### 5.3 Hygiene files
`.github/dependabot.yml` (weekly, grouped, `npm` + `github-actions`, cooldown a few days), `.github/PULL_REQUEST_TEMPLATE.md` (Gate 7 fields), `.github/CODEOWNERS` (`.github/**`, `package.json`, `src/**`, `vite.config.ts`), `SECURITY.md` (private reporting via GitHub Security Advisories; "secret leaked → rotate first, purge history only if needed"), `.gitignore` additions (`*.pem`, `*.key`, `.npmrc`).

Verification: `ci.yml` and `security.yml` syntax and workflows verified 100% green in live GitHub Actions runs; gitleaks 8.30.1 verified against entire repo commit history (0 leaks); planted secret test verified gitleaks detection (`RuleID: github-pat`); scratch branch cleanly deleted; `protect-main` ruleset active.

## 6. Phase P2: make the package publishable (still `private: true`)

- `LICENSE` (MIT; copyright holder to confirm with owner).
- **Type declarations**: `tsconfig.build.json` (`emitDeclarationOnly`, plain `tsc`, no plugin) → `dist/**/*.d.ts`; point `types` and `exports.types` there.
- **Trim tarball**: `files` = `dist`, `README.md`, `LICENSE`, `CHANGELOG.md`; drop `src`, `games` and every `*.test.ts`. Add `sideEffects` (the custom element registers on import), `repository`, `bugs`, `homepage`, `publishConfig: { access: "public", provenance: true }`, `engines`. Keep `./dist/*` export only if consumers need chunk paths.
- Replace `prepare: npm run build` with `prepack` so installs (including `npm ci`) no longer run a build.
- Rename package to `@simorml/kid-lesson-games`; update README, AGENTS.md §8.4 and install examples.
- CI additions: `publint` + `@arethetypeswrong/cli` on the packed tarball; **tarball smoke test** (install into a temp dir, `import()` in Node with a DOM-less guard, bundle with Vite).
- Prerequisite PR (separate, approved, touches `src/`): **SSR guard** for `KidGameElement`.

## 7. Phase P3: release and deploy hardening

### 7.1 `release.yml`
- Trigger: tag `v*.*.*` (+ `workflow_dispatch` with `dry_run`).
- **verify job**: full P1 pipeline on the tagged commit; assert tag == `package.json` version, tag commit is reachable from `main`, `CHANGELOG.md` has that version section.
- **publish job** (`needs: verify`, `environment: npm-publish` → human approval): `permissions: contents: write, id-token: write`; **npm Trusted Publishing (OIDC), no `NPM_TOKEN`**; publish the exact tarball that was smoke-tested, `npm publish --provenance --access public`.
- **Bootstrap caveat**: trusted publishing can only be configured on npmjs.com for an existing package. First publish may need a short-lived granular token stored only in the Environment, deleted right after the first release, then switch to OIDC.
- GitHub Release from the CHANGELOG section with the tarball + SHA-512 attached.
- Rollback: `npm deprecate` and ship a patch; `unpublish` only inside 72 h; never move or delete a tag.
- Remove `"private": true` only in the last PR of this phase, after a green `workflow_dispatch` dry run. Update AGENTS.md §0 (Gate 9), §9 and the cold-start list in the same PR.
- Start with an `rc` dist-tag; promote to `latest` after consumer smoke test.

### 7.2 `deploy-pages.yml`
SHA-pin actions, add `timeout-minutes`, deploy only after CI is green on `main`, scope `pages: write` / `id-token: write` to the deploy job only.

## 8. Prioritized TODO

Priority: **P0** = do first, blocks everything; **P1** = high; **P2** = packaging; **P3** = release. One PR per task unless noted; version numbers are bumped only by the Merger (Gate 9).

### P0: settings (owner action, no PR)
- [x] ✅ **T-01** Enable secret scanning + push protection + Dependabot security updates ([§4](#4-phase-p0-repo-settings-no-code-owner-approves-each)).
- [x] ✅ **T-02** Read-only default `GITHUB_TOKEN`; create `npm-publish` Environment (reviewer + `v*` tag rule).
- [x] ✅ **T-03** npm 2FA enforced on the publishing account.

### P1: CI + security (PRs; start here)
- [x] ✅ **T-04** `ci.yml` with `verify` aggregate job, SHA-pinned actions, `.nvmrc`, `engines.node` ([§5.1](#51-ciyml)).
- [x] ✅ **T-05** Ruleset on `main` requiring `ci / verify` (after T-04 is merged and has run once) ([§4](#4-phase-p0-repo-settings-no-code-owner-approves-each)).
- [x] ✅ **T-06** `security.yml`: gitleaks + `.gitleaks.toml`, CodeQL, Dependency Review, audit gate ([§5.2](#52-securityyml-secret--code-scanning)).
- [x] ✅ **T-07** Hygiene files: `dependabot.yml`, PR template, `CODEOWNERS`, `SECURITY.md`, `.gitignore` additions ([§5.3](#53-hygiene-files)).
- [x] ✅ **T-08** Verify with CI/security workflow executions, planted-secret detection test, and repo hygiene validation ([§5.3](#53-hygiene-files)).

### P2: publishable package
- [x] ✅ **T-09** `LICENSE` file (MIT, copyright `Simo (@SimoRML)`).
- [x] ✅ **T-10** `tsconfig.build.json` + `.d.ts` emission; repoint `types` ([§6](#6-phase-p2-make-the-package-publishable-still-private-true)).
- [x] ✅ **T-11** Trim `files`, add `sideEffects`/`repository`/`publishConfig`, swap `prepare` → `prepack`.
- [x] ✅ **T-12** Rename to `@simorml/kid-lesson-games` and update docs/install examples.
- [x] ✅ **T-13** Add `publint` + `@arethetypeswrong/cli` + tarball smoke test to CI.
- [x] ✅ **T-14** Remove unused `matter-js` + `@types/matter-js` (AGENTS.md §8.11; separate approved dependency PR).
- [x] ✅ **T-17** SSR guard in `src/core/KidGameElement.ts` (separate, explicitly approved `src/` PR; prerequisite of T-16).

### P3: release
- [x] ✅ **T-15** `release.yml` with verify + approval-gated OIDC publish + GitHub Release, dry-run only ([§7.1](#71-releaseyml)).
- [x] ✅ **T-18** Harden `deploy-pages.yml` ([§7.2](#72-deploy-pagesyml)).
- [ ] **T-16** Remove `"private": true`, update AGENTS.md §0/§9, first `rc` publish, configure Trusted Publisher on npmjs.com, promote to `latest`.

## 9. Risks and rollback

- **Lockout**: a required check that is renamed or never reports blocks merges. Mitigation: single stable `verify` job; ruleset added only after it has run (T-05 after T-04).
- **Irreversible publish**: a version number can never be reused. Mitigation: dry runs, `rc` tag, Environment approval, publish the smoke-tested tarball.
- **Tarball trimming** could break `src/` path consumers; acceptable while the package is private and unpublished.
- **Semver**: P0–P1 CI/docs = patch/no release; P2/P3 change the published shape = **MINOR** (still `0.x`). Every phase reverts as a PR; a bad release is deprecated and superseded.

## 10. Not verifiable until live

Real OIDC publish, Environment approval prompt, and ruleset enforcement against admins. They are exercised only by the first `rc` release.
