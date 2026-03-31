import React from 'react';
import { tokenizeGlossaryText } from '@/ui/content/terminology';
import { GlossaryTerm } from '@/ui/components/GlossaryTerm';

export function GlossaryText({
  text,
  className = ''
}: {
  text: string;
  className?: string;
}) {
  return (
    <span className={className}>
      {tokenizeGlossaryText(text).map((token, index) => {
        if (token.type === 'term') {
          return (
            <GlossaryTerm key={`${token.value}-${index}`} term={token.value}>
              {token.value}
            </GlossaryTerm>
          );
        }
        if (token.type === 'number') {
          return <span key={`${token.value}-${index}`}>{token.value}</span>;
        }
        return <React.Fragment key={`${token.value}-${index}`}>{token.value}</React.Fragment>;
      })}
    </span>
  );
}
