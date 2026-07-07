import { useEffect, useRef, useState } from 'react';
import type { CrowcodeConfig } from './global.js';

interface ProjectRow {
  id: string;
  name: string;
  repoUrl: string;
  workingBranch: string;
}

interface FeedLine {
  id: string;
  agentType?: string;
  text: string;
}

function extractText(raw: unknown): string | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const message = (raw as { type?: string; message?: { content?: unknown } }).message;
  const content = message?.content;
  if (!Array.isArray(content)) return null;
  const text = content
    .filter((block): block is { type: 'text'; text: string } => {
      return typeof block === 'object' && block !== null && (block as { type?: string }).type === 'text';
    })
    .map((block) => block.text)
    .join('');
  return text || null;
}

export function App() {
  const [config, setConfig] = useState<CrowcodeConfig | null>(null);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [feed, setFeed] = useState<FeedLine[]>([]);
  const [draftMessage, setDraftMessage] = useState('');
  const [form, setForm] = useState({ name: '', repoUrl: '', gitCredential: '' });
  const wsRef = useRef<WebSocket | null>(null);

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
    if (!config || !selectedProjectId) return;
    setFeed([]);
    const ws = new WebSocket(config.controlPlaneWsUrl);
    wsRef.current = ws;
    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({ type: 'subscribe', projectId: selectedProjectId }));
    });
    ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'session_event' && message.event.payload.type === 'sdk_message') {
        const text = extractText(message.event.payload.raw);
        if (text) {
          setFeed((prev) => [
            ...prev,
            { id: crypto.randomUUID(), agentType: message.event.payload.agentType, text },
          ]);
        }
      } else if (message.type === 'error') {
        setFeed((prev) => [...prev, { id: crypto.randomUUID(), text: `error: ${message.message}` }]);
      }
    });
    return () => ws.close();
  }, [config, selectedProjectId]);

  async function createProject() {
    if (!config) return;
    const res = await fetch(`${config.controlPlaneHttpUrl}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (!res.ok) return;
    const { project } = await res.json();
    setProjects((prev) => [...prev, project]);
    setSelectedProjectId(project.id);
    setForm({ name: '', repoUrl: '', gitCredential: '' });
  }

  function sendMessage() {
    if (!wsRef.current || !selectedProjectId || !draftMessage.trim()) return;
    wsRef.current.send(
      JSON.stringify({ type: 'user_message', projectId: selectedProjectId, text: draftMessage }),
    );
    setFeed((prev) => [...prev, { id: crypto.randomUUID(), text: `you: ${draftMessage}` }]);
    setDraftMessage('');
  }

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif' }}>
      <div style={{ width: 280, borderRight: '1px solid #333', padding: 12 }}>
        <h3>Projects</h3>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {projects.map((p) => (
            <li key={p.id}>
              <button onClick={() => setSelectedProjectId(p.id)} style={{ width: '100%', textAlign: 'left' }}>
                {p.name}
              </button>
            </li>
          ))}
        </ul>
        <h4>New project</h4>
        <input
          placeholder="name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          placeholder="repo url"
          value={form.repoUrl}
          onChange={(e) => setForm({ ...form, repoUrl: e.target.value })}
        />
        <input
          placeholder="git PAT"
          type="password"
          value={form.gitCredential}
          onChange={(e) => setForm({ ...form, gitCredential: e.target.value })}
        />
        <button onClick={createProject}>Create</button>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 12 }}>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {feed.map((line) => (
            <div key={line.id}>
              {line.agentType ? <b>[{line.agentType}] </b> : null}
              {line.text}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex' }}>
          <input
            style={{ flex: 1 }}
            value={draftMessage}
            onChange={(e) => setDraftMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder={selectedProjectId ? 'Message the orchestrator...' : 'Select a project first'}
            disabled={!selectedProjectId}
          />
          <button onClick={sendMessage} disabled={!selectedProjectId}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
