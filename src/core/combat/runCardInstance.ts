import type {
  ActionSpec,
  CardAfflictionDef,
  CardDef,
  CardEnchantmentDef,
  RunCardInstance
} from '@/core/types/actions';

function cloneAction(action: ActionSpec): ActionSpec {
  return {
    ...action,
    condition: action.condition ? { ...action.condition } : undefined,
    scaling: action.scaling ? { ...action.scaling } : undefined,
    actions: action.actions?.map(cloneAction),
    trueActions: action.trueActions?.map(cloneAction),
    falseActions: action.falseActions?.map(cloneAction)
  };
}

function cloneBaseCard(card: CardDef): CardDef {
  return {
    ...card,
    actions: card.actions.map(cloneAction),
    tags: [...card.tags],
    upgrade: card.upgrade ? { ...card.upgrade } : undefined,
    instanceId: undefined
  };
}

function cloneModifier<T extends CardEnchantmentDef | CardAfflictionDef>(modifier: T): T {
  return { ...modifier, effect: { ...modifier.effect } as T['effect'] };
}

function applyEffectToActions(actions: ActionSpec[], effect: CardEnchantmentDef['effect'] | CardAfflictionDef['effect']): ActionSpec[] {
  return actions.map((action) => {
    const next = cloneAction(action);
    next.actions = next.actions ? applyEffectToActions(next.actions, effect) : next.actions;
    next.trueActions = next.trueActions ? applyEffectToActions(next.trueActions, effect) : next.trueActions;
    next.falseActions = next.falseActions ? applyEffectToActions(next.falseActions, effect) : next.falseActions;

    if (effect.type === 'damage' && next.type === 'DealDamage' && typeof next.amount === 'number') next.amount = Math.max(0, next.amount + effect.amount);
    if (effect.type === 'block' && next.type === 'GainBlock' && typeof next.amount === 'number') next.amount = Math.max(0, next.amount + effect.amount);
    if (effect.type === 'draw' && next.type === 'Draw' && typeof next.amount === 'number') next.amount = Math.max(0, next.amount + effect.amount);
    if (effect.type === 'professionResource') {
      if (effect.resource === 'intel' && next.type === 'GainIntel' && typeof next.amount === 'number') next.amount = Math.max(0, next.amount + effect.amount);
      if (effect.resource === 'timeLayer' && next.type === 'GainTimeLayer' && typeof next.amount === 'number') next.amount = Math.max(0, next.amount + effect.amount);
      if (effect.resource === 'thread' && next.type === 'GainThread' && typeof next.amount === 'number') next.amount = Math.max(0, next.amount + effect.amount);
      if (effect.resource === 'concoction' && next.type === 'GainConcoction' && typeof next.amount === 'number') next.amount = Math.max(0, next.amount + effect.amount);
    }

    return next;
  });
}

function modifierSummary(effect: CardEnchantmentDef['effect'] | CardAfflictionDef['effect']): string {
  switch (effect.type) {
    case 'damage': return `${effect.amount >= 0 ? '+' : ''}${effect.amount} 伤害`;
    case 'block': return `${effect.amount >= 0 ? '+' : ''}${effect.amount} 护盾`;
    case 'cost': return `${effect.amount >= 0 ? '+' : ''}${effect.amount} 费用`;
    case 'draw': return `${effect.amount >= 0 ? '+' : ''}${effect.amount} 抽牌`;
    case 'professionResource': return `${effect.amount >= 0 ? '+' : ''}${effect.amount} ${effect.resource}`;
  }
}

export function deriveRunCardInstance(instance: RunCardInstance): RunCardInstance {
  const runtimeBase = cloneBaseCard(instance.runtimeBase);
  let derived: CardDef = {
    ...runtimeBase,
    actions: runtimeBase.actions.map(cloneAction),
    tags: [...runtimeBase.tags]
  };

  for (const enchantment of instance.persistentEnchantments) {
    if (enchantment.effect.type === 'cost') derived.cost = Math.max(0, derived.cost + enchantment.effect.amount);
    else derived.actions = applyEffectToActions(derived.actions, enchantment.effect);
  }
  for (const affliction of instance.combatAfflictions) {
    if (affliction.effect.type === 'cost') derived.cost = Math.max(0, derived.cost + affliction.effect.amount);
    else derived.actions = applyEffectToActions(derived.actions, affliction.effect);
  }

  const extraText: string[] = [];
  if (instance.persistentEnchantments.length > 0) extraText.push(`附魔：${instance.persistentEnchantments.map((entry) => modifierSummary(entry.effect)).join('，')}`);
  if (instance.combatAfflictions.length > 0) extraText.push(`咒蚀：${instance.combatAfflictions.map((entry) => modifierSummary(entry.effect)).join('，')}`);

  return {
    ...derived,
    instanceId: instance.instanceId,
    baseCardId: instance.baseCardId,
    runtimeBase,
    persistentEnchantments: instance.persistentEnchantments.map((entry) => cloneModifier(entry)),
    combatAfflictions: instance.combatAfflictions.map((entry) => cloneModifier(entry)),
    text: extraText.length > 0 ? `${runtimeBase.text}\n${extraText.join('\n')}` : runtimeBase.text,
    actions: derived.actions,
    cost: instance.tempCost ?? derived.cost,
    tempCost: instance.tempCost,
    tags: [...derived.tags, ...(instance.persistentEnchantments.length ? ['enchanted'] : []), ...(instance.combatAfflictions.length ? ['afflicted'] : [])]
  };
}

export function createRunCardInstance(card: CardDef, instanceId: string): RunCardInstance {
  const base = cloneBaseCard(card);
  return deriveRunCardInstance({
    ...base,
    instanceId,
    baseCardId: card.id,
    runtimeBase: base,
    persistentEnchantments: [],
    combatAfflictions: []
  });
}

export function normalizeRunCardInstance(card: CardDef | RunCardInstance, instanceIdFactory: () => string): RunCardInstance {
  if (isRunCardInstance(card)) {
    return deriveRunCardInstance({
      ...card,
      instanceId: card.instanceId || instanceIdFactory(),
      baseCardId: card.baseCardId || card.id,
      runtimeBase: cloneBaseCard(card.runtimeBase || card),
      persistentEnchantments: (card.persistentEnchantments || []).map((entry) => cloneModifier(entry)),
      combatAfflictions: (card.combatAfflictions || []).map((entry) => cloneModifier(entry)),
      tempCost: card.tempCost
    });
  }

  return createRunCardInstance(card, card.instanceId || instanceIdFactory());
}

export function cloneRunCardInstance(card: RunCardInstance, nextInstanceId = card.instanceId): RunCardInstance {
  return deriveRunCardInstance({
    ...card,
    instanceId: nextInstanceId,
    runtimeBase: cloneBaseCard(card.runtimeBase),
    persistentEnchantments: card.persistentEnchantments.map((entry) => cloneModifier(entry)),
    combatAfflictions: card.combatAfflictions.map((entry) => cloneModifier(entry)),
    tempCost: card.tempCost
  });
}

export function applyPersistentEnchantmentToInstance(card: RunCardInstance, enchantment: CardEnchantmentDef): RunCardInstance {
  if (card.persistentEnchantments.length >= 1) return card;
  return deriveRunCardInstance({ ...card, persistentEnchantments: [...card.persistentEnchantments, cloneModifier(enchantment)] });
}

export function applyCombatAfflictionToInstance(card: RunCardInstance, affliction: CardAfflictionDef): RunCardInstance {
  return deriveRunCardInstance({ ...card, combatAfflictions: [...card.combatAfflictions, cloneModifier(affliction)] });
}

export function clearCombatAfflictionsFromInstance(card: RunCardInstance): RunCardInstance {
  if (card.combatAfflictions.length === 0) return card;
  return deriveRunCardInstance({ ...card, combatAfflictions: [] });
}

export function isRunCardInstance(card: CardDef | RunCardInstance): card is RunCardInstance {
  return typeof (card as RunCardInstance).baseCardId === 'string' && Array.isArray((card as RunCardInstance).persistentEnchantments);
}
