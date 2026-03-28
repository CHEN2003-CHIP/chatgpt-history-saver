import { MESSAGE_TYPES } from "../shared/types.js";

const pageStatus = document.getElementById("pageStatus");
const statusMessage = document.getElementById("statusMessage");
const warningBox = document.getElementById("warningBox");
const buttons = Array.from(document.querySelectorAll("[data-export-type]"));

bootstrap();

async function bootstrap() {
  setLoadingState(true);
  try {
    const response = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.CHECK_COMPATIBILITY });
    if (!response?.ok) {
      throw new Error(response?.error || "Unable to inspect the current tab.");
    }
    if (!response.isChatPage) {
      pageStatus.textContent = "Unsupported page";
      pageStatus.classList.add("error");
      statusMessage.textContent = "Open a ChatGPT conversation tab, then try again.";
      setButtonsEnabled(false);
      return;
    }

    pageStatus.textContent = "Ready to export";
    pageStatus.classList.add("ready");
    statusMessage.textContent = "Choose PDF for printing or HTML for a standalone static reading page.";
    setButtonsEnabled(true);
  } catch (error) {
    pageStatus.textContent = "Extension error";
    pageStatus.classList.add("error");
    statusMessage.textContent = error.message;
    setButtonsEnabled(false);
  } finally {
    setLoadingState(false);
  }
}

for (const button of buttons) {
  button.addEventListener("click", async () => {
    const type = button.dataset.exportType;
    setButtonsEnabled(false);
    showWarnings([]);
    pageStatus.textContent = "Export in progress";
    pageStatus.classList.remove("error");
    statusMessage.textContent = "Collecting the conversation and preparing your export.";

    try {
      const response = await chrome.runtime.sendMessage({ type });
      if (!response?.ok) {
        throw new Error(response?.error || "The export failed.");
      }
      pageStatus.textContent = type === MESSAGE_TYPES.EXPORT_PDF ? "PDF preview opened" : "HTML export opened";
      pageStatus.classList.add("ready");
      statusMessage.textContent =
        type === MESSAGE_TYPES.EXPORT_PDF
          ? "The preview page is ready. Use the browser print dialog to save as PDF."
          : "A standalone HTML export page has opened and will download automatically.";
      showWarnings(response.warnings || []);
    } catch (error) {
      pageStatus.textContent = "Export failed";
      pageStatus.classList.remove("ready");
      pageStatus.classList.add("error");
      statusMessage.textContent = error.message;
    } finally {
      setButtonsEnabled(true);
    }
  });
}

function setButtonsEnabled(enabled) {
  for (const button of buttons) {
    button.disabled = !enabled;
  }
}

function setLoadingState(loading) {
  document.body.dataset.loading = loading ? "true" : "false";
}

function showWarnings(warnings) {
  if (!warnings.length) {
    warningBox.classList.add("hidden");
    warningBox.innerHTML = "";
    return;
  }
  warningBox.classList.remove("hidden");
  warningBox.innerHTML = warnings.map((warning) => `<p>${warning}</p>`).join("");
}
