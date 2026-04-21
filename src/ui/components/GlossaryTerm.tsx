import React, { useCallback, useRef, useEffect } from 'react';
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
  const isOpenRef = useRef(false);
  const bubbleRef = useRef<HTMLSpanElement>(null);

  const showTooltip = useCallback(() => {
    if (!entry) return;
    isOpenRef.current = true;
    if (bubbleRef.current) {
      bubbleRef.current.style.display = 'block';
    }
  }, [entry]);

  const hideTooltip = useCallback(() => {
    isOpenRef.current = false;
    if (bubbleRef.current) {
      bubbleRef.current.style.display = 'none';
    }
  }, []);

  useEffect(() => {
    return () => {
      isOpenRef.current = false;
    };
  }, []);

  if (!entry) {
    return <span className={className}>{children || term}</span>;
  }

  return (
    <span
      className={`glossary-term glossary-term--interactive ${className}`.trim()}
      tabIndex={0}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
      aria-label={`${entry.label}：${entry.description}`}
    >
      <span className="glossary-term__trigger">{children || term}</span>
      <span
        ref={bubbleRef}
        className="glossary-term__bubble"
        role="tooltip"
        style={{ display: 'none' }}
        aria-hidden="true"
      >
        <span className="glossary-term__bubbleLabel">{entry.label}</span>
        <span className="glossary-term__bubbleBody">{entry.description}</span>
      </span>
    </span>
  );
}
