import { useEffect, useState, type FormEvent } from 'react';
import type { CreateManagedAgentRequest, Integration, IntegrationKind, ManagedAgent } from '@crowcode/shared-types';
import type { CrowcodeConfig } from '../global.js';

const emptyAgentForm: CreateManagedAgentRequest = { name: '', description: '', prompt: '', model: '', tools: [] };

function AgentsTab({ config, projectId }: { config: CrowcodeConfig; projectId: string }) {
  const [agents, setAgents] = useState<ManagedAgent[]>([]);
  const [form, setForm] = useState(emptyAgentForm);
  const [toolsInput, setToolsInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function loadAgents() {
    fetch(`${config.controlPlaneHttpUrl}/projects/${projectId}/agents`)
      .then((res) => res.json())
      .then(setAgents)
      .catch(() => setAgents([]));
  }

  useEffect(loadAgents, [config, projectId]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim() || !form.description.trim() || !form.prompt.trim() || submitting) return;
    setSubmitting(true);
    const body: CreateManagedAgentRequest = {
      ...form,
      model: form.model?.trim() || undefined,
      tools: toolsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    };
    const res = await fetch(`${config.controlPlaneHttpUrl}/projects/${projectId}/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setSubmitting(false);
    if (res.ok) {
      setForm(emptyAgentForm);
      setToolsInput('');
      loadAgents();
    }
  }

  async function handleDelete(agentId: string) {
    await fetch(`${config.controlPlaneHttpUrl}/projects/${projectId}/agents/${agentId}`, { method: 'DELETE' });
    loadAgents();
  }

  return (
    <>
      <p className="settings-section-hint">
        Available to the orchestrator via the Task tool in every new session for this project, alongside any
        repo-native agents defined in <code>.claude/agents/*.md</code>.
      </p>

      {agents.length === 0 ? (
        <div className="sidebar-empty">No managed agents yet</div>
      ) : (
        <ul className="agent-list">
          {agents.map((agent) => (
            <li key={agent.id} className="agent-list-item">
              <div>
                <span className="agent-list-name">{agent.name}</span>
                <span className="agent-list-description">{agent.description}</span>
              </div>
              <button type="button" className="btn-secondary" onClick={() => handleDelete(agent.id)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      <form className="agent-form" onSubmit={handleSubmit}>
        <input
          className="sidebar-input"
          placeholder="Name (e.g. reviewer)"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          className="sidebar-input"
          placeholder="Description (when the orchestrator should use it)"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <textarea
          className="sidebar-input agent-form-prompt"
          placeholder="System prompt"
          rows={4}
          value={form.prompt}
          onChange={(e) => setForm({ ...form, prompt: e.target.value })}
        />
        <div className="agent-form-row">
          <select
            className="sidebar-input"
            value={form.model ?? ''}
            onChange={(e) => setForm({ ...form, model: e.target.value })}
          >
            <option value="">Model: inherit</option>
            <option value="haiku">haiku</option>
            <option value="sonnet">sonnet</option>
            <option value="opus">opus</option>
          </select>
          <input
            className="sidebar-input"
            placeholder="Tools (comma-separated, blank = all)"
            value={toolsInput}
            onChange={(e) => setToolsInput(e.target.value)}
          />
        </div>
        <div className="new-project-form-actions">
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Adding…' : 'Add agent'}
          </button>
        </div>
      </form>
    </>
  );
}

const mcpStdioExample = '{\n  "type": "stdio",\n  "command": "npx",\n  "args": ["-y", "some-mcp-server"]\n}';
const pluginExample = '{\n  "path": ".claude/plugins/local-tools"\n}';

function IntegrationsTab({ config, projectId }: { config: CrowcodeConfig; projectId: string }) {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [kind, setKind] = useState<IntegrationKind>('mcp');
  const [name, setName] = useState('');
  const [configText, setConfigText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function loadIntegrations() {
    fetch(`${config.controlPlaneHttpUrl}/projects/${projectId}/integrations`)
      .then((res) => res.json())
      .then(setIntegrations)
      .catch(() => setIntegrations([]));
  }

  useEffect(loadIntegrations, [config, projectId]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!name.trim() || submitting) return;

    let parsedConfig: Record<string, unknown>;
    try {
      parsedConfig = JSON.parse(configText || '{}');
    } catch {
      setError('Config must be valid JSON');
      return;
    }

    setSubmitting(true);
    const res = await fetch(`${config.controlPlaneHttpUrl}/projects/${projectId}/integrations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, name: name.trim(), config: parsedConfig }),
    });
    setSubmitting(false);
    if (res.ok) {
      setName('');
      setConfigText('');
      loadIntegrations();
    } else {
      setError('Failed to create integration');
    }
  }

  async function handleDelete(integrationId: string) {
    await fetch(`${config.controlPlaneHttpUrl}/projects/${projectId}/integrations/${integrationId}`, {
      method: 'DELETE',
    });
    loadIntegrations();
  }

  return (
    <>
      <p className="settings-section-hint">
        MCP servers and local plugins available to the orchestrator in every new session for this project. Config is
        encrypted at rest and never shown again after creation.
      </p>

      {integrations.length === 0 ? (
        <div className="sidebar-empty">No integrations yet</div>
      ) : (
        <ul className="agent-list">
          {integrations.map((integration) => (
            <li key={integration.id} className="agent-list-item">
              <div>
                <span className="agent-list-name">{integration.name}</span>
                <span className="agent-list-description">{integration.kind}</span>
              </div>
              <button type="button" className="btn-secondary" onClick={() => handleDelete(integration.id)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      <form className="agent-form" onSubmit={handleSubmit}>
        <div className="agent-form-row">
          <select className="sidebar-input" value={kind} onChange={(e) => setKind(e.target.value as IntegrationKind)}>
            <option value="mcp">MCP server</option>
            <option value="plugin">Local plugin</option>
          </select>
          <input
            className="sidebar-input"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <textarea
          className="sidebar-input agent-form-prompt"
          placeholder={kind === 'mcp' ? mcpStdioExample : pluginExample}
          rows={5}
          value={configText}
          onChange={(e) => setConfigText(e.target.value)}
        />
        {error && <div className="meta-turn meta-turn--error">{error}</div>}
        <div className="new-project-form-actions">
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Adding…' : 'Add integration'}
          </button>
        </div>
      </form>
    </>
  );
}

export function ProjectSettings({
  config,
  projectId,
  onClose,
}: {
  config: CrowcodeConfig;
  projectId: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'agents' | 'integrations'>('agents');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Project settings</span>
          <button type="button" className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-tabs">
          <button
            type="button"
            className={`modal-tab${tab === 'agents' ? ' modal-tab--active' : ''}`}
            onClick={() => setTab('agents')}
          >
            Agents
          </button>
          <button
            type="button"
            className={`modal-tab${tab === 'integrations' ? ' modal-tab--active' : ''}`}
            onClick={() => setTab('integrations')}
          >
            Integrations
          </button>
        </div>

        <div className="modal-body">
          {tab === 'agents' ? (
            <AgentsTab config={config} projectId={projectId} />
          ) : (
            <IntegrationsTab config={config} projectId={projectId} />
          )}
        </div>
      </div>
    </div>
  );
}
