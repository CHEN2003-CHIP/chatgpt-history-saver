import { ROLE_LABELS } from "./types.js";

const STATIC_EXPORT_CSS = `
  :root {
    --page-bg: #ebe4d8;
    --paper: #fffcf5;
    --line: rgba(15, 23, 42, 0.08);
    --text: #1f2937;
    --muted: #667085;
    --assistant: #ffffff;
    --user: #e0f2f1;
    --code-bg: #111827;
    --code-text: #e5e7eb;
    --accent: #0f766e;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: Georgia, "Times New Roman", "PingFang SC", serif;
    color: var(--text);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.45), rgba(255, 255, 255, 0)),
      radial-gradient(circle at top left, rgba(15, 118, 110, 0.12), transparent 32%),
      var(--page-bg);
  }
  .export-shell {
    max-width: 960px;
    margin: 0 auto;
    padding: 40px 24px 80px;
  }
  .export-header, .warnings, .message {
    border: 1px solid var(--line);
    box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
  }
  .export-header {
    padding: 28px;
    border-radius: 28px;
    background: rgba(255, 252, 245, 0.92);
  }
  .eyebrow {
    margin: 0 0 8px;
    font-size: 12px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--accent);
  }
  .export-header h1 {
    margin: 0;
    font-size: 38px;
    line-height: 1.05;
  }
  .meta {
    margin: 8px 0 0;
    color: var(--muted);
  }
  .warnings {
    margin-top: 18px;
    border-radius: 20px;
    background: #fff7ed;
    padding: 18px 22px;
  }
  .conversation-list {
    margin-top: 26px;
    display: grid;
    gap: 18px;
  }
  .message {
    padding: 22px;
    border-radius: 24px;
    break-inside: avoid;
  }
  .message-assistant { background: var(--assistant); }
  .message-user { background: var(--user); }
  .message-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
  }
  .role-pill {
    display: inline-flex;
    padding: 6px 10px;
    border-radius: 999px;
    background: rgba(15, 118, 110, 0.12);
    color: var(--accent);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .author-name { color: var(--muted); }
  .message-body {
    display: grid;
    gap: 14px;
  }
  .part { line-height: 1.7; }
  .text-part { font-size: 17px; }
  .code-part {
    overflow: hidden;
    border-radius: 18px;
    background: var(--code-bg);
    color: var(--code-text);
  }
  .code-header {
    padding: 10px 14px;
    font: 600 12px/1.2 "Segoe UI", sans-serif;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #93c5fd;
    background: rgba(255, 255, 255, 0.06);
  }
  .code-part pre {
    margin: 0;
    padding: 16px;
    white-space: pre-wrap;
    word-break: break-word;
    font: 14px/1.6 Consolas, "SFMono-Regular", monospace;
  }
  .image-part { margin: 0; }
  .image-part img {
    display: block;
    max-width: 100%;
    border-radius: 18px;
    border: 1px solid var(--line);
  }
  .image-part figcaption {
    margin-top: 8px;
    color: var(--muted);
    font-size: 14px;
  }
`;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function serializeToJson(conversation) {
  const content = JSON.stringify(conversation, null, 2);
  return new Blob([content], { type: "application/json;charset=utf-8" });
}

export function serializeToMarkdown(conversation) {
  const lines = [];
  const title = conversation.conversation.title || "Untitled ChatGPT Conversation";
  lines.push(`# ${title}`);
  lines.push("");
  lines.push(`- Source: ${conversation.conversation.url}`);
  lines.push(`- Exported At: ${conversation.conversation.exportedAt}`);
  lines.push("");

  for (const message of conversation.messages) {
    const role = ROLE_LABELS[message.role] || message.role;
    lines.push(`## ${role}`);
    lines.push("");

    for (const part of message.parts) {
      if (part.type === "text") {
        lines.push(part.text || "");
        lines.push("");
      } else if (part.type === "code") {
        lines.push(`\`\`\`${part.language || ""}`);
        lines.push(part.text || "");
        lines.push("```");
        lines.push("");
      } else if (part.type === "image") {
        const alt = part.alt || "Image";
        lines.push(`![${alt}](${part.src || ""})`);
        lines.push("");
      }
    }
  }

  if (conversation.warnings?.length) {
    lines.push("## Export Notes");
    lines.push("");
    for (const warning of conversation.warnings) {
      lines.push(`- ${warning}`);
    }
    lines.push("");
  }

  return new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
}

export function serializeToHtml(conversation) {
  const title = conversation.conversation.title || "Untitled ChatGPT Conversation";
  const documentHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <style>${STATIC_EXPORT_CSS}</style>
  </head>
  <body>
    ${renderConversationHtml(conversation)}
  </body>
</html>`;

  return new Blob([documentHtml], { type: "text/html;charset=utf-8" });
}

function renderPart(part) {
  if (part.type === "code") {
    return `
      <div class="part code-part">
        <div class="code-header">${escapeHtml(part.language || "code")}</div>
        <pre><code>${escapeHtml(part.text || "")}</code></pre>
      </div>
    `;
  }

  if (part.type === "image") {
    const alt = escapeHtml(part.alt || "Conversation image");
    const src = escapeHtml(part.dataUrl || part.src || "");
    return `
      <figure class="part image-part">
        <img src="${src}" alt="${alt}" loading="eager" />
        <figcaption>${alt}</figcaption>
      </figure>
    `;
  }

  return `<div class="part text-part">${escapeHtml(part.text || "").replace(/\n/g, "<br />")}</div>`;
}

export function renderConversationHtml(conversation) {
  const title = escapeHtml(conversation.conversation.title || "Untitled ChatGPT Conversation");
  const url = escapeHtml(conversation.conversation.url || "");
  const exportedAt = escapeHtml(conversation.conversation.exportedAt || "");
  const warnings = (conversation.warnings || [])
    .map((warning) => `<li>${escapeHtml(warning)}</li>`)
    .join("");

  const messages = conversation.messages
    .map((message) => {
      const role = escapeHtml(ROLE_LABELS[message.role] || message.role);
      const author = escapeHtml(message.authorName || role);
      const parts = message.parts.map(renderPart).join("");
      return `
        <article class="message message-${escapeHtml(message.role)}">
          <header class="message-header">
            <span class="role-pill">${role}</span>
            <span class="author-name">${author}</span>
          </header>
          <div class="message-body">${parts}</div>
        </article>
      `;
    })
    .join("");

  return `
    <section class="export-shell">
      <header class="export-header">
        <div>
          <p class="eyebrow">ChatGPT History Saver</p>
          <h1>${title}</h1>
          <p class="meta">Source: ${url}</p>
          <p class="meta">Exported At: ${exportedAt}</p>
        </div>
      </header>
      ${warnings ? `<aside class="warnings"><h2>Export Notes</h2><ul>${warnings}</ul></aside>` : ""}
      <main class="conversation-list">${messages}</main>
    </section>
  `;
}
