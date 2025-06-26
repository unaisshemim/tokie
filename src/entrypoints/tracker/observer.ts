// import {
//   countTokens,
//   getChatGPTSessionId,
//   loadTokenUsage,
//   saveTokenUsage,
//   TokenUsage,
//   DEFAULT_USAGE,
// } from "./tokeUsage";

// import { updateWidgetUI } from "./ui";

// let currentSessionUsage: TokenUsage | null = null;

// export async function monitorSessionChanges(widget: HTMLElement) {
//   setInterval(async () => {
//     const newSessionId = getChatGPTSessionId();
//     if (
//       newSessionId &&
//       (!currentSessionUsage || newSessionId !== currentSessionUsage.sessionId)
//     ) {
//       currentSessionUsage = (await loadTokenUsage(newSessionId)) || {
//         ...DEFAULT_USAGE,
//         sessionId: newSessionId,
//         sessionStart: Date.now(),
//       };
//       updateWidgetUI(currentSessionUsage, widget);
//       stopActiveObserver();
//       startMessageObserver(currentSessionUsage, widget);
//     }
//   }, 1000);
// }

// // observer.ts

// let activeObserver: MutationObserver | null = null;

// export function stopActiveObserver() {
//   if (activeObserver) {
//     activeObserver.disconnect();
//     activeObserver = null;
//     console.log("[Observer] Stopped active observer");
//   }
// }

// export function startMessageObserver(
//   usage: TokenUsage,
//   widget: HTMLElement
// ): MutationObserver {
//   stopActiveObserver();

//   let buffer = "";
//   let debounceTimer: ReturnType<typeof setTimeout> | null = null;
//   const DEBOUNCE_DELAY = 800;

//   const handleAssistantUpdate = async (text: string) => {
//     buffer = text;
//     if (debounceTimer) clearTimeout(debounceTimer);
//     debounceTimer = setTimeout(async () => {
//       console.log("[Observer] Processing assistant message:", buffer);
//       const outputToken = countTokens(buffer);
//       usage.outputTokens += outputToken;
//       usage.totalTokens = usage.inputTokens + usage.outputTokens;
//       console.log("outputToken", outputToken);
//       updateWidgetUI(usage, widget);
//       await saveTokenUsage(usage);
//       buffer = "";
//     }, DEBOUNCE_DELAY);
//   };

//   const observer = new MutationObserver((mutations) => {
//     for (const mutation of mutations) {
//       for (const node of Array.from(mutation.addedNodes)) {
//         if (node.nodeType === Node.ELEMENT_NODE) {
//           const articles = (node as HTMLElement).querySelectorAll("article");
//           articles.forEach((article) => {
//             const aiBlock = article.querySelector(
//               'div[data-message-author-role="assistant"]'
//             );
//             if (aiBlock) {
//               const allText = article.innerText.trim();
//               if (allText && allText.length > 0) {
//                 const messageHash = btoa(encodeURIComponent(allText)).slice(
//                   0,
//                   24
//                 );
//                 const sessionKey = `output-token-counted-${usage.sessionId}-${messageHash}`;
//                 if (!localStorage.getItem(sessionKey)) {
//                   handleAssistantUpdate(allText);
//                   localStorage.setItem(sessionKey, "true");
//                 }
//               }
//             }
//             const userBlock = article.querySelector(
//               'div[data-message-author-role="user"]'
//             );
//             if (userBlock) {
//               const userText = (userBlock as HTMLElement).innerText.trim();
//               if (userText && userText.length > 0) {
//                 const messageHash = btoa(encodeURIComponent(userText)).slice(
//                   0,
//                   24
//                 );
//                 const sessionKey = `token-counted-${usage.sessionId}-${messageHash}`;
//                 if (!localStorage.getItem(sessionKey)) {
//                   console.log(
//                     "[Observer] Counting tokens for user message:",
//                     userText
//                   );
//                   const inputToken = countTokens(userText);
//                   usage.inputTokens += inputToken;
//                   usage.totalTokens = usage.inputTokens + usage.outputTokens;
//                   console.log("inputToken", inputToken);
//                   updateWidgetUI(usage, widget);
//                   saveTokenUsage(usage);
//                   localStorage.setItem(sessionKey, "true");
//                 }
//               }
//             }
//           });
//         }
//       }
//     }
//   });

//   const chatRoot = document.querySelector("main");
//   if (chatRoot) {
//     observer.observe(chatRoot, {
//       childList: true,
//       subtree: true,
//       characterData: true,
//     });
//     activeObserver = observer;
//   } else {
//     console.warn("[Observer] Chat root not found");
//   }

//   return observer;
// }

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
