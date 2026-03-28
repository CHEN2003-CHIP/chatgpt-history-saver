# ChatGPT History Saver

An Edge/Chromium extension that exports the current ChatGPT web conversation to PDF or high-fidelity HTML.

## Features

- One-click export from the browser action popup
- High-fidelity HTML export as a standalone static reading page
- PDF export through a dedicated print-friendly preview page
- Best-effort image embedding for readable exports
- ChatGPT-only scope for `chatgpt.com` and `chat.openai.com`

## Load In Edge

1. Open `edge://extensions/`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select the folder:
   - `E:\Pycharm Project\ChatHistory-Saver`
5. If the extension was already loaded earlier, click the extension card's reload button before retesting.

## Release Prep

- Icons are included in `icons/` and referenced in `manifest.json`.
- Store metadata draft is in `docs/STORE_LISTING.md`.
- Privacy policy draft is in `docs/PRIVACY_POLICY.md`.
- Release steps are in `docs/RELEASE_CHECKLIST.md`.

## How It Works

- `content/content.js` collects the current conversation.
- HTML export builds a DOM snapshot of the visible chat content and inlines key styles.
- PDF export renders the conversation into a print-friendly preview page.
- `background/background.js` stores export payloads in temporary session storage and opens the export page.

## Known Limitations

- ChatGPT frontend changes may require parser updates.
- Structured extraction is best-effort because ChatGPT does not expose a stable public export API in-page.
- Some protected or expiring image URLs may not embed successfully; the export includes warnings when that happens.
