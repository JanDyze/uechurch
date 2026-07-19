---
name: deploy
description: Deploy the current branch to production by merging into main. Verifies the build, pushes the branch, merges into main, and pushes so Vercel auto-deploys. Use when the user says "deploy", "ship it", "push to main", or "release".
---

# Deploy to production (main)

This project deploys through Vercel: pushing to `main` triggers a production
deploy automatically. The whole flow is wrapped in `scripts/deploy.mjs`.

## Steps

1. Check for uncommitted changes with `git status --porcelain`.
   - If there are changes, commit them first on the current branch with a
     clear conventional-commit message summarizing the actual changes
     (e.g. `feat: ...`, `fix: ...`). Do not commit unrelated or generated
     files (`dist/`, `node_modules/` must never be committed).
2. Run the deploy script:
   ```
   npm run deploy
   ```
   It will: run `npm run build` as a safety check, push the current branch,
   switch to `main`, pull, merge the branch, push `main`, and switch back.
3. If the script fails:
   - **Build failure**: show the build error to the user and fix it if the
     cause is clear, then rerun `npm run deploy`.
   - **Merge conflict**: the script aborts the merge and returns to the
     original branch. Report the conflicting files and ask the user how to
     resolve them.
4. On success, tell the user that `main` is updated and Vercel is deploying
   production, and that they can watch it at https://vercel.com/dashboard.

## Notes

- Never force-push `main`.
- If already on `main`, the script just builds and pushes.
