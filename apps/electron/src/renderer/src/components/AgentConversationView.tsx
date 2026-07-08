import { useEffect, useRef, useState } from 'react';
import type { AgentStatus, ManagedAgent, SdkMessageEvent } from '@crowcode/shared-types';
import type { CrowcodeConfig } from '../global.js';
import { parseSdkEvents } from '../lib/parseSdkEvents.js';
import { TurnBlock } from './TurnBlock.js';

/**
 * Read-only view of a managed agent's own persistent conversation --
 * project-scoped, independent of any one session's lifecycle. Reuses
 * parseSdkEvents/TurnBlock unchanged since the control-plane conversation
 * endpoint returns the same SdkMessageEvent[] shape a session's chat does.
 *
 * Not fully live: while a call is in progress, `status` (fed by the
 * project-scoped WS status channel) shows "running" in real time, but the
 * conversation content itself only refreshes once that call finishes
 * (running -> idle) -- full token-by-token streaming to a passive observer
 * is a follow-up, not needed to make the conversation genuinely persistent
 * and observable.
 */
export function AgentConversationView({
  config,
  agent,
  status,
}: {
  config: CrowcodeConfig;
  agent: ManagedAgent;
  status: AgentStatus;
}) {
  const [events, setEvents] = useState<SdkMessageEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const prevStatusRef = useRef(status);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  function loadConversation() {
    setLoading(true);
    fetch(`${config.controlPlaneHttpUrl}/projects/${agent.projectId}/agents/${agent.id}/conversation`)
      .then((res) => res.json())
      .then((data) => setEvents(data.events ?? []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadConversation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, agent.id]);

  useEffect(() => {
    if (prevStatusRef.current === 'running' && status === 'idle') {
      loadConversation();
    }
    prevStatusRef.current = status;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [events]);

  const turns = parseSdkEvents(events);

  return (
    <main className="chat-panel">
      <div className="chat-header">
        <span className="chat-header-title">{agent.name}</span>
        <span className={`chat-connection-dot${status === 'running' ? ' chat-connection-dot--live' : ''}`} />
        <div className="chat-header-spacer" />
        <span className="agent-view-badge">Read-only</span>
      </div>

      <div className="chat-body">
        <div className="chat-main-column">
          <div className="chat-messages scrollable">
            <div className="chat-messages-column">
              {loading && events.length === 0 ? (
                <div className="chat-empty-state">Loading…</div>
              ) : turns.length === 0 ? (
                <div className="chat-empty-state">{agent.name} hasn't been called yet</div>
              ) : (
                turns.map((turn) => <TurnBlock key={turn.id} turn={turn} />)
              )}
              <div ref={bottomRef} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
