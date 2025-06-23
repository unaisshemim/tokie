import { countTokens, saveTokenUsage, TokenUsage } from "./tokeUsage";
import { updateWidgetUI } from "./ui";

export function interceptNetworkRequests(
  usage: TokenUsage,
  widget: HTMLElement
) {
  const originalFetch = window.fetch;
  console.log("[tracker] bomb1");

  window.fetch = async function (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    // Step 1: Determine if the request is to ChatGPT backend
    console.log("[tracker] bomb2", input, init);
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
    console.log("[tracker] bomb3", requestUrl, init);
    const isChatRequest = requestUrl.includes("/backend-api/conversation");

    // Step 2: Extract input text from request body
    let inputText = "";
    let model = "gpt-3.5-turbo"; // default fallback

    async function readRequestBody(init?: RequestInit): Promise<any> {
      if (!init?.body) return null;

      if (typeof init.body === "string") {
        return JSON.parse(init.body);
      }

      try {
        const reader = (init.body as ReadableStream<Uint8Array>).getReader();
        const decoder = new TextDecoder("utf-8");
        let fullBody = "";

        let done = false;
        while (!done) {
          const { value, done: streamDone } = await reader.read();
          done = streamDone;
          fullBody += decoder.decode(value || new Uint8Array(), {
            stream: true,
          });
        }

        return JSON.parse(fullBody);
      } catch (e) {
        console.warn("[tracker] Failed to decode request body", e);
        return null;
      }
    }

    if (isChatRequest) {
      const bodyJson = await readRequestBody(init);
      if (bodyJson) {
        const parts = bodyJson?.messages?.[0]?.content?.parts;
        if (Array.isArray(parts)) {
          inputText = parts.join(" ");
        }
        model = bodyJson?.model || model;
      }
    }

    // Step 3: Proceed with original fetch
    const response = await originalFetch(input, init);

    if (isChatRequest) {
      // Step 4: Count input tokens
      const inputTokenCount = countTokens(inputText);
      usage.inputTokens += inputTokenCount;
      console.log("[tracker] Input tokens:", inputTokenCount);

      // Step 5: Handle streamed output
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
            if (!clean.startsWith("data:")) continue;

            const jsonStr = clean.replace(/^data:\s*/, "");
            if (jsonStr === "[DONE]") continue;

            try {
              const parsed = JSON.parse(jsonStr);

              // Handle various delta formats
              const delta = parsed?.delta?.v;
              if (typeof delta === "string") {
                messageParts.push(delta);
              } else if (delta?.message?.content?.parts?.[0]) {
                messageParts.push(delta.message.content.parts[0]);
              }
            } catch (err) {
              // Skip malformed lines
              console.warn("[tracker] Malformed delta line", clean);
            }
          }
        }

        // Step 6: Count output tokens
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
