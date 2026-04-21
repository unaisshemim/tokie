import React from "react";
import ReactDOM from "react-dom/client";

const HOST_ID = "tokie-skills-host";

type MountedRoot = {
  host: HTMLElement;
  root: ReactDOM.Root;
};

let current: MountedRoot | null = null;

function unmount() {
  if (!current) return;
  try {
    current.root.unmount();
  } catch {
  }
  current.host.remove();
  current = null;
}

async function mount() {
  const host = document.createElement("div");
  host.id = HOST_ID;
  host.style.all = "initial";
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });
  const container = document.createElement("div");
  shadow.appendChild(container);

  const { SkillsModal } = await import("./SkillsModal");
  const root = ReactDOM.createRoot(container);
  current = { host, root };
  root.render(React.createElement(SkillsModal, { onClose: unmount }));
}

export async function toggleSkillsModal(): Promise<void> {
  if (current) {
    unmount();
    return;
  }
  await mount();
}

export function closeSkillsModal(): void {
  unmount();
}

export function isSkillsModalOpen(): boolean {
  return current !== null;
}
