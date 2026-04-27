# Step-by-Step Git Setup & Push Guide

This guide is for developers who just cloned the **PSB_MetalBuildingsApp** repo and need to set up git, push their work, and sync core updates.

Read each step carefully. Run each command **one at a time**. Do not skip steps.

---

## PART 1 — First-Time Git Config (Do This Once Per Computer)

Before you can push anything, git needs to know who you are.

### Step 1: Open a terminal

In VS Code, press `` Ctrl + ` `` (backtick) to open the terminal.

### Step 2: Set your name

Replace `Your Name` with your real name. Keep the quotes.

```bash
git config --global user.name "Your Name"
```

### Step 3: Set your email

Use the same email as your GitHub account. Keep the quotes.

```bash
git config --global user.email "your.email@example.com"
```

### Step 4: Verify it worked

```bash
git config --global user.name
git config --global user.email
```

You should see your name and email printed back. If you do, move on.

---

## PART 2 — Clone and Set Up Your Repo (Do This Once)

If you already cloned the repo and see the project files, skip to Step 8.

### Step 5: Clone the app repo

```bash
git clone https://github.com/PSBUniverse/PSB_MetalBuildingsApp.git
```

### Step 6: Go into the project folder

```bash
cd PSB_MetalBuildingsApp
```

### Step 7: Open it in VS Code

```bash
code .
```

A new VS Code window will open with the project. Use the terminal in that window from now on.

### Step 8: Check what branch you are on

```bash
git branch
```

You should see something like:

```
* main
```

The `*` means that's the branch you're currently on. **You want to be on `main`.**

If you are NOT on `main`, switch to it:

```bash
git checkout main
```

### Step 9: Check your remotes

```bash
git remote -v
```

You should see:

```
origin  https://github.com/PSBUniverse/PSB_MetalBuildingsApp.git (fetch)
origin  https://github.com/PSBUniverse/PSB_MetalBuildingsApp.git (push)
```

`origin` is YOUR project repo. This is where you push your work.

### Step 10: Add the core remote

This connects your project to the shared core repo so you can pull updates later.

```bash
git remote add core https://github.com/PSBUniverse/PSBUniverse-core.git
```

> **If you get an error saying "remote core already exists"** — that's fine, it means it was already added. Move on.

### Step 11: Verify both remotes exist

```bash
git remote -v
```

You should now see FOUR lines:

```
core    https://github.com/PSBUniverse/PSBUniverse-core.git (fetch)
core    https://github.com/PSBUniverse/PSBUniverse-core.git (push)
origin  https://github.com/PSBUniverse/PSB_MetalBuildingsApp.git (fetch)
origin  https://github.com/PSBUniverse/PSB_MetalBuildingsApp.git (push)
```

### Step 12: Fetch the core and create the core-main branch

```bash
git fetch core
```

Then:

```bash
git branch core-main core/main
```

> **If you get "fatal: a branch named 'core-main' already exists"** — that's fine. It was already created. Move on.

You're done with setup. You only do Part 1 and Part 2 **once**.

---

## PART 3 — How to Push Your Work (Do This Every Time)

This is your daily workflow. You write code, then push it.

### Step 13: Make sure you are on the `main` branch

```bash
git branch
```

Look for `* main`. If you're not on main:

```bash
git checkout main
```

### Step 14: Stage your changes

This tells git "I want to include these files in my next save."

```bash
git add -A
```

(`-A` means "add everything that changed.")

### Step 15: Commit your changes

This saves your work locally with a message describing what you did.

```bash
git commit -m "describe what you changed here"
```

Example:

```bash
git commit -m "feat: add Metal Buildings module with initial config"
```

> **If you get an error about user.name or user.email**, go back to Part 1.

### Step 16: Push to your project repo

```bash
git push origin main
```

That's it. Your code is now on GitHub in the PSB_MetalBuildingsApp repo.

> **If you get "rejected" or "failed to push"**, see the Troubleshooting section below.

---

## PART 4 — How to Sync Core Updates (Only When Told)

Only do this when the team says "the core has been updated." Do NOT do this on your own.

### Step 17: Save your current work first

If you have any unsaved changes:

```bash
git add -A
git commit -m "wip: save work before syncing core"
```

### Step 18: Switch to the core-main branch

```bash
git checkout core-main
```

### Step 19: Pull the latest core updates

```bash
git pull core main
```

### Step 20: Switch back to main

```bash
git checkout main
```

### Step 21: Rebase your work on top of the core

```bash
git rebase core-main
```

**What does this do?** It takes all your work and replays it on top of the latest core. This keeps the history clean.

### Step 22: Push your updated main

```bash
git push origin main --force-with-lease
```

> You need `--force-with-lease` here because rebase rewrites history. This is normal and safe after a rebase.

---

## PART 5 — If Something Goes Wrong During Rebase

If Step 21 shows conflict errors, don't panic.

### Option A: Abort and go back to how things were

```bash
git rebase --abort
```

This undoes the rebase entirely. You're back to where you were. Ask a senior dev for help.

### Option B: Fix the conflicts yourself

1. Git will tell you which files have conflicts. Open them.
2. Look for lines like this:

```
<<<<<<< HEAD
(core's version of the code)
=======
(your version of the code)
>>>>>>> your-commit-message
```

3. Decide which version to keep (or combine both). Delete the `<<<<`, `====`, and `>>>>` markers.
4. Save the file.
5. Stage the fixed file:

```bash
git add path/to/the/file.js
```

6. Continue the rebase:

```bash
git rebase --continue
```

7. Repeat for any other conflicted files until the rebase finishes.

---

## Troubleshooting

### "Make sure you configure your user.name and user.email in git"

Go to Part 1 and run the `git config` commands.

### "fatal: a branch named 'core-main' already exists"

Not an error. The branch was already created. Move on.

### "Everything up-to-date" when you push

This means there's nothing new to push. Either you already pushed, or you forgot to commit (Step 15).

### "rejected — failed to push some refs"

Someone else pushed changes you don't have yet. Run:

```bash
git pull origin main --rebase
```

Then push again:

```bash
git push origin main
```

### "You are not currently on a branch"

Run:

```bash
git checkout main
```

### Push goes to the wrong repo

Make sure you're using `origin` (not `core`):

```bash
git push origin main
```

`origin` = your app repo (PSB_MetalBuildingsApp). This is where your work goes.

`core` = the shared platform repo (PSBUniverse-core). **Never push to core.**

---

## Quick Reference Card

| What you want to do | Command |
|---|---|
| Check what branch you're on | `git branch` |
| Switch to main | `git checkout main` |
| Stage all changes | `git add -A` |
| Commit your work | `git commit -m "your message"` |
| Push your work | `git push origin main` |
| Sync core updates | See Part 4 (Steps 17-22) |

---

## Rules (Read These)

1. **Always work on the `main` branch** (or a feature branch). Never commit your work to `core-main`.
2. **`core-main` is read-only.** It's just a mirror of the shared core. Don't touch it.
3. **Never push to `core`.** Only push to `origin`.
4. **Commit often.** Small commits with clear messages are better than one giant commit.
5. **Ask for help** if you see merge conflicts you don't understand.
