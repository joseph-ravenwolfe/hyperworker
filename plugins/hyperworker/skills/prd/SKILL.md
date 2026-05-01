---
name: prd
description: "Generate a Product Requirements Document (PRD) for a new feature. Use when planning a feature, starting a new project, or when asked to create a PRD. Triggers on: create a prd, write prd for, plan this feature, requirements for, spec out. Returns results only. Do not run in plan mode."
user-invocable: true
---

# PRD Generator

Create detailed Product Requirements Documents that are clear, actionable, and suitable for implementation by junior developers or AI agents.

## Sizing Guidance

Before drafting, assess the project scope to calibrate the number of tasks:

| Project scope           | Example                                 | Expected tasks |
|-------------------------|-----------------------------------------|----------------|
| Single feature / bugfix | Add a priority field to tasks           | 3–5            |
| Small feature set       | User auth + profile page                | 8–15           |
| Medium initiative       | New API service with DB, auth, and UI   | 15–30          |
| Large initiative        | Multi-service platform migration        | 30–60          |
| Major system overhaul   | Full infrastructure re-architecture     | 60–100+        |

Use the codebase size, number of affected systems, and integration points to pick the right band. When in doubt, aim for the upper end — more granularity doesn't hurt, but less granularity does. Tasks can always be consolidated, but vague mega-tasks produce poor agent output.

Present the estimated range to the user for confirmation before drafting.

## The Job

> **Placeholders used below:**
> - `<branch>` — today's date (`YYYYMMDD`) + a short kebab-case slug of the feature description (e.g., `20260415-ambient-mesh`)
>
> Substitute this placeholder with its actual value everywhere it appears.

### Phase 0: Environment Setup
1. Receive a feature description from the user. If you did not receive a description during skill invocation, use **AskUserQuestion** to ask for a brief description before continuing.
2. Generate `<branch>` automatically from the current git branch (expected format: `XXX-000-my-description`). If the current git branch is `main`, then use today's date + a short, lowercase-kebab-case slug derived from the feature description (e.g., "Deploy Ambient Mesh" on 2026-04-15 → `20260415-ambient-mesh`). Do not prompt for approval.

### Phase 1: Draft PRD
1. If `plans/<branch>-prd.md` already exists, move it to `plans/archive/<branch>-prd.md` before continuing
2. Explore the codebase to understand the current state relevant to the feature
3. Generate a complete draft PRD following the [annotated example](#example-prd-annotated-reference) below — do NOT ask clarifying questions first; produce the best draft you can from the description and codebase alone
    - Must include **Design Considerations** and **Open Questions**
4. Save to `plans/<branch>-prd.md`

### Phase 2: Design Interview
Interview the user relentlessly about every aspect of this plan until you reach a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one by one. For each question, provide your recommended answer.

Ask the questions one at a time using **AskUserQuestion**.

If a question can be answered by exploring the codebase, explore the codebase instead of asking.

After each answer (or batch of answers), update `plans/<branch>-prd.md` with the refined content. Continue until each branch of the design tree is resolved.

**Important:** Do NOT start implementing. Just create the PRD.

## Before Saving

- [ ] Phase 0 completed: `<branch>` chosen
- [ ] Phase 1 PRD includes all 9 sections, including Design Considerations and Open Questions
- [ ] Phase 2 interview resolved all Open Questions and refined the PRD accordingly
- [ ] Work items (stories, tasks, objectives, or requirements) are small, specific, and follow the [annotated example](#example-prd-annotated-reference) structure
- [ ] Functional requirements are numbered (e.g., `FR-###`) and unambiguous
- [ ] Any old `plans/<branch>-prd.md` is archived to `plans/archive/`
- [ ] Non-goals section defines clear boundaries
- [ ] All Open Questions resolved or explicitly deferred by the user

---

# ✨ Final Artifact Checklist

Before completing, use this checklist to validate all referenced artifacts and environment details exist and align. These actions must be taken.

- [ ] The `<branch>` value matches between Phase 0 and the saved `plans/<branch>-prd.md` filename.
- [ ] The file `plans/<branch>-prd.md` exists and contains the final PRD draft.
- [ ] If an older PRD exists for this branch, it has been archived to `plans/archive/<branch>-prd.md`.
- [ ] All checklist items under "Before Saving" have been individually checked.

---

# Example PRD (Annotated Reference)

> **[Guidance]** Brief description of the feature and the problem it solves.

## 1. Introduction/Overview

Build a **user notifications system** that delivers email notifications for important in-app events (mentions, status changes, system alerts) and lets users control which events they receive.

Today, users miss critical events because the app has no notification surface. This PRD defines the end-to-end pipeline: an API to enqueue notifications, a worker that consumes from SQS and sends via SES, a database to record delivery state, and two UI pages (inbox + preferences). The feature spans four stacks:

- **Terraform** — AWS infrastructure (SES, SQS, IAM)
- **PostgreSQL** — persistence for notifications and user preferences
- **Kubernetes + Flux** — deploying the worker via HelmRelease
- **TypeScript** — the worker, API, and frontend

> **[Guidance]** Specific, measurable objectives (bullet list).

## 2. Goals

- Users receive email notifications for defined event types within 60 seconds of the triggering event
- Users can opt out of all email notifications or specific event types via a preferences page
- Every notification attempt is persisted with delivery state (`pending` / `sent` / `failed` / `skipped`) for auditability
- Infrastructure is declaratively managed: AWS via Terraform, worker deployment via Flux HelmRelease
- Failed sends retry via SQS redrive; repeated failures land in a DLQ for inspection (no silent drops)

> **[Guidance]** Section 3 structures the deliverables. Outcomes, tasks, objectives, or functional requirements — whatever fits the work. The example below uses **Outcomes & Tasks**:
> - An **Outcome** is a one-sentence statement of what the user or system can do. No acceptance criteria.
> - A **Task** is a substantial, self-contained unit of work with three parts:
>   - **Description** — what needs to be built and why.
>   - **Approach** — the intended implementation path: which components/files to create, which libraries or patterns to use, and the key constraints or gotchas. Describe enough that an agent understands the intended solution; leave room for judgment on exact commands and implementation details.
>   - **Acceptance criteria** — verifiable outcomes that must hold when done. Phrase them as observable states ("migration applies cleanly", "pod is Ready", "GET returns paginated rows newest-first"), not assertions on literal command output. Keep the "prove it in the real environment" expectation — but let the agent choose the means.
>
> Do NOT script every shell invocation, pin exact command output strings, or write an "execute exactly as written, do not improvise" preamble. Treat the agent as a capable implementer following a brief, not a runbook.
>
> Use the `<branch>-##` prefix (zero-padded, two-digit) for tasks.
>
> **[Guidance]** Acceptance criteria must be **verified in the real environment** before a task is considered complete.
> The verification method depends on the domain:
>
> | Domain | Verification |
> |---|---|
> | Web UI | Clickable in a browser — navigate to the feature, exercise the happy path and at least one edge case |
> | Kubernetes | `kubectl apply` (or Flux reconcile) succeeds, then `kubectl get/describe` confirms the expected state |
> | Terraform | `terraform plan` shows the expected diff, `terraform apply` succeeds, resource exists in the provider console |
> | Database | Migration runs, connection confirmed, query returns expected results |
> | API | Endpoint responds with correct status and payload (e.g., `curl` or integration test) |
>
> If the domain is not listed, derive an equivalent: **actually run the thing, observe the result, confirm it matches the acceptance criteria.**
> Never mark a task done based solely on "the code looks right" — proof of execution is required.

## 3. Outcomes & Tasks

### Outcome A

*Users receive email notifications for important events.*

#### <branch>-01: Provision notification infrastructure via Terraform

**Description:** As a platform engineer, I need the notification pipeline's cloud infrastructure provisioned reproducibly so the worker has a queue to consume from, an SES identity to send from, and an IAM role it can assume.

**Approach:** Add a new Terraform module under `terraform/modules/notifications/` that provisions the SES domain identity + DKIM, a main SQS queue, a DLQ with redrive (`maxReceiveCount` around 5), and an IAM role assumable via IRSA by the worker's Kubernetes ServiceAccount. Expose queue URL, queue/DLQ ARNs, role ARN, and SES identity ARN as module outputs. Follow the repo's existing module layout (`main.tf` / `variables.tf` / `outputs.tf` / `README.md`) and backend conventions.

**Acceptance criteria:**
- [ ] Module plans and applies cleanly against staging with the expected set of new resources and no unrelated drift.
- [ ] SES domain identity reports a verified status.
- [ ] A test message round-trips through the main SQS queue.
- [ ] The IAM role's trust policy permits assumption via the cluster's IRSA OIDC provider.
- [ ] Module README documents inputs, outputs, and how to re-verify the checks above.

#### <branch>-02: Create database schema for notifications + user_preferences

**Description:** As a backend engineer, I need persistent tables to record outbound notifications and per-user delivery preferences so the worker has somewhere to write delivery state and the API has somewhere to read inbox + preferences from.

**Approach:** Add a migration that creates two tables:
- `notifications` — one row per enqueue attempt, keyed by a BIGSERIAL id, with `user_id`, `event_type`, `payload` (JSONB), `status` (one of `pending` / `sent` / `failed` / `skipped`, enforced by a CHECK), `attempt_count`, `last_error`, `created_at`, and `sent_at`.
- `user_preferences` — one row per user (`user_id` PK), with `email_enabled` (default true), `event_type_optouts` (TEXT[]), and `updated_at`.

Add indexes to support the inbox query (`user_id, created_at DESC`) and the worker's status polling (`status, created_at`). Provide a clean `-- Down` that drops both tables in reverse order. Use the repo's existing migration runner.

**Acceptance criteria:**
- [ ] Migration applies cleanly against staging; both tables exist with the expected columns, defaults, constraints, and indexes.
- [ ] A round-trip insert into `notifications` succeeds with defaults populated as expected.
- [ ] `-- Down` rolls both tables back cleanly and the migration re-applies.
- [ ] `db/README.md` documents how to run migrations against staging.

#### <branch>-03: Build notification-worker service (TypeScript)

**Description:** As a backend engineer, I need a long-running TypeScript service that consumes notification jobs from SQS, renders email content from templates, sends via SES, and persists delivery state to the database — so users actually receive notifications and we have an auditable record of every send attempt.

**Approach:** New service at `services/notification-worker/` built on the AWS SDK v3 (`client-sqs`, `client-ses`) and `pg`. Long-poll SQS; each message body is `{ notificationId: number }` (the DB row id, for idempotency). For each message: load the notification row, render the template for its `event_type` from `src/templates/`, send via SES, and update the row — `sent` on success; `failed` with an incremented `attempt_count` and populated `last_error` on failure, then rethrow so SQS redrives. Only delete the SQS message on success. Containerize with a Dockerfile. Cover success, missing-row, and SES-failure paths in unit tests with mocked AWS clients.

**Acceptance criteria:**
- [ ] Unit tests pass; the build produces a clean `dist/`.
- [ ] Local end-to-end against staging SQS/DB: enqueuing a notification row + SQS message results in `status='sent'` and a logged success within ~30s.
- [ ] Failure path: an enqueued row with a bad or missing template ends up `status='failed'` with a populated `last_error`, and the SQS message is redriven after the visibility timeout.
- [ ] Container image builds.
- [ ] README covers required env vars and local-dev steps.

#### <branch>-04: Deploy notification-worker to Kubernetes via Flux HelmRelease

**Description:** As a platform engineer, I need the notification-worker running in the staging cluster behind Flux so it consumes jobs from SQS reproducibly, with declarative config in Git and no manual `kubectl apply` drift.

**Approach:** Add a Helm chart at `charts/notification-worker/` and a Flux HelmRelease under `clusters/base/notification-worker/` (namespace, HelmRepository, HelmRelease, IRSA-annotated ServiceAccount, Kustomization). Staging-specific values (image tag, SQS URL, region, `DATABASE_URL` from a Secret) live under `clusters/staging/notification-worker/`. Wire a Flux Kustomization in `flux/staging/notification-worker.yaml`. Honor the **Flux suspend → apply → validate → resume** protocol — suspend before any cluster change, apply manually, validate, then resume. Record cluster actions in `tasks/progress.txt` per the hyperworker Kubernetes protocol.

**Acceptance criteria:**
- [ ] Worker pod becomes Ready in the `notifications` namespace on staging.
- [ ] Pod picks up the IRSA role ARN from the ServiceAccount annotation.
- [ ] A notification enqueued end-to-end (per task 03) is processed to `status='sent'` within ~60s, visible in pod logs and the DB.
- [ ] After resume, the Flux Kustomization reports `Ready=True` with no drift.
- [ ] Suspend/apply/resume actions and QA evidence are recorded in `tasks/progress.txt`.

#### <branch>-05: Implement notifications API endpoints (TypeScript)

**Description:** As a backend engineer, I need HTTP endpoints that let clients enqueue notifications and read a user's inbox — so the frontend can trigger sends and render a user's notification history.

**Approach:** Add `apps/api/src/routes/notifications.ts` with two endpoints:
- `POST /notifications` — Zod-validated body (`userId`, `eventType`, `payload`), insert a `pending` row, enqueue an SQS message (`{ notificationId }`), return 201 with the new id.
- `GET /notifications` — authenticated, cursor-paginated (last-seen id), newest-first, returns `{ notifications, nextCursor }`.

Wire into the existing router. Cover the round-trip (POST → row → SQS message), cursor pagination correctness, and auth rejection in integration tests against the ephemeral test DB (`docker-compose.test.yml`).

**Acceptance criteria:**
- [ ] Integration tests pass; build is clean.
- [ ] `POST /notifications` inserts a row, enqueues the message, and returns 201 with `{ id }`.
- [ ] `GET /notifications` returns items newest-first, respects `limit`, and pages correctly via `cursor` until `nextCursor` is null.
- [ ] Unauthenticated requests are rejected.
- [ ] `apps/api/README.md` documents the endpoints with example requests.

#### <branch>-06: Build inbox UI page (TS frontend)

**Description:** As a frontend engineer, I need a web page where users view their notifications in reverse chronological order with infinite scroll — so users have a visible surface for the notifications the system is already delivering.

**Approach:** Add a Next.js app-router page at `apps/web/src/pages/inbox/page.tsx` backed by a `useNotifications` React Query hook that calls `GET /notifications`. Render event type, payload summary, relative timestamp, and a read/unread indicator. Use the existing design tokens under `apps/web/src/styles/` — no new CSS frameworks. Implement infinite scroll via the returned `nextCursor`. Cover the happy path in a Playwright e2e test.

**Acceptance criteria:**
- [ ] E2E test passes; build has no TS or Next errors.
- [ ] Browser: with ~25 seeded notifications, the page renders newest-first and loads subsequent batches on scroll.
- [ ] Empty state: with no notifications for the user, the page renders a clear empty-state message (not a blank page, spinner, or error).

### Outcome B

*Users control which notifications they receive.*

#### <branch>-07: Implement preferences API + worker preference check

**Description:** As a backend engineer, I need endpoints to read and update a user's notification preferences AND the worker to honor those preferences at send time — so users' opt-outs actually prevent sends, not just persist to the DB.

**Approach:** Add `apps/api/src/routes/preferences.ts`:
- `GET /preferences` — return the user's row, or defaults (`email_enabled: true`, `event_type_optouts: []`) when absent; do not insert on read.
- `PUT /preferences` — Zod-validated partial body, UPSERT, return the updated row.

Update the worker handler to consult preferences **before** calling SES: if `email_enabled === false`, or the notification's `event_type` is in `event_type_optouts`, mark the row `status='skipped'` and return without sending. A missing `user_preferences` row defaults to all-enabled.

**Acceptance criteria:**
- [ ] API and worker tests pass; both build clean.
- [ ] `GET /preferences` returns defaults for a user with no row and does not create one on read.
- [ ] `PUT /preferences` upserts and a subsequent GET reflects the change.
- [ ] With `email_enabled=false`, an enqueued notification ends up `status='skipped'` and SES send stats show no new send from the identity for that window.

#### <branch>-08: Build preferences UI page (TS frontend)

**Description:** As a frontend engineer, I need a web page where users toggle email on/off and opt out of specific event types — so users can self-serve their notification preferences without admin intervention.

**Approach:** Add `apps/web/src/pages/preferences/page.tsx` backed by a `usePreferences` query and a `useUpdatePreferences` mutation (optimistic update, cache invalidation on settle). UI: one toggle for `email_enabled`, plus a toggle per event type (from a fixed `EVENT_TYPES` const in `apps/web/src/lib/notifications.ts`) bound to membership in `event_type_optouts`. Save button disables while in-flight and surfaces success/failure via toasts. Use existing design tokens. Cover the toggle-save-reload flow in a Playwright e2e test.

**Acceptance criteria:**
- [ ] E2E test passes; build has no errors.
- [ ] Browser: toggling "Email notifications" off and saving persists across reload.
- [ ] End-to-end skip: with email off, an enqueued notification ends up `status='skipped'`; after re-enabling, a new enqueue is `status='sent'`.

> **[Guidance]** Numbered `FR-#` list. Be explicit and unambiguous. State invariants the system must hold, not implementation steps.

## 4. Functional Requirements

- FR-1: A `notifications` table persists every enqueue attempt with columns for user, event type, payload, status, attempt count, and last error.
- FR-2: A `user_preferences` table stores per-user email opt-out and per-event-type opt-out lists, defaulting (when absent) to all events enabled.
- FR-3: AWS infrastructure (SES identity, SQS queue + DLQ, IAM role) is provisioned via a single Terraform module with environment-scoped var files.
- FR-4: The notification-worker MUST check user preferences before calling SES and MUST mark `status='skipped'` without sending when the user has opted out.
- FR-5: Worker failures MUST propagate to SQS so messages redrive; after `maxReceiveCount=5` attempts they land in the DLQ.
- FR-6: The API exposes `POST /notifications` (enqueue), `GET /notifications` (inbox with cursor pagination), `GET /preferences`, and `PUT /preferences`.
- FR-7: The worker is deployed to Kubernetes via a Flux HelmRelease in `clusters/base/notification-worker/`, with env-specific overlays in `clusters/<env>/notification-worker/`.
- FR-8: Every initial cluster rollout MUST follow the Flux suspend → apply → validate → resume protocol — never apply directly to a Flux-managed resource without first suspending.

> **[Guidance]** What this feature will NOT include. Critical for managing scope.

## 5. Non-Goals (Out of Scope)

- No in-app push notifications — email only for this PRD.
- No SMS channel — SES email only.
- No rich HTML templates beyond the minimal set in `services/notification-worker/src/templates/` — richer templates are a follow-up.
- No scheduled or delayed sends — every enqueue is sent as soon as the worker picks it up.
- No multi-region SES failover — staging and prod each use a single region.
- No admin UI for sending notifications on behalf of users — automated pipeline only.

> **[Guidance]** Address each of these categories where relevant:
> - High-level architecture overview (diagrams, if available)
> - Kubernetes considerations (namespaces, service types, cluster resources)
> - Application/component boundaries and responsibilities
> - Reuse of existing infrastructure or services
> - Security and network policies relevant to the design

## 6. Design Considerations

- **Pipeline topology:** API → `notifications` row (`status=pending`) + SQS message → worker → SES → `notifications` row (`status=sent|failed|skipped`). The DB row is the source of truth; SQS is transport.
- **Idempotency:** The worker uses `notificationId` (DB row id) as the SQS message body so redelivery always targets the same row. Multiple receives update the same row; `attempt_count` increments.
- **Preference checks happen at send time**, not enqueue time, so preference changes apply to already-queued messages.
- **Kubernetes:** `notifications` namespace holds the worker Deployment + ServiceAccount. IRSA (`eks.amazonaws.com/role-arn` annotation) grants AWS access — no static credentials.
- **Component boundaries:**
  - API (`apps/api`) owns enqueue + inbox + preferences endpoints.
  - Worker (`services/notification-worker`) owns template rendering, SES send, and status transitions.
  - Frontend (`apps/web`) owns inbox + preferences UI.
  - Terraform module (`terraform/modules/notifications`) owns AWS resources.
- **Reuse of existing infrastructure:** Flux HelmRelease pattern, existing Postgres cluster, existing `apps/api` router, existing Next.js app router, existing React Query + design tokens.
- **Safe staging:** All Kubernetes changes go through Flux suspend → manual apply → validate → resume, per the hyperworker Kubernetes Testing protocol.

> **[Guidance]** Address each of these categories where relevant:
> - Known constraints or dependencies
> - Integration points with existing systems
> - Performance requirements

## 7. Technical Considerations

- **SES sandbox:** New SES identities start in sandbox mode (200 emails/day, verified recipients only). Staging verification is sufficient for QA; prod rollout requires a separate SES production-access request.
- **DLQ alerting:** DLQ depth is a leading indicator of systemic failure. A CloudWatch alarm on `ApproximateNumberOfMessagesVisible > 0` is a follow-up task; out of scope here.
- **Preference row default:** A missing `user_preferences` row is treated as all-defaults-enabled. Rows are upserted lazily on first `PUT`.
- **Pagination:** Inbox uses cursor pagination (last-seen id) rather than offset to avoid the shifting-window problem on high-write users.
- **Test DB isolation:** API integration tests run against an ephemeral Postgres spun up via `docker compose -f docker-compose.test.yml`.
- **Flux prune:** Flux reconciles from `main` with `prune: true`; deleted manifests will remove cluster resources after merge.

> **[Guidance]** Quantitative, outcome-based metrics. Examples: "Reduce time to complete X by 50%", "Increase conversion rate by 10%".

## 8. Success Metrics

- 95% of notifications reach `status='sent'` within 60 seconds of enqueue, measured over a 24-hour window in staging
- DLQ depth remains at 0 during normal operation; any non-zero depth triggers a manual inspection
- Preference updates propagate to the worker's send decision within one message (no caching staleness)
- Zero unauthorized sends: notifications for users with `email_enabled=false` MUST show `status='skipped'` in 100% of cases (measured by a daily SQL audit)

> **[Guidance]** Questions that must be answered to finalize scope/design/rollout. These will be resolved during the Phase 2 Design Interview.

## 9. Open Questions

- Which initial event types should ship with templates (mentions, status changes, system alerts — any others)?
- Is there an existing internal Helm repository the HelmRelease should source from, or do we need to set one up?
- Should preference changes trigger re-evaluation of already-queued notifications (cancel in-flight opt-outs), or only affect future enqueues?
- What's the retention policy for `notifications` rows — keep all history indefinitely, or prune after N days?
