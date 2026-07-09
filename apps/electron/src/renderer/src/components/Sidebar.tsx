import { useEffect, useState, type FormEvent } from 'react';
import type { AgentStatus, ManagedAgent } from '@crowcode/shared-types';
import type { NewProjectForm, ProjectRow, SessionRow } from '../types.js';

interface SidebarProps {
  projects: ProjectRow[];
  sessions: SessionRow[];
  agents: ManagedAgent[];
  agentStatuses: Record<string, AgentStatus>;
  selectedProjectId: string | null;
  selectedSessionId: string | null;
  selectedAgentId: string | null;
  onSelectProject: (id: string) => void;
  onSelectSession: (id: string) => void;
  onSelectAgent: (id: string) => void;
  onCreateProject: (form: NewProjectForm) => Promise<boolean>;
  onCreateSession: (title: string) => Promise<boolean>;
  onOpenProjectSettings: (projectId: string) => void;
  onOpenAppSettings: () => void;
}

const emptyForm: NewProjectForm = { name: '', repoUrl: '', gitCredential: '' };

function NewSessionRow({ onCreateSession }: { onCreateSession: (title: string) => Promise<boolean> }) {
  const [active, setActive] = useState(false);
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!active) {
    return (
      <button type="button" className="btn-new-session" onClick={() => setActive(true)}>
        + New session
      </button>
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    const ok = await onCreateSession(title.trim());
    setSubmitting(false);
    if (ok) {
      setTitle('');
      setActive(false);
    }
  }

  return (
    <form className="new-session-form" onSubmit={handleSubmit}>
      <input
        className="sidebar-input"
        placeholder="Session title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
      />
      <div className="new-project-form-actions">
        <button type="button" className="btn-secondary" onClick={() => setActive(false)}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Starting…' : 'Start'}
        </button>
      </div>
    </form>
  );
}

export function Sidebar({
  projects,
  sessions,
  agents,
  agentStatuses,
  selectedProjectId,
  selectedSessionId,
  selectedAgentId,
  onSelectProject,
  onSelectSession,
  onSelectAgent,
  onCreateProject,
  onCreateSession,
  onOpenProjectSettings,
  onOpenAppSettings,
}: SidebarProps) {
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [form, setForm] = useState<NewProjectForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (projects.length === 0) {
      setShowProjectForm(true);
    } else {
      setShowProjectForm((prev) => (form.name || form.repoUrl || form.gitCredential ? prev : false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects.length]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim() || !form.repoUrl.trim() || !form.gitCredential.trim() || submitting) return;
    setSubmitting(true);
    const ok = await onCreateProject(form);
    setSubmitting(false);
    if (ok) {
      setForm(emptyForm);
      setShowProjectForm(false);
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">crowCode</span>
        <button type="button" className="sidebar-settings-button" title="Settings" onClick={onOpenAppSettings}>
          ⚙
        </button>
      </div>

      <div className="sidebar-new-project">
        {showProjectForm ? (
          <form className="new-project-form" onSubmit={handleSubmit}>
            <input
              className="sidebar-input"
              placeholder="Project name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoFocus
            />
            <input
              className="sidebar-input"
              placeholder="Repository URL"
              value={form.repoUrl}
              onChange={(e) => setForm({ ...form, repoUrl: e.target.value })}
            />
            <input
              className="sidebar-input"
              placeholder="Git PAT"
              type="password"
              value={form.gitCredential}
              onChange={(e) => setForm({ ...form, gitCredential: e.target.value })}
            />
            <div className="new-project-form-actions">
              <button type="button" className="btn-secondary" onClick={() => setShowProjectForm(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? 'Creating…' : 'Create'}
              </button>
            </div>
          </form>
        ) : (
          <button type="button" className="btn-new-project" onClick={() => setShowProjectForm(true)}>
            + New project
          </button>
        )}
      </div>

      <div className="sidebar-projects scrollable">
        {projects.length === 0 ? (
          <div className="sidebar-empty">No projects yet</div>
        ) : (
          projects.map((project) => (
            <div key={project.id} className="sidebar-project-group">
              <div className="sidebar-project-row">
                <button
                  type="button"
                  className={`sidebar-project${project.id === selectedProjectId ? ' sidebar-project--active' : ''}`}
                  onClick={() => onSelectProject(project.id)}
                >
                  {project.name}
                </button>
                {project.id === selectedProjectId && (
                  <button
                    type="button"
                    className="sidebar-settings-button"
                    title="Project settings"
                    onClick={() => onOpenProjectSettings(project.id)}
                  >
                    ⚙
                  </button>
                )}
              </div>
              {project.id === selectedProjectId && (
                <div className="sidebar-sessions">
                  {sessions.map((session) => (
                    <button
                      key={session.id}
                      type="button"
                      className={`sidebar-session${session.id === selectedSessionId ? ' sidebar-session--active' : ''}`}
                      onClick={() => onSelectSession(session.id)}
                    >
                      {session.title}
                    </button>
                  ))}
                  <NewSessionRow onCreateSession={onCreateSession} />
                </div>
              )}
              {project.id === selectedProjectId && agents.length > 0 && (
                <div className="sidebar-agents">
                  <div className="sidebar-subheading">Agents</div>
                  {agents.map((agent) => (
                    <button
                      key={agent.id}
                      type="button"
                      className={`sidebar-agent${agent.id === selectedAgentId ? ' sidebar-agent--active' : ''}`}
                      onClick={() => onSelectAgent(agent.id)}
                    >
                      <span
                        className={`agent-status-dot agent-status-dot--${agentStatuses[agent.id] ?? 'idle'}`}
                      />
                      {agent.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
