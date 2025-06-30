import { countTokens, TokenUsage } from "./tokeUsage";
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

  const mutationObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      // Track live AI response by extracting all text under <article> with assistant message
      for (const node of Array.from(mutation.addedNodes)) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const articles = (node as HTMLElement).querySelectorAll("article");
          articles.forEach((article) => {
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
            updateWidgetUI(usage, widget);
          }
        }
      }
    }
  });

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
