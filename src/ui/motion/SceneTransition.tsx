import React, { useEffect, useState, useCallback } from 'react';
import { 
  getMotionTokens, 
  getAmbientClassForScene, 
  shouldReduceAnimations,
  type SceneId 
} from '@/ui/motion';

interface SceneTransitionWrapperProps {
  sceneId: SceneId;
  children: React.ReactNode;
  onTransitionComplete?: () => void;
}

export function SceneTransitionWrapper({ 
  sceneId, 
  children, 
  onTransitionComplete 
}: SceneTransitionWrapperProps) {
  const [isEntering, setIsEntering] = useState(true);
  const [prevScene, setPrevScene] = useState<SceneId | null>(null);
  const tokens = getMotionTokens();

  useEffect(() => {
    if (prevScene !== null && prevScene !== sceneId) {
      setIsEntering(true);
      const timer = setTimeout(() => {
        setIsEntering(false);
        onTransitionComplete?.();
      }, tokens.sceneEnter);
      return () => clearTimeout(timer);
    } else {
      setIsEntering(false);
    }
    setPrevScene(sceneId);
  }, [sceneId, prevScene, tokens.sceneEnter, onTransitionComplete]);

  const reduced = shouldReduceAnimations();

  return (
    <div 
      className={`scene-wrapper ${isEntering && !reduced ? 'scene-enter' : ''}`}
      style={{ 
        animationDuration: reduced ? '0ms' : `${tokens.sceneEnter}ms` 
      }}
    >
      {children}
    </div>
  );
}

interface AmbientLayerProps {
  sceneId: SceneId;
}

export function AmbientLayer({ sceneId }: AmbientLayerProps) {
  const ambientClass = getAmbientClassForScene(sceneId);
  
  return (
    <div 
      className={`ambient-layer ${ambientClass}`}
      aria-hidden="true"
    />
  );
}

interface SceneContainerProps {
  sceneId: SceneId;
  children: React.ReactNode;
}

export function SceneContainer({ sceneId, children }: SceneContainerProps) {
  return (
    <div className="scene-container">
      <AmbientLayer sceneId={sceneId} />
      <SceneTransitionWrapper sceneId={sceneId}>
        {children}
      </SceneTransitionWrapper>
    </div>
  );
}

export default SceneContainer;
