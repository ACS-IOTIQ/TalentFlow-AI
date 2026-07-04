export function aiFeaturesEnabled() {
  return process.env.AI_FEATURES_ENABLED !== 'false' && process.env.NEXT_PUBLIC_AI_FEATURES_ENABLED !== 'false'
}
