# Syncing Core Updates Into Your App

If your app repo (e.g. `PSB_MetalBuildingsApp`) was cloned from PSBUniverse-core, you'll need to pull core updates periodically. This guide shows you how to do that safely without losing your work.

---

## How It Works

Your app repo has **two Git remotes**:

| Remote | Points To | Purpose |
|--------|-----------|---------|
| `origin` | Your app repo (e.g. `PSB_MetalBuildingsApp`) | Your module code |
| `core` | `PSBUniverse-core` | The shared platform |

You keep a local branch called `core-main` that mirrors the core. Your work stays on `main` (or a feature branch). When core gets updated, you pull into `core-main` and rebase your branch on top.

```
main        ← Your app work (Metal Buildings module, etc.)
core-main   ← Read-only mirror of PSBUniverse-core
```

---

## First-Time Setup

Run this **once** after cloning your app repo:

```bash
git clone https://github.com/PSBUniverse/PSB_MetalBuildingsApp.git
cd PSB_MetalBuildingsApp

# Add the core as a second remote
git remote add core https://github.com/PSBUniverse/PSBUniverse-core.git

# Create a local branch that tracks core's main
git fetch core
git branch core-main core/main

# Push your main branch to your app repo
git push -u origin main
```

Verify your remotes:

```bash
git remote -v
# origin  https://github.com/PSBUniverse/PSB_MetalBuildingsApp.git (fetch)
# origin  https://github.com/PSBUniverse/PSB_MetalBuildingsApp.git (push)
# core    https://github.com/PSBUniverse/PSBUniverse-core.git (fetch)
# core    https://github.com/PSBUniverse/PSBUniverse-core.git (push)
```

---

## Pulling Core Updates

When the team tells you the core has been updated:

```bash
# 1. Save your current work
git add -A
git commit -m "wip: save current work"

# 2. Update your core-main branch
git checkout core-main
git pull core main

# 3. Rebase your working branch on top of the updated core
git checkout main
git rebase core-main
```

Your app commits will sit on top of whatever the core ships.

---

## Resolving Conflicts

If Git pauses during the rebase and reports conflicts:

```bash
# Open the conflicted file, fix the markers (<<<< ==== >>>>), then:
git add <file>
git rebase --continue
```

To abort and go back to where you were before the rebase:

```bash
git rebase --abort
```

**Common conflict spot:** `src/app/[...modulePath]/page.js` — if both core and your app added new routes. Just keep both entries.

---

## Pushing After Sync

After syncing, push your updated branch:

```bash
git push origin main
```

If Git says the histories diverged (because of the rebase), use a safe force push:

```bash
git push origin main --force-with-lease
```

`--force-with-lease` is safer than `--force` — it refuses if someone else pushed to the branch since your last fetch.

---

## Quick Reference

```bash
# Run these 5 lines to sync
git checkout core-main
git pull core main
git checkout main
git rebase core-main
git push origin main --force-with-lease
```

---

## Rules

1. **Never commit your app work to `core-main`.** It's a read-only mirror.
2. **Always rebase, don't merge.** Keeps a clean linear history with your work on top.
3. **Pull core before rebase.** Always update `core-main` first, then rebase.
4. **Ask the team before force-pushing** if others are also working on the same branch.
