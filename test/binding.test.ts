import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { activeCanonicalBinding } from "../src/binding";

function temporaryDirectory(): { path: string; dispose(): void } {
  const path = mkdtempSync(join(tmpdir(), "pi-session-orchestrator-binding-"));
  return { path, dispose: () => rmSync(path, { recursive: true, force: true }) };
}

test("canonical binding uses filesystem Git metadata for a repository worktree", () => {
  const fixture = temporaryDirectory();
  try {
    const worktree = join(fixture.path, "repository");
    mkdirSync(join(worktree, ".git"), { recursive: true });
    const nestedDirectory = join(worktree, "src", "nested");
    mkdirSync(nestedDirectory, { recursive: true });

    assert.deepEqual(activeCanonicalBinding(nestedDirectory), {
      repository: realpathSync(join(worktree, ".git")),
      worktree: realpathSync(worktree),
    });
  } finally {
    fixture.dispose();
  }
});

test("canonical binding resolves a linked worktree through its commondir metadata", () => {
  const fixture = temporaryDirectory();
  try {
    const repository = join(fixture.path, "repository", ".git");
    const gitDir = join(repository, "worktrees", "focused");
    const worktree = join(fixture.path, "focused");
    mkdirSync(gitDir, { recursive: true });
    mkdirSync(worktree, { recursive: true });
    writeFileSync(join(gitDir, "commondir"), "../..\n");
    writeFileSync(join(worktree, ".git"), `gitdir: ${gitDir}\n`);

    assert.deepEqual(activeCanonicalBinding(worktree), {
      repository: realpathSync(repository),
      worktree: realpathSync(worktree),
    });
  } finally {
    fixture.dispose();
  }
});

test("canonical binding rejects directories without Git worktree metadata", () => {
  const fixture = temporaryDirectory();
  try {
    assert.throws(() => activeCanonicalBinding(fixture.path), /requires an active Git repository\/worktree binding/);
  } finally {
    fixture.dispose();
  }
});
