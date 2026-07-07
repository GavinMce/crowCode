// Runs as the changesets/action "publish" step. All @crowcode/* packages are
// version-locked together (see .changeset/config.json "fixed"), so any one
// of them reflects the unified repo version -- read from shared-types since
// it has no workspace dependencies of its own. Packages are private and
// never published to npm; a "release" here is just a git tag + GitHub
// Release.
//
// changesets/action can auto-create a release from a pushed tag, but only
// when the publish command's stdout matches its expected "New tag:
// name@version" format (designed around per-package npm tags) -- a single
// unified tag like "v0.1.0" doesn't match, so we create the release
// ourselves via `gh` instead of relying on that.
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const { version } = JSON.parse(readFileSync('packages/shared-types/package.json', 'utf8'));
const tag = `v${version}`;

const existingTags = execSync('git tag -l', { encoding: 'utf8' }).split('\n').map((t) => t.trim());
if (existingTags.includes(tag)) {
  console.log(`Tag ${tag} already exists, nothing to do.`);
  process.exit(0);
}

execSync(`git tag ${tag}`, { stdio: 'inherit' });
execSync(`git push origin ${tag}`, { stdio: 'inherit' });
console.log(`Created and pushed tag ${tag}`);

execSync(`gh release create ${tag} --title ${tag} --generate-notes`, { stdio: 'inherit' });
console.log(`Created GitHub Release ${tag}`);
