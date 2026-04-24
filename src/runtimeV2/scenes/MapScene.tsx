/**
 * @file MapScene.tsx
 * @description 地图场景 DOM 组件，渲染地图节点、路线和玩家 HUD
 *
 * 主要职责:
 * - 渲染地图节点、连线和路线推荐面板
 * - 处理节点进入交互回调
 * - 显示玩家状态和路线判断信息
 */
import React from 'react';
import type { MapSceneProps } from '../sceneProps';

export interface MapSceneComponentProps {
  scene: MapSceneProps;
  onEnterNode: (nodeId: string) => void;
}

export function MapScene({ scene, onEnterNode }: MapSceneComponentProps) {
  const { player, map } = scene;
  const dossierByNodeId = new Map(map.routeDossiers.map((dossier) => [dossier.nodeId, dossier]));

  return (
    <div className="map-scene" data-scene="map">
      <div className="player-hud">
        <span>生命：{player.hp}/{player.maxHp}</span>
        <span>金币：{player.gold}</span>
        <span>牌库：{player.deckCount}</span>
        {map.currentFloor && <span>层级：{map.currentFloor}</span>}
      </div>
      <h2>地图路线</h2>
      {map.routeDossiers.length > 0 && (
        <div className="route-guidance-panel">
          <strong>路线判断</strong>
          <span>
            推荐：{map.recommendedNodeId ?? '无'} · {
              map.recommendedNodeId ? dossierByNodeId.get(map.recommendedNodeId)?.summary : '等待更多节点信息'
            }
          </span>
        </div>
      )}
      <div className="map-nodes">
        {map.nodes.map((node) => {
          const dossier = dossierByNodeId.get(node.id);
          const isRecommended = map.recommendedNodeId === node.id;
          return (
            <button
              key={node.id}
              className={`map-node ${node.revealed ? 'revealed' : 'hidden'} ${map.availableNodeIds.includes(node.id) ? 'available' : ''} ${isRecommended ? 'recommended' : ''}`}
              onClick={() => map.availableNodeIds.includes(node.id) && onEnterNode(node.id)}
              disabled={!map.availableNodeIds.includes(node.id)}
              data-node-id={node.id}
              data-node-type={node.type}
              data-recommended={isRecommended ? 'true' : undefined}
            >
              <span className="node-id">{node.id}</span>
              <span className="node-type">{node.type}</span>
              {dossier && <span className="node-guidance">{dossier.fitLabel} · {dossier.summary}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
