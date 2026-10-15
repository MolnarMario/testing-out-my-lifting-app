# How lane work reaches main

AI Hive agents each work in their own git worktree, on a `hive/<agent>` branch
(a lane). An integrator merges finished lanes into one `integrate/<topic>`
branch and ships it to main through a pull request. Nothing reaches main any
other way.

GPT-6-Luna reviews the code twice. Each lane agent has Luna review its lane
before it marks the work done. The integrator has Luna review the whole
`integrate/` branch before the PR merges. The lane review catches problems in
one agent's work. The PR review catches problems that only show up once lanes
meet: two lanes editing the same CSS rule, a merge resolution that dropped one
side, a lane that was clean against an older main.

Both reviews use the same command, run from the branch being reviewed:

```bash
codex review --base origin/main -c model=gpt-6-luna -c model_reasoning_effort=high -c sandbox_mode=read-only
```

## For lane agents

1. Commit the work on your lane branch.
2. Run `git fetch origin` and merge `origin/main` into your lane. Never rebase.
   Resolve a conflict by keeping what both sides meant. If they can't both
   hold, stop and ask the user.
3. Run `npm test`. If you touched TypeScript, also run `npm run build`, since
   that is where `tsc` runs.
4. Don't commit the rebuilt `docs/index.html` or `docs/assets/`. Bundle names
   are content hashes, so two lanes that each commit a build always conflict.
   Throw the build away with
   `git restore docs/index.html docs/assets && git clean -fd docs/assets`.
   Leave the rest of `docs/` alone, since `docs/agents/` is hand-written.
   The integrator publishes one build per PR.
5. Run the Luna review. Commit a fix for every finding that holds up and run
   it again, until Luna finds nothing you accept as a real problem. A finding
   you reject needs a reason, and that reason goes in the commit message.
6. Make a commit whose message ends with a line of just `Task done`. Say in
   the message what Luna found, or that it found nothing. Use
   `git commit --allow-empty` when nothing is left to commit.

If Codex is missing or keeps failing, leave the `Task done` line off and tell
the user the lane is not reviewed.

## For the integrator

1. Run `git fetch origin` and create `integrate/<topic>` from `origin/main`.
2. Merge each lane's `Task done` commit by its SHA, with `git merge --no-ff`.
   Only merge commits that end in `Task done`. Resolve conflicts the same way
   lane agents do, and stop and ask if both sides can't hold.
3. Run `npm test` and `npm run build`. Throw the build output away for now
   (step 4 of the lane list).
4. Run the Luna review on the `integrate/` branch. Review before you commit the
   build, because Luna would otherwise read about a megabyte of minified
   bundle. Commit a fix on the `integrate/` branch for every finding that
   holds up, rerun the tests, and review again until Luna is clean.
5. Run `npm run build` once more and commit `docs/` on its own, as
   "Publish the current build: <what changed>".
6. Push the branch and open the PR against main. The body names each lane and
   SHA, what changed, the test and build result, and what each Luna review
   found.
7. Merge the PR with a merge commit (`gh pr merge <n> --merge`), only after
   the user asked to ship.

This project keeps no CHANGELOG, leaves `package.json` at its current version,
and has no test count in the README, so the integrator has nothing to bump.
