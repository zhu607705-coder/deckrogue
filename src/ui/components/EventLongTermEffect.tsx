import React from 'react';
import { motion } from 'motion/react';

interface EventLongTermEffectProps {
  effect: {
    type: string;
    duration: string;
    description: string;
  };
  className?: string;
}

export const EventLongTermEffect: React.FC<EventLongTermEffectProps> = ({ effect, className = '' }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        ease: [0.4, 0, 0.2, 1]
      }}
      className={`event-long-term-effect ${className}`}
    >
      <div className="event-long-term-effect__icon">
        {effect.type === 'blessing' && '✨'}
        {effect.type === 'curse' && '⚠️'}
        {effect.type === 'buff' && '📈'}
        {effect.type === 'debuff' && '📉'}
        {effect.type === 'quest' && '📜'}
        {!['blessing', 'curse', 'buff', 'debuff', 'quest'].includes(effect.type) && '📌'}
      </div>
      <div className="event-long-term-effect__content">
        <div className="event-long-term-effect__title">
          {effect.type === 'blessing' && '祝福'}
          {effect.type === 'curse' && '诅咒'}
          {effect.type === 'buff' && '增益'}
          {effect.type === 'debuff' && '减益'}
          {effect.type === 'quest' && '任务'}
          {!['blessing', 'curse', 'buff', 'debuff', 'quest'].includes(effect.type) && '长期影响'}
        </div>
        <div className="event-long-term-effect__duration">{effect.duration}</div>
        <div className="event-long-term-effect__description">{effect.description}</div>
      </div>
    </motion.div>
  );
};

// 用于在事件选项中显示长期影响提示的包装组件
export const EventOptionLongTermEffect: React.FC<{
  effects: Array<{
    type: string;
    duration: string;
    description: string;
  }>;
  className?: string;
}> = ({ effects, className = '' }) => {
  if (effects.length === 0) return null;

  return (
    <div className={`event-option-long-term-effects ${className}`}>
      {effects.map((effect, index) => (
        <EventLongTermEffect
          key={index}
          effect={effect}
          className="event-option-long-term-effects__item"
        />
      ))}
    </div>
  );
};

export default EventLongTermEffect;