import type { Turn } from '../lib/parseSdkEvents.js';
import { Markdown } from './Markdown.js';
import { ToolCallEntry } from './ToolCallEntry.js';

export function TurnBlock({ turn }: { turn: Turn }) {
  if (turn.kind === 'meta') {
    return <div className={`meta-turn meta-turn--${turn.subtype}`}>{turn.text}</div>;
  }

  return (
    <div className="turn">
      {turn.agentType && <div className="turn-agent-label">{turn.agentType}</div>}
      {turn.blocks.map((block) => {
        if (block.kind === 'text') return <Markdown key={block.id} text={block.text} />;
        if (block.kind === 'thinking') {
          return (
            <details key={block.id} className="thinking-block">
              <summary>Thinking</summary>
              <div className="thinking-text">{block.text}</div>
            </details>
          );
        }
        return <ToolCallEntry key={block.id} block={block} />;
      })}
    </div>
  );
}
