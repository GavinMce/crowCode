export interface ProjectRow {
  id: string;
  name: string;
  repoUrl: string;
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

export interface NewProjectForm {
  name: string;
  repoUrl: string;
  gitCredential: string;
}
