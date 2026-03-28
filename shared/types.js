export const MESSAGE_TYPES = {
  EXPORT_HTML: "EXPORT_HTML",
  EXPORT_PDF: "EXPORT_PDF",
  CHECK_COMPATIBILITY: "CHECK_COMPATIBILITY",
  COLLECT_CONVERSATION: "COLLECT_CONVERSATION",
  COLLECT_HTML_SNAPSHOT: "COLLECT_HTML_SNAPSHOT"
};

export const ROLE_LABELS = {
  user: "You",
  assistant: "ChatGPT",
  system: "System",
  tool: "Tool"
};

export function createEmptyConversation() {
  return {
    conversation: {
      id: "",
      title: "",
      url: "",
      exportedAt: ""
    },
    messages: [],
    assets: [],
    warnings: []
  };
}
