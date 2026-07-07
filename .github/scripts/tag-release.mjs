// Runs as the changesets/action "publish" step. All @crowcode/* packages are
// version-locked together (see .changeset/config.json "fixed"), so any one
// of them reflects the unified repo version -- read from shared-types since
// it has no workspace dependencies of its own. Packages are private and
// never published to npm; a "release" here is just a git tag + GitHub
// Release, which changesets/action creates automatically once it sees a new
// tag pushed by this script.
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
