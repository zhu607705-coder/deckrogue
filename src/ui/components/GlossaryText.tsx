/**
 * @file GlossaryText.tsx
 * @description 术语文本组件 - 将含术语标记的文本解析为带高亮的富文本
 *
 * 主要职责:
 * - 解析文本中的术语标记
 * - 渲染带高亮的术语词条组件
 * - 支持自定义样式
 */

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
