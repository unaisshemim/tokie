import { jsPDF } from "jspdf";
import { detectPlatform, getPlatformConfig } from "./platform";

type ChatRole = "user" | "assistant" | "system";
type ThemeName = "light" | "dark";

interface PdfTheme {
  background: string;
  text: string;
  textMuted: string;
  link: string;
  userBubble: string;
  assistantBubble: string;
  border: string;
  codeBg: string;
  codeBorder: string;
}

interface MessageRange {
  start?: number;
  end?: number;
}

interface DateRange {
  from?: Date;
  to?: Date;
}

export interface ChatExportOptions {
  theme?: ThemeName;
  fontScale?: number; // multiplier over base font size
  includeTimestamps?: boolean;
  includeSystemMessages?: boolean;
  includeTableOfContents?: boolean;
  includeImages?: boolean;
  includeCitations?: boolean;
  includeMessageNumbers?: boolean;
  dateRange?: DateRange;
  range?: MessageRange;
  title?: string;
  filename?: string;
  customHeaderNote?: string;
}

interface ChatMessage {
  id: string;
  index: number;
  role: ChatRole;
  timestamp?: string;
  blocks: RichBlock[];
  citations: string[];
}

type RichBlock =
  | ParagraphBlock
  | ListBlock
  | CodeBlock
  | QuoteBlock
  | ImageBlock
  | DividerBlock;

interface ParagraphBlock {
  type: "paragraph";
  runs: TextRun[];
}

interface ListBlock {
  type: "list";
  ordered: boolean;
  items: TextRun[][];
}

interface CodeBlock {
  type: "code";
  code: string;
  language?: string;
}

interface QuoteBlock {
  type: "quote";
  runs: TextRun[];
}

interface ImageBlock {
  type: "image";
  alt?: string;
  caption?: string;
  width?: number;
  height?: number;
  dataUrl?: string;
  source?: HTMLImageElement;
}

interface DividerBlock {
  type: "divider";
}

interface TextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  monospace?: boolean;
  link?: string;
}

interface TocEntry {
  messageLabel: string;
  page: number;
}

const PAGE_MARGIN = 40;
const HEADER_HEIGHT = 56;
const BASE_FONT_SIZE = 11;
const LINE_HEIGHT = 1.4;
const THEMES: Record<ThemeName, PdfTheme> = {
  light: {
    background: "#ffffff",
    text: "#0f172a",
    textMuted: "#6b7280",
    link: "#2563eb",
    userBubble: "#dbeafe",
    assistantBubble: "#f3f4f6",
    border: "#e5e7eb",
    codeBg: "#0f172a0d",
    codeBorder: "#cbd5f5",
  },
  dark: {
    background: "#0f172a",
    text: "#f8fafc",
    textMuted: "#94a3b8",
    link: "#93c5fd",
    userBubble: "#1d4ed8",
    assistantBubble: "#1f2937",
    border: "#334155",
    codeBg: "#111827",
    codeBorder: "#1f2937",
  },
};

type Html2CanvasFn = (
  element: HTMLElement,
  options?: Record<string, unknown>
) => Promise<HTMLCanvasElement>;
let html2canvasFn: Html2CanvasFn | null = null;

async function ensureHtml2Canvas(): Promise<Html2CanvasFn> {
  if (html2canvasFn) return html2canvasFn;
  const mod = await import("html2canvas");
  const fn = (mod as any).default ?? mod;
  html2canvasFn = fn as Html2CanvasFn;
  return html2canvasFn;
}

const DEFAULT_OPTIONS: Required<
  Pick<
    ChatExportOptions,
    | "theme"
    | "fontScale"
    | "includeTimestamps"
    | "includeSystemMessages"
    | "includeTableOfContents"
    | "includeImages"
    | "includeCitations"
    | "includeMessageNumbers"
  >
> = {
  theme: "light",
  fontScale: 1,
  includeTimestamps: true,
  includeSystemMessages: false,
  includeTableOfContents: true,
  includeImages: true,
  includeCitations: true,
  includeMessageNumbers: true,
};

export async function generateChatPdf(
  options: ChatExportOptions = {}
): Promise<void> {
  if (typeof document === "undefined") {
    throw new Error("Chat export is only available in the browser context.");
  }

  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  const theme = THEMES[mergedOptions.theme] || THEMES.light;
  const messages = await scrapeChatMessages(mergedOptions);
  if (!messages.length) {
    throw new Error("No chat messages were found on the page.");
  }

  await resolveImageBlocks(messages, mergedOptions);

  const doc = new jsPDF("p", "pt", "a4", true);

  const title =
    mergedOptions.title ||
    `Chat Export – ${new Date().toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })}`;

  paintPageBackground(doc, theme);
  let cursorY = drawHeader(doc, title, mergedOptions, theme);
  const tocEntries: TocEntry[] = [];

  for (let idx = 0; idx < messages.length; idx++) {
    cursorY = await drawMessageCard(
      doc,
      messages[idx],
      {
        cursorY,
        fontSize: BASE_FONT_SIZE * mergedOptions.fontScale,
        theme,
        includeTimestamps: mergedOptions.includeTimestamps,
        includeCitations: mergedOptions.includeCitations,
        includeImages: mergedOptions.includeImages,
        includeMessageNumbers: mergedOptions.includeMessageNumbers,
        messageNumber: idx + 1,
      },
      tocEntries,
      title
    );
  }

  if (mergedOptions.includeTableOfContents && tocEntries.length > 3) {
    insertTableOfContents(doc, tocEntries, theme, mergedOptions);
  }

  decorateFooters(doc, title, theme);

  const filename =
    mergedOptions.filename ||
    `tokie-chat-${new Date().toISOString().replace(/[:.]/g, "-")}.pdf`;
  doc.save(filename);
}

async function scrapeChatMessages(
  options: ChatExportOptions
): Promise<ChatMessage[]> {
  const platform = detectPlatform();
  const config = getPlatformConfig();
  const messages: ChatMessage[] = [];

  if (platform === "claude") {
    // Claude uses a different structure - messages are in containers with data-test-render-count
    const messageContainers = Array.from(
      document.querySelectorAll<HTMLElement>(config.messageContainerSelector)
    );

    messageContainers.forEach((container, idx) => {
      // Check if it's a user message
      const userMessage = container.querySelector<HTMLElement>(
        config.userMessageSelector
      );
      // Check if it's an assistant message
      const assistantMessage = container.querySelector<HTMLElement>(
        config.assistantMessageSelector
      );

      let role: ChatRole = "assistant";
      let contentRoot: HTMLElement | null = null;

      if (userMessage) {
        role = "user";
        contentRoot = userMessage;
      } else if (assistantMessage) {
        role = "assistant";
        // For Claude, the response content is in a div with font-claude-response class
        // or the container with data-is-streaming attribute
        const responseContent = container.querySelector<HTMLElement>(
          ".font-claude-response"
        );
        contentRoot =
          responseContent ||
          assistantMessage
            .closest<HTMLElement>(".group")
            ?.querySelector<HTMLElement>(".font-claude-response") ||
          assistantMessage.closest<HTMLElement>(".group") ||
          container;
      } else {
        return; // Skip if neither user nor assistant message found
      }

      if (!contentRoot) return;

      const timestamp =
        container.querySelector("time")?.getAttribute("datetime") ||
        container.querySelector("time")?.textContent?.trim() ||
        undefined;

      const blocks = parseBlocks(contentRoot);
      const citations = Array.from(container.querySelectorAll("sup a"))
        .map((a) => a.textContent?.trim())
        .filter((text): text is string => Boolean(text));

      if (!blocks.length && !citations.length) return;

      messages.push({
        id: `${role}-${idx}`,
        index: idx,
        role,
        timestamp,
        blocks,
        citations,
      });
    });
  } else {
    // ChatGPT structure - use article elements
    const articles = Array.from(
      document.querySelectorAll<HTMLElement>("article")
    );

    articles.forEach((article, idx) => {
      const authorNode = article.querySelector<HTMLElement>(
        "[data-message-author-role]"
      );
      if (!authorNode) return;
      const role =
        (authorNode.dataset.messageAuthorRole as ChatRole | undefined) ||
        "assistant";
      if (role === "system" && !options.includeSystemMessages) return;

      const timestamp =
        article.querySelector("time")?.getAttribute("datetime") ||
        article.querySelector("time")?.textContent?.trim() ||
        undefined;

      const contentRoot =
        article.querySelector<HTMLElement>(
          '[data-testid="conversation-turn"]'
        ) || authorNode;
      const blocks = parseBlocks(contentRoot);
      const citations = Array.from(article.querySelectorAll("sup a"))
        .map((a) => a.textContent?.trim())
        .filter((text): text is string => Boolean(text));

      if (!blocks.length && !citations.length) return;

      messages.push({
        id: authorNode.dataset.messageId || `${role}-${idx}`,
        index: idx,
        role,
        timestamp,
        blocks,
        citations,
      });
    });
  }

  const filteredByDate = filterByDate(messages, options.dateRange);
  return applyRange(filteredByDate, options.range);
}

function parseBlocks(root: HTMLElement): RichBlock[] {
  const blocks: RichBlock[] = [];
  root.childNodes.forEach((node) => {
    const block = blockFromNode(node);
    if (Array.isArray(block)) {
      blocks.push(...block);
    } else if (block) {
      blocks.push(block);
    }
  });
  return blocks;
}

function blockFromNode(node: Node): RichBlock | RichBlock[] | null {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent?.trim();
    if (!text) return null;
    return [
      {
        type: "paragraph",
        runs: [{ text }],
      },
    ];
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();

  // Check for Claude's code block structure (div with code-block__code class)
  if (tag === "div" && el.classList.contains("code-block__code")) {
    return parseCodeBlock(el);
  }

  switch (tag) {
    case "p":
    case "div":
      return {
        type: "paragraph",
        runs: parseInline(el),
      };
    case "ul":
    case "ol":
      return parseList(el, tag === "ol");
    case "pre":
      return parseCodeBlock(el);
    case "blockquote":
      return {
        type: "quote",
        runs: parseInline(el),
      };
    case "hr":
      return { type: "divider" };
    case "figure":
    case "img":
      return parseImageBlock(el);
    default:
      if (tag.startsWith("h")) {
        return {
          type: "paragraph",
          runs: [{ text: el.innerText.trim(), bold: true }],
        };
      }
      return {
        type: "paragraph",
        runs: parseInline(el),
      };
  }
}

function parseInline(el: HTMLElement, style: Partial<TextRun> = {}): TextRun[] {
  const runs: TextRun[] = [];

  el.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const textContent = child.textContent ?? "";
      if (!textContent) return;
      runs.push({
        text: textContent.replace(/\s+/g, " "),
        ...style,
      });
      return;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return;

    const childEl = child as HTMLElement;
    const childStyle = { ...style };
    const tag = childEl.tagName.toLowerCase();

    if (tag === "strong" || tag === "b") childStyle.bold = true;
    if (tag === "em" || tag === "i") childStyle.italic = true;
    if (tag === "code") childStyle.monospace = true;
    if (tag === "a") {
      childStyle.link = childEl.getAttribute("href") || undefined;
    }

    if (tag === "br") {
      runs.push({ text: "\n", ...childStyle });
      return;
    }

    runs.push(...parseInline(childEl, childStyle));
  });

  return runs;
}

function parseList(el: HTMLElement, ordered: boolean): ListBlock {
  const items: TextRun[][] = [];
  Array.from(el.children).forEach((child) => {
    if (child.tagName.toLowerCase() === "li") {
      items.push(parseInline(child as HTMLElement));
    }
  });
  return { type: "list", ordered, items };
}

function parseCodeBlock(el: HTMLElement): CodeBlock {
  // For Claude: code-block__code div contains a code element
  // For ChatGPT: pre element contains a code element
  const codeEl = el.querySelector("code") || el;
  const language =
    codeEl.getAttribute("data-language") ||
    codeEl.className.match(/language-(\w+)/)?.[1] ||
    (codeEl.classList.contains("language-javascript")
      ? "javascript"
      : undefined) ||
    (codeEl.classList.contains("language-js") ? "javascript" : undefined);
  return {
    type: "code",
    language: language || undefined,
    code: codeEl.textContent?.replace(/\s+$/, "") || "",
  };
}

function parseImageBlock(el: HTMLElement): ImageBlock | null {
  const img = (
    el.tagName.toLowerCase() === "img" ? el : el.querySelector("img")
  ) as HTMLImageElement | null;
  if (!img) return null;
  const caption =
    el.querySelector("figcaption")?.innerText.trim() || img.alt || undefined;
  return {
    type: "image",
    alt: img.alt,
    caption,
    source: img,
    width: img.naturalWidth || undefined,
    height: img.naturalHeight || undefined,
  };
}

function filterByDate(
  messages: ChatMessage[],
  range?: DateRange
): ChatMessage[] {
  if (!range) return messages;
  const fromMs = range.from?.valueOf();
  const toMs = range.to?.valueOf();
  if (!fromMs && !toMs) return messages;

  return messages.filter((msg) => {
    if (!msg.timestamp) return true;
    const msgTime = Date.parse(msg.timestamp);
    if (Number.isNaN(msgTime)) return true;
    if (fromMs && msgTime < fromMs) return false;
    if (toMs && msgTime > toMs) return false;
    return true;
  });
}

function applyRange(
  messages: ChatMessage[],
  range?: MessageRange
): ChatMessage[] {
  if (!range) return messages;
  const start = range.start ?? 0;
  const end = range.end ?? messages.length - 1;
  if (start === 0 && end === messages.length - 1) return messages;
  return messages.slice(start, end + 1);
}

async function resolveImageBlocks(
  messages: ChatMessage[],
  options: ChatExportOptions
) {
  if (!options.includeImages) return;
  for (const message of messages) {
    for (const block of message.blocks) {
      if (block.type === "image" && block.source && !block.dataUrl) {
        block.dataUrl = await captureElementImage(block.source);
      }
    }
  }
}

async function captureElementImage(
  img: HTMLImageElement
): Promise<string | undefined> {
  const src = img.currentSrc || img.src;
  if (!src) return undefined;

  // Attempt fetch for cleaner data URL
  try {
    const response = await fetch(src, { mode: "cors" });
    const blob = await response.blob();
    return await blobToDataUrl(blob);
  } catch (_) {
    // Fallback to html2canvas
    try {
      const html2canvas = await ensureHtml2Canvas();
      const canvas = await html2canvas(img, {
        backgroundColor: null,
        scale: 1,
      });
      return canvas.toDataURL("image/png");
    } catch (error) {
      console.warn("[chatExport] Failed to capture image", error);
      return undefined;
    }
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Failed to read blob as data url."));
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function paintPageBackground(doc: jsPDF, theme: PdfTheme) {
  const pageWidth = getPageWidth(doc);
  const pageHeight = getPageHeight(doc);
  doc.setFillColor(theme.background);
  doc.rect(0, 0, pageWidth, pageHeight, "F");
}

function drawHeader(
  doc: jsPDF,
  title: string,
  options: ChatExportOptions,
  theme: PdfTheme
): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(theme.text);
  doc.text(title, PAGE_MARGIN, PAGE_MARGIN);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(theme.textMuted);
  const dateLine = `Exported ${new Date().toLocaleString()}`;
  doc.text(dateLine, PAGE_MARGIN, PAGE_MARGIN + 16);
  if (options.customHeaderNote) {
    doc.text(options.customHeaderNote, PAGE_MARGIN, PAGE_MARGIN + 32);
    return PAGE_MARGIN + HEADER_HEIGHT;
  }
  return PAGE_MARGIN + HEADER_HEIGHT - 16;
}

interface DrawContext {
  cursorY: number;
  fontSize: number;
  theme: PdfTheme;
  includeTimestamps: boolean;
  includeCitations: boolean;
  includeImages: boolean;
  includeMessageNumbers: boolean;
  messageNumber: number;
}

async function drawMessageCard(
  doc: jsPDF,
  message: ChatMessage,
  ctx: DrawContext,
  tocEntries: TocEntry[],
  title: string
): Promise<number> {
  const startPage = doc.getCurrentPageInfo().pageNumber;
  const theme = ctx.theme;
  const fontSize = ctx.fontSize;
  const bubbleColor =
    message.role === "user" ? theme.userBubble : theme.assistantBubble;

  let cursorY = ensureSpace(doc, ctx.cursorY, 20, theme, title);

  const label =
    (ctx.includeMessageNumbers ? `#${ctx.messageNumber} ` : "") +
    (message.role === "user"
      ? "You"
      : message.role === "assistant"
      ? "Tokie Assistant"
      : "System");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(fontSize + 1);
  doc.setTextColor(theme.text);
  doc.text(label, PAGE_MARGIN, cursorY);

  if (ctx.includeTimestamps && message.timestamp) {
    doc.setFontSize(fontSize - 1);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(theme.textMuted);
    doc.text(
      new Date(message.timestamp).toLocaleString(),
      getPageWidth(doc) - PAGE_MARGIN,
      cursorY,
      { align: "right" }
    );
  }

  cursorY += 8;
  const cardWidth = getPageWidth(doc) - PAGE_MARGIN * 2;

  doc.setFillColor(bubbleColor);
  doc.setDrawColor(theme.border);
  const cardHeightEstimate = message.blocks.length * (fontSize * 1.5) + 24;
  cursorY = ensureSpace(doc, cursorY, cardHeightEstimate, theme, title);

  const cardY = cursorY;
  let innerY = cardY + 16;

  for (const block of message.blocks) {
    innerY = await drawBlock(doc, block, PAGE_MARGIN + 12, innerY, {
      fontSize,
      maxWidth: cardWidth - 24,
      theme,
      includeImages: ctx.includeImages,
    });
    innerY += fontSize * 0.6;
  }

  if (ctx.includeCitations && message.citations.length) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(fontSize - 1);
    doc.setTextColor(theme.textMuted);
    const citations = message.citations.join(", ");
    const lines = doc.splitTextToSize(citations, cardWidth - 24);
    lines.forEach((line: string, idx: number) => {
      const lineY = innerY + idx * fontSize * LINE_HEIGHT;
      doc.text(line, PAGE_MARGIN + 12, lineY);
    });
    innerY += lines.length * fontSize * LINE_HEIGHT;
  }

  const cardHeight = innerY - cardY + 12;
  doc.setDrawColor(theme.border);
  doc.roundedRect(PAGE_MARGIN, cardY, cardWidth, cardHeight, 8, 8, "FD");

  tocEntries.push({
    messageLabel: label,
    page: startPage,
  });

  return cardY + cardHeight + fontSize * 1.5;
}

async function drawBlock(
  doc: jsPDF,
  block: RichBlock,
  x: number,
  cursorY: number,
  options: {
    fontSize: number;
    maxWidth: number;
    theme: PdfTheme;
    includeImages: boolean;
  }
): Promise<number> {
  switch (block.type) {
    case "paragraph":
      drawParagraph(doc, block.runs, x, cursorY, options);
      return cursorY + paragraphHeight(doc, block.runs, options);
    case "list":
      return drawList(doc, block, x, cursorY, options);
    case "code":
      return drawCodeBlock(doc, block, x, cursorY, options);
    case "quote":
      return drawQuote(doc, block, x, cursorY, options);
    case "image":
      if (options.includeImages) {
        return drawImage(doc, block, x, cursorY, options);
      }
      return cursorY;
    case "divider":
      doc.setDrawColor(options.theme.border);
      doc.setLineWidth(0.5);
      doc.line(x, cursorY, x + options.maxWidth, cursorY);
      return cursorY + options.fontSize * 0.8;
    default:
      return cursorY;
  }
}

function drawParagraph(
  doc: jsPDF,
  runs: TextRun[],
  x: number,
  y: number,
  options: { fontSize: number; maxWidth: number; theme: PdfTheme }
) {
  let cursorX = x;
  let cursorY = y;
  const lineHeight = options.fontSize * LINE_HEIGHT;
  doc.setFontSize(options.fontSize);

  runs.forEach((run) => {
    if (run.text === "\n") {
      cursorX = x;
      cursorY += lineHeight;
      return;
    }

    if (run.monospace) {
      doc.setFont("courier", run.bold ? "bold" : "normal");
    } else {
      const fontStyle = run.bold
        ? run.italic
          ? "bolditalic"
          : "bold"
        : run.italic
        ? "italic"
        : "normal";
      doc.setFont("helvetica", fontStyle as any);
    }

    if (run.link) {
      doc.setTextColor(options.theme.link);
    } else {
      doc.setTextColor(options.theme.text);
    }

    const words = run.text.split(/(\s+)/);
    words.forEach((word) => {
      const wordWidth = doc.getTextWidth(word);
      if (cursorX + wordWidth > x + options.maxWidth) {
        cursorX = x;
        cursorY += lineHeight;
      }
      doc.text(word, cursorX, cursorY);
      cursorX += wordWidth;
    });
  });
}

function paragraphHeight(
  doc: jsPDF,
  runs: TextRun[],
  options: { fontSize: number; maxWidth: number }
) {
  const text = runs.map((run) => run.text).join("");
  const lines = doc.splitTextToSize(text, options.maxWidth);
  return lines.length * options.fontSize * LINE_HEIGHT;
}

function drawList(
  doc: jsPDF,
  block: ListBlock,
  x: number,
  cursorY: number,
  options: { fontSize: number; maxWidth: number; theme: PdfTheme }
): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(options.fontSize);
  doc.setTextColor(options.theme.text);
  let y = cursorY;
  const lineHeight = options.fontSize * LINE_HEIGHT;

  block.items.forEach((itemRuns, idx) => {
    const prefix = block.ordered ? `${idx + 1}. ` : "• ";
    doc.text(prefix, x, y);
    const paragraphWidth = options.maxWidth - doc.getTextWidth(prefix);
    drawParagraph(doc, itemRuns, x + 16, y, {
      ...options,
      maxWidth: paragraphWidth,
    });
    y += lineHeight;
  });

  return y;
}

function drawCodeBlock(
  doc: jsPDF,
  block: CodeBlock,
  x: number,
  cursorY: number,
  options: { fontSize: number; maxWidth: number; theme: PdfTheme }
): number {
  const codeFontSize = options.fontSize * 0.95;
  const padding = 10;
  const text = block.code || "";
  const lines = doc.splitTextToSize(text, options.maxWidth - padding * 2);
  const height = lines.length * codeFontSize * 1.2 + padding * 2;

  doc.setFillColor(options.theme.codeBg);
  doc.setDrawColor(options.theme.codeBorder);
  doc.roundedRect(x, cursorY, options.maxWidth, height, 4, 4, "FD");

  doc.setFont("courier", "normal");
  doc.setFontSize(codeFontSize);
  doc.setTextColor(options.theme.text);

  lines.forEach((line: string, idx: number) => {
    doc.text(line, x + padding, cursorY + padding + idx * codeFontSize * 1.2);
  });

  if (block.language) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(codeFontSize - 2);
    doc.setTextColor(options.theme.textMuted);
    doc.text(
      block.language.toUpperCase(),
      x + options.maxWidth - padding,
      cursorY + height - padding / 2,
      { align: "right" }
    );
  }

  return cursorY + height + codeFontSize * 0.8;
}

function drawQuote(
  doc: jsPDF,
  block: QuoteBlock,
  x: number,
  cursorY: number,
  options: { fontSize: number; maxWidth: number; theme: PdfTheme }
): number {
  doc.setDrawColor(options.theme.border);
  doc.setLineWidth(2);
  doc.line(x, cursorY - options.fontSize * 0.6, x, cursorY + 8);
  drawParagraph(doc, block.runs, x + 10, cursorY, {
    ...options,
    fontSize: options.fontSize,
  });
  return cursorY + paragraphHeight(doc, block.runs, options);
}

async function drawImage(
  doc: jsPDF,
  block: ImageBlock,
  x: number,
  cursorY: number,
  options: { fontSize: number; maxWidth: number; theme: PdfTheme }
): Promise<number> {
  if (!block.dataUrl) return cursorY;
  const maxImageWidth = options.maxWidth;
  const ratio =
    block.width && block.height ? Math.min(maxImageWidth / block.width, 1) : 1;
  const width = block.width ? block.width * ratio : maxImageWidth;
  const height = block.height ? block.height * ratio : maxImageWidth * 0.6;

  doc.addImage(block.dataUrl, "PNG", x, cursorY, width, height);
  let y = cursorY + height + options.fontSize * 0.4;

  if (block.caption) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(options.fontSize - 1);
    doc.setTextColor(options.theme.textMuted);
    const lines = doc.splitTextToSize(block.caption, options.maxWidth);
    lines.forEach((line: string, idx: number) => {
      doc.text(line, x, y + idx * (options.fontSize - 1) * LINE_HEIGHT);
    });
    y += lines.length * (options.fontSize - 1) * LINE_HEIGHT;
  }
  return y + options.fontSize * 0.4;
}

function ensureSpace(
  doc: jsPDF,
  cursorY: number,
  blockHeight: number,
  theme: PdfTheme,
  title: string
): number {
  const pageHeight = getPageHeight(doc);
  if (cursorY + blockHeight <= pageHeight - PAGE_MARGIN) {
    return cursorY;
  }
  doc.addPage();
  paintPageBackground(doc, theme);
  return PAGE_MARGIN;
}

function insertTableOfContents(
  doc: jsPDF,
  entries: TocEntry[],
  theme: PdfTheme,
  options: ChatExportOptions
) {
  doc.insertPage(2);
  doc.setPage(2);
  paintPageBackground(doc, theme);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16 * (options.fontScale || 1));
  doc.setTextColor(theme.text);
  doc.text("Table of Contents", PAGE_MARGIN, PAGE_MARGIN);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11 * (options.fontScale || 1));
  doc.setTextColor(theme.textMuted);

  let cursorY = PAGE_MARGIN + 20;
  entries.forEach((entry, idx) => {
    const adjustedPage = entry.page + 1; // TOC inserted after cover
    const label = `${idx + 1}. ${entry.messageLabel}`;
    doc.text(label, PAGE_MARGIN, cursorY);
    doc.text(`${adjustedPage}`, getPageWidth(doc) - PAGE_MARGIN, cursorY, {
      align: "right",
    });
    cursorY += 16;
  });
}

function decorateFooters(doc: jsPDF, title: string, theme: PdfTheme) {
  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(theme.textMuted);
    doc.setFontSize(9);
    const footerY = getPageHeight(doc) - PAGE_MARGIN / 2;
    doc.text(title, PAGE_MARGIN, footerY);
    doc.text(
      `Page ${page} of ${totalPages}`,
      getPageWidth(doc) - PAGE_MARGIN,
      footerY,
      { align: "right" }
    );
  }
}

function getPageWidth(doc: jsPDF): number {
  const size: any = doc.internal.pageSize;
  if (typeof size.getWidth === "function") return size.getWidth();
  return size.width;
}

function getPageHeight(doc: jsPDF): number {
  const size: any = doc.internal.pageSize;
  if (typeof size.getHeight === "function") return size.getHeight();
  return size.height;
}
