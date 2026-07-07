import { DatabaseSync } from 'node:sqlite';

export interface ProjectRow {
  id: string;
  name: string;
  repoUrl: string;
  defaultBranch: string;
  workingBranch: string;
  image: string;
  /** Envelope-encrypted at rest; decrypted only when injecting into a sandbox spec. */
  encryptedGitCredential: string;
  createdAt: string;
}

/**
 * v1 stopgap: Node's built-in node:sqlite, no ORM. Chosen over better-sqlite3
 * because its native addon doesn't yet build against very recent Node
 * versions (no prebuilt binary, source predates current V8 API). Migrate to
 * Postgres + Drizzle per the architecture plan once multi-instance
 * control-plane is needed.
 */
export class Db {
  private readonly sqlite: DatabaseSync;

  constructor(path: string) {
    this.sqlite = new DatabaseSync(path);
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        repo_url TEXT NOT NULL,
        default_branch TEXT NOT NULL,
        working_branch TEXT NOT NULL,
        image TEXT NOT NULL,
        encrypted_git_credential TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
  }

  insertProject(row: ProjectRow): void {
    this.sqlite
      .prepare(
        `INSERT INTO projects
         (id, name, repo_url, default_branch, working_branch, image, encrypted_git_credential, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        row.id,
        row.name,
        row.repoUrl,
        row.defaultBranch,
        row.workingBranch,
        row.image,
        row.encryptedGitCredential,
        row.createdAt,
      );
  }

  listProjects(): ProjectRow[] {
    const rows = this.sqlite.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
    return rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      repoUrl: r.repo_url as string,
      defaultBranch: r.default_branch as string,
      workingBranch: r.working_branch as string,
      image: r.image as string,
      encryptedGitCredential: r.encrypted_git_credential as string,
      createdAt: r.created_at as string,
    }));
  }
}
