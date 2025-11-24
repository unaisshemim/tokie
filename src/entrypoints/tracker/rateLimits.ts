import { Platform } from "./platform";

export type PlanTier = "free" | "plus" | "pro";

export interface RateLimitConfig {
  maxMessages: number;
  windowHours: number;
  isRolling: boolean; // true for rolling window, false for fixed reset
}

export interface RateLimitState {
  messageCount: number;
  windowStart: number;
  lastMessageTime: number;
}

export interface RateLimitInfo {
  remaining: number;
  used: number;
  limit: number;
  resetTime: number;
  isExceeded: boolean;
}

const RATE_LIMITS: Record<Platform, Record<PlanTier, RateLimitConfig>> = {
  chatgpt: {
    free: {
      maxMessages: 10,
      windowHours: 5,
      isRolling: false, // Fixed 5-hour windows
    },
    plus: {
      maxMessages: 80, // Conservative estimate (can be 80-160 depending on model)
      windowHours: 3,
      isRolling: true, // Rolling 3-hour window
    },
    pro: {
      maxMessages: 999999, // Virtually unlimited
      windowHours: 1,
      isRolling: false,
    },
  },
  claude: {
    free: {
      maxMessages: 40,
      windowHours: 24, // Daily limit
      isRolling: false,
    },
    plus: {
      maxMessages: 45,
      windowHours: 5,
      isRolling: false,
    },
    pro: {
      maxMessages: 45, // Claude Pro has same limit as Plus
      windowHours: 5,
      isRolling: false,
    },
  },
};

export function getRateLimitConfig(
  platform: Platform,
  tier: PlanTier
): RateLimitConfig {
  return RATE_LIMITS[platform][tier];
}

export async function loadRateLimitState(
  platform: Platform,
  tier: PlanTier
): Promise<RateLimitState> {
  const key = `rateLimit_${platform}_${tier}`;
  const data = await chrome.storage.local.get(key);
  const state: RateLimitState | undefined = data[key];

  if (!state) {
    return {
      messageCount: 0,
      windowStart: Date.now(),
      lastMessageTime: 0,
    };
  }

  return state;
}

export async function saveRateLimitState(
  platform: Platform,
  tier: PlanTier,
  state: RateLimitState
): Promise<void> {
  const key = `rateLimit_${platform}_${tier}`;
  await chrome.storage.local.set({ [key]: state });
}

export function calculateRateLimitInfo(
  config: RateLimitConfig,
  state: RateLimitState
): RateLimitInfo {
  const now = Date.now();
  const windowMs = config.windowHours * 60 * 60 * 1000;

  let windowStart = state.windowStart;
  let messageCount = state.messageCount;

  if (config.isRolling) {
    // Rolling window: count messages in the last N hours
    const cutoffTime = now - windowMs;
    
    // For rolling windows, we need to track individual message times
    // For simplicity, we'll use a sliding window approach
    // If the window has passed, reset
    if (state.lastMessageTime > 0 && state.lastMessageTime < cutoffTime) {
      messageCount = 0;
      windowStart = now;
    }
  } else {
    // Fixed window: reset if we've passed the window
    if (now - windowStart >= windowMs) {
      messageCount = 0;
      windowStart = now;
    }
  }

  const remaining = Math.max(0, config.maxMessages - messageCount);
  const isExceeded = messageCount >= config.maxMessages;
  const resetTime = windowStart + windowMs;

  return {
    remaining,
    used: messageCount,
    limit: config.maxMessages,
    resetTime,
    isExceeded,
  };
}

export async function incrementMessageCount(
  platform: Platform,
  tier: PlanTier
): Promise<RateLimitInfo> {
  const config = getRateLimitConfig(platform, tier);
  const state = await loadRateLimitState(platform, tier);
  const now = Date.now();
  const windowMs = config.windowHours * 60 * 60 * 1000;

  let newState: RateLimitState;

  if (config.isRolling) {
    // Rolling window: check if we need to reset
    const cutoffTime = now - windowMs;
    if (state.windowStart < cutoffTime) {
      // Window has rolled, start fresh
      newState = {
        messageCount: 1,
        windowStart: now,
        lastMessageTime: now,
      };
    } else {
      // Increment within current window
      newState = {
        messageCount: state.messageCount + 1,
        windowStart: state.windowStart,
        lastMessageTime: now,
      };
    }
  } else {
    // Fixed window: reset if window has passed
    if (now - state.windowStart >= windowMs) {
      newState = {
        messageCount: 1,
        windowStart: now,
        lastMessageTime: now,
      };
    } else {
      newState = {
        messageCount: state.messageCount + 1,
        windowStart: state.windowStart,
        lastMessageTime: now,
      };
    }
  }

  await saveRateLimitState(platform, tier, newState);
  return calculateRateLimitInfo(config, newState);
}

export async function getRateLimitInfo(
  platform: Platform,
  tier: PlanTier
): Promise<RateLimitInfo> {
  const config = getRateLimitConfig(platform, tier);
  const state = await loadRateLimitState(platform, tier);
  return calculateRateLimitInfo(config, state);
}

export function formatTimeUntilReset(resetTime: number): string {
  const now = Date.now();
  const msUntilReset = Math.max(0, resetTime - now);
  
  if (msUntilReset === 0) return "Now";
  
  const hours = Math.floor(msUntilReset / (60 * 60 * 1000));
  const minutes = Math.floor((msUntilReset % (60 * 60 * 1000)) / (60 * 1000));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

