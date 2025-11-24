import { Platform } from "./platform";
import { PlanTier } from "./planDetection";

/**
 * Token limit configuration based on platform, plan, and model
 * Values are in tokens (context window size)
 */
const TOKEN_LIMITS: Record<
  Platform,
  Record<PlanTier, Record<string, number> & { default: number }>
> = {
  chatgpt: {
    free: {
      default: 128000, // Default for free tier
      "GPT-4o": 128000,
      "GPT-4o mini": 128000,
      "gpt-4o": 128000,
      "gpt-4o-mini": 128000,
    },
    plus: {
      default: 128000, // Default for plus tier
      "GPT-5": 128000,
      "GPT-5.1": 128000,
      "GPT-4o": 128000,
      "GPT-4o mini": 128000,
      "gpt-5": 128000,
      "gpt-5.1": 128000,
      "gpt-4o": 128000,
      "gpt-4o-mini": 128000,
    },
    pro: {
      default: 128000, // Default for pro tier
      "GPT-5": 128000,
      "GPT-5.1": 128000,
      "GPT-4.1": 1000000, // 1M tokens for GPT-4.1
      "GPT-4o": 128000,
      "o3": 128000, // Varies, using 128K as default
      "o4-mini": 128000, // Varies, using 128K as default
      "gpt-5": 128000,
      "gpt-5.1": 128000,
      "gpt-4.1": 1000000,
      "gpt-4o": 128000,
    },
  },
  claude: {
    free: {
      default: 200000, // Default for free tier
      "Claude Sonnet 4.5": 200000,
      "Claude Sonnet": 200000,
      "Sonnet 4.5": 200000,
      "claude-sonnet-4.5": 200000,
      "claude-sonnet": 200000,
    },
    plus: {
      // Claude doesn't have a "plus" tier, but keeping for consistency
      default: 200000,
      "Claude Sonnet 4.5": 200000,
      "Claude Haiku 4.5": 200000,
      "Sonnet 4.5": 200000,
      "Haiku 4.5": 200000,
      "claude-sonnet-4.5": 200000,
      "claude-haiku-4.5": 200000,
    },
    pro: {
      default: 200000, // Default for pro tier (includes Pro, Max, Team)
      "Claude Sonnet 4.5": 200000,
      "Claude Haiku 4.5": 200000,
      "Claude Opus 4": 200000,
      "Claude Opus 4.1": 200000,
      "Sonnet 4.5": 200000,
      "Haiku 4.5": 200000,
      "Opus 4": 200000,
      "Opus 4.1": 200000,
      "claude-sonnet-4.5": 200000,
      "claude-haiku-4.5": 200000,
      "claude-opus-4": 200000,
      "claude-opus-4.1": 200000,
      // Note: 1M tokens available via API, but we track UI usage which is 200K
    },
  },
};

/**
 * Normalizes a model name to check against token limit mappings
 * Handles various formats and case insensitivity
 */
function normalizeModelName(model: string): string {
  return model.trim();
}

/**
 * Gets the token limit for a given platform, plan, and model
 * Falls back to plan defaults if model is not found
 */
export function getTokenLimit(
  platform: Platform,
  plan: PlanTier,
  model?: string
): number {
  const platformLimits = TOKEN_LIMITS[platform];
  if (!platformLimits) {
    console.warn(
      `[tokenLimits] Unknown platform: ${platform}, defaulting to 128000`
    );
    return 128000;
  }

  const planLimits = platformLimits[plan];
  if (!planLimits) {
    console.warn(
      `[tokenLimits] Unknown plan: ${plan} for platform ${platform}, defaulting to 128000`
    );
    return 128000;
  }

  // If no model specified, return plan default
  if (!model) {
    return planLimits.default;
  }

  const normalizedModel = normalizeModelName(model);

  // Try exact match first (case-insensitive)
  for (const [key, value] of Object.entries(planLimits)) {
    if (key === "default") continue;
    if (key.toLowerCase() === normalizedModel.toLowerCase()) {
      return value;
    }
  }

  // Try partial match (model name contains key or vice versa)
  for (const [key, value] of Object.entries(planLimits)) {
    if (key === "default") continue;
    const lowerKey = key.toLowerCase();
    const lowerModel = normalizedModel.toLowerCase();
    
    if (lowerModel.includes(lowerKey) || lowerKey.includes(lowerModel)) {
      return value;
    }
  }

  // Fallback to plan default
  console.log(
    `[tokenLimits] Model "${model}" not found for ${platform}/${plan}, using default: ${planLimits.default}`
  );
  return planLimits.default;
}

/**
 * Gets the default token limit for a platform and plan (without model)
 */
export function getDefaultTokenLimit(
  platform: Platform,
  plan: PlanTier
): number {
  return getTokenLimit(platform, plan);
}

