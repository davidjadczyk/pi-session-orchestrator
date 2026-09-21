import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

const requiredFiles = ["package.json", "README.md", "LICENSE", "assets/pi-session-orchestrator-thumbnail-pi-sessions.png", "src/index.ts", "src/binding.ts", "src/model.ts", "src/prompt.ts", "src/state.ts", "src/tools.ts", "docs/README.md", "docs/prompt-injection.md", "docs/pi-intercom.md", "docs/release-version-preparation.md", "docs/reference/README.md", "docs/reference/coordination-model.md", "docs/reference/operational-boundaries.md", "docs/reference/fast-decision-model.md"];
const prohibitedRoots = ["test/", ".github/", "openspec/", "scripts/"];

export function normalizePath(value) {
  const path = String(value).replaceAll("\\", "/").replace(/^package\//, "");
  return path.replace(/^\.\//, "");
}

export function validatePackFiles(input) {
  const files = input.map(normalizePath);
  const issues = [];
  for (const required of requiredFiles) if (!files.includes(required)) issues.push(`missing required file: ${required}`);
  for (const file of files) {
    if (prohibitedRoots.some((root) => file.startsWith(root))) issues.push(`prohibited packaged path: ${file}`);
    if (["package-lock.json", "tsconfig.json"].includes(file)) issues.push(`prohibited packaged path: ${file}`);
    if (!requiredFiles.includes(file) && !["package.json", "README.md", "LICENSE"].includes(file) && !prohibitedRoots.some((root) => file.startsWith(root)) && file !== "package-lock.json" && file !== "tsconfig.json") issues.push(`outside consumer boundary: ${file}`);
  }
  return issues;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) {
  let output;
  try {
    output = execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
  } catch {
    process.exitCode = 1;
  }
  if (output) {
    let parsed;
    try { parsed = JSON.parse(output); } catch { console.error("verify-pack: npm pack returned invalid JSON"); process.exitCode = 1; }
    if (parsed) {
      if (!Array.isArray(parsed) || parsed.length !== 1 || !Array.isArray(parsed[0].files)) { console.error("verify-pack: expected one npm pack result"); process.exitCode = 1; }
      else {
        const issues = validatePackFiles(parsed[0].files.map((entry) => entry.path));
        if (issues.length) { console.error(issues.join("\n")); process.exitCode = 1; }
        else console.log(parsed[0].files.map((entry) => normalizePath(entry.path)).join("\n"));
      }
    }
  }
}
