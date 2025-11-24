import { countTokens, saveTokenUsage, TokenUsage } from "./tokeUsage";
import { updateWidgetUI } from "./ui";
import { getPlatformConfig, detectPlatform } from "./platform";
import {
  incrementMessageCount,
  getRateLimitInfo,
  formatTimeUntilReset,
} from "./rateLimits";
import { detectUserPlan, watchPlanChanges, PlanTier } from "./planDetection";
import { getTokenLimit } from "./tokenLimits";

function setupPlanObserver(usage: TokenUsage, widget: HTMLElement) {
  const log = console.log;
  const platform = detectPlatform();

  const updatePlanAndTokenLimit = (newPlan: PlanTier, model?: string) => {
    const planChanged = usage.planType !== newPlan;
    if (planChanged) {
      log(`[Observer] Plan detected: ${newPlan}`);
      usage.planType = newPlan;
    }

    // Update token limit based on plan and model
    const detectedModel = model || usage.displayedModel || usage.actualModel;
    const newMaxTokens = getTokenLimit(platform, newPlan, detectedModel);
    
    const tokenLimitChanged = usage.maxTokens !== newMaxTokens;
    if (tokenLimitChanged) {
      log(
        `[Observer] Updating max tokens: ${usage.maxTokens} -> ${newMaxTokens} (plan: ${newPlan}, model: ${detectedModel || "unknown"})`
      );
      usage.maxTokens = newMaxTokens;
    }

    if (planChanged || tokenLimitChanged) {
      updateWidgetUI(usage, widget);
      saveTokenUsage(usage);
    }
  };

  // Initial plan detection
  const initialPlan = detectUserPlan(platform);
  updatePlanAndTokenLimit(initialPlan);

  // Watch for plan changes
  const cleanup = watchPlanChanges((newPlan: PlanTier) => {
    updatePlanAndTokenLimit(newPlan);
  }, platform);

  // Store cleanup function for later use if needed
  (usage as any)._planObserverCleanup = cleanup;
}

// Model downgrade detection state
interface ModelDetectionState {
  responseLengths: number[];
  responseTimes: number[];
  lastResponseTime: number;
  lastResponseLength: number;
}

function detectModelDowngrade(
  usage: TokenUsage,
  responseText: string,
  detectionState: ModelDetectionState
): boolean {
  if (!usage.platform || usage.platform !== "chatgpt") {
    return false;
  }

  const now = Date.now();
  const responseLength = responseText.length;
  const timeSinceLastResponse = now - detectionState.lastResponseTime;

  // Update detection state
  detectionState.responseLengths.push(responseLength);
  detectionState.responseTimes.push(timeSinceLastResponse);
  
  // Keep only last 5 responses for analysis
  if (detectionState.responseLengths.length > 5) {
    detectionState.responseLengths.shift();
    detectionState.responseTimes.shift();
  }

  detectionState.lastResponseTime = now;
  detectionState.lastResponseLength = responseLength;

  // Check if rate limit is exceeded
  const rateLimitExceeded = usage.rateLimit?.isExceeded ?? false;

  // Indicators of downgrade:
  // 1. Rate limit exceeded
  // 2. Sudden drop in response quality/length (if we have previous responses)
  // 3. Faster response times (mini is faster)
  
  if (rateLimitExceeded) {
    // If rate limit is exceeded, likely downgraded
    return true;
  }

  // Check for sudden quality drop (if we have enough data)
  if (detectionState.responseLengths.length >= 3) {
    const avgLength =
      detectionState.responseLengths.reduce((a, b) => a + b, 0) /
      detectionState.responseLengths.length;
    const recentAvg =
      detectionState.responseLengths
        .slice(-2)
        .reduce((a, b) => a + b, 0) / 2;

    // If recent responses are significantly shorter (50%+ drop), might be downgraded
    if (recentAvg < avgLength * 0.5 && avgLength > 500) {
      return true;
    }
  }

  return false;
}

function detectDisplayedModel(platform: Platform): string | null {
  if (platform === "chatgpt") {
    // Try to find the model selector or model name in the UI
    const modelSelectors = [
      '[data-testid="model-selector"]',
      'button[aria-label*="model"]',
      'select[name*="model"]',
      '.model-selector',
      '[role="button"][aria-label*="model"]',
      'button[class*="model"]',
    ];

    for (const selector of modelSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const text = (element.textContent || element.getAttribute("aria-label") || "").toLowerCase();
        
        // Check for specific models (order matters - check more specific first)
        if (text.includes("gpt-5.1") || text.includes("gpt5.1")) {
          return "GPT-5.1";
        }
        if (text.includes("gpt-5") || text.includes("gpt5")) {
          return "GPT-5";
        }
        if (text.includes("gpt-4.1") || text.includes("gpt4.1")) {
          return "GPT-4.1";
        }
        if (text.includes("gpt-4o mini") || text.includes("gpt-4o-mini") || text.includes("gpt4o-mini")) {
          return "GPT-4o mini";
        }
        if (text.includes("gpt-4o") || text.includes("gpt4o")) {
          return "GPT-4o";
        }
        if (text.includes("o3")) {
          return "o3";
        }
        if (text.includes("o4-mini") || text.includes("o4mini")) {
          return "o4-mini";
        }
        if (text.includes("gpt-4")) {
          return "GPT-4o"; // Default GPT-4 variant
        }
      }
    }

    // Search in all text content for model mentions
    const allText = document.body.textContent?.toLowerCase() || "";
    if (allText.includes("gpt-5.1") || allText.includes("gpt5.1")) {
      return "GPT-5.1";
    }
    if (allText.includes("gpt-5") || allText.includes("gpt5")) {
      return "GPT-5";
    }
    if (allText.includes("gpt-4.1") || allText.includes("gpt4.1")) {
      return "GPT-4.1";
    }
    if (allText.includes("gpt-4o mini") || allText.includes("gpt-4o-mini")) {
      return "GPT-4o mini";
    }
    if (allText.includes("gpt-4o")) {
      return "GPT-4o";
    }

    // Fallback: check URL or other indicators
    const url = window.location.href.toLowerCase();
    if (url.includes("gpt-5.1") || url.includes("gpt5.1")) {
      return "GPT-5.1";
    }
    if (url.includes("gpt-5") || url.includes("gpt5")) {
      return "GPT-5";
    }
    if (url.includes("gpt-4.1") || url.includes("gpt4.1")) {
      return "GPT-4.1";
    }
    if (url.includes("gpt-4o")) {
      return "GPT-4o";
    }
  } else if (platform === "claude") {
    // Try to find Claude model selector or model name in the UI
    const modelSelectors = [
      '[data-testid*="model"]',
      'button[aria-label*="model"]',
      'select[name*="model"]',
      '.model-selector',
      '[role="button"][aria-label*="model"]',
      'button[class*="model"]',
    ];

    for (const selector of modelSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const text = (element.textContent || element.getAttribute("aria-label") || "").toLowerCase();
        
        // Check for specific Claude models (order matters - check more specific first)
        if (text.includes("claude opus 4.1") || text.includes("opus 4.1") || text.includes("opus4.1")) {
          return "Claude Opus 4.1";
        }
        if (text.includes("claude opus 4") || text.includes("opus 4") || text.includes("opus4")) {
          return "Claude Opus 4";
        }
        if (text.includes("claude sonnet 4.5") || text.includes("sonnet 4.5") || text.includes("sonnet4.5")) {
          return "Claude Sonnet 4.5";
        }
        if (text.includes("claude haiku 4.5") || text.includes("haiku 4.5") || text.includes("haiku4.5")) {
          return "Claude Haiku 4.5";
        }
        if (text.includes("claude sonnet") || text.includes("sonnet")) {
          return "Claude Sonnet 4.5"; // Default to latest
        }
        if (text.includes("claude haiku") || text.includes("haiku")) {
          return "Claude Haiku 4.5"; // Default to latest
        }
        if (text.includes("claude opus") || text.includes("opus")) {
          return "Claude Opus 4.1"; // Default to latest
        }
        if (text.includes("claude")) {
          return "Claude Sonnet 4.5"; // Default Claude model
        }
      }
    }

    // Search in all text content for model mentions
    const allText = document.body.textContent?.toLowerCase() || "";
    if (allText.includes("claude opus 4.1") || allText.includes("opus 4.1")) {
      return "Claude Opus 4.1";
    }
    if (allText.includes("claude opus 4") || allText.includes("opus 4")) {
      return "Claude Opus 4";
    }
    if (allText.includes("claude sonnet 4.5") || allText.includes("sonnet 4.5")) {
      return "Claude Sonnet 4.5";
    }
    if (allText.includes("claude haiku 4.5") || allText.includes("haiku 4.5")) {
      return "Claude Haiku 4.5";
    }
    if (allText.includes("claude sonnet") || allText.includes("sonnet")) {
      return "Claude Sonnet 4.5";
    }
    if (allText.includes("claude haiku") || allText.includes("haiku")) {
      return "Claude Haiku 4.5";
    }
  }

  return null;
}

export const startMessageObserver = (
  usage: TokenUsage,
  widget: HTMLElement
) => {
  const log = console.log;
  const platform = detectPlatform();
  const config = getPlatformConfig();

  // Initialize model detection state
  const modelDetectionState: ModelDetectionState = {
    responseLengths: [],
    responseTimes: [],
    lastResponseTime: 0,
    lastResponseLength: 0,
  };

  // Initialize rate limit tracking
  const updateRateLimit = async () => {
    if (usage.platform && usage.planType) {
      const rateLimitInfo = await getRateLimitInfo(usage.platform, usage.planType);
      usage.rateLimit = rateLimitInfo;
      safeUpdateWidgetUI();
    }
  };

  // Initial rate limit load
  updateRateLimit();

  // Cache the last widget state
  let lastWidgetState = {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    maxTokens: usage.maxTokens,
    planType: usage.planType,
    rateLimit: usage.rateLimit,
    isDowngraded: usage.isDowngraded,
  };

  // Debounce for widget update
  let widgetUpdateTimer: ReturnType<typeof setTimeout> | null = null;
  const WIDGET_UPDATE_DEBOUNCE = 400; // ms

  function safeUpdateWidgetUI() {
    const changed =
      usage.inputTokens !== lastWidgetState.inputTokens ||
      usage.outputTokens !== lastWidgetState.outputTokens ||
      usage.maxTokens !== lastWidgetState.maxTokens ||
      usage.planType !== lastWidgetState.planType ||
      usage.rateLimit?.remaining !== lastWidgetState.rateLimit?.remaining ||
      usage.isDowngraded !== lastWidgetState.isDowngraded;
    if (changed) {
      if (widgetUpdateTimer) clearTimeout(widgetUpdateTimer);
      widgetUpdateTimer = setTimeout(() => {
        updateWidgetUI(usage, widget);
        lastWidgetState = {
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          maxTokens: usage.maxTokens,
          planType: usage.planType,
          rateLimit: usage.rateLimit,
          isDowngraded: usage.isDowngraded,
        };
      }, WIDGET_UPDATE_DEBOUNCE);
    }
  }

  // Function to count all tokens and update the widget
  function countAllTokensAndUpdate() {
    const messageContainers = document.querySelectorAll(config.messageContainerSelector);
    let initialInputTokens = 0;
    let initialOutputTokens = 0;
    
    messageContainers.forEach((container, idx) => {
      // All user blocks inside the container
      const userBlocks = container.querySelectorAll(config.userMessageSelector);
      userBlocks.forEach((userBlock) => {
        const userText = (userBlock as HTMLElement).innerText.trim();
        if (userText) {
          initialInputTokens += countTokens(userText, platform);
        }
      });
      // All assistant blocks inside the container
      const aiBlocks = container.querySelectorAll(config.assistantMessageSelector);
      aiBlocks.forEach((aiBlock) => {
        const aiText = (aiBlock as HTMLElement).innerText.trim();
        if (aiText) {
          initialOutputTokens += countTokens(aiText, platform);
        }
      });
    });
    usage.inputTokens = initialInputTokens;
    usage.outputTokens = initialOutputTokens;
    usage.totalTokens = usage.inputTokens + usage.outputTokens;
    safeUpdateWidgetUI();
    saveTokenUsage(usage);
  }

  // Wait for the DOM to contain at least one message container before running the initial count
  function waitForContainersAndCount() {
    if (document.querySelectorAll(config.messageContainerSelector).length > 0) {
      setTimeout(countAllTokensAndUpdate, 300);
      return;
    }
    const observer = new MutationObserver(() => {
      if (document.querySelectorAll(config.messageContainerSelector).length > 0) {
        observer.disconnect();
        setTimeout(countAllTokensAndUpdate, 300);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Run the initial count
  waitForContainersAndCount();

  // Detect chat/conversation change by URL change (SPA navigation)
  let lastPath = window.location.pathname;
  setInterval(() => {
    if (window.location.pathname !== lastPath) {
      lastPath = window.location.pathname;
      waitForContainersAndCount();
    }
  }, 800);

  // Debounced AI response buffer logic
  let buffer = "";
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  //delay to start observing AI responses
  const DEBOUNCE_DELAY = 800;

  const handleAssistantUpdate = async (text: string) => {
    buffer = text;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      let outPutToken = countTokens(buffer, platform);
      usage.outputTokens += outPutToken;
      usage.totalTokens = usage.inputTokens + usage.outputTokens;

      // Detect model downgrade
      const isDowngraded = detectModelDowngrade(usage, buffer, modelDetectionState);
      usage.isDowngraded = isDowngraded;
      
      // Detect displayed model
      const detectedModel = detectDisplayedModel(platform);
      if (detectedModel && detectedModel !== usage.displayedModel) {
        usage.displayedModel = detectedModel;
      }
      
      if (isDowngraded && !usage.actualModel) {
        usage.actualModel = "GPT-4o mini";
      } else if (!isDowngraded) {
        usage.actualModel = usage.displayedModel;
      }

      // Update token limit based on detected model
      if (usage.planType && (detectedModel || usage.displayedModel)) {
        const model = detectedModel || usage.displayedModel;
        const newMaxTokens = getTokenLimit(platform, usage.planType, model);
        if (usage.maxTokens !== newMaxTokens) {
          usage.maxTokens = newMaxTokens;
        }
      }

      safeUpdateWidgetUI();
      await saveTokenUsage(usage);
      buffer = "";
    }, DEBOUNCE_DELAY);
  };

  const mutationObserver = new MutationObserver(async (mutations) => {
    for (const mutation of mutations) {
      // Track live AI response by extracting all text from message containers
      for (const node of Array.from(mutation.addedNodes)) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const containers = (node as HTMLElement).querySelectorAll(config.messageContainerSelector);
          containers.forEach(async (container) => {
            // Extract assistant response
            const aiBlock = container.querySelector(config.assistantMessageSelector);
            if (aiBlock) {
              const allText = (container as HTMLElement).innerText.trim();
              if (allText) {
                handleAssistantUpdate(allText);
              }
            }
            // Extract user input
            const userBlock = container.querySelector(config.userMessageSelector);
            if (userBlock) {
              const userText = (userBlock as HTMLElement).innerText.trim();
              if (userText) {
                let inputToken = countTokens(userText, platform);
                usage.inputTokens += inputToken;
                usage.totalTokens = usage.inputTokens + usage.outputTokens;
                
                // Track message count for rate limits
                if (usage.platform && usage.planType) {
                  try {
                    const rateLimitInfo = await incrementMessageCount(
                      usage.platform,
                      usage.planType
                    );
                    usage.rateLimit = rateLimitInfo;
                    
                    // If rate limit exceeded, likely downgraded
                    if (rateLimitInfo.isExceeded && usage.platform === "chatgpt") {
                      usage.isDowngraded = true;
                      usage.actualModel = "GPT-4o mini";
                    }
                  } catch (error) {
                    console.error("[Observer] Failed to update rate limit:", error);
                  }
                }
                
                safeUpdateWidgetUI();
                await saveTokenUsage(usage);
              }
            }
          });
        }
      }
      // Also handle direct mutations to message containers (e.g., streaming updates)
      if (mutation.type === "characterData") {
        const parent = (mutation.target as any).parentElement;
        const container = parent?.closest(config.messageContainerSelector);
        if (container) {
          // Assistant
          const aiBlock = container.querySelector(config.assistantMessageSelector);
          if (aiBlock) {
            const allText = (container as HTMLElement).innerText.trim();
            if (allText) {
              handleAssistantUpdate(allText);
            }
          }
          // User
          const userBlock = container.querySelector(config.userMessageSelector);
          if (userBlock) {
            const userText = (userBlock as HTMLElement).innerText.trim();
            if (userText) {
              let inputToken = countTokens(userText, platform);
              usage.inputTokens += inputToken;
              usage.totalTokens = usage.inputTokens + usage.outputTokens;
              
              // Track message count for rate limits
              if (usage.platform && usage.planType) {
                try {
                  const rateLimitInfo = await incrementMessageCount(
                    usage.platform,
                    usage.planType
                  );
                  usage.rateLimit = rateLimitInfo;
                  
                  // If rate limit exceeded, likely downgraded
                  if (rateLimitInfo.isExceeded && usage.platform === "chatgpt") {
                    usage.isDowngraded = true;
                    usage.actualModel = "GPT-4o mini";
                  }
                } catch (error) {
                  console.error("[Observer] Failed to update rate limit:", error);
                }
              }
              
              safeUpdateWidgetUI();
              await saveTokenUsage(usage);
            }
          }
        }
      }
    }
  });

  // Set up plan observer for all platforms
  setupPlanObserver(usage, widget);
  
  // Detect displayed model periodically and update token limits
  setInterval(() => {
    const displayedModel = detectDisplayedModel(platform);
    if (displayedModel && displayedModel !== usage.displayedModel) {
      usage.displayedModel = displayedModel;
      // If not downgraded, actual model matches displayed
      if (!usage.isDowngraded) {
        usage.actualModel = displayedModel;
      }
      
      // Update token limit based on new model
      if (usage.planType) {
        const newMaxTokens = getTokenLimit(platform, usage.planType, displayedModel);
        if (usage.maxTokens !== newMaxTokens) {
          usage.maxTokens = newMaxTokens;
        }
      }
      
      safeUpdateWidgetUI();
      saveTokenUsage(usage);
    }
  }, 5000);

  // Update rate limit info periodically
  setInterval(() => {
    updateRateLimit();
  }, 60000); // Every minute

  // Find the chat root - different for each platform
  let chatRoot: Element | null = null;
  if (platform === "claude") {
    // Claude's main chat container
    chatRoot = document.querySelector(".mx-auto.flex.size-full.max-w-3xl.flex-col") ||
               document.querySelector('[data-test-render-count]')?.closest('.flex-1') ||
               document.body;
  } else {
    // ChatGPT's main container
    chatRoot = document.querySelector("main");
  }

  if (chatRoot) {
    mutationObserver.observe(chatRoot, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  } else {
    log("[Observer] Chat root not found!");
  }
};
