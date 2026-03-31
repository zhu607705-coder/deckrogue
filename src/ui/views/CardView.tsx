import React from 'react';
import type { CardDef, RunCardInstance } from '@/core';
import { ASSET_PLACEHOLDERS, bindImgFallback, localCardArt } from '@/ui/components/assetHelpers';
import { GlossaryTerm } from '@/ui/components/GlossaryTerm';
import { getCardNameZh, getCardTargetingZh, getCardTextZh, tokenizeGlossaryText } from '@/ui/content/terminology';
import { WarpDeceptionText } from '@/ui/overlays/WarpDeceptionText';

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

type CardRootProps = React.HTMLAttributes<HTMLDivElement> & {
  [key: `data-${string}`]: string | undefined;
};

type CardViewProps = {
  card: CardDef | RunCardInstance;
  onClick?: () => void;
  disabled?: boolean;
  displayText?: string;
  selected?: boolean;
  warpTide?: number;
  size?: 'default' | 'compact';
  rootProps?: CardRootProps;
};

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
  const typeZh = card.type === 'Attack' ? '攻击' : card.type === 'Skill' ? '技能' : '能力';
  const rarityZh = card.rarity === 'Starter' ? '基础' : card.rarity === 'Common' ? '普通' : card.rarity === 'Uncommon' ? '罕见' : card.rarity === 'Rare' ? '稀有' : card.rarity;
  return `${typeZh} · ${rarityZh}`;
}

function renderCardText(text: string, warpTide?: number, type: 'damage' | 'block' = 'damage') {
  return tokenizeGlossaryText(text).map((token, idx) => {
    if (token.type === 'number') {
      const numeric = Number(token.value);
      return (
        <span key={idx} className="immersive-card__number">
          <WarpDeceptionText realValue={numeric} warpTide={warpTide ?? 0} type={type} />
        </span>
      );
    }
    if (token.type === 'term') {
      return (
        <GlossaryTerm key={idx} term={token.value} className="immersive-card__keyword">
          {token.value}
        </GlossaryTerm>
      );
    }
    return <React.Fragment key={idx}>{token.value}</React.Fragment>;
  });
}

export const CardView: React.FC<CardViewProps> = ({
  card,
  onClick,
  disabled,
  displayText,
  selected,
  warpTide,
  size = 'default',
  rootProps
}) => {
  const theme = getCardTheme(card);
  const displayCost = (card as any).tempCost ?? card.cost;
  const localizedName = getCardNameZh(card);
  const text = getCardTextZh(card, displayText ?? card.text);
  const artSrc = card.artUrl || localCardArt(card.id);
  const persistentEnchantments = (card as RunCardInstance).persistentEnchantments || [];
  const combatAfflictions = (card as RunCardInstance).combatAfflictions || [];

  return (
    <div
      {...rootProps}
      onClick={disabled ? undefined : onClick}
      className={[
        'immersive-card',
        `immersive-card--${theme}`,
        size === 'compact' ? 'immersive-card--compact' : '',
        card.rarity === 'Rare' ? 'is-rare' : '',
        card.rarity === 'Uncommon' ? 'is-uncommon' : '',
        card.isUpgraded ? 'is-upgraded' : '',
        selected ? 'is-selected' : '',
        disabled ? 'is-disabled' : '',
        !disabled && onClick ? 'is-clickable' : '',
        rootProps?.className || ''
      ].filter(Boolean).join(' ')}
      tabIndex={rootProps?.tabIndex ?? (onClick && !disabled ? 0 : undefined)}
    >
      <div className="immersive-card__glow" />
      <div className="immersive-card__frame">
        <div className="immersive-card__cost" aria-label={`费用 ${displayCost}`}>
          <span><WarpDeceptionText realValue={displayCost} warpTide={warpTide ?? 0} type="cost" /></span>
        </div>

        <div className="immersive-card__header">
          <div className="immersive-card__titleRow">
            <span className="immersive-card__titleZh" title={localizedName}>{localizedName}</span>
            {card.name !== localizedName && (
              <span className="immersive-card__titleEn" title={card.name}>{card.name}</span>
            )}
            {card.isUpgraded && <span className="immersive-card__upgradeMark">+</span>}
          </div>
          <div className="immersive-card__typeBadges">
            <span className={`immersive-card__typeBadge immersive-card__typeBadge--${card.type.toLowerCase()}`}>
              {card.type === 'Attack' ? 'ATK' : card.type === 'Skill' ? 'SKL' : 'PWR'}
            </span>
            <span className={`immersive-card__rarityBadge immersive-card__rarityBadge--${card.rarity.toLowerCase()}`}>
              {card.rarity === 'Starter' ? '基础' : card.rarity === 'Common' ? '普通' : card.rarity === 'Uncommon' ? '罕见' : '稀有'}
            </span>
          </div>
          {(persistentEnchantments.length > 0 || combatAfflictions.length > 0) && (
            <div className="mt-2 flex flex-wrap gap-1">
              {persistentEnchantments.map((entry) => (
                <span
                  key={entry.id}
                  className="rounded-full border border-emerald-500/50 bg-emerald-950/35 px-2 py-0.5 text-[10px] uppercase tracking-wider text-emerald-200"
                  title={entry.description}
                >
                  附魔 · {entry.name}
                </span>
              ))}
              {combatAfflictions.map((entry) => (
                <span
                  key={entry.id}
                  className="rounded-full border border-fuchsia-500/50 bg-fuchsia-950/35 px-2 py-0.5 text-[10px] uppercase tracking-wider text-fuchsia-200"
                  title={entry.description}
                >
                  咒蚀 · {entry.name}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="immersive-card__art">
          {card.artUrl ? (
            <img src={artSrc} alt={card.name} className="immersive-card__artImg" onError={(e) => bindImgFallback(e, ASSET_PLACEHOLDERS.card)} />
          ) : (
            <img src={artSrc} alt={card.name} className="immersive-card__artImg" onError={(e) => bindImgFallback(e, ASSET_PLACEHOLDERS.card)} />
          )}
          <div className="immersive-card__artShade" />
        </div>

        <div className="immersive-card__body">
          <div className="immersive-card__tagline">
            <GlossaryTerm term={getCardTargetingZh(card.targeting)}>{getCardTargetingZh(card.targeting)}</GlossaryTerm>
          </div>
          <div className="immersive-card__text" title={text}>
            {renderCardText(text, warpTide, card.type === 'Skill' ? 'block' : 'damage')}
          </div>
        </div>
      </div>
    </div>
  );
};
