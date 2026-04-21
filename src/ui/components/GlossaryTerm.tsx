import React from 'react';
import { getGlossaryEntry } from '@/ui/content/terminology';

export function GlossaryTerm({
  term,
  children,
  className = ''
}: {
  term: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const entry = getGlossaryEntry(term);
  const [open, setOpen] = React.useState(false);

  if (!entry) {
    return <span className={className}>{children || term}</span>;
  }

  return (
    <span
      className={`glossary-term glossary-term--interactive ${className}`.trim()}
      tabIndex={0}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      aria-label={`${entry.label}：${entry.description}`}
      data-glossary-open={open ? 'true' : 'false'}
    >
      <span className="glossary-term__trigger">{children || term}</span>
      <span className="glossary-term__bubble" role="tooltip" aria-hidden={open ? 'false' : 'true'}>
        <span className="glossary-term__bubbleLabel">{entry.label}</span>
        <span className="glossary-term__bubbleBody">{entry.description}</span>
      </span>
    </span>
  );
}
