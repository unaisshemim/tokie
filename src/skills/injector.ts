import { getPlatformConfig } from "@/platform";

function findComposer(): HTMLElement | null {
  const { composerSelectors } = getPlatformConfig();
  for (const selector of composerSelectors) {
    const els = Array.from(document.querySelectorAll<HTMLElement>(selector));
    const visible = els.find(isVisibleComposer);
    if (visible) return visible;
  }
  return null;
}

function isVisibleComposer(el: HTMLElement): boolean {
  if (el.getAttribute("aria-hidden") === "true") return false;

  const rect = el.getBoundingClientRect();
  if (rect.width < 20 || rect.height < 10) return false;

  const style = window.getComputedStyle(el);
  return (
    style.visibility !== "hidden" &&
    style.display !== "none" &&
    Number(style.opacity) !== 0
  );
}

function getCurrentText(el: HTMLElement): string {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    return el.value;
  }
  return el.innerText ?? el.textContent ?? "";
}

function insertIntoTextarea(
  el: HTMLTextAreaElement | HTMLInputElement,
  text: string
): boolean {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype,
    "value"
  )?.set;

  const existing = el.value;
  const separator = existing.trim() ? "\n\n" : "";
  const next = existing + separator + text;

  el.focus();
  if (nativeSetter) {
    nativeSetter.call(el, next);
  } else {
    el.value = next;
  }
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function dispatchTextInput(el: HTMLElement, text: string, inputType: string): boolean {
  const beforeInput = new InputEvent("beforeinput", {
    bubbles: true,
    cancelable: true,
    composed: true,
    inputType,
    data: text,
  });
  el.dispatchEvent(beforeInput);

  if (beforeInput.defaultPrevented) {
    return true;
  }

  el.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      composed: true,
      inputType,
      data: text,
    })
  );
  return false;
}

function dispatchPaste(el: HTMLElement, text: string): boolean {
  try {
    const data = new DataTransfer();
    data.setData("text/plain", text);
    const paste = new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      composed: true,
      clipboardData: data,
    });
    el.dispatchEvent(paste);
    return paste.defaultPrevented;
  } catch {
    return false;
  }
}

function insertIntoContentEditable(el: HTMLElement, text: string): boolean {
  el.focus();

  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  if (sel) {
    sel.removeAllRanges();
    sel.addRange(range);
  }

  const existing = getCurrentText(el);
  const needsSeparator = existing.trim().length > 0;
  const payload = (needsSeparator ? "\n\n" : "") + text;

  let inserted = false;
  try {
    inserted = document.execCommand("insertText", false, payload);
  } catch {
    inserted = false;
  }

  if (!inserted) {
    inserted =
      dispatchPaste(el, payload) ||
      dispatchTextInput(el, payload, "insertFromPaste") ||
      dispatchTextInput(el, payload, "insertText");
  }

  if (!inserted && !el.classList.contains("ProseMirror")) {
    const lines = payload.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (i > 0) el.appendChild(document.createElement("br"));
      if (lines[i]) el.appendChild(document.createTextNode(lines[i]));
    }
    inserted = true;
  }

  return inserted;
}

export type InjectionResult =
  | { ok: true; composer: HTMLElement }
  | { ok: false; reason: "no_composer" | "insert_failed" };

export function injectSkillText(text: string): InjectionResult {
  const el = findComposer();
  if (!el) return { ok: false, reason: "no_composer" };

  let ok = false;
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    ok = insertIntoTextarea(el, text);
  } else {
    ok = insertIntoContentEditable(el, text);
  }

  return ok ? { ok: true, composer: el } : { ok: false, reason: "insert_failed" };
}

export function focusComposer(): boolean {
  const el = findComposer();
  if (!el) return false;
  el.focus();
  return true;
}
