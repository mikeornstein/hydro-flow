import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCHEMA_PATH = join(ROOT, "docs/schema/hydroflow.project.schema.json");
const GOLDENS_PATH = join(ROOT, "tests/fixtures/goldens.json");
const EXAMPLES_DIR = join(ROOT, "examples");
const WORKFLOW_PATH = join(ROOT, ".github/workflows/ci.yml");
const PR_TEMPLATE_PATH = join(ROOT, ".github/PULL_REQUEST_TEMPLATE.md");
const SETTINGS_PATH = join(ROOT, ".cursor/settings.json");
const PSTACK_MODELS_PATH = join(ROOT, ".cursor/rules/pstack-models.mdc");
const CONTRIBUTING_PATH = join(ROOT, "CONTRIBUTING.md");
const AGENTS_PATH = join(ROOT, "AGENTS.md");

const REQUIRED_FILES = [
  "README.md",
  "AGENTS.md",
  "CONTRIBUTING.md",
  "package.json",
  "docs/MACROFLOW_RESEARCH.md",
  "docs/WORKFLOWS_AND_ACCEPTANCE.md",
  "docs/VERIFICATION_CASES.md",
  "docs/schema/hydroflow.project.schema.json",
  "tests/fixtures/goldens.json",
  "tests/fixtures/README.md",
  ".github/workflows/ci.yml",
  ".github/PULL_REQUEST_TEMPLATE.md",
  ".github/CODEOWNERS",
  ".cursor/settings.json",
  ".cursor/environment.json",
  ".cursor/rules/hydro-flow.mdc",
  ".cursor/rules/pstack-models.mdc",
  ".cursor/skills/verify-hydro-flow/SKILL.md",
];

const PR_HEADINGS = [
  "## Why",
  "## Scope",
  "## Tradeoffs",
  "## Blast Radius",
  "## Verification",
];

const PSTACK_ROLE_LINES = [
  "feature, refactoring:",
  "bug-fix:",
  "swarm workers:",
  "architect runners:",
  "interrogate reviewers:",
];

const BANNED_TASK_SLUGS = new Set(["grok-4.6-fast-xhigh"]);

let failed = 0;

function ok(msg) {
  console.log(`ok  ${msg}`);
}

function fail(msg) {
  failed += 1;
  console.error(`FAIL  ${msg}`);
}

function read(path) {
  return readFileSync(path, "utf8");
}

function parseJson(path) {
  try {
    return JSON.parse(read(path));
  } catch (err) {
    fail(`${path} is not valid JSON: ${err.message}`);
    return null;
  }
}

for (const rel of REQUIRED_FILES) {
  const path = join(ROOT, rel);
  if (existsSync(path)) ok(`exists ${rel}`);
  else fail(`missing ${rel}`);
}

const settings = parseJson(SETTINGS_PATH);
if (settings && settings.plugins?.pstack?.enabled !== true) {
  fail(".cursor/settings.json must set plugins.pstack.enabled to true");
} else if (settings) {
  ok("pstack enabled in .cursor/settings.json");
}

const env = parseJson(join(ROOT, ".cursor/environment.json"));
if (env && typeof env.install !== "string") {
  fail(".cursor/environment.json must have an install string");
} else if (env) {
  ok("environment.json has install");
}

const prTemplate = existsSync(PR_TEMPLATE_PATH) ? read(PR_TEMPLATE_PATH) : "";
for (const heading of PR_HEADINGS) {
  if (prTemplate.includes(heading)) ok(`PR template has ${heading}`);
  else fail(`PR template missing ${heading}`);
}

const contributing = existsSync(CONTRIBUTING_PATH) ? read(CONTRIBUTING_PATH) : "";
for (const needle of ["main", "Conventional Commits", "npm run check"]) {
  if (contributing.includes(needle)) ok(`CONTRIBUTING.md names ${needle}`);
  else fail(`CONTRIBUTING.md missing ${needle}`);
}

const agents = existsSync(AGENTS_PATH) ? read(AGENTS_PATH) : "";
for (const needle of ["poteto-mode", "npm run check", "hydroflow.project.schema.json"]) {
  if (agents.includes(needle)) ok(`AGENTS.md names ${needle}`);
  else fail(`AGENTS.md missing ${needle}`);
}

const workflow = existsSync(WORKFLOW_PATH) ? read(WORKFLOW_PATH) : "";
if (workflow.includes("pull_request:") && workflow.includes("npm run check")) {
  ok("CI workflow runs npm run check on pull_request");
} else {
  fail(".github/workflows/ci.yml must trigger on pull_request and run npm run check");
}

if (existsSync(PSTACK_MODELS_PATH)) {
  const models = read(PSTACK_MODELS_PATH);
  for (const lineStart of PSTACK_ROLE_LINES) {
    if (models.includes(lineStart)) ok(`pstack-models has ${lineStart.trim()}`);
    else fail(`pstack-models missing ${lineStart.trim()}`);
  }
  const seenSlugs = new Set();
  for (const line of models.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("---") || trimmed.startsWith("description:") || trimmed.startsWith("alwaysApply:")) {
      continue;
    }
    const idx = trimmed.indexOf(":");
    if (idx === -1) continue;
    const values = trimmed.slice(idx + 1).split(",").map((s) => s.trim()).filter(Boolean);
    for (const value of values) {
      if (BANNED_TASK_SLUGS.has(value)) {
        fail(`Task-uncallable slug ${value} on line: ${trimmed}`);
        continue;
      }
      if (!seenSlugs.has(value)) {
        seenSlugs.add(value);
        ok(`model slug ${value}`);
      }
    }
  }
}

const schema = parseJson(SCHEMA_PATH);
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validate = schema ? ajv.compile(schema) : null;

function checkProject(rel, project) {
  if (!project) return;
  if (validate) {
    if (!validate(project)) {
      fail(`${rel} fails schema: ${ajv.errorsText(validate.errors, { separator: "; " })}`);
    } else {
      ok(`${rel} matches schema`);
    }
  }

  const nodeIds = new Set();
  for (const node of project.nodes ?? []) {
    if (nodeIds.has(node.id)) fail(`${rel} duplicate node id ${node.id}`);
    nodeIds.add(node.id);
  }
  const linkIds = new Set();
  for (const link of project.links ?? []) {
    if (linkIds.has(link.id)) fail(`${rel} duplicate link id ${link.id}`);
    linkIds.add(link.id);
    if (!nodeIds.has(link.from)) fail(`${rel} link ${link.id} from unknown node ${link.from}`);
    if (!nodeIds.has(link.to)) fail(`${rel} link ${link.id} to unknown node ${link.to}`);
  }
  const fluids = project.fluids ?? {};
  const fluidIds = new Set(Object.keys(fluids));
  if (fluidIds.size === 0) fail(`${rel} needs a fluids map`);
  for (const [id, fluid] of Object.entries(fluids)) {
    if (typeof fluid?.rho !== "number" || typeof fluid?.mu !== "number") {
      fail(`${rel} fluid ${id} needs numeric rho and mu`);
    }
  }
  for (const node of project.nodes ?? []) {
    if (node.fluid && !fluidIds.has(node.fluid)) {
      fail(`${rel} node ${node.id} unknown fluid ${node.fluid}`);
    }
  }
  for (const link of project.links ?? []) {
    if (link.fluid && !fluidIds.has(link.fluid)) {
      fail(`${rel} link ${link.id} unknown fluid ${link.fluid}`);
    }
  }
  for (const coupling of project.couplings ?? []) {
    if (coupling.hotLinkId && !linkIds.has(coupling.hotLinkId)) {
      fail(`${rel} coupling ${coupling.id} unknown hot link ${coupling.hotLinkId}`);
    }
    if (coupling.coldLinkId && !linkIds.has(coupling.coldLinkId)) {
      fail(`${rel} coupling ${coupling.id} unknown cold link ${coupling.coldLinkId}`);
    }
  }
  ok(`${rel} graph ids resolve`);
  return { nodeIds, linkIds };
}

const exampleFiles = existsSync(EXAMPLES_DIR)
  ? readdirSync(EXAMPLES_DIR).filter((name) => name.endsWith(".hydroflow.json"))
  : [];
if (exampleFiles.length === 0) fail("no examples/*.hydroflow.json files");

const graphs = new Map();
for (const name of exampleFiles) {
  const rel = `examples/${name}`;
  const project = parseJson(join(EXAMPLES_DIR, name));
  graphs.set(rel, checkProject(rel, project));
}

const goldens = parseJson(GOLDENS_PATH);
if (goldens) {
  if (typeof goldens.tolerance?.flowRelative !== "number") {
    fail("goldens.json needs numeric tolerance.flowRelative");
  } else {
    ok(`golden flowRelative ${goldens.tolerance.flowRelative}`);
  }
  if (!Array.isArray(goldens.cases) || goldens.cases.length === 0) {
    fail("goldens.json needs a non-empty cases array");
  }
  for (const goldenCase of goldens.cases ?? []) {
    if (!goldenCase.id) fail("golden case missing id");
    if (goldenCase.file == null) {
      ok(`golden ${goldenCase.id} has no project file yet`);
      continue;
    }
    const graph = graphs.get(goldenCase.file);
    if (!existsSync(join(ROOT, goldenCase.file))) {
      fail(`golden ${goldenCase.id} file missing: ${goldenCase.file}`);
      continue;
    }
    ok(`golden ${goldenCase.id} file ${goldenCase.file}`);
    const expectedLinks = Object.keys(goldenCase.expected?.links ?? {});
    for (const linkId of expectedLinks) {
      if (!graph?.linkIds.has(linkId)) {
        fail(`golden ${goldenCase.id} expected link ${linkId} missing from ${goldenCase.file}`);
      }
    }
    const expectedNodes = Object.keys(goldenCase.expected?.nodes ?? {});
    for (const nodeId of expectedNodes) {
      if (!graph?.nodeIds.has(nodeId)) {
        fail(`golden ${goldenCase.id} expected node ${nodeId} missing from ${goldenCase.file}`);
      }
    }
    if (expectedLinks.length || expectedNodes.length) {
      ok(`golden ${goldenCase.id} ids match ${goldenCase.file}`);
    }
  }
}

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nall checks passed");
