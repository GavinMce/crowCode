import { useEffect, useState } from 'react';
import type { CrowcodeConfig } from './global.js';
import type { NewProjectForm, ProjectRow } from './types.js';
import { Sidebar } from './components/Sidebar.js';
import { ChatPanel } from './components/ChatPanel.js';

export function App() {
  const [config, setConfig] = useState<CrowcodeConfig | null>(null);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  useEffect(() => {
    window.crowcode.getConfig().then(setConfig);
  }, []);

  useEffect(() => {
    if (!config) return;
    fetch(`${config.controlPlaneHttpUrl}/projects`)
      .then((res) => res.json())
      .then(setProjects)
      .catch(() => setProjects([]));
  }, [config]);

  async function createProject(form: NewProjectForm): Promise<boolean> {
    if (!config) return false;
    const res = await fetch(`${config.controlPlaneHttpUrl}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (!res.ok) return false;
    const { project } = await res.json();
    setProjects((prev) => [...prev, project]);
    setSelectedProjectId(project.id);
    return true;
  }

  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null;

  if (!config) return null;

  return (
    <div className="app-shell">
      <Sidebar
        projects={projects}
        selectedProjectId={selectedProjectId}
        onSelectProject={setSelectedProjectId}
        onCreateProject={createProject}
      />
      <ChatPanel config={config} project={selectedProject} />
    </div>
  );
}
