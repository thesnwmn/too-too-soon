import { defineConfig } from "vite";

// base "./" so the same build works at the Worker's root and under GitHub Pages' /too-too-soon/.
export default defineConfig({ base: "./" });
