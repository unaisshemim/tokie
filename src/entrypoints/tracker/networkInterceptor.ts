import { countTokens, saveTokenUsage, TokenUsage } from "./tokeUsage";
import { updateWidgetUI } from "./ui";

export function interceptNetworkRequests(
  usage: TokenUsage,
  widget: HTMLElement
) {
  console.log("[tracker] Intercepting network requests");
  // src/entrypoints/injector.ts
  const originalFetch = window.fetch;
  console.log("[tracker] Original fetch function:", originalFetch);

  window.fetch = async (...args) => {
    console.log("[tracker] Fetch called with args:", args);
    const response = await originalFetch(...args);

    const url = args[0];
    if (typeof url === "string" && url.includes("/backend-api/conversation")) {
      const clone = response.clone();

      const reader = clone.body?.getReader();
      const decoder = new TextDecoder("utf-8");
      let fullText = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });

          // You can now process each `data: ...` line
          chunk.split("\n").forEach((line) => {
            if (line.startsWith("data: ")) {
              try {
                const json = JSON.parse(line.replace("data: ", ""));
                const delta = json.choices?.[0]?.delta?.content;
                if (delta) {
                  fullText += delta;
                  // 👇 You can now send this to your extension or tokenizer
                  console.log("[Token Delta]", delta);
                  chrome.runtime.sendMessage({
                    type: "updateUsage",
                    text: fullText,
                  });
                }
              } catch (err) {
                // Ignore parsing errors for non-JSON lines like "[DONE]"
              }
            }
          });
        }

        console.log("[Full Model Response]:", fullText);
      }
    }

    return response;
  };
}
