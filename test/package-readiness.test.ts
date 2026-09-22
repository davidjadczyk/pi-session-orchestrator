import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";

// @ts-expect-error The executable JavaScript helper exposes a tested ESM API.
import { validatePackFiles } from "../scripts/verify-pack.mjs";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

test("package readiness has exact legal and public metadata", () => {
  const manifest = JSON.parse(read("package.json"));
  assert.equal(read("LICENSE").match(/Copyright \(c\) 2026 David Jadczyk/g)?.length, 1);
  assert.equal(manifest.name, "pi-session-orchestrator");
  assert.equal(manifest.version, "0.2.0");
  assert.match(manifest.version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/);
  const lockfile = JSON.parse(read("package-lock.json"));
  assert.equal(lockfile.version, manifest.version);
  assert.equal(lockfile.packages[""].version, manifest.version);
  assert.equal(manifest.license, "MIT");
  assert.equal(manifest.private, undefined);
  assert.deepEqual(manifest.repository, { type: "git", url: "git+https://github.com/davidjadczyk/pi-session-orchestrator.git" });
  assert.equal(manifest.bugs.url, "https://github.com/davidjadczyk/pi-session-orchestrator/issues");
  assert.equal(manifest.homepage, "https://github.com/davidjadczyk/pi-session-orchestrator");
  assert.deepEqual(manifest.publishConfig, { access: "public", registry: "https://registry.npmjs.org/" });
  assert.deepEqual(manifest.keywords, ["pi", "pi-extension", "pi-package", "orchestration", "session-coordination"]);
  assert.deepEqual(manifest.pi, {
    extensions: ["./src/index.ts"],
    image: "https://raw.githubusercontent.com/davidjadczyk/pi-session-orchestrator/main/assets/pi-session-orchestrator-thumbnail-pi-sessions.png",
  });
  assert.equal(manifest.engines.node, ">=22.19.0");
  assert.deepEqual(manifest.files, ["src/", "README.md", "LICENSE", "assets/pi-session-orchestrator-thumbnail-pi-sessions.png", "docs/"]);
});

test("Pi runtime packages are peers and remain development-installed", () => {
  const manifest = JSON.parse(read("package.json"));
  const lockfile = JSON.parse(read("package-lock.json"));
  assert.deepEqual(manifest.peerDependencies, {
    "@earendil-works/pi-coding-agent": "*",
    typebox: "*",
  });
  assert.equal(manifest.dependencies, undefined);
  assert.equal(manifest.devDependencies.typebox, "1.3.7");
  assert.deepEqual(lockfile.packages[""].peerDependencies, manifest.peerDependencies);
  assert.equal(lockfile.packages[""].dependencies, undefined);
  assert.equal(lockfile.packages[""].devDependencies.typebox, "1.3.7");
  assert.equal(lockfile.packages["node_modules/typebox"].dev, true);
});

test("lockfile and CI install only from the public npm registry", () => {
  const lockfile = JSON.parse(read("package-lock.json"));
  for (const [packagePath, packageMetadata] of Object.entries(lockfile.packages) as [string, { resolved?: string }][]) {
    if (!packageMetadata.resolved) continue;
    assert.equal(new URL(packageMetadata.resolved).origin, "https://registry.npmjs.org", `${packagePath} must resolve from public npm`);
  }

  const workflow = read(".github/workflows/ci.yml");
  const setupNode = workflow.indexOf("uses: actions/setup-node@");
  const registry = workflow.indexOf("registry-url: https://registry.npmjs.org");
  assert.ok(setupNode >= 0);
  assert.ok(setupNode < registry);
  assert.ok(registry < workflow.indexOf("npm ci"));
});

test("reference and contributor documents expose stable and exploratory boundaries", () => {
  assert.match(read("CONTRIBUTING.md"), /npm test/);
  assert.match(read("CONTRIBUTING.md"), /npm run build/);
  assert.match(read("CONTRIBUTING.md"), /verify-pack/);
  assert.match(read("CODE_OF_CONDUCT.md"), /report/i);
  assert.match(read("docs/README.md"), /Stable documentation/);
  assert.match(read("docs/README.md"), /Exploratory documentation/);
  assert.match(read("docs/README.md"), /prompt-injection\.md/);
  assert.match(read("docs/README.md"), /pi-intercom\.md/);
  assert.match(read("docs/README.md"), /release-version-preparation\.md/);
  assert.match(read("docs/reference/README.md"), /Stable current behavior/);
  assert.match(read("docs/reference/README.md"), /Exploratory/);
  const brief = read("docs/reference/fast-decision-model.md");
  assert.match(brief, /exploratory/i);
  assert.match(brief, /intent/i);
  assert.match(brief, /candidate decision flow/i);
  assert.match(brief, /open questions/i);
  assert.match(brief, /not a runtime commitment/i);
  const readme = read("README.md");
  const relativeDocumentLinks = [...new Set([...readme.matchAll(/(?:href="|\]\()(?:\.\/)?(docs\/[^\")]+\.md)/g)].map((match) => match[1]))];
  assert.deepEqual(relativeDocumentLinks.sort(), ["docs/README.md", "docs/pi-intercom.md", "docs/prompt-injection.md", "docs/release-version-preparation.md"]);
  const manifest = JSON.parse(read("package.json"));
  assert.ok(manifest.files.includes("docs/"));
  for (const document of relativeDocumentLinks) assert.ok(existsSync(join(root, document)), `${document} must be packaged with the README`);
  const repositoryUrl = "https://github.com/davidjadczyk/pi-session-orchestrator/blob/main/";
  for (const repositoryOnlyPath of ["CONTRIBUTING.md", "CODE_OF_CONDUCT.md", ".github/ISSUE_TEMPLATE/bug_report.yml", ".github/ISSUE_TEMPLATE/feature_request.yml"]) {
    assert.match(readme, new RegExp(`${repositoryUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}${repositoryOnlyPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    assert.doesNotMatch(readme, new RegExp(`(?:href="|\\]\\()\\.?/?${repositoryOnlyPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  }
  assert.match(readme, /orchestrator:coordinator/);
  assert.match(read("docs/pi-intercom.md"), /not a dependency/);
  assert.match(read("docs/release-version-preparation.md"), /Major/);
  assert.match(read("docs/release-version-preparation.md"), /Before 1\.0/);
  assert.match(read("docs/release-version-preparation.md"), /separate authorization/);
});

test("pack policy accepts complete consumer contents", () => {
  const files = ["package.json", "README.md", "LICENSE", "assets/pi-session-orchestrator-thumbnail-pi-sessions.png", "src/index.ts", "src/binding.ts", "src/model.ts", "src/prompt.ts", "src/state.ts", "src/tools.ts", "docs/README.md", "docs/prompt-injection.md", "docs/pi-intercom.md", "docs/release-version-preparation.md", "docs/reference/README.md", "docs/reference/coordination-model.md", "docs/reference/operational-boundaries.md", "docs/reference/fast-decision-model.md"];
  assert.deepEqual(validatePackFiles(files), []);
});

test("pack policy requires the README thumbnail asset", () => {
  const files = ["package.json", "README.md", "LICENSE", "src/index.ts", "src/binding.ts", "src/model.ts", "src/prompt.ts", "src/state.ts", "src/tools.ts"];
  assert.ok(validatePackFiles(files).includes("missing required file: assets/pi-session-orchestrator-thumbnail-pi-sessions.png"));
});

test("direct verifier execution from a path with spaces runs npm pack", () => {
  const directory = mkdtempSync(join(tmpdir(), "verify pack space-"));
  const script = join(directory, "verify pack.mjs");
  try {
    copyFileSync(join(root, "scripts/verify-pack.mjs"), script);
    const output = execFileSync(process.execPath, [script], { cwd: root, encoding: "utf8" });
    assert.match(output, /^package\.json$/m);
    assert.match(output, /^assets\/pi-session-orchestrator-thumbnail-pi-sessions\.png$/m);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("pack policy reports missing required and prohibited files", () => {
  const missing = validatePackFiles(["package.json", "README.md", "LICENSE", "src/index.ts"]);
  assert.ok(missing.some((issue: string) => issue.includes("src/binding.ts")));
  const prohibited = validatePackFiles(["package.json", "README.md", "LICENSE", "src/index.ts", "test/index.test.ts", ".github/workflows/ci.yml", "openspec/changes/x/spec.md", "scripts/verify-pack.mjs", "tsconfig.json"]);
  for (const path of ["test/index.test.ts", ".github/workflows/ci.yml", "openspec/changes/x/spec.md", "scripts/verify-pack.mjs", "tsconfig.json"]) assert.ok(prohibited.some((issue: string) => issue.includes(path)));
  assert.ok(validatePackFiles(["package.json", "README.md", "LICENSE", "assets/pi-session-orchestrator-thumbnail-pi-sessions.png", "src/index.ts", "src/binding.ts", "src/model.ts", "src/prompt.ts", "src/state.ts", "src/tools.ts", "docs/unreviewed.md"]).includes("outside consumer boundary: docs/unreviewed.md"));
});

test("publish workflow is main-bound, tag-safe, and tokenless", () => {
  const workflow = read(".github/workflows/publish.yml");
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /description:.*vSemVer|Exact vSemVer/);
  assert.match(workflow, /required: true/);
  assert.match(workflow, /if: github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /^permissions:\n  contents: read\n  id-token: write$/m);
  assert.match(workflow, /refs\/tags\/\$\{RELEASE_TAG\}/);
  assert.match(workflow, /git cat-file -t/);
  assert.match(workflow, /refs\/remotes\/origin\/main/);
  assert.match(workflow, /tag_commit/);
  assert.match(workflow, /main_commit/);
  assert.match(workflow, /package_version/);
  assert.match(workflow, /npm publish --provenance/);
  assert.match(workflow, /registry=https:\/\/registry\.npmjs\.org/);
  assert.doesNotMatch(workflow, /NPM_TOKEN|secrets\.|npm token/);
  for (const command of ["npm ci", "npm test", "npm run build", "npm run verify-pack", "npm pack --dry-run --json --ignore-scripts", "npm publish --provenance"]) {
    assert.ok(workflow.includes(command), `publish workflow must run ${command}`);
  }
  assert.ok(workflow.indexOf("npm ci") < workflow.indexOf("npm test"));
  assert.ok(workflow.indexOf("npm test") < workflow.indexOf("npm run build"));
  assert.ok(workflow.indexOf("npm run build") < workflow.indexOf("npm run verify-pack"));
  assert.ok(workflow.indexOf("npm run verify-pack") < workflow.indexOf("npm pack --dry-run"));
  assert.ok(workflow.indexOf("npm pack --dry-run") < workflow.indexOf("npm publish"));
});

test("bootstrap workflow is temporary, main-bound, tag-safe, and credential-scoped", () => {
  const workflow = read(".github/workflows/publish-bootstrap.yml");
  assert.match(workflow, /TEMPORARY FIRST-RELEASE BOOTSTRAP/);
  assert.match(workflow, /^on:\n  workflow_dispatch:/m);
  assert.doesNotMatch(workflow, /^(?:  )?(?:push|pull_request):/m);
  assert.match(workflow, /description: Exact release tag; this bootstrap accepts only v0\.2\.0/);
  assert.match(workflow, /required: true/);
  assert.match(workflow, /if: github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /^permissions:\n  contents: read\n  id-token: write$/m);
  assert.match(workflow, /RELEASE_TAG.*v0\.2\.0/);
  assert.match(workflow, /git cat-file -t/);
  assert.match(workflow, /refs\/remotes\/origin\/main/);
  assert.match(workflow, /tag_commit/);
  assert.match(workflow, /main_commit/);
  assert.match(workflow, /head_commit/);
  assert.match(workflow, /package_version/);
  assert.match(workflow, /package_version.*0\.2\.0/);
  assert.match(workflow, /registry-url: https:\/\/registry\.npmjs\.org/);
  assert.match(workflow, /--registry=https:\/\/registry\.npmjs\.org/);
  assert.match(workflow, /npm publish --provenance --access public/);
  assert.equal((workflow.match(/\$\{\{ secrets\.NPM_BOOTSTRAP_TOKEN \}\}/g) ?? []).length, 1);
  assert.equal((workflow.match(/secrets\./g) ?? []).length, 1);
  assert.match(workflow, /NODE_AUTH_TOKEN: \$\{\{ secrets\.NPM_BOOTSTRAP_TOKEN \}\}/);
  assert.doesNotMatch(workflow, /NPM_TOKEN|npm token|_authToken/);
  for (const path of ["AGENTS.md", ".pi/skills/create-release/SKILL.md", "odd/tasks/first-release-bootstrap.md"]) {
    const guidance = read(path);
    assert.doesNotMatch(guidance, /NPM_BOOTSTRAP_TOKEN|NPM_TOKEN|NODE_AUTH_TOKEN|\.npmrc|npm token|_authToken|npm config set/i);
  }
  for (const command of ["npm ci", "npm test", "npm run build", "npm run verify-pack", "npm pack --dry-run --json --ignore-scripts", "npm publish --provenance"]) {
    assert.ok(workflow.includes(command), `bootstrap workflow must run ${command}`);
  }
  assert.ok(workflow.indexOf("npm ci") < workflow.indexOf("npm test"));
  assert.ok(workflow.indexOf("npm test") < workflow.indexOf("npm run build"));
  assert.ok(workflow.indexOf("npm run build") < workflow.indexOf("npm run verify-pack"));
  assert.ok(workflow.indexOf("npm run verify-pack") < workflow.indexOf("npm pack --dry-run"));
  assert.ok(workflow.indexOf("npm pack --dry-run") < workflow.indexOf("npm publish --provenance"));

  const permanentWorkflow = read(".github/workflows/publish.yml");
  assert.doesNotMatch(permanentWorkflow, /NPM_TOKEN|NPM_BOOTSTRAP_TOKEN|NODE_AUTH_TOKEN|secrets\.|npm token/);
  assert.match(permanentWorkflow, /npm publish --provenance/);
  assert.match(permanentWorkflow, /registry=https:\/\/registry\.npmjs\.org/);
});

test("workflow is local validation only and keeps checks ordered", () => {
  const workflow = read(".github/workflows/ci.yml");
  assert.match(workflow, /push:/);
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /^permissions:\n  contents: read$/m);
  assert.match(workflow, /uses: actions\/checkout@[a-f0-9]{40}(?: # v4\.2\.2)?\n        with:\n          persist-credentials: false/);
  assert.match(workflow, /uses: actions\/setup-node@[a-f0-9]{40}/);
  assert.doesNotMatch(workflow, /persist-credentials:\s*true/);
  assert.match(workflow, /22\.19\.0/);
  assert.match(workflow, /npm ci/);
  assert.ok(workflow.indexOf("npm test") < workflow.indexOf("npm run build"));
  assert.ok(workflow.indexOf("npm run build") < workflow.indexOf("npm run verify-pack"));
  assert.doesNotMatch(workflow, /publish|npm token|NPM_TOKEN|secrets\./i);
});
