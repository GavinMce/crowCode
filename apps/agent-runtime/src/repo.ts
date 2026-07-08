import { simpleGit } from 'simple-git';

export interface RepoConfig {
  repoUrl: string;
  workDir: string;
  defaultBranch: string;
  workingBranch: string;
  /** Injected via env at container start; written only to an in-memory git config, never logged or persisted. */
  credential?: string;
}

/** Builds the `-c http.extraHeader=...` args needed for every authenticated git network call. */
function authHeaderArgs(credential: string | undefined): string[] {
  return credential
    ? ['-c', `http.extraHeader=Authorization: Basic ${Buffer.from(`x-access-token:${credential}`).toString('base64')}`]
    : [];
}

/**
 * Clones the project repo into workDir if absent, otherwise fetches +
 * checks out the working branch. Credentials are passed via an in-process
 * git http.extraHeader, never written to disk (no .git-credentials file).
 */
export async function ensureRepoCheckedOut(config: RepoConfig): Promise<void> {
  const git = simpleGit();
  const authHeader = authHeaderArgs(config.credential);

  const alreadyCloned = await simpleGit(config.workDir)
    .checkIsRepo()
    .catch(() => false);

  if (!alreadyCloned) {
    await git.raw([...authHeader, 'clone', config.repoUrl, config.workDir]);
  }

  const repo = simpleGit(config.workDir);
  await repo.addConfig('user.email', 'agent@crowcode.dev', false, 'local');
  await repo.addConfig('user.name', 'crowCode Agent', false, 'local');
  await repo.raw([...authHeader, 'fetch', 'origin']);

  const branches = await repo.branch(['-a']);
  if (branches.all.includes(config.workingBranch)) {
    await repo.checkout(config.workingBranch);
  } else {
    await repo.checkout(config.defaultBranch);
    await repo.checkoutLocalBranch(config.workingBranch);
  }
}

/** Returns null if there were no working-tree changes to commit. */
export async function commitAndPush(
  workDir: string,
  message: string,
  workingBranch: string,
  credential?: string,
): Promise<{ sha: string } | null> {
  const repo = simpleGit(workDir);
  const status = await repo.status();
  if (status.files.length === 0) return null;

  await repo.add(['-A']);
  const commitResult = await repo.commit(message);
  await repo.raw([...authHeaderArgs(credential), 'push', 'origin', workingBranch]);
  return { sha: commitResult.commit };
}

/** Unified diff of the default branch's remote tip against the session's working branch. */
export async function computeDiff(
  workDir: string,
  defaultBranch: string,
  workingBranch: string,
): Promise<string> {
  const repo = simpleGit(workDir);
  return repo.diff([`origin/${defaultBranch}...${workingBranch}`]);
}
