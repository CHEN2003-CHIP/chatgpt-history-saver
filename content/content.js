const MESSAGE_TYPES = {
  COLLECT_CONVERSATION: "COLLECT_CONVERSATION",
  COLLECT_HTML_SNAPSHOT: "COLLECT_HTML_SNAPSHOT",
  PING_COLLECTOR: "PING_COLLECTOR"
};

if (!window.__chatHistorySaverCollectorInitialized) {
  window.__chatHistorySaverCollectorInitialized = true;

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === MESSAGE_TYPES.PING_COLLECTOR) {
      sendResponse({ ok: true });
      return false;
    }

    if (message?.type === MESSAGE_TYPES.COLLECT_HTML_SNAPSHOT) {
      collectHtmlSnapshot()
        .then((snapshot) => sendResponse({ ok: true, ...snapshot }))
        .catch((error) => sendResponse({ ok: false, error: error.message }));
      return true;
    }

    if (message?.type !== MESSAGE_TYPES.COLLECT_CONVERSATION) {
      return undefined;
    }

    collectConversation()
      .then((conversation) => sendResponse({ ok: true, conversation }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));

    return true;
  });
}

async function collectHtmlSnapshot() {
  const title = inferTitle();
  const exportedAt = new Date().toISOString();
  const warnings = [];
  const messageNodes = findMessageElements();
  if (!messageNodes.length) {
    throw new Error("No chat messages were found for HTML export.");
  }

  const snapshotRoot = document.createElement("div");
  snapshotRoot.setAttribute("data-chat-history-snapshot", "true");

  for (const node of messageNodes) {
    const clone = node.cloneNode(true);
    inlineTreeStyles(node, clone);
    sanitizeSnapshot(clone);
    snapshotRoot.appendChild(clone);
  }

  const imageWarnings = await embedSnapshotImages(snapshotRoot);
  warnings.push(...imageWarnings);

  const pageShell = buildSnapshotShell(snapshotRoot.innerHTML, {
    title,
    exportedAt,
    warnings,
    sourceUrl: location.href
  });

  return { title, warnings, htmlDocument: pageShell };
}

function buildSnapshotShell(contentHtml, meta) {
  const pageStyles = getComputedStyle(document.body);
  const mainStyles = getComputedStyle(document.querySelector("main") || document.body);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(meta.title)}</title>
    <base href="${escapeHtml(meta.sourceUrl)}" />
  </head>
  <body style="margin:0;background:${escapeHtml(pageStyles.background || pageStyles.backgroundColor || '#f7f7f8')};color:${escapeHtml(pageStyles.color || '#111827')};font-family:${escapeHtml(pageStyles.fontFamily || 'Segoe UI, sans-serif')};">
    <div style="min-height:100vh;background:${escapeHtml(mainStyles.background || 'transparent')};">
      <div style="max-width:860px;margin:0 auto;padding:24px 16px 48px;">
        <div style="margin:0 0 20px;padding:14px 18px;border-radius:16px;background:rgba(255,255,255,0.82);border:1px solid rgba(15,23,42,0.08);backdrop-filter:blur(10px);">
          <div style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#0f766e;margin-bottom:6px;">ChatGPT Snapshot</div>
          <h1 style="margin:0;font-size:28px;line-height:1.15;">${escapeHtml(meta.title)}</h1>
          <p style="margin:8px 0 0;color:#667085;font-size:14px;">Exported At: ${escapeHtml(meta.exportedAt)}</p>
          <p style="margin:4px 0 0;color:#667085;font-size:14px;">Source: ${escapeHtml(meta.sourceUrl)}</p>
        </div>
        ${meta.warnings.length ? `<div style="margin:0 0 16px;padding:14px 16px;border-radius:14px;background:#fff7ed;color:#9a3412;border:1px solid rgba(154,52,18,0.12);"><strong>Export Notes</strong><ul style="margin:8px 0 0;padding-left:18px;">${meta.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul></div>` : ""}
        <main style="display:grid;gap:0;">${contentHtml}</main>
      </div>
    </div>
  </body>
</html>`;
}

async function collectConversation() {
  const conversation = {
    conversation: {
      id: inferConversationId(),
      title: inferTitle(),
      url: location.href,
      exportedAt: new Date().toISOString()
    },
    messages: [],
    assets: [],
    warnings: []
  };

  const stateMessages = collectFromBootstrappedState();
  if (stateMessages.length) {
    conversation.messages = normalizeMessages(stateMessages);
  } else {
    conversation.messages = normalizeMessages(collectFromDom());
    if (!conversation.messages.length) {
      throw new Error("No conversation messages found on this page.");
    }
    conversation.warnings.push("Fell back to DOM parsing because no structured page state was available.");
  }

  await enrichImages(conversation);
  if (!conversation.messages.length) {
    throw new Error("The conversation appears to be empty.");
  }
  return conversation;
}

function findMessageElements() {
  const direct = Array.from(document.querySelectorAll("[data-message-author-role]")).filter(isVisibleElement);
  if (direct.length) {
    return dedupeElementsByContent(direct.map((node) => node.closest("article") || node));
  }

  const articles = Array.from(document.querySelectorAll("main article")).filter((node) => {
    return isVisibleElement(node) && node.innerText && node.innerText.trim().length > 0;
  });
  if (articles.length) {
    return dedupeElementsByContent(articles);
  }

  const groups = Array.from(document.querySelectorAll("main [class*='group']")).filter((node) => {
    return isVisibleElement(node) && node.innerText && node.innerText.trim().length > 40;
  });
  return dedupeElementsByContent(groups);
}

function dedupeElementsByContent(elements) {
  const seen = new Set();
  const output = [];
  for (const element of elements) {
    if (!(element instanceof HTMLElement)) {
      continue;
    }
    const signature = `${element.getAttribute("data-message-author-role") || ""}:${(element.innerText || "").trim().slice(0, 500)}`;
    if (!signature.trim() || seen.has(signature)) {
      continue;
    }
    seen.add(signature);
    output.push(element);
  }
  return output;
}

function isVisibleElement(element) {
  if (!(element instanceof HTMLElement)) {
    return false;
  }
  const style = getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") {
    return false;
  }
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function inlineTreeStyles(sourceRoot, targetRoot) {
  const sourceNodes = [sourceRoot, ...sourceRoot.querySelectorAll("*")];
  const targetNodes = [targetRoot, ...targetRoot.querySelectorAll("*")];
  const count = Math.min(sourceNodes.length, targetNodes.length);

  for (let index = 0; index < count; index += 1) {
    inlineComputedStyle(sourceNodes[index], targetNodes[index]);
    if (targetNodes[index] instanceof HTMLElement) {
      if (targetNodes[index].tagName === "A") {
        targetNodes[index].setAttribute("target", "_blank");
        targetNodes[index].setAttribute("rel", "noreferrer noopener");
      }
      if (targetNodes[index].tagName === "CODE" || targetNodes[index].tagName === "PRE") {
        targetNodes[index].style.whiteSpace = "pre-wrap";
        targetNodes[index].style.wordBreak = "break-word";
        targetNodes[index].style.overflowWrap = "break-word";
      }
    }
  }
}

function inlineComputedStyle(sourceNode, targetNode) {
  if (!(sourceNode instanceof Element) || !(targetNode instanceof Element)) {
    return;
  }
  const computed = getComputedStyle(sourceNode);
  const priorityProps = [
    "display",
    "position",
    "top",
    "right",
    "bottom",
    "left",
    "z-index",
    "width",
    "height",
    "max-width",
    "min-width",
    "max-height",
    "min-height",
    "margin",
    "padding",
    "border",
    "border-top",
    "border-right",
    "border-bottom",
    "border-left",
    "border-radius",
    "background",
    "background-color",
    "background-image",
    "box-shadow",
    "opacity",
    "overflow",
    "overflow-x",
    "overflow-y",
    "color",
    "font",
    "font-family",
    "font-size",
    "font-weight",
    "font-style",
    "line-height",
    "letter-spacing",
    "text-align",
    "text-transform",
    "text-decoration",
    "white-space",
    "word-break",
    "overflow-wrap",
    "gap",
    "row-gap",
    "column-gap",
    "grid-template-columns",
    "grid-template-rows",
    "grid-column",
    "grid-row",
    "flex",
    "flex-direction",
    "justify-content",
    "align-items",
    "align-self"
  ];

  for (const property of priorityProps) {
    const value = computed.getPropertyValue(property);
    if (value) {
      targetNode.style.setProperty(property, value, computed.getPropertyPriority(property));
    }
  }
}

function sanitizeSnapshot(root) {
  const removeSelectors = [
    "script",
    "style",
    "noscript",
    "textarea",
    "form",
    "button",
    "input",
    "select",
    "nav",
    "aside",
    "footer",
    "[role='dialog']",
    "[contenteditable='true']",
    "[data-testid='composer-action-bar']",
    "[data-testid='floating-composer']",
    "[data-testid='conversation-turn-actions']",
    "[data-testid='copy-turn-action-button']"
  ];

  for (const node of Array.from(root.querySelectorAll(removeSelectors.join(",")))) {
    node.remove();
  }

  for (const element of Array.from(root.querySelectorAll("*"))) {
    element.removeAttribute("id");
    element.removeAttribute("data-testid");
    element.removeAttribute("aria-controls");
    element.removeAttribute("aria-expanded");
    if (element instanceof HTMLElement) {
      element.style.animation = "none";
      element.style.transition = "none";
      if (element.style.position === "sticky" || element.style.position === "fixed") {
        element.style.position = "static";
        element.style.top = "auto";
        element.style.left = "auto";
        element.style.right = "auto";
        element.style.bottom = "auto";
      }
    }
  }
}

async function embedSnapshotImages(root) {
  const warnings = [];
  const images = Array.from(root.querySelectorAll("img"));
  for (const image of images) {
    const src = image.currentSrc || image.src;
    if (!src || src.startsWith("data:")) {
      continue;
    }
    try {
      const dataUrl = await fetchAsDataUrl(src);
      image.src = dataUrl;
      image.removeAttribute("srcset");
      image.loading = "eager";
    } catch (error) {
      warnings.push(`Could not inline image: ${src}`);
    }
  }
  return warnings;
}

function inferConversationId() {
  const match = location.pathname.match(/\/c\/([^/?]+)/);
  return match?.[1] || crypto.randomUUID();
}

function inferTitle() {
  const title = document.title
    .replace(/\s*\|\s*ChatGPT\s*$/i, "")
    .replace(/\s*-\s*ChatGPT\s*$/i, "")
    .trim();
  return title || "Untitled ChatGPT Conversation";
}

function collectFromBootstrappedState() {
  const scripts = Array.from(document.querySelectorAll("script"));
  const messages = [];

  for (const script of scripts) {
    const text = script.textContent || "";
    if (!text.includes("\"author\"") || !text.includes("\"content\"")) {
      continue;
    }

    const regex = /\{[^{}]*"author":\{"role":"(user|assistant|system|tool)"[^{}]*"content":\{[\s\S]*?\}\}/g;
    for (const match of text.matchAll(regex)) {
      try {
        const parsed = JSON.parse(match[0]);
        const normalized = normalizeStateMessage(parsed);
        if (normalized) {
          messages.push(normalized);
        }
      } catch (error) {
        continue;
      }
    }

    if (messages.length) {
      break;
    }
  }

  return dedupeMessages(messages);
}

function normalizeStateMessage(message) {
  if (!message?.author?.role) {
    return null;
  }

  const role = normalizeRole(message.author.role);
  const parts = [];
  const contentParts = message.content?.parts || [];

  for (const part of contentParts) {
    if (typeof part === "string" && part.trim()) {
      parts.push({ type: "text", text: part.trim() });
      continue;
    }

    if (part?.content_type === "image_asset_pointer" && part.asset_pointer) {
      parts.push({
        type: "image",
        src: part.asset_pointer,
        alt: part.alt || "Conversation image"
      });
    }
  }

  if (!parts.length && typeof message.content?.text === "string") {
    parts.push({ type: "text", text: message.content.text });
  }

  if (!parts.length) {
    return null;
  }

  return {
    id: message.id || crypto.randomUUID(),
    role,
    authorName: role === "assistant" ? "ChatGPT" : "You",
    createdAt: message.create_time || null,
    parts
  };
}

function collectFromDom() {
  const elements = findMessageElements();
  const parsed = [];

  for (const element of elements) {
    const role =
      element.getAttribute("data-message-author-role") ||
      element.querySelector("[data-message-author-role]")?.getAttribute("data-message-author-role") ||
      inferRoleFromElement(element);

    if (!role) {
      continue;
    }

    const parts = extractPartsFromElement(element);
    if (!parts.length) {
      continue;
    }

    parsed.push({
      id: element.id || element.dataset.messageId || crypto.randomUUID(),
      role: normalizeRole(role),
      authorName: normalizeRole(role) === "assistant" ? "ChatGPT" : "You",
      createdAt: null,
      parts
    });
  }

  return dedupeMessages(parsed);
}

function inferRoleFromElement(element) {
  const attr = element.querySelector("img[alt*='User'], img[alt*='ChatGPT']")?.alt || "";
  if (/chatgpt/i.test(attr) || /assistant/i.test(element.className || "")) {
    return "assistant";
  }
  return "user";
}

function extractPartsFromElement(element) {
  const parts = [];
  const codeBlocks = Array.from(element.querySelectorAll("pre"));

  for (const pre of codeBlocks) {
    const code = pre.querySelector("code");
    const text = code?.innerText || pre.innerText || "";
    if (text.trim()) {
      parts.push({ type: "code", language: detectLanguage(code), text });
    }
  }

  for (const image of Array.from(element.querySelectorAll("img"))) {
    const src = image.currentSrc || image.src;
    if (!src || /^data:image\/svg\+xml/i.test(src)) {
      continue;
    }
    parts.push({ type: "image", src: absoluteUrl(src), alt: image.alt || "Conversation image" });
  }

  const textSelectors = ["p", "li", "blockquote", "h1", "h2", "h3", "h4", "table"];
  const textChunks = [];
  for (const node of Array.from(element.querySelectorAll(textSelectors.join(", ")))) {
    if (node.closest("pre")) {
      continue;
    }
    const text = node.innerText?.trim();
    if (text) {
      textChunks.push(text);
    }
  }

  if (!textChunks.length) {
    const fallback = htmlToText(element.innerHTML)
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (fallback) {
      textChunks.push(fallback);
    }
  }

  if (textChunks.length) {
    parts.unshift({ type: "text", text: dedupeText(textChunks).join("\n\n") });
  }

  return parts;
}

function normalizeMessages(messages) {
  return messages
    .filter((message) => message?.parts?.length)
    .map((message) => ({
      ...message,
      role: normalizeRole(message.role),
      parts: normalizeParts(message.parts)
    }))
    .filter((message) => message.parts.length);
}

function normalizeParts(parts) {
  return parts
    .map((part) => {
      if (part.type === "text") {
        const text = (part.text || "").trim();
        return text ? { type: "text", text } : null;
      }
      if (part.type === "code") {
        const text = part.text || "";
        return text ? { type: "code", text, language: part.language || "" } : null;
      }
      if (part.type === "image") {
        return {
          type: "image",
          src: absoluteUrl(part.src || ""),
          alt: part.alt || "Conversation image"
        };
      }
      return null;
    })
    .filter(Boolean);
}

async function enrichImages(conversation) {
  let failedImages = 0;
  for (const message of conversation.messages) {
    for (const part of message.parts) {
      if (part.type !== "image" || !part.src) {
        continue;
      }
      try {
        part.dataUrl = await fetchAsDataUrl(part.src);
        conversation.assets.push({ type: "image", src: part.src, alt: part.alt || "Conversation image" });
      } catch (error) {
        failedImages += 1;
      }
    }
  }

  if (failedImages > 0) {
    conversation.warnings.push(
      `${failedImages} image attachment(s) could not be embedded and will fall back to their original URL.`
    );
  }
}

function normalizeRole(role) {
  if (["assistant", "user", "system", "tool"].includes(role)) {
    return role;
  }
  if (String(role).toLowerCase().includes("assistant")) {
    return "assistant";
  }
  return "user";
}

function detectLanguage(codeElement) {
  if (!codeElement) {
    return "";
  }
  const className = codeElement.className || "";
  const match = className.match(/language-([\w-]+)/);
  return match?.[1] || "";
}

function dedupeMessages(messages) {
  const seen = new Set();
  const deduped = [];
  for (const message of messages) {
    const signature = `${message.role}:${message.parts.map((part) => part.text || part.src || "").join("|")}`;
    if (seen.has(signature)) {
      continue;
    }
    seen.add(signature);
    deduped.push(message);
  }
  return deduped;
}

function dedupeText(values) {
  return values.filter((value, index) => values.indexOf(value) === index);
}

function absoluteUrl(url) {
  try {
    return new URL(url, location.href).href;
  } catch (error) {
    return url;
  }
}

function htmlToText(html) {
  const container = document.createElement("div");
  container.innerHTML = html;
  return container.textContent || "";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("Failed to read blob"));
    reader.readAsDataURL(blob);
  });
}

async function fetchAsDataUrl(url) {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    throw new Error(`Failed to fetch asset: ${response.status}`);
  }
  const blob = await response.blob();
  return blobToDataUrl(blob);
}
