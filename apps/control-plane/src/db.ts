import { DatabaseSync } from 'node:sqlite';

export interface ProjectRow {
  id: string;
  name: string;
  repoUrl: string;
  defaultBranch: string;
  image: string;
  /** Envelope-encrypted at rest; decrypted only when injecting into a sandbox spec. */
  encryptedGitCredential: string;
  createdAt: string;
}

export interface SessionRow {
  id: string;
  projectId: string;
  title: string;
  branch: string;
  sandboxId: string | null;
  status: string;
  createdAt: string;
}

export interface AgentRow {
  id: string;
  projectId: string;
  name: string;
  description: string;
  prompt: string;
  model: string | null;
  /** JSON-encoded string[] */
  tools: string;
  createdAt: string;
}

export interface IntegrationRow {
  id: string;
  projectId: string;
  kind: string;
  name: string;
  /** Envelope-encrypted at rest; decrypted only when injecting into a sandbox spec. */
  encryptedConfig: string;
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
        image TEXT NOT NULL,
        encrypted_git_credential TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id),
        title TEXT NOT NULL,
        branch TEXT NOT NULL,
        sandbox_id TEXT,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id),
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        prompt TEXT NOT NULL,
        model TEXT,
        tools TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS integrations (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id),
        kind TEXT NOT NULL,
        name TEXT NOT NULL,
        encrypted_config TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
  }

  insertProject(row: ProjectRow): void {
    this.sqlite
      .prepare(
        `INSERT INTO projects
         (id, name, repo_url, default_branch, image, encrypted_git_credential, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        row.id,
        row.name,
        row.repoUrl,
        row.defaultBranch,
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
      image: r.image as string,
      encryptedGitCredential: r.encrypted_git_credential as string,
      createdAt: r.created_at as string,
    }));
  }

  getProject(id: string): ProjectRow | null {
    const row = this.sqlite.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!row) return null;
    return {
      id: row.id as string,
      name: row.name as string,
      repoUrl: row.repo_url as string,
      defaultBranch: row.default_branch as string,
      image: row.image as string,
      encryptedGitCredential: row.encrypted_git_credential as string,
      createdAt: row.created_at as string,
    };
  }

  insertSession(row: SessionRow): void {
    this.sqlite
      .prepare(
        `INSERT INTO sessions
         (id, project_id, title, branch, sandbox_id, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(row.id, row.projectId, row.title, row.branch, row.sandboxId, row.status, row.createdAt);
  }

  listSessionsForProject(projectId: string): SessionRow[] {
    const rows = this.sqlite
      .prepare('SELECT * FROM sessions WHERE project_id = ? ORDER BY created_at DESC')
      .all(projectId);
    return rows.map((r) => ({
      id: r.id as string,
      projectId: r.project_id as string,
      title: r.title as string,
      branch: r.branch as string,
      sandboxId: r.sandbox_id as string | null,
      status: r.status as string,
      createdAt: r.created_at as string,
    }));
  }

  updateSessionSandbox(id: string, sandboxId: string, status: string): void {
    this.sqlite
      .prepare('UPDATE sessions SET sandbox_id = ?, status = ? WHERE id = ?')
      .run(sandboxId, status, id);
  }

  getSession(id: string): SessionRow | null {
    const row = this.sqlite.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
    if (!row) return null;
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      title: row.title as string,
      branch: row.branch as string,
      sandboxId: row.sandbox_id as string | null,
      status: row.status as string,
      createdAt: row.created_at as string,
    };
  }

  insertAgent(row: AgentRow): void {
    this.sqlite
      .prepare(
        `INSERT INTO agents
         (id, project_id, name, description, prompt, model, tools, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(row.id, row.projectId, row.name, row.description, row.prompt, row.model, row.tools, row.createdAt);
  }

  listAgentsForProject(projectId: string): AgentRow[] {
    const rows = this.sqlite
      .prepare('SELECT * FROM agents WHERE project_id = ? ORDER BY created_at DESC')
      .all(projectId);
    return rows.map((r) => ({
      id: r.id as string,
      projectId: r.project_id as string,
      name: r.name as string,
      description: r.description as string,
      prompt: r.prompt as string,
      model: r.model as string | null,
      tools: r.tools as string,
      createdAt: r.created_at as string,
    }));
  }

  deleteAgent(id: string, projectId: string): void {
    this.sqlite.prepare('DELETE FROM agents WHERE id = ? AND project_id = ?').run(id, projectId);
  }

  insertIntegration(row: IntegrationRow): void {
    this.sqlite
      .prepare(
        `INSERT INTO integrations
         (id, project_id, kind, name, encrypted_config, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(row.id, row.projectId, row.kind, row.name, row.encryptedConfig, row.createdAt);
  }

  listIntegrationsForProject(projectId: string): IntegrationRow[] {
    const rows = this.sqlite
      .prepare('SELECT * FROM integrations WHERE project_id = ? ORDER BY created_at DESC')
      .all(projectId);
    return rows.map((r) => ({
      id: r.id as string,
      projectId: r.project_id as string,
      kind: r.kind as string,
      name: r.name as string,
      encryptedConfig: r.encrypted_config as string,
      createdAt: r.created_at as string,
    }));
  }

  deleteIntegration(id: string, projectId: string): void {
    this.sqlite.prepare('DELETE FROM integrations WHERE id = ? AND project_id = ?').run(id, projectId);
  }
}
