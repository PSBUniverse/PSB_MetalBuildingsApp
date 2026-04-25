# How to Sync Core Updates Into Your App

Your app repo (e.g. `PSB_MetalBuildingsApp`) was built on top of a clone of the shared core (`PSBUniverse-core`).
The core team ships updates (bug fixes, new shared components, admin modules, etc.) to the core repo.
This guide shows you how to pull those updates into your app without losing your work.

## Repos

| Repo | URL | What it is |
|---|---|---|
| **Core** | `https://github.com/PSBUniverse/PSBUniverse-core.git` | Shared platform (auth, UI, admin modules, layout) |
| **Your app** | `https://github.com/PSBUniverse/PSB_MetalBuildingsApp.git` | Your module built on top of the core |

## How it works

Your repo has two remotes:

- `origin` — your app repo (`PSB_MetalBuildingsApp`)
- `core` — the shared core repo (`PSBUniverse-core`)

You keep a `core-main` branch that mirrors the core. Your work stays on `main` (or a feature branch). When the core gets updated, you pull into `core-main` and rebase your branch on top.

## First-time setup

Run this once after cloning your app repo:

```bash
git clone https://github.com/PSBUniverse/PSB_MetalBuildingsApp.git
cd PSB_MetalBuildingsApp

# Add the core as a second remote
git remote add core https://github.com/PSBUniverse/PSBUniverse-core.git

# Create a local branch that tracks the core's main
git fetch core
git branch core-main core/main
```

Verify your remotes:

```bash
git remote -v
# origin  https://github.com/PSBUniverse/PSB_MetalBuildingsApp.git (fetch)
# origin  https://github.com/PSBUniverse/PSB_MetalBuildingsApp.git (push)
# core    https://github.com/PSBUniverse/PSBUniverse-core.git (fetch)
# core    https://github.com/PSBUniverse/PSBUniverse-core.git (push)
```

## Pulling core updates

When the team tells you the core has been updated:

```bash
# 1. Make sure your work is committed
git add -A
git commit -m "wip: save current work"

# 2. Update your core-main branch
git checkout core-main
git pull core main

# 3. Rebase your working branch on top of the updated core
git checkout main
git rebase core-main
```

Your app commits stay on top of whatever the core ships.

## If there are conflicts during rebase

Git will pause and tell you which files conflict. For each one:

```bash
# Open the conflicted file, resolve the markers (<<<< ==== >>>>), then:
git add <file>
git rebase --continue
```

To abort and go back to where you were before the rebase:

```bash
git rebase --abort
```

**Common conflict spots:** `src/app/[...modulePath]/page.js` (if core adds new modules to `pageImporters` and you did too). Just keep both entries.

## Pushing your work

After syncing, push your updated branch to your app repo:

```bash
git push origin main
```

If git says the histories diverged (because of the rebase), you need a force push:

```bash
git push origin main --force-with-lease
```

`--force-with-lease` is safer than `--force` — it will refuse if someone else pushed to the branch since your last fetch.

## Branch structure

```
main        ← your app work (Metal Buildings module, etc.)
core-main   ← read-only mirror of PSBUniverse-core
```

## Quick reference

```bash
# Sync core (run these 5 lines)
git checkout core-main
git pull core main
git checkout main
git rebase core-main
git push origin main --force-with-lease
```

## Rules

- **Never commit your app work to `core-main`.** It's a read-only mirror of the core.
- **Always rebase, don't merge.** Keeps a clean linear history with your work on top.
- **Pull core before rebase.** Always update `core-main` first, then rebase.
- **Ask the team before force-pushing** if others are also working on the same branch.
