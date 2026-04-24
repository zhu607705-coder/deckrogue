/**
 * @file BranchingOutcomeModal.tsx
 * @description 分支结果模态框 - 展示事件的多种可能结果和选择
 *
 * 主要职责:
 * - 渲染分支叙事条目
 * - 显示结果条件和奖励
 * - 提供视觉动画效果
 */

import React from 'react';

export interface NarrativeEntry {
  title: string;
  description: string;
  flavorText: string;
  icon?: string;
}

export interface OutcomeCondition {
  type: 'hp_threshold' | 'turn_count' | 'status_count' | 'action_sequence' | 'relic_owned';
  params: Record<string, any>;
  comparison: 'gte' | 'lte' | 'eq' | 'contains';
}

export interface RewardSpec {
  type: string;
  id: string;
  amount?: number;
}

export interface OutcomeChoice {
  id: string;
  label: string;
  description: string;
  requirements: OutcomeCondition[];
  result: {
    combatContinuation: boolean;
    reward?: RewardSpec;
    penalty?: RewardSpec;
    narrative: NarrativeEntry;
  };
}

export interface BranchingOutcome {
  id: string;
  triggerCondition: OutcomeCondition;
  combatModification: Record<string, any>;
  narrative: NarrativeEntry;
  availableChoices: OutcomeChoice[];
}

interface BranchingOutcomeModalProps {
  outcome: BranchingOutcome;
  onSelectChoice: (choice: OutcomeChoice) => void;
  onDecline: () => void;
  visible: boolean;
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.85)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: '20px',
};

const modalStyle: React.CSSProperties = {
  backgroundColor: '#1a1a1a',
  border: '2px solid #c9a227',
  borderRadius: '12px',
  maxWidth: '560px',
  width: '100%',
  maxHeight: '90vh',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 0 40px rgba(201, 162, 39, 0.3)',
};

const headerStyle: React.CSSProperties = {
  backgroundColor: '#2d2d2d',
  padding: '20px 24px',
  borderBottom: '1px solid #c9a227',
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  color: '#c9a227',
  fontSize: '24px',
  fontWeight: 'bold',
  textAlign: 'center',
  textShadow: '0 0 10px rgba(201, 162, 39, 0.5)',
};

const contentStyle: React.CSSProperties = {
  padding: '24px',
  overflowY: 'auto',
  flex: 1,
};

const descriptionStyle: React.CSSProperties = {
  color: '#e0e0e0',
  fontSize: '15px',
  lineHeight: 1.6,
  marginBottom: '12px',
  textAlign: 'center',
};

const flavorStyle: React.CSSProperties = {
  color: '#9e9e9e',
  fontSize: '13px',
  fontStyle: 'italic',
  lineHeight: 1.5,
  marginBottom: '24px',
  textAlign: 'center',
  borderLeft: '3px solid #c9a227',
  paddingLeft: '12px',
};

const choiceListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  marginBottom: '24px',
};

const choiceButtonStyle: React.CSSProperties = {
  backgroundColor: '#2d2d2d',
  border: '1px solid #4a4a4a',
  borderRadius: '8px',
  padding: '16px 20px',
  cursor: 'pointer',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: '6px',
  transition: 'all 0.2s ease',
  textAlign: 'left',
  width: '100%',
};

const choiceLabelStyle: React.CSSProperties = {
  color: '#c9a227',
  fontSize: '16px',
  fontWeight: 'bold',
};

const choiceDescriptionStyle: React.CSSProperties = {
  color: '#b0b0b0',
  fontSize: '13px',
  lineHeight: 1.4,
};

const declineButtonStyle: React.CSSProperties = {
  backgroundColor: 'transparent',
  border: '1px solid #6b6b6b',
  borderRadius: '8px',
  padding: '12px 24px',
  color: '#9e9e9e',
  fontSize: '14px',
  cursor: 'pointer',
  width: '100%',
  transition: 'all 0.2s ease',
};

export function BranchingOutcomeModal({
  outcome,
  onSelectChoice,
  onDecline,
  visible,
}: BranchingOutcomeModalProps) {
  if (!visible) return null;

  const handleChoiceHover = (e: React.MouseEvent<HTMLButtonElement>, isHover: boolean) => {
    const target = e.currentTarget;
    if (isHover) {
      target.style.backgroundColor = '#3a3a3a';
      target.style.borderColor = '#c9a227';
      target.style.transform = 'translateY(-2px)';
      target.style.boxShadow = '0 4px 12px rgba(201, 162, 39, 0.2)';
    } else {
      target.style.backgroundColor = '#2d2d2d';
      target.style.borderColor = '#4a4a4a';
      target.style.transform = 'translateY(0)';
      target.style.boxShadow = 'none';
    }
  };

  const handleDeclineHover = (e: React.MouseEvent<HTMLButtonElement>, isHover: boolean) => {
    const target = e.currentTarget;
    if (isHover) {
      target.style.backgroundColor = '#2d2d2d';
      target.style.borderColor = '#9e9e9e';
      target.style.color = '#e0e0e0';
    } else {
      target.style.backgroundColor = 'transparent';
      target.style.borderColor = '#6b6b6b';
      target.style.color = '#9e9e9e';
    }
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={headerStyle}>
          <h2 style={titleStyle}>{outcome.narrative.title}</h2>
        </div>

        <div style={contentStyle}>
          <p style={descriptionStyle}>{outcome.narrative.description}</p>
          <p style={flavorStyle}>{outcome.narrative.flavorText}</p>

          <div style={choiceListStyle}>
            {outcome.availableChoices.map((choice) => (
              <button
                key={choice.id}
                style={choiceButtonStyle}
                onClick={() => onSelectChoice(choice)}
                onMouseEnter={(e) => handleChoiceHover(e, true)}
                onMouseLeave={(e) => handleChoiceHover(e, false)}
              >
                <span style={choiceLabelStyle}>{choice.label}</span>
                <span style={choiceDescriptionStyle}>{choice.description}</span>
              </button>
            ))}
          </div>

          <button
            style={declineButtonStyle}
            onClick={onDecline}
            onMouseEnter={(e) => handleDeclineHover(e, true)}
            onMouseLeave={(e) => handleDeclineHover(e, false)}
          >
            继续作战
          </button>
        </div>
      </div>
    </div>
  );
}
