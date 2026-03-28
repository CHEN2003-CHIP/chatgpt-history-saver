import { renderConversationHtml } from "../shared/serialize.js";

const app = document.getElementById("app");

bootstrap();

async function bootstrap() {
  try {
    const params = new URLSearchParams(location.search);
    const exportId = params.get("exportId");
    if (!exportId) {
      throw new Error("Missing export id.");
    }

    const stored = await chrome.storage.session.get(exportId);
    const payload = stored[exportId];
    if (!payload) {
      throw new Error("The export data expired before the page loaded.");
    }
    await chrome.storage.session.remove(exportId);

    const { mode, conversation, fileName, htmlDocument, warnings } = payload;

    if (mode === "html") {
      document.title = `${fileName || "Conversation"} - HTML Export`;
      app.classList.remove("loading-state");
      app.innerHTML = renderHtmlPreview(fileName || "chatgpt-conversation.html", warnings || []);

      const previewFrame = document.getElementById("htmlPreview");
      previewFrame.srcdoc = htmlDocument || "";

      const downloadButton = document.getElementById("downloadHtmlButton");
      downloadButton.addEventListener("click", () => {
        downloadHtmlDocument(htmlDocument, fileName || "chatgpt-conversation.html");
      });

      return;
    }

    if (!conversation) {
      throw new Error("Missing conversation payload.");
    }

    document.title = `${conversation.conversation.title || "Conversation"} - Export`;
    app.classList.remove("loading-state");
    app.innerHTML = renderConversationHtml(conversation);

    await waitForImages();

    if (mode === "pdf") {
      window.print();
      return;
    }

    throw new Error("Unsupported export mode.");
  } catch (error) {
    app.classList.add("loading-state");
    app.textContent = error.message;
  }
}

function renderHtmlPreview(fileName, warnings) {
  return `
    <section class="html-preview-shell">
      <header class="html-toolbar">
        <div>
          <p class="eyebrow">ChatGPT HTML Export</p>
          <h1>${escapeHtml(fileName)}</h1>
          <p class="meta">Preview the static snapshot below, then download it if it looks right.</p>
        </div>
        <button id="downloadHtmlButton" class="download-button">Download HTML</button>
      </header>
      ${renderWarnings(warnings)}
      <section class="html-frame-shell">
        <iframe id="htmlPreview" class="html-preview-frame" title="HTML export preview"></iframe>
      </section>
    </section>
  `;
}

function renderWarnings(warnings) {
  if (!warnings.length) {
    return "";
  }
  return `<aside class="warnings"><h2>Export Notes</h2><ul>${warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul></aside>`;
}

function downloadHtmlDocument(htmlDocument, fileName) {
  if (!htmlDocument) {
    throw new Error("Missing HTML export content.");
  }
  const blob = new Blob([htmlDocument], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function waitForImages() {
  const images = Array.from(document.images);
  if (!images.length) {
    return;
  }
  await Promise.all(
    images.map(
      (image) =>
        new Promise((resolve) => {
          if (image.complete) {
            resolve();
            return;
          }
          image.addEventListener("load", resolve, { once: true });
          image.addEventListener("error", resolve, { once: true });
        })
    )
  );
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
