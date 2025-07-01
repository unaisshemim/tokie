import { countTokens, saveTokenUsage, TokenUsage } from "./tokeUsage";
import { updateWidgetUI } from "./ui";

export const startMessageObserver = (
  usage: TokenUsage,
  widget: HTMLElement
) => {
  const log = console.log;

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
      updateWidgetUI(usage, widget);
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
              updateWidgetUI(usage, widget);
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
            console.log(`[Observer] AI response detected: ${allText}`);
            // Call the function to handle AI

            handleAssistantUpdate(allText);
          }
          // User
          const userBlock = article.querySelector(
            'div[data-message-author-role="user"]'
          );
          if (userBlock) {
            const userText = (userBlock as HTMLElement).innerText.trim();
            console.log(`[Observer] User input detected: ${userText}`);
            let inputToken = countTokens(userText);
            usage.inputTokens += inputToken;
            usage.totalTokens = usage.inputTokens + usage.outputTokens;
            updateWidgetUI(usage, widget);
            await saveTokenUsage(usage);
          }
        }
      }
    }
  });

  // Detect and handle the badgeSpan element
  const badgeSpan = document.querySelector(
    'button[data-testid="profile-button"] span'
  );
  if (badgeSpan) {
    log(`[Observer] badgeSpan detected with content: ${badgeSpan.textContent}`);

    // Monitor changes to the badgeSpan element
    const badgeObserver = new MutationObserver(() => {
      log(`[Observer] badgeSpan updated to: ${badgeSpan.textContent}`);
      const isPlusUser = badgeSpan.textContent?.includes("PLUS");
      if (isPlusUser) {
        usage.planType = "plus";
        usage.maxTokens = 128000; // Set max tokens for Plus users
      }
    });

    badgeObserver.observe(badgeSpan, {
      characterData: true,
      subtree: true,
    });
  } else {
    log("[Observer] badgeSpan not found!");
  }

  // Observe the parent container for the badgeSpan element
  defineBadgeObserver();

  function defineBadgeObserver() {
    const profileButtonContainer = document.querySelector(
      'button[data-testid="profile-button"]'
    );

    if (profileButtonContainer) {
      const observer = new MutationObserver(() => {
        const badgeSpan = profileButtonContainer.querySelector("span");
        if (badgeSpan) {
          log(
            `[Observer] badgeSpan detected with content: ${badgeSpan.textContent}`
          );
          const isPlusUser = badgeSpan.textContent?.includes("PLUS");
          if (isPlusUser) {
            usage.planType = "plus";
            usage.maxTokens = 128000; // Set max tokens for Plus users
          }
          observer.disconnect(); // Stop observing once the element is found
        }
      });

      observer.observe(profileButtonContainer, {
        childList: true,
        subtree: true,
      });
    } else {
      log("[Observer] Profile button container not found!");
    }
  }
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

// Optionally export default or call the function elsewhere
