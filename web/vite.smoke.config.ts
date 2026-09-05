import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const webRoot = path.dirname(fileURLToPath(import.meta.url));
const mockApi = path.join(webRoot, "smoke", "apiMock.ts");

export default defineConfig({
  plugins: [
    {
      name: "smoke-api-mock",
      enforce: "pre",
      resolveId(source, importer) {
        const normalizedSource = source.replaceAll("\\", "/");
        const normalizedImporter = importer?.replaceAll("\\", "/");
        const isJournalEntryForm =
          normalizedImporter?.endsWith("/src/components/JournalEntryForm.tsx") ||
          normalizedImporter?.endsWith("/src/components/JournalEntryForm.js");
        const isDeleteEntryModal =
          normalizedImporter?.endsWith("/src/components/DeleteEntryModal.tsx") ||
          normalizedImporter?.endsWith("/src/components/DeleteEntryModal.js");
        const isIntegrityBadge =
          normalizedImporter?.endsWith("/src/components/IntegrityBadge.tsx") ||
          normalizedImporter?.endsWith("/src/components/IntegrityBadge.js");
        const isConversationThread =
          normalizedImporter?.endsWith("/src/components/ConversationThread.tsx") ||
          normalizedImporter?.endsWith("/src/components/ConversationThread.js");
        if ((isJournalEntryForm || isDeleteEntryModal || isIntegrityBadge || isConversationThread) && normalizedSource === "../lib/api") {
          return mockApi;
        }
        return null;
      },
    },
    react(),
  ],
});
