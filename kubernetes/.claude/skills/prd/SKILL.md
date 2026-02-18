---
name: prd
description: "Generate a Product Requirements Document (PRD) for a new feature. Use when planning a feature, starting a new project, or when asked to create a PRD. Triggers on: create a prd, write prd for, plan this feature, requirements for, spec out."
user-invocable: true
---

# PRD Generator

Create detailed Product Requirements Documents that are clear, actionable, and suitable for implementation by junior developers or AI agents.

## The Job

> **Placeholders used below:**
> - `<ticket>` — the Jira ticket number provided by the user (e.g., `OPS-1234`)
> - `<branch>` — derived from the ticket number + a short kebab-case slug of the feature description (e.g., `OPS-1234-ambient-mesh`)
>
> Substitute these placeholders with their actual values everywhere they appear.

### Phase 0: Environment Setup
1. Receive a feature description from the user.
2. Ask for the **Jira ticket number** (format: `OPS-####`) using **AskUserQuestion**.
3. Generate `<branch>` by combining `<ticket>` with a short, lowercase-kebab-case slug derived from the feature description (e.g., ticket `OPS-1234` + description "Deploy Ambient Mesh" → `OPS-1234-ambient-mesh`).
4. Update `.claude/settings.json`: set the value of `env.CLAUDE_CODE_TASK_LIST_ID` to `<branch>`.
5. Run:
   ```
   ln -sf ~/.claude/tasks/<branch> plans/<branch>
   ```
   (This creates both directories if needed and makes `plans/<branch>` a symlink to `~/.claude/tasks/<branch>`)

### Phase 1: Draft PRD (baseline)
1. If `plans/<branch>-prd.md` already exists, move it to `plans/archive/<branch>-prd.md` before continuing
2. Ask 3–5 clarifying questions using **AskUserQuestion** (focus on: problem/goal, core functionality, scope/boundaries, success criteria)
3. Generate a complete draft PRD following the [annotated example](#example-prd-annotated-reference) below
    - Must include **Design Considerations** and **Open Questions**
4. Save to `plans/<branch>-prd.md`

### Phase 2: Design refinement (questions + expand open questions)
1. Review the PRD's **Design Considerations** and ask a targeted series of design questions using **AskUserQuestion**
2. Append newly discovered questions to the **bottom of the Open Questions section** (keep existing; add an "Added in Phase 2" subsection)
3. Update `plans/<branch>-prd.md` with the refined design considerations and updated open questions

### Phase 3: Final refinement (answer all open questions + final pass)
1. Ask the user **all remaining Open Questions** using **AskUserQuestion**
2. Refine the PRD one final time based on the answers
3. Save the final version to `plans/<branch>-prd.md`

**Important:** Do NOT start implementing. Just create the PRD.

## Before Saving

- [ ] Phase 0 completed: `<branch>` chosen, `CLAUDE_CODE_TASK_LIST_ID` updated in `.claude/settings.json`, `plans/<branch>/` directory exists, symlink `~/.claude/tasks/<branch>` points to `plans/<branch>/`
- [ ] Phase 1 PRD includes all 9 sections, including Design Considerations and Open Questions
- [ ] Used **AskUserQuestion** in each phase as needed
- [ ] Incorporated user's answers into the PRD after each refinement phase
- [ ] Developer stories are small, specific, and follow story format in the [annotated example](#example-prd-annotated-reference) below
- [ ] Functional requirements are numbered (`OPSFR-###`) and unambiguous
- [ ] Any old `plans/<branch>-prd.md` is archived to `plans/archive/`
- [ ] Non-goals section defines clear boundaries
- [ ] Any newly discovered questions were appended to the bottom of **Open Questions** (with a phase marker)

---

# Example PRD (Annotated Reference)

> **[Guidance]** Brief description of the feature and the problem it solves.

## 1. Introduction/Overview

Standardize how we deploy and operate **Istio Ambient Mode** across clusters using our existing **Flux → Kustomize → HelmRelease** pattern.

Today, Ambient Mode components already exist in repo (`clusters/base/istio/*`) and are reconciled by Flux (`flux/<env>/istio.yaml`). What's missing is a single "golden path" PRD example that ties together:

- The install chain (istio-base → istiod → istio-cni → ztunnel)
- Namespace enrollment (`istio.io/dataplane-mode: ambient`)
- How to write/validate AuthorizationPolicies in Ambient Mode (L4 via ztunnel vs L7 via waypoint)

> **[Guidance]** Specific, measurable objectives (bullet list).

## 2. Goals

- Deploy Istio Ambient stack via Flux Kustomizations with all 4 components (`istio-base`, `istiod`, `istio-cni`, `ztunnel`) `Ready=True` in every target environment within one reconciliation cycle
- Reuse a single set of Kustomize bases in `clusters/base/istio/` across all environments — zero duplicated manifests per cluster
- Enroll at least one workload namespace into Ambient Mode via Git-managed Namespace manifest and confirm ztunnel interception within the same PR cycle
- All AuthorizationPolicies enforceable at the ztunnel layer without waypoint proxies
- Every policy change includes positive and negative validation

> **[Guidance]** Stories use the `<ticket>-##` prefix (zero-padded, two-digit). Each should be small enough to implement in one focused session.
> Format: `### <ticket>-##: [Title]` / `**Description:** As a [developer], I want [capability] so that [benefit].`
> Acceptance criteria must be concrete, testable, and indicate the "how." Good: "Running `kubectl get pods -n <namespace>` returns all expected pods in Ready state." Bad: "Pods are working."
> For Kubernetes stories, also include: suspend Flux before changes, document changes in `tasks/progress.txt`, validate before resuming Flux.

## 3. Developer Stories

### OPS-1234-01: Verify Flux Kustomization chain for Ambient stack
**Description:** As a developer, I want Flux to reconcile Ambient Mode in a safe, ordered way so the mesh components come up reliably.

**Acceptance Criteria:**
- [ ] Never operate on production; suspend Flux before applying changes
- [ ] Running `flux get kustomization -n flux-system | grep -E 'istio-base|istiod|istio-cni|ztunnel'` verifies Kustomizations are present
- [ ] Running `flux describe kustomization istiod -n flux-system` verifies `dependsOn: istio-base` is set for `istiod`
- [ ] Running `flux describe kustomization ztunnel -n flux-system` verifies `dependsOn: istio-cni` is set for `ztunnel`
- [ ] After reconciliation, `kubectl get pods -n istio-system` shows all Ambient Mode components (`istiod`, `ztunnel`, `istio-cni`) running in Ready state
- [ ] `kubectl get daemonset -n istio-system ztunnel` confirms ztunnel is deployed and the desired number of pods are available
- [ ] Sending test traffic (e.g., from a workload pod in an enrolled namespace) is routed correctly via Ambient mesh (demonstrates ambient interception is active)
- [ ] Attempts to communicate from a non-enrolled namespace do not traverse the mesh and are not intercepted (negative/behavior test)
- [ ] Relevant events appear in `kubectl logs -n istio-system <ztunnel-pod>` upon Ambient traffic, confirming real traffic is flowing through Ztunnel
- [ ] Validate deployment and correct behavior before resuming Flux
- [ ] Document all manifest applications and cluster changes in `tasks/progress.txt`

... continued with OPS-1234-02, OPS-1234-03, OPS-1234-04, OPS-1234-05... and so on.

> **[Guidance]** Numbered `OPSFR-#` list. Be explicit and unambiguous. Use infrastructure-oriented phrasing for infra PRDs, user-action phrasing for application PRDs.

## 4. Functional Requirements

- OPSFR-1: Each environment must have `flux/<env>/istio.yaml` defining Flux Kustomizations for the Ambient stack (`istio-base`, `istiod`, `istio-cni`, `ztunnel`) with correct `dependsOn` ordering.
- OPSFR-2: `clusters/base/istio/base/kustomization.yaml` must include the HelmRepository (`source.yaml`) and required namespaces (`namespace.yaml`, `ingress-namespace.yaml`).
- OPSFR-3: Ambient Mode must be enabled via Helm values (`values.profile: ambient`) for `istio-base`, `istiod`, and `istio-cni`.
- OPSFR-4: Namespace enrollment must be expressed as Namespace YAML with `istio.io/dataplane-mode: ambient`, committed under `clusters/<env>/namespaces/`, and referenced by that directory's Kustomize `kustomization.yaml`.
- OPSFR-5: AuthorizationPolicies intended for Ambient Mode must prefer L4 rules (`ports` + `principals`) so ztunnel can enforce them without requiring waypoint proxies.
- OPSFR-6: Validation for any policy change must include at least one negative test proving unauthorized access is denied.

> **[Guidance]** What this feature will NOT include. Critical for managing scope.

## 5. Non-Goals (Out of Scope)

- No blanket enrollment of all namespaces into Ambient Mode without explicit review (rollout is namespace-by-namespace)
- No L7 path/method/header authorization for workloads unless waypoint strategy is explicitly adopted
- No re-architecture of application Helm charts beyond what's required to support ambient enrollment (e.g., labels) for this PRD

> **[Guidance]** Address each of these categories where relevant:
> - High-level architecture overview (diagrams, if available)
> - Kubernetes considerations (namespaces, service types, cluster resources)
> - Application/component boundaries and responsibilities
> - Reuse of existing infrastructure or services
> - Security and network policies relevant to the design

## 6. Design Considerations

- **GitOps layering** (architecture overview):
  - Flux Kustomizations: `flux/<env>/istio.yaml` → point to `clusters/base/istio/*`
  - Kustomize overlays: `clusters/base/istio/**/kustomization.yaml` → compose YAML
  - HelmReleases: install Istio charts into `istio-system` (and create `istio-ingress` namespace)
- **Kubernetes considerations** (namespaces, resources):
  - `istio-system` for control plane and ztunnel
  - `istio-ingress` for ingress gateway components
  - Workload namespaces enrolled via `istio.io/dataplane-mode: ambient`
- **Component boundaries**:
  - `istiod` owns control plane logic (xDS, certificate issuance)
  - `ztunnel` is the per-node L4 data plane (DaemonSet); it enforces `ports` + `principals` policies — no sidecar required
  - `istio-cni` configures pod networking for ambient capture; must be ready before ztunnel
  - Waypoint proxies (optional, per-service) handle L7 enforcement — not deployed by default
- **Reuse of existing infrastructure**:
  - Istio HelmRepository (`source.yaml`) is shared across all components via `clusters/base/istio/base/`
  - Nonprod clusters use `clusters/base/istio/nonprod/ztunnel/` (custom resource limits); prod uses `clusters/base/istio/ztunnel/`
  - Namespace manifests reuse the existing `clusters/<env>/namespaces/` Kustomize pattern
- **Security and network policies**:
  - AuthorizationPolicies live in `clusters/<env>/networking/authorization-policies/` with a `kustomization.yaml` listing each policy
  - L7 attributes (`hosts`, `paths`, `methods`) require a waypoint proxy; without one, ztunnel silently ignores those rules

> **[Guidance]** Address each of these categories where relevant:
> - Known constraints or dependencies
> - Integration points with existing systems
> - Performance requirements

## 7. Technical Considerations

- **Version pinning**: `istiod` and other Istio components should ideally be aligned to a consistent chart version; today they may differ by component.
- **Rollout impact**: Applying `istio.io/dataplane-mode: ambient` requires restarting workloads for capture; this can impact app-level clustering (e.g., Orleans gateway connectivity on port 30000).
- **Waypoint caveats**: Waypoint routing can introduce 503/HBONE issues; L4-only (ports) policies can often be enforced directly by ztunnel without waypoints.
- **Flux behavior**: Flux reconciles from `main` and uses `prune: true`; deleted manifests will remove resources after merge.

> **[Guidance]** Quantitative, outcome-based metrics. Examples: "Reduce time to complete X by 50%", "Increase conversion rate by 10%".

## 8. Success Metrics

- 100% of Flux Kustomizations (`istio-base`, `istiod`, `istio-cni`, `ztunnel`) reach `Ready=True` within a single reconciliation cycle (< 10 min) per environment
- ztunnel DaemonSet achieves 100% node coverage (desired == available) with zero crash-loop restarts in the first 30 minutes after rollout
- Enrolled namespaces have zero application-impacting regressions (pod restarts, connection failures) within 1 hour of ambient enrollment and workload restart
- AuthorizationPolicy negative tests achieve a 100% deny rate for unauthorized principals — zero false-allows observed during validation

> **[Guidance]** Questions that must be answered to finalize scope/design/rollout. Keep existing questions across phases. Append additional questions discovered during refinement at the bottom (e.g., "Added in Phase 2", "Added in Phase 3").

## 9. Open Questions

- Should we standardize all Istio chart versions (`base`, `istiod`, `cni`, `ztunnel`) to a single pinned version?
- Which namespaces should be enrolled first beyond `default` (and why)?
- When (if ever) do we introduce waypoint proxies for L7 policies, given the known routing caveats?
