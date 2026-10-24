/// <reference types="vitest/config" />
import { defineConfig } from "vite";

// base "./" so the same build works at the Worker's root and under GitHub Pages' /too-too-soon/.
// The map picker's chunk (MapLibre) is big, but it's only loaded when the picker opens.
// MapLibre's worker is a module worker, so workers are built as ES modules.
// Tests read style.css as text (test/contrast.test.ts), which Vitest only allows for CSS it processes.
export default defineConfig({ base: "./", build: { chunkSizeWarningLimit: 1200 }, worker: { format: "es" }, test: { css: { include: [/style\.css/] } } });
