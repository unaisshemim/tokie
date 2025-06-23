import ReactDOM from "react-dom/client";
import { Widget } from "./Widget";
import { TokenUsage } from "./tokeUsage";

/**
 * Mounts the React widget and returns its container HTMLElement
 */
export function createWidget(usage: TokenUsage): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);

  const root = ReactDOM.createRoot(container);
  root.render(
    <Widget
      usage={usage}
      onNewSession={() => window.open("https://chatgpt.com/", "_blank")}
      onReset={() => location.reload()} // or a smarter reset if you wish
    />
  );

  return container; // maintain compatibility with startObserver and interceptNetworkRequests
}
export function updateWidgetUI(usage: TokenUsage, widget: HTMLElement) {
  const root = ReactDOM.createRoot(widget);
  root.render(
    <Widget
      usage={usage}
      onNewSession={() => window.open("https://chatgpt.com/", "_blank")}
      onReset={() => location.reload()}
    />
  );
}
