# How to contribute to hydro-flow

hydro-flow is a 1-D flow-network modeling app. This page is the how-to for changing the repo.

## Branch from main

`main` is trunk. Keep it green.

1. Update main. `git fetch origin && git checkout main && git pull`
2. Create a branch. `git checkout -b feat/short-name`
3. Open a pull request against `main` before you merge.

Branch prefixes are `feat/`, `fix/`, `docs/`, `chore/`, `test/`, and `refactor/`. Cursor Cloud Agents may use `cursor/<name>-<id>`.

Do not push commits to `main`. For stacked work, the child pull request targets the parent branch, not `main`.

## Write commit messages

Use Conventional Commits in the form `type(scope): subject`.

Allowed types are `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, and `perf`. The subject is imperative and has no trailing period.

Example: `feat(solver): add darcy-weisbach pipe drop`

## Open a pull request

Fill `.github/PULL_REQUEST_TEMPLATE.md`. Keep Why, Scope, Tradeoffs, Blast Radius, and Verification.

One concern per pull request. Five small pull requests beat one large one.

CI must pass. The gates are `npm run check` and `npm test`.

## Run checks locally

```bash
npm install
npm run check
npm test
```

`npm run check` validates project JSON against `docs/schema/hydroflow.project.schema.json`, walks example graphs, and confirms the agent and pull-request files this repo needs.

`npm test` runs Vitest, including `tests/goldens.test.ts` against `tests/fixtures/goldens.json` (1% on flow).
