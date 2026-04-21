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
