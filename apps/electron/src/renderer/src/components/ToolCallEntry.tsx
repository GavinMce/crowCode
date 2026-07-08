import { useState } from 'react';
import type { ToolCallContentBlock } from '../lib/parseSdkEvents.js';
import { TurnBlock } from './TurnBlock.js';

const OUTPUT_LINE_THRESHOLD = 12;

function truncateOneLine(text: string, max: number): string {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  return oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine;
}

function summarizeInput(input: unknown): string {
  if (!input || typeof input !== 'object') return '';
  const obj = input as Record<string, unknown>;
  const preferredKeys = ['file_path', 'path', 'command', 'pattern', 'query', 'url', 'prompt', 'description'];
  for (const key of preferredKeys) {
    const value = obj[key];
    if (typeof value === 'string' && value.length > 0) return truncateOneLine(value, 90);
  }
  const firstString = Object.values(obj).find((v): v is string => typeof v === 'string');
  return firstString ? truncateOneLine(firstString, 90) : '';
}

function TruncatedOutput({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const lines = text.split('\n');
  const isLong = lines.length > OUTPUT_LINE_THRESHOLD;
  const shown = expanded || !isLong ? text : lines.slice(0, OUTPUT_LINE_THRESHOLD).join('\n');

  return (
    <div className="tool-call-output">
      <pre>{shown}</pre>
      {isLong && (
        <button type="button" className="tool-call-show-more" onClick={() => setExpanded((e) => !e)}>
          {expanded ? 'Show less' : `Show ${lines.length - OUTPUT_LINE_THRESHOLD} more lines`}
        </button>
      )}
    </div>
  );
}

export function ToolCallEntry({ block }: { block: ToolCallContentBlock }) {
  const argsSummary = summarizeInput(block.input);
  const status = !block.result ? 'pending' : block.result.isError ? 'error' : 'ok';

  return (
    <div className="tool-call">
      <div className="tool-call-header">
        <span className={`tool-call-bullet tool-call-bullet--${status}`}>●</span>
        <span className="tool-call-name">{block.name}</span>
        {argsSummary && <span className="tool-call-args">{argsSummary}</span>}
        {status === 'pending' && <span className="tool-call-status">running…</span>}
      </div>

      {block.result && block.result.text && <TruncatedOutput text={block.result.text} />}

      {block.childTurns.length > 0 && (
        <div className="tool-call-children">
          {block.childTurns.map((turn) => (
            <TurnBlock key={turn.id} turn={turn} />
          ))}
        </div>
      )}
    </div>
  );
}
