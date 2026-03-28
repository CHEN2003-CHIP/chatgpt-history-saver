import { MESSAGE_TYPES } from "../shared/types.js";
import { sanitizeFileName } from "../shared/utils.js";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message?.type) {
    return undefined;
  }

  if (message.type === MESSAGE_TYPES.CHECK_COMPATIBILITY) {
    handleCompatibilityCheck(sendResponse);
    return true;
  }

  if (message.type === MESSAGE_TYPES.EXPORT_HTML || message.type === MESSAGE_TYPES.EXPORT_PDF) {
    handleExportRequest(message.type)
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  return undefined;
});

async function handleCompatibilityCheck(sendResponse) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const isChatPage = Boolean(tab?.url && /^https:\/\/(chatgpt\.com|chat\.openai\.com)\//.test(tab.url));
    sendResponse({ ok: true, isChatPage });
  } catch (error) {
    sendResponse({ ok: false, error: error.message });
  }
}

async function handleExportRequest(type) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) {
    throw new Error("No active tab available.");
  }
  if (!/^https:\/\/(chatgpt\.com|chat\.openai\.com)\//.test(tab.url)) {
    throw new Error("Open a ChatGPT conversation page before exporting.");
  }

  await ensureCollectorInjected(tab.id);

  if (type === MESSAGE_TYPES.EXPORT_HTML) {
    const snapshotResponse = await chrome.tabs.sendMessage(tab.id, { type: MESSAGE_TYPES.COLLECT_HTML_SNAPSHOT });
    if (!snapshotResponse?.ok) {
      throw new Error(snapshotResponse?.error || "Failed to build the HTML snapshot.");
    }

    const fileName = `${sanitizeFileName(snapshotResponse.title || "chatgpt-conversation")}.html`;
    const exportId = `export-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await chrome.storage.session.set({
      [exportId]: {
        mode: "html",
        fileName,
        htmlDocument: snapshotResponse.htmlDocument,
        warnings: snapshotResponse.warnings || []
      }
    });

    const url = chrome.runtime.getURL(`export/export.html?exportId=${encodeURIComponent(exportId)}`);
    await chrome.tabs.create({ url });

    return {
      warnings: snapshotResponse.warnings || [],
      fileName
    };
  }

  const response = await chrome.tabs.sendMessage(tab.id, { type: MESSAGE_TYPES.COLLECT_CONVERSATION });
  if (!response?.ok) {
    throw new Error(response?.error || "Failed to collect the conversation.");
  }

  const conversation = response.conversation;
  const baseName = sanitizeFileName(conversation.conversation.title || "chatgpt-conversation");
  const exportId = `export-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  await chrome.storage.session.set({
    [exportId]: {
      mode: "pdf",
      fileName: `${baseName}.pdf`,
      conversation,
      warnings: conversation.warnings || []
    }
  });

  const url = chrome.runtime.getURL(`export/export.html?exportId=${encodeURIComponent(exportId)}`);
  await chrome.tabs.create({ url });

  return {
    warnings: conversation.warnings || [],
    fileName: `${baseName}.pdf`
  };
}

async function ensureCollectorInjected(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "PING_COLLECTOR" });
    return;
  } catch (error) {
    const message = chrome.runtime.lastError?.message || error?.message || "";
    if (
      message.includes("Receiving end does not exist") ||
      message.includes("Could not establish connection") ||
      message.includes("The message port closed")
    ) {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content/content.js"]
      });
      return;
    }
    throw error;
  }
}
