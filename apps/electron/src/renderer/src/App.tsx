import { useEffect, useState } from 'react';
import type { CrowcodeConfig } from './global.js';
import type { NewProjectForm, ProjectRow, SessionRow } from './types.js';
import { Sidebar } from './components/Sidebar.js';
import { ChatPanel } from './components/ChatPanel.js';
import { ProjectSettings } from './components/ProjectSettings.js';

export function App() {
  const [config, setConfig] = useState<CrowcodeConfig | null>(null);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [settingsProjectId, setSettingsProjectId] = useState<string | null>(null);

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

  useEffect(() => {
    if (!config || !selectedProjectId) {
      setSessions([]);
      return;
    }
    fetch(`${config.controlPlaneHttpUrl}/projects/${selectedProjectId}/sessions`)
      .then((res) => res.json())
      .then(setSessions)
      .catch(() => setSessions([]));
  }, [config, selectedProjectId]);

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
    setSelectedSessionId(null);
    return true;
  }

  async function createSession(title: string): Promise<boolean> {
    if (!config || !selectedProjectId) return false;
    const res = await fetch(`${config.controlPlaneHttpUrl}/projects/${selectedProjectId}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) return false;
    const { session } = await res.json();
    setSessions((prev) => [session, ...prev]);
    setSelectedSessionId(session.id);
    return true;
  }

  function selectProject(id: string) {
    setSelectedProjectId(id);
    setSelectedSessionId(null);
  }

  const selectedSession = sessions.find((s) => s.id === selectedSessionId) ?? null;

  if (!config) return null;

  return (
    <div className="app-shell">
      <Sidebar
        projects={projects}
        sessions={sessions}
        selectedProjectId={selectedProjectId}
        selectedSessionId={selectedSessionId}
        onSelectProject={selectProject}
        onSelectSession={setSelectedSessionId}
        onCreateProject={createProject}
        onCreateSession={createSession}
        onOpenProjectSettings={setSettingsProjectId}
      />
      <ChatPanel config={config} session={selectedSession} />
      {settingsProjectId && (
        <ProjectSettings config={config} projectId={settingsProjectId} onClose={() => setSettingsProjectId(null)} />
      )}
    </div>
  );
}
