const status = document.getElementById("status");

bootstrap();

async function bootstrap() {
  try {
    const params = new URLSearchParams(location.search);
    const downloadId = params.get("downloadId");
    if (!downloadId) {
      throw new Error("Missing download id.");
    }

    const stored = await chrome.storage.session.get(downloadId);
    const payload = stored[downloadId];
    if (!payload) {
      throw new Error("The download data expired before the page loaded.");
    }
    await chrome.storage.session.remove(downloadId);

    const blob = new Blob([payload.content], { type: payload.mimeType || "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = payload.fileName || "export.txt";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    status.textContent = `Downloaded ${payload.fileName}. This tab will close automatically.`;

    setTimeout(() => {
      URL.revokeObjectURL(url);
      window.close();
    }, 1200);
  } catch (error) {
    status.textContent = error.message;
  }
}
