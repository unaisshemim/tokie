export default defineBackground(() => {
  console.log("[tracker] Background script initialized");

  chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
      const url = details.url;

      // ----- Chat Request (user input) -----
      if (
        details.method === "POST" &&
        url.includes("https://chatgpt.com/backend-api/conversation")
      ) {
        console.log("[tracker] Request to /conversation:", url);

        if (details.requestBody && Array.isArray(details.requestBody.raw)) {
          try {
            const decoder = new TextDecoder("utf-8");

            const byteChunks = details.requestBody.raw
              .map((data) => data.bytes)
              .filter((bytes): bytes is ArrayBuffer => !!bytes);

            if (byteChunks.length === 0) {
              console.warn("[tracker] No valid bytes in requestBody.raw");
              return;
            }

            const totalLength = byteChunks.reduce(
              (sum, b) => sum + b.byteLength,
              0
            );
            const combinedBytes = new Uint8Array(totalLength);
            let offset = 0;
            for (const buffer of byteChunks) {
              combinedBytes.set(new Uint8Array(buffer), offset);
              offset += buffer.byteLength;
            }

            const decodedPayload = decoder.decode(combinedBytes);

            try {
              const jsonPayload = JSON.parse(decodedPayload);
              console.log(
                "[tracker] Parsed Chat Request:",
                jsonPayload.messages?.[0]?.content?.parts
              );
            } catch (e) {
              console.warn(
                "[tracker] Failed to parse Chat JSON:",
                decodedPayload
              );
            }
          } catch (e) {
            console.error("[tracker] Error decoding chat payload:", e);
          }
        }
      }

      // ----- Telemetry Request (/lat/r) -----
      else if (
        details.method === "POST" &&
        url.includes("https://chatgpt.com/backend-api/lat/r")
      ) {
        console.log("[tracker] Detected telemetry POST to /lat/r");
        console.log(details);
        if (details.requestBody && Array.isArray(details.requestBody.raw)) {
          try {
            const decoder = new TextDecoder("utf-8");

            const byteChunks = details.requestBody.raw
              .map((data) => data.bytes)
              .filter((bytes): bytes is ArrayBuffer => !!bytes);

            if (byteChunks.length === 0) {
              console.warn("[tracker] No valid telemetry bytes found");
              return;
            }

            const totalLength = byteChunks.reduce(
              (sum, b) => sum + b.byteLength,
              0
            );
            const combinedBytes = new Uint8Array(totalLength);
            let offset = 0;
            for (const buffer of byteChunks) {
              combinedBytes.set(new Uint8Array(buffer), offset);
              offset += buffer.byteLength;
            }

            const decodedTelemetry = decoder.decode(combinedBytes);

            try {
              const parsed = JSON.parse(decodedTelemetry);
              console.log("[tracker] Telemetry metadata from /lat/r:", parsed);
            } catch (e) {
              console.warn(
                "[tracker] Failed to parse telemetry JSON:",
                decodedTelemetry
              );
            }
          } catch (e) {
            console.error("[tracker] Error decoding telemetry:", e);
          }
        }
      }

      return {};
    },
    { urls: ["<all_urls>"], types: ["xmlhttprequest"] },
    ["requestBody", "extraHeaders"]
  );

  // --- Listener for content-script streamed messages ---
});
