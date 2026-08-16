# COMAC Agent Hub — Repository Instructions

## Read before coding

Read these files in order before changing code:

1. `docs/codex/00-Codex开工提示词-首期Hub-v1.2.md`
2. `docs/product/01-网页中枢UIUX设计基线-Codex执行版-v1.0.md`
3. `docs/product/02-AI导师Coach人格与交互规范-v1.0.md`
4. `docs/product/03-视觉参考使用说明.md`
5. `docs/product/04-阶段一活动配置待确认项.md`
6. Images under `docs/design-references/`
7. `config/activity.example.json`

## Source priority

When instructions conflict, follow this order:

1. This `AGENTS.md`
2. The phase-one Hub kickoff prompt
3. The Codex execution version of the UI/UX baseline
4. The AI Coach persona and interaction specification
5. The visual reference guide
6. The reference images
7. Example copy, labels, dates, numbers, avatars, and project names shown inside images

Never copy generated-image text or fictional metrics as product truth.

## Current milestone

Implement only the **phase-one public Hub and lightweight deterministic Coach preview**.

Do not expand the milestone into:

- a complete participant workbench;
- full Artifacts management;
- a reviewer scoring system;
- an organizer dashboard;
- backend, database, SSO, object storage, or real LLM integration;
- a Coding IDE, online debugger, model runtime, or benchmark executor;
- rankings, health scores, completion-rate dashboards, or fabricated activity statistics.

Later-phase concepts are context only. They are not implementation scope.

## Product non-negotiables

- Strong orchestration, weak intervention.
- One question per scene; one decision per scene.
- The current scene owns the visual focus.
- Business problem and evidence come before technical vocabulary.
- AI Coach is strict but constructive; it does not flatter the user.
- The platform does not perform Coding or large-scale testing.
- Evidence is expressed as claim—evidence—gap, not fake completion percentages.
- AI has process capability, not human decision authority.
- The visual language is a quiet cognitive canvas, not an enterprise cockpit.
- Motion must explain state change and support `prefers-reduced-motion`.

## Execution behavior

1. Inspect the repository, dependency versions, routes, styles, tests, and uncommitted work.
2. Prefer incremental changes. Never reset Git or overwrite unrelated work.
3. Create `IMPLEMENTATION_PLAN.md` before implementation.
4. After the plan, continue directly into implementation; do not stop for routine approval.
5. Ask only when external information genuinely blocks progress. Otherwise use reversible, configuration-driven defaults and record the decision.
6. Use real DOM, accessible components, and working interactions. Never use screenshots as implemented pages.
7. Keep public activity facts configurable. Unknown dates, links, departments, quotas, awards, or rules must remain explicitly pending.

## Validation before reporting completion

Run and report the actual results of all available checks:

- lint;
- typecheck;
- unit tests;
- production build;
- existing end-to-end tests;
- Playwright flows added for this milestone.

Do not claim success for a check that was not run or did not pass.
