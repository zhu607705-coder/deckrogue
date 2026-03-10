import { balanceSystem, CardEvaluation, RelicEvaluation } from '@/core/balance/balanceSystem';
import { cardsData } from '@/content/narrative/numericSystem';
import { relicsData } from '@/content/narrative/numericSystem';

export class EvaluationSystem {
  private cardEvaluations: Map<string, CardEvaluation> = new Map();
  private relicEvaluations: Map<string, RelicEvaluation> = new Map();

  constructor() {
    this.evaluateAllCards();
    this.evaluateAllRelics();
  }

  /**
   * Evaluate all cards in the game
   */
  private evaluateAllCards() {
    for (const card of cardsData) {
      const evaluation = this.evaluateCard(card);
      this.cardEvaluations.set(card.id, evaluation);
    }
  }

  /**
   * Evaluate all relics in the game
   */
  private evaluateAllRelics() {
    for (const relic of relicsData) {
      const evaluation = this.evaluateRelic(relic);
      this.relicEvaluations.set(relic.id, evaluation);
    }
  }

  /**
   * Evaluate a single card
   */
  public evaluateCard(card: any): CardEvaluation {
    let damage = 0;
    let block = 0;
    let draw = 0;
    const statusEffects: Record<string, number> = {};

    // Parse card actions to extract values
    if (card.actions) {
      for (const action of card.actions) {
        switch (action.type) {
          case 'DealDamage':
          case 'DealWarpDamage':
            damage += action.amount || 0;
            break;
          case 'GainBlock':
          case 'EmergencyBlock':
            block += action.amount || action.bonus || 0;
            break;
          case 'Draw':
            draw += action.amount || 0;
            break;
          case 'ApplyStatus':
            if (action.status && action.amount) {
              statusEffects[action.status] = (statusEffects[action.status] || 0) + action.amount;
            }
            break;
        }
      }
    }

    // Calculate card value
    const value = balanceSystem.calculateCardValue(
      card.cost,
      damage,
      block,
      draw,
      statusEffects,
      card.type.toLowerCase(),
      card.rarity.toLowerCase()
    );

    // Calculate efficiency
    const efficiency = balanceSystem.evaluateCardEfficiency(value, card.cost);

    // Rate the card
    const rating = balanceSystem.rateCard(efficiency);

    // Identify synergies and anti-synergies
    const synergies = this.identifyCardSynergies(card);
    const antiSynergies = this.identifyCardAntiSynergies(card);

    return {
      id: card.id,
      name: card.name,
      cost: card.cost,
      value,
      efficiency,
      rating,
      synergies,
      antiSynergies
    };
  }

  /**
   * Evaluate a single relic
   */
  public evaluateRelic(relic: any): RelicEvaluation {
    let effectValue = 0;
    let triggerRate = 1.0;
    let duration = 1;

    // Parse relic effect to extract value
    if (relic.effect) {
      switch (relic.effect.type) {
        case 'GainEnergy':
          effectValue += (relic.effect.amount || 0) * 1.0;
          break;
        case 'Heal':
          effectValue += (relic.effect.amount || 0) * 0.1;
          break;
        case 'ApplyStatus':
          if (relic.effect.status && relic.effect.amount) {
            effectValue += (relic.effect.amount || 0) * 0.3;
          }
          break;
        case 'AddCurseOnPickup':
          effectValue -= (relic.effect.addCurseOnPickup || 0) * 0.5;
          break;
        case 'maxHpPenalty':
          effectValue -= (relic.effect.maxHpPenalty || 0) * 0.1;
          break;
      }
    }

    // Calculate relic values
    const valuePerCombat = balanceSystem.calculateRelicValuePerCombat(effectValue, triggerRate, duration);
    const valuePerTurn = balanceSystem.calculateRelicValuePerTurn(effectValue, triggerRate);
    const overallValue = balanceSystem.calculateRelicOverallValue(valuePerCombat, valuePerTurn);

    // Rate the relic
    const rating = balanceSystem.rateRelic(overallValue, relic.price);

    // Identify synergies and anti-synergies
    const synergies = this.identifyRelicSynergies(relic);
    const antiSynergies = this.identifyRelicAntiSynergies(relic);

    return {
      id: relic.id,
      name: relic.name,
      price: relic.price,
      valuePerCombat,
      valuePerTurn,
      overallValue,
      rating,
      synergies,
      antiSynergies
    };
  }

  /**
   * Identify synergies for a card
   */
  private identifyCardSynergies(card: any): string[] {
    const synergies: string[] = [];

    // Check for construct synergies
    if (card.actions && card.actions.some((a: any) => 
      a.type === 'Summon' || a.type === 'BuffConstructs' || a.type === 'ConstructOverdrive'
    )) {
      synergies.push('Constructs');
    }

    // Check for element synergies
    if (card.actions && card.actions.some((a: any) => 
      a.type === 'AddElement' || a.type === 'AddRandomElement' || a.type === 'TriggerReactions'
    )) {
      synergies.push('Elements');
    }

    // Check for warp synergies
    if (card.tags && card.tags.includes('warp')) {
      synergies.push('Warp');
    }

    // Check for delay synergies
    if (card.actions && card.actions.some((a: any) => 
      a.type === 'Delay' || a.type === 'TriggerDelay'
    )) {
      synergies.push('Delay');
    }

    // Check for status synergies
    if (card.actions && card.actions.some((a: any) => 
      a.type === 'ApplyStatus'
    )) {
      synergies.push('Status Effects');
    }

    return synergies;
  }

  /**
   * Identify anti-synergies for a card
   */
  private identifyCardAntiSynergies(card: any): string[] {
    const antiSynergies: string[] = [];

    // Check for curse-related anti-synergies
    if (card.tags && card.tags.includes('Curse')) {
      antiSynergies.push('Curses');
    }

    // Check for high cost anti-synergies
    if (card.cost >= 3) {
      antiSynergies.push('High Cost');
    }

    // Check for self-damage anti-synergies
    if (card.actions && card.actions.some((a: any) => 
      a.type === 'DealDamage' && a.target === 'Self'
    )) {
      antiSynergies.push('Self Damage');
    }

    return antiSynergies;
  }

  /**
   * Identify synergies for a relic
   */
  private identifyRelicSynergies(relic: any): string[] {
    const synergies: string[] = [];

    // Check for energy synergies
    if (relic.effect && relic.effect.type === 'GainEnergy') {
      synergies.push('Energy');
    }

    // Check for strength synergies
    if (relic.effect && relic.effect.type === 'ApplyStatus' && relic.effect.status === 'Strength') {
      synergies.push('Strength');
    }

    // Check for curse synergies
    if (relic.id === 'corrupted_tome') {
      synergies.push('Curses');
    }

    // Check for construct synergies
    if (relic.id === 'bag_of_prep') {
      synergies.push('Constructs');
    }

    return synergies;
  }

  /**
   * Identify anti-synergies for a relic
   */
  private identifyRelicAntiSynergies(relic: any): string[] {
    const antiSynergies: string[] = [];

    // Check for corruption anti-synergies
    if (relic.corrupted) {
      antiSynergies.push('Corruption');
    }

    // Check for self-damage anti-synergies
    if (relic.effect && relic.effect.selfDamage) {
      antiSynergies.push('Self Damage');
    }

    // Check for max hp penalty anti-synergies
    if (relic.effect && relic.effect.maxHpPenalty) {
      antiSynergies.push('Max HP Penalty');
    }

    return antiSynergies;
  }

  /**
   * Get card evaluation
   */
  public getCardEvaluation(cardId: string): CardEvaluation | undefined {
    return this.cardEvaluations.get(cardId);
  }

  /**
   * Get relic evaluation
   */
  public getRelicEvaluation(relicId: string): RelicEvaluation | undefined {
    return this.relicEvaluations.get(relicId);
  }

  /**
   * Get all card evaluations
   */
  public getAllCardEvaluations(): CardEvaluation[] {
    return Array.from(this.cardEvaluations.values());
  }

  /**
   * Get all relic evaluations
   */
  public getAllRelicEvaluations(): RelicEvaluation[] {
    return Array.from(this.relicEvaluations.values());
  }

  /**
   * Get cards by rating
   */
  public getCardsByRating(rating: 'excellent' | 'good' | 'average' | 'poor' | 'terrible'): CardEvaluation[] {
    return Array.from(this.cardEvaluations.values()).filter(e => e.rating === rating);
  }

  /**
   * Get relics by rating
   */
  public getRelicsByRating(rating: 'excellent' | 'good' | 'average' | 'poor' | 'terrible'): RelicEvaluation[] {
    return Array.from(this.relicEvaluations.values()).filter(e => e.rating === rating);
  }

  /**
   * Generate balance report
   */
  public generateBalanceReport(): string {
    let report = '# Balance Report\n\n';

    // Card summary
    report += '## Card Summary\n\n';
    const cardCounts = {
      excellent: 0,
      good: 0,
      average: 0,
      poor: 0,
      terrible: 0
    };

    for (const cardEval of this.cardEvaluations.values()) {
      cardCounts[cardEval.rating]++;
    }

    report += `Excellent: ${cardCounts.excellent}\n`;
    report += `Good: ${cardCounts.good}\n`;
    report += `Average: ${cardCounts.average}\n`;
    report += `Poor: ${cardCounts.poor}\n`;
    report += `Terrible: ${cardCounts.terrible}\n\n`;

    // Relic summary
    report += '## Relic Summary\n\n';
    const relicCounts = {
      excellent: 0,
      good: 0,
      average: 0,
      poor: 0,
      terrible: 0
    };

    for (const relicEval of this.relicEvaluations.values()) {
      relicCounts[relicEval.rating]++;
    }

    report += `Excellent: ${relicCounts.excellent}\n`;
    report += `Good: ${relicCounts.good}\n`;
    report += `Average: ${relicCounts.average}\n`;
    report += `Poor: ${relicCounts.poor}\n`;
    report += `Terrible: ${relicCounts.terrible}\n\n`;

    // Top cards
    report += '## Top Cards\n\n';
    const topCards = Array.from(this.cardEvaluations.values())
      .sort((a, b) => b.efficiency - a.efficiency)
      .slice(0, 10);

    for (const card of topCards) {
      report += `- ${card.name} (${card.cost}): ${card.efficiency.toFixed(2)} (${card.rating})\n`;
    }

    // Bottom cards
    report += '\n## Bottom Cards\n\n';
    const bottomCards = Array.from(this.cardEvaluations.values())
      .sort((a, b) => a.efficiency - b.efficiency)
      .slice(0, 10);

    for (const card of bottomCards) {
      report += `- ${card.name} (${card.cost}): ${card.efficiency.toFixed(2)} (${card.rating})\n`;
    }

    // Top relics
    report += '\n## Top Relics\n\n';
    const topRelics = Array.from(this.relicEvaluations.values())
      .sort((a, b) => b.overallValue - a.overallValue)
      .slice(0, 10);

    for (const relic of topRelics) {
      report += `- ${relic.name} (${relic.price}): ${relic.overallValue.toFixed(2)} (${relic.rating})\n`;
    }

    // Bottom relics
    report += '\n## Bottom Relics\n\n';
    const bottomRelics = Array.from(this.relicEvaluations.values())
      .sort((a, b) => a.overallValue - b.overallValue)
      .slice(0, 10);

    for (const relic of bottomRelics) {
      report += `- ${relic.name} (${relic.price}): ${relic.overallValue.toFixed(2)} (${relic.rating})\n`;
    }

    return report;
  }
}

export const evaluationSystem = new EvaluationSystem();
