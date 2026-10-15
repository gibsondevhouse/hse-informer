import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

/** Presentation previews have no database or training-service dependency. */
export default defineConfig({
  ...base,
  testMatch: "pbj-presentation.spec.ts",
  webServer: process.env.REACT_PREVIEW_URL
    ? []
    : [
        {
          command: "npm run dev --prefix ../admin-app -- --host 127.0.0.1 --port 5189 --strictPort",
          url: "http://127.0.0.1:5189",
          reuseExistingServer: false,
          timeout: 60_000,
        },
      ],
});
