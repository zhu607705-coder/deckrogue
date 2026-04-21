import test from 'node:test';
import assert from 'node:assert/strict';

import { inferSemanticCode } from '../../scripts/validation/runtime_v2_adapter_parity_utils';

test('inferSemanticCode classifies selector resolution failures', () => {
  assert.equal(
    inferSemanticCode('Upgrade target could not be resolved: 999:missing_card'),
    'selector_out_of_range',
  );
  assert.equal(
    inferSemanticCode('ValueError: upgrade_card selector index is out of range'),
    'selector_out_of_range',
  );
});

test('inferSemanticCode classifies missing shop offers', () => {
  assert.equal(
    inferSemanticCode('Shop card dead_drop is not offered in the current shop'),
    'shop_offer_missing',
  );
});

test('inferSemanticCode classifies invalid phase and surface state messages', () => {
  assert.equal(
    inferSemanticCode('wrong phase for remove_card: map'),
    'invalid_phase',
  );
  assert.equal(
    inferSemanticCode('cancel_surface cannot be used from this surface state'),
    'invalid_surface_state',
  );
  assert.equal(
    inferSemanticCode('cancel_surface is only valid during upgrade, remove_card, enchant, or relic_upgrade phase'),
    'invalid_phase',
  );
  assert.equal(
    inferSemanticCode('Relic is not available for upgrade: missing_relic'),
    'invalid_surface_state',
  );
});

test('inferSemanticCode falls back to unknown for unmatched messages', () => {
  assert.equal(
    inferSemanticCode('unexpected runtime failure with no known semantic shape'),
    'unknown',
  );
});
