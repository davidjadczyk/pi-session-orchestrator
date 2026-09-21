import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

import type { CanonicalBinding } from "./model";

function gitDirectory(worktree: string): string {
  const dotGit = join(worktree, ".git");
  const metadata = lstatSync(dotGit);
  if (metadata.isDirectory()) return dotGit;
  if (!metadata.isFile()) throw new Error("Git metadata is not a file or directory");

  const match = /^gitdir:\s*(.+?)\s*$/m.exec(readFileSync(dotGit, "utf8"));
  if (!match) throw new Error("Git metadata file has no gitdir");
  return isAbsolute(match[1]) ? match[1] : resolve(worktree, match[1]);
}

function worktreeFor(cwd: string): string {
  let directory = realpathSync(cwd);
  while (true) {
    try {
      gitDirectory(directory);
      return directory;
    } catch {
      const parent = dirname(directory);
      if (parent === directory) throw new Error("No Git worktree found");
      directory = parent;
    }
  }
}

function commonGitDirectory(gitDir: string): string {
  try {
    return resolve(gitDir, readFileSync(join(gitDir, "commondir"), "utf8").trim());
  } catch {
    return gitDir;
  }
}

/** Resolves canonical Git metadata from filesystem worktree metadata without spawning Git. */
export function activeCanonicalBinding(cwd: string): CanonicalBinding {
  try {
    const worktree = worktreeFor(cwd);
    return {
      repository: realpathSync(commonGitDirectory(gitDirectory(worktree))),
      worktree,
    };
  } catch {
    throw new Error("A managed assignment requires an active Git repository/worktree binding");
  }
}
