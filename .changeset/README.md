# Changesets

This directory manages changelogs and version bumps for crowCode via [Changesets](https://github.com/changesets/changesets).

All `@crowcode/*` packages are version-locked together (see `fixed` in `config.json`), since this is an application monorepo, not a set of independently published libraries. Packages are private and never published to npm; releases here just mean a version bump, changelog entry, git tag, and GitHub Release.

## Adding a changeset

When you open a PR that should be reflected in the next release, run:

```
pnpm changeset
```

and follow the prompts, then commit the generated `.changeset/*.md` file with your PR.

## How releases happen

Merging PRs with changesets into `main` triggers the Release workflow, which opens/updates a "Version Packages" PR. Merging that PR bumps versions, updates changelogs, and creates a git tag + GitHub Release.
