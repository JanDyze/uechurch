#!/usr/bin/env node
/**
 * Deploys the current branch to production by merging it into main and
 * pushing. Vercel auto-deploys from main, so nothing else is needed.
 *
 * Usage: npm run deploy
 *
 * Steps:
 *   1. Refuse to run with uncommitted changes.
 *   2. Run the production build locally so a broken build never reaches main.
 *   3. Push the current branch to origin.
 *   4. Merge the branch into main and push it.
 *   5. Return to the original branch.
 */
import { execSync } from "node:child_process";

const run = (cmd, opts = {}) =>
  execSync(cmd, { stdio: "inherit", ...opts });
const capture = (cmd) => execSync(cmd, { encoding: "utf8" }).trim();

const fail = (msg) => {
  console.error(`\n[deploy] ERROR: ${msg}`);
  process.exit(1);
};

const status = capture("git status --porcelain");
if (status) {
  fail(
    "You have uncommitted changes. Commit or stash them first:\n" + status
  );
}

const branch = capture("git rev-parse --abbrev-ref HEAD");
console.log(`[deploy] Current branch: ${branch}`);

console.log("[deploy] Running production build check...");
try {
  run("npm run build");
} catch {
  fail("Build failed. Fix the build before deploying.");
}

console.log(`[deploy] Pushing ${branch} to origin...`);
run(`git push origin ${branch}`);

if (branch !== "main") {
  console.log("[deploy] Switching to main and merging...");
  run("git checkout main");
  try {
    run("git pull origin main");
    run(`git merge ${branch} --no-edit`);
    run("git push origin main");
  } catch {
    // Leave main clean and go back to where the user was.
    try {
      run("git merge --abort");
    } catch {}
    run(`git checkout ${branch}`);
    fail("Merge or push to main failed. Resolve manually and retry.");
  }
  run(`git checkout ${branch}`);
}

console.log(
  "\n[deploy] Done. main is updated - Vercel will auto-deploy production."
);
console.log("[deploy] Check progress at https://vercel.com/dashboard");
