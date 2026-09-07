# Feature map

Index of what an agent can prove today.

| Feature | File | Proof |
|---|---|---|
| Project files validate | [project-files.md](./project-files.md) | `npm run check` reports each `examples/*.hydroflow.json` matches the schema |
| Golden fixtures | [golden-fixtures.md](./golden-fixtures.md) | `npm test` (`tests/goldens.test.ts`) within 1% on Q |
| DLC worked example | `tests/dlcExample.test.ts` | HEX rejects 2800 W; conservation report passes |
