import { Platform, detectPlatform } from "./platform";

export type PlanTier = "free" | "plus" | "pro";

/**
 * Detects the user's ChatGPT plan by scraping the profile menu
 * Looks for the plan text in the profile button area
 */
export function detectChatGPTPlan(): PlanTier {
  try {
    // Target the profile menu button
    const profileButton = document.querySelector(
      '[data-testid="accounts-profile-button"]'
    );

    if (!profileButton) {
      console.log("[planDetection] ChatGPT profile button not found");
      return "free"; // Default to free
    }

    // Look for plan text in the profile button area
    // The plan is typically in a div with class containing "text-xs" or "text-token-text-tertiary"
    // Based on the HTML provided, it's in a div with "truncate" class
    const planElements = profileButton.querySelectorAll(
      ".truncate, .text-xs, [class*='text-token-text-tertiary']"
    );

    for (const element of Array.from(planElements)) {
      const text = element.textContent?.trim().toLowerCase() || "";
      
      // Check for plan indicators
      if (text === "go" || text.includes("pro") || text.includes("enterprise")) {
        return "pro";
      }
      if (text.includes("plus")) {
        return "plus";
      }
      if (text.includes("free")) {
        return "free";
      }
    }

    // Also search for plan badges in the sidebar
    const sidebarPlanElements = document.querySelectorAll(
      '[data-testid*="plan"], [class*="plan"], .text-xs'
    );
    
    for (const element of Array.from(sidebarPlanElements)) {
      const text = element.textContent?.trim().toLowerCase() || "";
      if (text.includes("pro") || text.includes("enterprise")) {
        return "pro";
      }
      if (text.includes("plus")) {
        return "plus";
      }
      if (text.includes("free")) {
        return "free";
      }
    }

    console.log("[planDetection] ChatGPT plan not detected, defaulting to free");
    return "free";
  } catch (error) {
    console.error("[planDetection] Error detecting ChatGPT plan:", error);
    return "free";
  }
}

/**
 * Detects the user's Claude plan by scraping the user menu
 * Looks for plan text like "Free plan", "Pro plan", etc.
 */
export function detectClaudePlan(): PlanTier {
  try {
    // Target the user menu button
    const userMenuButton = document.querySelector(
      '[data-testid="user-menu-button"]'
    );

    if (!userMenuButton) {
      console.log("[planDetection] Claude user menu button not found");
      return "free"; // Default to free
    }

    // Look for plan text in spans with specific classes
    // Based on the HTML provided, it's in a span with "text-xs text-text-300"
    const planSpans = userMenuButton.querySelectorAll(
      'span.text-xs, [class*="text-text-300"], span[class*="text-xs"]'
    );

    for (const span of Array.from(planSpans)) {
      const text = span.textContent?.trim().toLowerCase() || "";
      
      // Check for plan indicators
      if (text.includes("max") || text.includes("team")) {
        // Max and Team plans are treated as "pro" tier
        return "pro";
      }
      if (text.includes("pro")) {
        return "pro";
      }
      if (text.includes("free")) {
        return "free";
      }
    }

    // Fallback: search for plan text in the entire user menu area
    const menuText = userMenuButton.textContent?.toLowerCase() || "";
    if (menuText.includes("max") || menuText.includes("team") || menuText.includes("pro")) {
      return "pro";
    }
    if (menuText.includes("free")) {
      return "free";
    }

    console.log("[planDetection] Claude plan not detected, defaulting to free");
    return "free";
  } catch (error) {
    console.error("[planDetection] Error detecting Claude plan:", error);
    return "free";
  }
}

/**
 * Detects the user's plan based on the current platform
 */
export function detectUserPlan(platform?: Platform): PlanTier {
  const currentPlatform = platform || detectPlatform();
  
  if (currentPlatform === "claude") {
    return detectClaudePlan();
  } else {
    return detectChatGPTPlan();
  }
}

/**
 * Sets up a MutationObserver to watch for plan changes in the UI
 * Returns a cleanup function to disconnect the observer
 */
export function watchPlanChanges(
  onPlanChange: (plan: PlanTier) => void,
  platform?: Platform
): () => void {
  const currentPlatform = platform || detectPlatform();
  
  let lastDetectedPlan: PlanTier | null = null;

  const checkPlan = () => {
    const detectedPlan = detectUserPlan(currentPlatform);
    if (detectedPlan !== lastDetectedPlan) {
      lastDetectedPlan = detectedPlan;
      onPlanChange(detectedPlan);
    }
  };

  // Initial check
  checkPlan();

  // Set up observer based on platform
  let targetElement: Element | null = null;
  
  if (currentPlatform === "chatgpt") {
    // Watch the profile button area
    targetElement = document.querySelector(
      '[data-testid="accounts-profile-button"]'
    ) || document.querySelector('[data-testid*="sidebar"]') || document.body;
  } else {
    // Watch the user menu button area
    targetElement = document.querySelector(
      '[data-testid="user-menu-button"]'
    ) || document.body;
  }

  const observer = new MutationObserver(() => {
    checkPlan();
  });

  if (targetElement) {
    observer.observe(targetElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    });
  }

  // Also check periodically in case mutations are missed
  const intervalId = setInterval(checkPlan, 5000);

  // Return cleanup function
  return () => {
    observer.disconnect();
    clearInterval(intervalId);
  };
}

