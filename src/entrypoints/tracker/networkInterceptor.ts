import { countTokens, saveTokenUsage, TokenUsage } from "./tokeUsage";
import { updateWidgetUI } from "./ui";

export function interceptNetworkRequests(
  usage: TokenUsage,
  widget: HTMLElement
) {
  const originalFetch = window.fetch;

  window.fetch = async function (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    // Step 1: Determine if the request is to ChatGPT backend
    let requestUrl: string;
    if (typeof input === "string") {
      requestUrl = input;
    } else if (input instanceof Request) {
      requestUrl = input.url;
    } else if (input instanceof URL) {
      requestUrl = input.toString();
    } else {
      requestUrl = "";
    }

    const isChatRequest = requestUrl.includes("/backend-api/conversation");

    // Step 2: Try to extract input message content
    let inputText = "";
    let model = "gpt-3.5-turbo"; // fallback

    if (isChatRequest && init?.body) {
      try {
        const body = JSON.parse(init.body.toString());
        const parts = body?.messages?.[0]?.content?.parts;
        if (Array.isArray(parts)) {
          inputText = parts.join(" ");
        }
        model = body?.model || "gpt-4";
      } catch (e) {
        console.warn("[tracker] Failed to parse request body", e);
      }
    }

    // Step 3: Proceed with original fetch
    const response = await originalFetch(input, init);

    if (isChatRequest) {
      // Step 4: Count input tokens
      const inputTokenCount = countTokens(inputText);
      usage.inputTokens += inputTokenCount;
      console.log("[tracker] Input tokens:", inputTokenCount);

      // Step 5: Handle streamed output tokens from response
      const cloned = response.clone();
      const reader = cloned.body?.getReader();
      if (reader) {
        const decoder = new TextDecoder("utf-8");
        const messageParts: string[] = [];

        let done = false;
        while (!done) {
          const { value, done: streamDone } = await reader.read();
          done = streamDone;

          const chunk = decoder.decode(value || new Uint8Array(), {
            stream: true,
          });
          const lines = chunk.split("\n");

          for (const line of lines) {
            const clean = line.trim();
            if (clean.startsWith("data:")) {
              try {
                const jsonStr = clean.replace(/^data:\s*/, "");
                if (jsonStr === "[DONE]") continue;

                const parsed = JSON.parse(jsonStr);

                if (typeof parsed.v === "string") {
                  messageParts.push(parsed.v);
                } else if (parsed?.v?.message?.content?.parts?.[0]) {
                  messageParts.push(parsed.v.message.content.parts[0]);
                } else if (parsed?.v) {
                  const delta = parsed.v;
                  if (typeof delta === "string") {
                    messageParts.push(delta);
                  } else if (delta?.message?.content?.parts?.[0]) {
                    messageParts.push(delta.message.content.parts[0]);
                  }
                }
              } catch {
                // Skip malformed data
              }
            }
          }
        }

        // Step 6: Count output tokens and update usage
        const fullMessage = messageParts.join("");
        const outputTokenCount = countTokens(fullMessage);
        usage.outputTokens += outputTokenCount;
        usage.totalTokens = usage.inputTokens + usage.outputTokens;

        console.log("[tracker] Output tokens:", outputTokenCount);
        console.log("[tracker] Total tokens:", usage.totalTokens);

        updateWidgetUI(usage, widget);
        await saveTokenUsage(usage);
      }
    }

    return response;
  };
}
