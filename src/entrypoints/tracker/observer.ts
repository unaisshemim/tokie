import { countTokens, saveTokenUsage, TokenUsage } from "./tokeUsage";
import { updateWidgetUI } from "./ui";

function setupPlanObserver(usage: TokenUsage, widget: HTMLElement) {
  const log = console.log;

  const updateUserPlan = (badgeSpan: Element | null) => {
    const badgeContent = badgeSpan?.textContent?.toUpperCase();
    const isPlusUser = badgeContent?.includes("PLUS");

    let planChanged = false;
    if (isPlusUser) {
      if (usage.planType !== "plus") {
        log("[Observer] Setting user plan to Plus.");
        usage.planType = "plus";
        usage.maxTokens = 32000;
        planChanged = true;
      }
    } else {
      if (usage.planType !== "free") {
        log("[Observer] Setting user plan to Free.");
        usage.planType = "free";
        usage.maxTokens = 8000;
        planChanged = true;
      }
    }

    if (planChanged) {
      updateWidgetUI(usage, widget);
    }
  };

  // Look for the plan badge in the sidebar bottom section
  const findPlanBadge = () => {
    // Try multiple selectors to find the plan badge
    let badgeElement = null;

    // First, try to find it in the sidebar bottom area
    const sidebarBottom = document.querySelector(".sticky.bottom-0");
    if (sidebarBottom) {
      badgeElement = sidebarBottom.querySelector(".text-xs .truncate");
    }

    // If not found, search globally for any element with "Plus" text
    if (!badgeElement) {
      const allElements = document.querySelectorAll("*");
      for (const element of allElements) {
        const text = element.textContent?.trim();
        if (text === "Plus" || text === "plus") {
          badgeElement = element;

          break;
        }
      }
    }

    return badgeElement;
  };

  const observePlanChanges = () => {
    const badgeElement = findPlanBadge();
    updateUserPlan(badgeElement);
  };

  // Set up a mutation observer to watch for sidebar changes
  const sidebarObserver = new MutationObserver(() => {
    observePlanChanges();
  });

  // Observe the entire sidebar for changes
  const sidebar =
    document.querySelector('[data-testid*="sidebar"]') ||
    document.querySelector(".sidebar") ||
    document.querySelector("nav") ||
    document.body;

  if (sidebar) {
    sidebarObserver.observe(sidebar, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  // Initial check
  setTimeout(() => {
    observePlanChanges();
  }, 1000); // Give time for the sidebar to load

  // Also check periodically in case we miss mutations
  setInterval(observePlanChanges, 5000);
}

export const startMessageObserver = (
  usage: TokenUsage,
  widget: HTMLElement
) => {
  const log = console.log;

  // Cache the last widget state
  let lastWidgetState = {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    maxTokens: usage.maxTokens,
    planType: usage.planType,
  };

  // Debounce for widget update
  let widgetUpdateTimer: ReturnType<typeof setTimeout> | null = null;
  const WIDGET_UPDATE_DEBOUNCE = 400; // ms

  function safeUpdateWidgetUI() {
    const changed =
      usage.inputTokens !== lastWidgetState.inputTokens ||
      usage.outputTokens !== lastWidgetState.outputTokens ||
      usage.maxTokens !== lastWidgetState.maxTokens ||
      usage.planType !== lastWidgetState.planType;
    if (changed) {
      if (widgetUpdateTimer) clearTimeout(widgetUpdateTimer);
      widgetUpdateTimer = setTimeout(() => {
        updateWidgetUI(usage, widget);
        lastWidgetState = {
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          maxTokens: usage.maxTokens,
          planType: usage.planType,
        };
      }, WIDGET_UPDATE_DEBOUNCE);
    }
  }

  // Function to count all tokens and update the widget
  function countAllTokensAndUpdate() {
    const articles = document.querySelectorAll("article");
    let initialInputTokens = 0;
    let initialOutputTokens = 0;
    articles.forEach((article, idx) => {
      // All user blocks inside the article
      const userBlocks = article.querySelectorAll(
        'div[data-message-author-role="user"]'
      );
      userBlocks.forEach((userBlock) => {
        const userText = (userBlock as HTMLElement).innerText.trim();
        initialInputTokens += countTokens(userText);
      });
      // All assistant blocks inside the article
      const aiBlocks = article.querySelectorAll(
        'div[data-message-author-role="assistant"]'
      );
      aiBlocks.forEach((aiBlock) => {
        const aiText = (aiBlock as HTMLElement).innerText.trim();
        initialOutputTokens += countTokens(aiText);
      });
    });
    usage.inputTokens = initialInputTokens;
    usage.outputTokens = initialOutputTokens;
    usage.totalTokens = usage.inputTokens + usage.outputTokens;
    safeUpdateWidgetUI();
    saveTokenUsage(usage);
  }

  // Wait for the DOM to contain at least one <article> before running the initial count
  function waitForArticlesAndCount() {
    if (document.querySelectorAll("article").length > 0) {
      setTimeout(countAllTokensAndUpdate, 300); // Aguarda mais um pouco para garantir renderização
      return;
    }
    const observer = new MutationObserver(() => {
      if (document.querySelectorAll("article").length > 0) {
        observer.disconnect();
        setTimeout(countAllTokensAndUpdate, 300);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Run the initial count
  waitForArticlesAndCount();

  // Detect chat/conversation change by URL change (SPA navigation)
  let lastPath = window.location.pathname;
  setInterval(() => {
    if (window.location.pathname !== lastPath) {
      lastPath = window.location.pathname;
      waitForArticlesAndCount();
    }
  }, 800);

  // Debounced AI response buffer logic
  let buffer = "";
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  //delay to start observing AI responses
  const DEBOUNCE_DELAY = 800;

  const handleAssistantUpdate = (text: string) => {
    buffer = text;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      let outPutToken = countTokens(buffer);
      usage.outputTokens += outPutToken;
      usage.totalTokens = usage.inputTokens + usage.outputTokens;
      safeUpdateWidgetUI();
      buffer = "";
    }, DEBOUNCE_DELAY);
  };

  const mutationObserver = new MutationObserver(async (mutations) => {
    for (const mutation of mutations) {
      // Track live AI response by extracting all text under <article> with assistant message
      for (const node of Array.from(mutation.addedNodes)) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const articles = (node as HTMLElement).querySelectorAll("article");
          articles.forEach(async (article) => {
            // Extract assistant response
            const aiBlock = article.querySelector(
              'div[data-message-author-role="assistant"]'
            );
            if (aiBlock) {
              const allText = article.innerText.trim();
              handleAssistantUpdate(allText);
            }
            // Extract user input
            const userBlock = article.querySelector(
              'div[data-message-author-role="user"]'
            );
            if (userBlock) {
              const userText = (userBlock as HTMLElement).innerText.trim();
              let inputToken = countTokens(userText);
              usage.inputTokens += inputToken;
              usage.totalTokens = usage.inputTokens + usage.outputTokens;
              safeUpdateWidgetUI();
              await saveTokenUsage(usage);
            }
          });
        }
      }
      // Also handle direct mutations to <article> (e.g., streaming updates)
      if (mutation.type === "characterData") {
        const parent = (mutation.target as any).parentElement;
        const article = parent?.closest("article");
        if (article) {
          // Assistant
          const aiBlock = article.querySelector(
            'div[data-message-author-role="assistant"]'
          );
          if (aiBlock) {
            const allText = article.innerText.trim();

            // Call the function to handle AI

            handleAssistantUpdate(allText);
          }
          // User
          const userBlock = article.querySelector(
            'div[data-message-author-role="user"]'
          );
          if (userBlock) {
            const userText = (userBlock as HTMLElement).innerText.trim();
            let inputToken = countTokens(userText);
            usage.inputTokens += inputToken;
            usage.totalTokens = usage.inputTokens + usage.outputTokens;
            safeUpdateWidgetUI();
            await saveTokenUsage(usage);
          }
        }
      }
    }
  });

  // Observe the parent container for the badgeSpan element
  setupPlanObserver(usage, widget);

  const chatRoot = document.querySelector("main");
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
