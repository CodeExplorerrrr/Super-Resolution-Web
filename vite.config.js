import { defineConfig } from "vite";
import { resolve } from "path";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  server: {
    port: 8002,
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  optimizeDeps: {
    exclude: ["onnxruntime-web"],
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
      },
    },
    assetsInlineLimit: 0,
  },
  publicDir: "public",
  assetsInclude: ["**/*.onnx", "**/*.wasm"],
  plugins: [
    viteStaticCopy({
      targets: [
        { src: "models/*", dest: "models" }, // 将 models 文件夹复制到 dist/models
      ],
    }),
  ],
});
