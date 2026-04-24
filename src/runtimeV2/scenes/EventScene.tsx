/**
 * @file EventScene.tsx
 * @description 事件场景 DOM 组件，渲染事件描述和选项按钮
 *
 * 主要职责:
 * - 渲染事件标题、描述和路线引导面板
 * - 绘制事件选项按钮并处理点击回调
 * - 显示选项的禁用状态和路线标签
 */
import React from 'react';
import type { EventSceneProps } from '../sceneProps';

export interface EventSceneComponentProps {
  scene: EventSceneProps;
  onChooseOption: (choiceId: string) => void;
}

export function EventScene({ scene, onChooseOption }: EventSceneComponentProps) {
  const { room } = scene;

  return (
    <div className="event-scene" data-scene="event">
      <h2>{room.title ?? 'Event'}</h2>
      {room.body && <p className="event-description">{room.body}</p>}
      {room.guidance && (
        <div className="route-guidance-panel">
          <strong>{room.guidance.headline}</strong>
          <span>{room.guidance.routeLabel ? `${room.guidance.routeLabel} · ` : ''}{room.guidance.reason}</span>
        </div>
      )}
      <div className="event-choices">
        {room.choices.map((choice) => (
          <button
            key={choice.id}
            className="event-choice-btn"
            onClick={() => onChooseOption(choice.id)}
            disabled={choice.disabled}
            data-choice-id={choice.id}
          >
            <span className="choice-label">{choice.label}</span>
            {choice.description && <span className="choice-desc">{choice.description}</span>}
            {choice.routeReason && <span className="choice-route">{choice.routeReason}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
