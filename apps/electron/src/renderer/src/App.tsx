import { useEffect, useRef, useState } from 'react';
import type { AgentStatus, ManagedAgent } from '@crowcode/shared-types';
import { ControlPlaneToElectronMessageSchema } from '@crowcode/shared-types';
import type { CrowcodeConfig } from './global.js';
import type { NewProjectForm, ProjectRow, SessionRow } from './types.js';
import { Sidebar } from './components/Sidebar.js';
import { ChatPanel } from './components/ChatPanel.js';
import { ProjectSettings } from './components/ProjectSettings.js';
import { AgentConversationView } from './components/AgentConversationView.js';

export function App() {
  const [config, setConfig] = useState<CrowcodeConfig | null>(null);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [agents, setAgents] = useState<ManagedAgent[]>([]);
  const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentStatus>>({});
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [settingsProjectId, setSettingsProjectId] = useState<string | null>(null);
  const projectWsRef = useRef<WebSocket | null>(null);

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
      setAgents([]);
      return;
    }
    fetch(`${config.controlPlaneHttpUrl}/projects/${selectedProjectId}/sessions`)
      .then((res) => res.json())
      .then(setSessions)
      .catch(() => setSessions([]));
    fetch(`${config.controlPlaneHttpUrl}/projects/${selectedProjectId}/agents`)
      .then((res) => res.json())
      .then(setAgents)
      .catch(() => setAgents([]));
  }, [config, selectedProjectId]);

  // Project-scoped WS: live agent status, independent of which session (if
  // any) is currently open -- an agent's own conversation outlives any one
  // session's container lifetime.
  useEffect(() => {
    setAgentStatuses({});
    if (!config || !selectedProjectId) return;

    const ws = new WebSocket(config.controlPlaneWsUrl);
    projectWsRef.current = ws;

    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({ type: 'subscribe_project', projectId: selectedProjectId }));
    });

    ws.addEventListener('message', (rawEvent) => {
      const parsed = ControlPlaneToElectronMessageSchema.safeParse(JSON.parse(rawEvent.data as string));
      if (!parsed.success || parsed.data.type !== 'agent_status') return;
      const { agentId, status } = parsed.data;
      setAgentStatuses((prev) => ({ ...prev, [agentId]: status }));
    });

    return () => ws.close();
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
    selectProject(project.id);
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
    setSelectedAgentId(null);
    return true;
  }

  function selectProject(id: string) {
    setSelectedProjectId(id);
    setSelectedSessionId(null);
    setSelectedAgentId(null);
  }

  function selectSession(id: string) {
    setSelectedSessionId(id);
    setSelectedAgentId(null);
  }

  function selectAgent(id: string) {
    setSelectedAgentId(id);
    setSelectedSessionId(null);
  }

  const selectedSession = sessions.find((s) => s.id === selectedSessionId) ?? null;
  const selectedAgent = agents.find((a) => a.id === selectedAgentId) ?? null;

  if (!config) return null;

  return (
    <div className="app-shell">
      <Sidebar
        projects={projects}
        sessions={sessions}
        agents={agents}
        agentStatuses={agentStatuses}
        selectedProjectId={selectedProjectId}
        selectedSessionId={selectedSessionId}
        selectedAgentId={selectedAgentId}
        onSelectProject={selectProject}
        onSelectSession={selectSession}
        onSelectAgent={selectAgent}
        onCreateProject={createProject}
        onCreateSession={createSession}
        onOpenProjectSettings={setSettingsProjectId}
      />
      {selectedAgent ? (
        <AgentConversationView
          key={selectedAgent.id}
          config={config}
          agent={selectedAgent}
          status={agentStatuses[selectedAgent.id] ?? 'idle'}
        />
      ) : (
        <ChatPanel config={config} session={selectedSession} />
      )}
      {settingsProjectId && (
        <ProjectSettings config={config} projectId={settingsProjectId} onClose={() => setSettingsProjectId(null)} />
      )}
    </div>
  );
}
