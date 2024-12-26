import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  server: {
    port: 8002,
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
    fs: {
      // 允许服务器访问上层目录
      allow: [".."],
    },
    plugins: [
      {
        name: 'serve-models',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url.startsWith('/models')) {
              const modelName = req.url.split('/models/')[1];
              const modelPath = path.join(__dirname, 'models', modelName);
              if (fs.existsSync(modelPath)) {
                res.sendFile(modelPath);
              } else {
                res.status(404).send('Model not found');
              }
            } else {
              next();
            }
          });
        },
      },
    ],
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
    // 确保WASM文件被正确复制
    assetsInlineLimit: 0,
  },
  // 配置静态资源目录
  publicDir: "public",
  // 确保.wasm和模型文件被识别为资源
  assetsInclude: ["**/*.onnx", "**/*.wasm"],
});
