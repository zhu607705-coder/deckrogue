import React from 'react';
import type { MapSceneProps } from '../sceneProps';

export interface MapSceneComponentProps {
  scene: MapSceneProps;
  onEnterNode: (nodeId: string) => void;
}

export function MapScene({ scene, onEnterNode }: MapSceneComponentProps) {
  const { player, map } = scene;

  return (
    <div className="map-scene" data-scene="map">
      <div className="player-hud">
        <span>生命：{player.hp}/{player.maxHp}</span>
        <span>金币：{player.gold}</span>
        <span>牌库：{player.deckCount}</span>
        {map.currentFloor && <span>层级：{map.currentFloor}</span>}
      </div>
      <h2>地图路线</h2>
      <div className="map-nodes">
        {map.nodes.map((node) => (
          <button
            key={node.id}
            className={`map-node ${node.revealed ? 'revealed' : 'hidden'} ${map.availableNodeIds.includes(node.id) ? 'available' : ''}`}
            onClick={() => map.availableNodeIds.includes(node.id) && onEnterNode(node.id)}
            disabled={!map.availableNodeIds.includes(node.id)}
            data-node-id={node.id}
            data-node-type={node.type}
          >
            <span className="node-id">{node.id}</span>
            <span className="node-type">{node.type}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
