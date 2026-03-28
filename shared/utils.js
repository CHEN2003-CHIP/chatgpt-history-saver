export function sanitizeFileName(input, fallback = "chatgpt-conversation") {
  const safe = (input || fallback)
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return safe || fallback;
}

export function formatIsoDate(date = new Date()) {
  return date.toISOString();
}

export function blobToDataUrl(blob) {
  if (typeof FileReader !== "undefined") {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error("Failed to read blob"));
      reader.readAsDataURL(blob);
    });
  }

  return blob.arrayBuffer().then((buffer) => {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = "";
    for (let index = 0; index < bytes.length; index += chunkSize) {
      const chunk = bytes.subarray(index, index + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return `data:${blob.type || "application/octet-stream"};base64,${btoa(binary)}`;
  });
}

export async function fetchAsDataUrl(url) {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    throw new Error(`Failed to fetch asset: ${response.status}`);
  }
  const blob = await response.blob();
  return blobToDataUrl(blob);
}

export function absoluteUrl(url) {
  try {
    return new URL(url, location.href).href;
  } catch (error) {
    return url;
  }
}

export function htmlToText(html) {
  const container = document.createElement("div");
  container.innerHTML = html;
  return container.textContent || "";
}

export async function downloadBlob(blob, fileName) {
  const url = await blobToDataUrl(blob);
  return new Promise((resolve, reject) => {
    chrome.downloads.download(
      {
        url,
        filename: fileName,
        saveAs: true
      },
      (downloadId) => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve(downloadId);
      }
    );
  });
}
