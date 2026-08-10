export type ModifierOperation = 'additive' | 'multiplicative' | 'override';

export interface NumericModifier {
  operation: ModifierOperation;
  value: number;
  priority?: number;
}

export function evaluateModifiers(
  base: number,
  modifiers: readonly NumericModifier[],
): number {
  const additive = modifiers
    .filter((modifier) => modifier.operation === 'additive')
    .reduce((sum, modifier) => sum + modifier.value, 0);
  const multiplicative = modifiers
    .filter((modifier) => modifier.operation === 'multiplicative')
    .reduce((product, modifier) => product * modifier.value, 1);
  const override = modifiers
    .filter((modifier) => modifier.operation === 'override')
    .sort((left, right) => (left.priority ?? 0) - (right.priority ?? 0))
    .at(-1);

  return override?.value ?? (base + additive) * multiplicative;
}
