import { defineConfig } from "vite";

// base "./" so the same build works at the Worker's root and under GitHub Pages' /too-too-soon/.
// The map picker's chunk (MapLibre) is big, but it's only loaded when the picker opens.
export default defineConfig({ base: "./", build: { chunkSizeWarningLimit: 1200 } });
