import React, { useMemo } from 'react';
import { tokenizeGlossaryText, type TextToken } from '@/ui/content/terminology';
import { GlossaryTerm } from '@/ui/components/GlossaryTerm';

export function GlossaryText({
  text,
  className = ''
}: {
  text: string;
  className?: string;
}) {
  const tokens = useMemo(() => tokenizeGlossaryText(text), [text]);

  return (
    <span className={className}>
      {tokens.map((token: TextToken, index: number) => {
        const key = `glossary-${index}-${token.type}`;
        if (token.type === 'term') {
          return (
            <GlossaryTerm key={key} term={token.value}>
              {token.value}
            </GlossaryTerm>
          );
        }
        if (token.type === 'number') {
          return <span key={key}>{token.value}</span>;
        }
        return <React.Fragment key={key}>{token.value}</React.Fragment>;
      })}
    </span>
  );
}
