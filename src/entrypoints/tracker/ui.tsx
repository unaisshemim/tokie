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
  (container as any)._reactRoot = root;
  root.render(
    <Widget
      usage={usage}
      onReset={() => location.reload()} // or a smarter reset if you wish
    />
  );

  return container; // maintain compatibility with startObserver and interceptNetworkRequests
}

export function updateWidgetUI(usage: TokenUsage, widget: HTMLElement) {
  const root = (widget as any)._reactRoot;
  if (root) {
    root.render(<Widget usage={usage} onReset={() => location.reload()} />);
  } else {
    const newRoot = ReactDOM.createRoot(widget);
    (widget as any)._reactRoot = newRoot;
    newRoot.render(<Widget usage={usage} onReset={() => location.reload()} />);
  }
}
