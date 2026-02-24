import React from 'react';
import { CardDef } from '../engine/types';

type CardTheme =
  | 'obsidian'
  | 'berserker'
  | 'clockwork'
  | 'storm'
  | 'rogue'
  | 'alchemy'
  | 'wood'
  | 'tactic'
  | 'mech'
  | 'magic'
  | 'time'
  | 'mirror'
  | 'spirit'
  | 'acid';
type CardViewProps = { card: CardDef; onClick?: () => void; disabled?: boolean };

function hasAction(card: CardDef, types: string[]) {
  const visit = (actions: any[] | undefined): boolean => {
    if (!actions) return false;
    for (const action of actions) {
      if (types.includes(action.type)) return true;
      if (visit(action.actions) || visit(action.trueActions) || visit(action.falseActions)) return true;
    }
    return false;
  };
  return visit(card.actions as any[]);
}

function cardText(card: CardDef) {
  return `${card.id} ${card.name} ${card.text}`.toLowerCase();
}

function isTacticSupportCard(card: CardDef) {
  if (card.type !== 'Skill') return false;
  const tags = new Set(card.tags || []);
  const hasResearchFlavor =
    tags.has('intel') ||
    hasAction(card, ['Draw', 'GainIntel', 'Conditional', 'ApplyStatus', 'DoubleStatus', 'RedirectIntent']);
  const dealsDamage = hasAction(card, ['DealDamage', 'PrecisionThrowDamage', 'ElementalOverloadDamage', 'SolventDamage']);
  return hasResearchFlavor && !dealsDamage;
}

function isMechanicalCard(card: CardDef) {
  return (
    card.character === 'puppeteer' ||
    hasAction(card, ['Summon', 'BuffConstructs', 'ConstructOverdrive', 'HealConstruct', 'SummonMegaConstruct'])
  );
}

function isArcaneElementalCard(card: CardDef) {
  return (
    card.character === 'alchemist' ||
    hasAction(card, ['AddElement', 'AddRandomElement', 'TriggerReactions', 'ElementalOverloadDamage', 'TransmuteElements'])
  );
}

function isTimeCard(card: CardDef) {
  const t = cardText(card);
  return (
    card.character === 'chronomancer' &&
    (/time|chrono|temporal|paradox|deja|delay|stasis|borrowed/.test(t) ||
      hasAction(card, ['Delay', 'TriggerDelay', 'ReturnLastCard', 'Revive']))
  );
}

function isMirrorCard(card: CardDef) {
  const t = cardText(card);
  return /mirror|reflect|redirect|turn the tables/.test(t) || hasAction(card, ['RedirectIntent', 'EmergencyBlock']);
}

function isSpiritCard(card: CardDef) {
  const t = cardText(card);
  return /soul|ghost|void|stealth|dark/.test(t) || (card.id === 'go_dark') || (card.id === 'soul_link');
}

function isAcidCard(card: CardDef) {
  const t = cardText(card);
  return /acid|poison|solvent|corros/.test(t) || hasAction(card, ['SolventDamage']);
}

function getCardTheme(card: CardDef): CardTheme {
  if (isTimeCard(card)) return 'time';
  if (isMirrorCard(card)) return 'mirror';
  if (isSpiritCard(card)) return 'spirit';
  if (isAcidCard(card)) return 'acid';
  if (card.rarity === 'Starter') return 'wood';
  if (isTacticSupportCard(card)) return 'tactic';
  if (isMechanicalCard(card)) return 'mech';
  if (isArcaneElementalCard(card)) return 'magic';

  switch (card.character) {
    case 'brute':
      return 'berserker';
    case 'chronomancer':
      return 'clockwork';
    case 'informant':
      return 'storm';
    case 'tactician':
      return 'rogue';
    case 'puppeteer':
      return 'mech';
    case 'alchemist':
      return 'alchemy';
    default:
      if (card.type === 'Attack') return 'berserker';
      if (card.type === 'Skill') return 'tactic';
      return 'obsidian';
  }
}

function getTypeLabel(card: CardDef) {
  return `${card.rarity} · ${card.type}`;
}

function renderCardText(text: string) {
  return text.split(/(\[[^\]]+\]|\d+)/g).map((part, idx) => {
    if (!part) return null;
    if (/^\d+$/.test(part)) {
      return (
        <span key={idx} className="immersive-card__number">
          {part}
        </span>
      );
    }
    if (/^\[[^\]]+\]$/.test(part)) {
      return (
        <span key={idx} className="immersive-card__keyword">
          {part}
        </span>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

export const CardView: React.FC<CardViewProps> = ({ card, onClick, disabled }) => {
  const theme = getCardTheme(card);
  const displayCost = (card as any).tempCost ?? card.cost;

  return (
    <div
      onClick={disabled ? undefined : onClick}
      className={[
        'immersive-card',
        `immersive-card--${theme}`,
        card.rarity === 'Rare' ? 'is-rare' : '',
        card.rarity === 'Uncommon' ? 'is-uncommon' : '',
        card.isUpgraded ? 'is-upgraded' : '',
        disabled ? 'is-disabled' : '',
        !disabled && onClick ? 'is-clickable' : ''
      ].filter(Boolean).join(' ')}
    >
      <div className="immersive-card__glow" />
      <div className="immersive-card__frame">
        <div className="immersive-card__cost" aria-label={`Cost ${displayCost}`}>
          <span>{displayCost}</span>
        </div>

        <div className="immersive-card__header">
          <div className="immersive-card__titleRow">
            <span className="immersive-card__title" title={card.name}>{card.name}</span>
            {card.isUpgraded && <span className="immersive-card__upgradeMark">+</span>}
          </div>
          <div className="immersive-card__subtitle">{getTypeLabel(card)}</div>
        </div>

        <div className="immersive-card__art">
          {card.artUrl ? (
            <img src={card.artUrl} alt={card.name} className="immersive-card__artImg" />
          ) : (
            <div className="immersive-card__artPlaceholder" />
          )}
          <div className="immersive-card__artShade" />
          <div className="immersive-card__artSigil">
            {card.type === 'Attack' ? 'ATK' : card.type === 'Skill' ? 'SKL' : 'PWR'}
          </div>
        </div>

        <div className="immersive-card__body">
          <div className="immersive-card__tagline">
            {card.targeting === 'AllEnemies' ? 'All Enemies' : card.targeting}
          </div>
          <div className="immersive-card__text" title={card.text}>
            {renderCardText(card.text)}
          </div>
        </div>
      </div>
    </div>
  );
};
