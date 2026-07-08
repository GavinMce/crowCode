function diffLineClass(line: string): string {
  if (line.startsWith('+++') || line.startsWith('---')) return 'diff-file-header';
  if (line.startsWith('+')) return 'diff-add';
  if (line.startsWith('-')) return 'diff-remove';
  if (line.startsWith('@@')) return 'diff-hunk';
  if (line.startsWith('diff --git') || line.startsWith('index ')) return 'diff-meta';
  return '';
}

export function ChangesPanel({ diff }: { diff: string | null }) {
  return (
    <div className="changes-panel">
      <div className="changes-panel-header">Changes</div>
      <div className="changes-panel-body scrollable">
        {!diff ? (
          <div className="changes-empty">No changes yet</div>
        ) : (
          <pre className="changes-diff">
            {diff.split('\n').map((line, i) => (
              <div key={i} className={diffLineClass(line)}>
                {line.length > 0 ? line : ' '}
              </div>
            ))}
          </pre>
        )}
      </div>
    </div>
  );
}
