// live session verification
import { simpleGit } from 'simple-git';

export interface RepoConfig {
  repoUrl: string;
  workDir: string;
  defaultBranch: string;
  workingBranch: string;
  /** Injected via env at container start; written only to an in-memory git config, never logged or persisted. */
  credential?: string;
}

/**
 * Clones the project repo into workDir if absent, otherwise fetches +
 * checks out the working branch. Credentials are passed via an in-process
 * git http.extraHeader, never written to disk (no .git-credentials file).
 */
export async function ensureRepoCheckedOut(config: RepoConfig): Promise<void> {
  const git = simpleGit();
  const authHeader = config.credential
    ? ['-c', `http.extraHeader=Authorization: Basic ${Buffer.from(`x-access-token:${config.credential}`).toString('base64')}`]
    : [];

  const alreadyCloned = await simpleGit(config.workDir)
    .checkIsRepo()
    .catch(() => false);

  if (!alreadyCloned) {
    await git.raw([...authHeader, 'clone', config.repoUrl, config.workDir]);
  }

  const repo = simpleGit(config.workDir);
  await repo.raw([...authHeader, 'fetch', 'origin']);

  const branches = await repo.branch(['-a']);
  if (branches.all.includes(config.workingBranch)) {
    await repo.checkout(config.workingBranch);
  } else {
    await repo.checkout(config.defaultBranch);
    await repo.checkoutLocalBranch(config.workingBranch);
  }
}

export async function commitAndPush(
  workDir: string,
  message: string,
  workingBranch: string,
): Promise<{ sha: string }> {
  const repo = simpleGit(workDir);
  await repo.add(['-A']);
  const commitResult = await repo.commit(message);
  await repo.push(['origin', workingBranch]);
  return { sha: commitResult.commit };
}
