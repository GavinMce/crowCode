import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ControlPlaneToElectronMessageSchema, type SdkMessageEvent } from '@crowcode/shared-types';
import type { CrowcodeConfig } from '../global.js';
import type { ProjectRow } from '../types.js';
import { parseSdkEvents } from '../lib/parseSdkEvents.js';
import { TurnBlock } from './TurnBlock.js';

interface Segment {
  id: string;
  userText?: string;
  events: SdkMessageEvent[];
  error?: string;
}

function newSegment(userText?: string): Segment {
  return { id: crypto.randomUUID(), userText, events: [] };
}

export function ChatPanel({ config, project }: { config: CrowcodeConfig; project: ProjectRow | null }) {
  const [segments, setSegments] = useState<Segment[]>([newSegment()]);
  const [connected, setConnected] = useState(false);
  const [draft, setDraft] = useState('');
  const wsRef = useRef<WebSocket | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSegments([newSegment()]);
    setConnected(false);
    if (!project) return;

    const ws = new WebSocket(config.controlPlaneWsUrl);
    wsRef.current = ws;

    ws.addEventListener('open', () => {
      setConnected(true);
      ws.send(JSON.stringify({ type: 'subscribe', projectId: project.id }));
    });

    ws.addEventListener('close', () => setConnected(false));

    ws.addEventListener('message', (rawEvent) => {
      const parsed = ControlPlaneToElectronMessageSchema.safeParse(JSON.parse(rawEvent.data as string));
      if (!parsed.success) return;
      const message = parsed.data;

      if (message.type === 'session_event' && message.event.payload.type === 'sdk_message') {
        const sdkEvent = message.event.payload;
        setSegments((prev) => {
          const last = prev[prev.length - 1];
          const updated: Segment = { ...last, events: [...last.events, sdkEvent] };
          return [...prev.slice(0, -1), updated];
        });
      } else if (message.type === 'error') {
        setSegments((prev) => {
          const last = prev[prev.length - 1];
          return [...prev.slice(0, -1), { ...last, error: message.message }];
        });
      }
    });

    return () => ws.close();
  }, [config, project?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [segments]);

  function sendMessage() {
    const text = draft.trim();
    const ws = wsRef.current;
    if (!text || !ws || !project || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: 'user_message', projectId: project.id, text }));
    setSegments((prev) => [...prev, newSegment(text)]);
    setDraft('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  function handleDraftChange(value: string) {
    setDraft(value);
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
    }
  }

  if (!project) {
    return (
      <main className="chat-panel chat-panel--empty">
        <div className="chat-empty-state">Select or create a project to get started</div>
      </main>
    );
  }

  return (
    <main className="chat-panel">
      <div className="chat-header">
        <span className="chat-header-title">{project.name}</span>
        <span className={`chat-connection-dot${connected ? ' chat-connection-dot--live' : ''}`} />
      </div>

      <div className="chat-messages scrollable">
        <div className="chat-messages-column">
          {segments.map((segment) => (
            <div key={segment.id} className="chat-segment">
              {segment.userText && <div className="user-message">{segment.userText}</div>}
              {parseSdkEvents(segment.events).map((turn) => (
                <TurnBlock key={turn.id} turn={turn} />
              ))}
              {segment.error && <div className="meta-turn meta-turn--error">{segment.error}</div>}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="chat-composer">
        <div className="chat-composer-column">
          <textarea
            ref={textareaRef}
            className="chat-input"
            rows={1}
            value={draft}
            onChange={(e) => handleDraftChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message the orchestrator…"
          />
          <button type="button" className="chat-send-button" onClick={sendMessage} disabled={!draft.trim()}>
            Send
          </button>
        </div>
      </div>
    </main>
  );
}
