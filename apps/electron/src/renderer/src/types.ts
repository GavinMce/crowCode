export interface ProjectRow {
  id: string;
  name: string;
  repoUrl: string;
  workingBranch: string;
}

export interface NewProjectForm {
  name: string;
  repoUrl: string;
  gitCredential: string;
}
