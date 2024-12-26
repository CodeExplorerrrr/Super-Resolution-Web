// 在文件开头添加
// 配置WASM文件路径
if (typeof ort !== "undefined") {
  ort.env.wasm.wasmPaths = "/";
}

let session = null;
let currentBackend = "webgpu";
import { ModelConfigs } from "./modelConfigs.js";
export let currentModel = ModelConfigs["srcnn_x4"].name;
const state = {
  isInterrupted: false,
};

// 初始化ONNX运行时
async function initONNX() {
  try {
    ort.env.debug = true;
    ort.env.webgpu = {
      ...ort.env.webgpu,
      // profiling: {
      //   mode: "default",
      // },
    };
    // todo 解决webgl无法推理的问题
    ort.env.webgl = {
      ...ort.env.webgl,
      pack: false,
      // contextId: "webgl2",
      // matmulMaxBatchSize: 0,
      // textureCacheMode: "initializerOnly",
    };
    console.log("initONNX-ort.env", ort.env);

    console.log(`尝试使用 ${currentBackend} 后端载模型...`);

    console.log("开始初始化模型会话...");
    session = await ort.InferenceSession.create(getModelPath(currentModel), {
      executionProviders: [currentBackend],
      graphOptimizationLevel: "all",
      // logSeverityLevel: 0,
    });

    if (!session) {
      throw new Error("模型会话创建失败");
    }

    console.log("模型加载成功，检查模型信息...");
    console.log("模型输入名称:", session.inputNames);
    console.log("模型输出名称:", session.outputNames);

    // 验证模型配置
    const modelConfig = ModelConfigs[currentModel];
    if (modelConfig) {
      if (!session.inputNames.includes(modelConfig.inputName)) {
        console.error("配置的输入名称不匹配！", {
          配置名称: modelConfig.inputName,
          实际名称: session.inputNames,
        });
      }
      if (!session.outputNames.includes(modelConfig.outputName)) {
        console.error("配置的输出名称不匹配！", {
          配置名称: modelConfig.outputName,
          实际名称: session.outputNames,
        });
      }
    }

    return true;
  } catch (e) {
    console.error("初始化失败:", e);
    // 如果是 WebGPU 失败，尝试切换到 WebGL
    if (currentBackend === "webgpu") {
      console.log("正在切换到 WebGL 后端...");
      currentBackend = "webgl";
      return initONNX();
    }
    return false;
  }
}

// 检查后端可用性并返回设备（如果是 WebGPU）
async function checkBackendAvailability(backend) {
  try {
    switch (backend) {
      case "webgpu":
        if (!navigator.gpu) {
          throw new Error("WebGPU 不支持 - 您的浏览器不支持 WebGPU");
        }
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
          throw new Error("WebGPU 不支持 - 无法获取 GPU 适配器");
        }
        try {
          const device = await adapter.requestDevice();
          if (!device) {
            throw new Error("WebGPU 不支持 - 无法获取 GPU 设备");
          }
          // 测试设备是否真正可用
          const testBuffer = device.createBuffer({
            size: 4,
            usage: GPUBufferUsage.STORAGE,
          });
          if (!testBuffer) {
            throw new Error("WebGPU 不支持 - 无法创建 GPU 缓冲区");
          }
          testBuffer.destroy();
          return device;
        } catch (e) {
          throw new Error(`WebGPU 设备初始化失败: ${e.message}`);
        }
      case "webgl":
        const canvas = document.createElement("canvas");
        const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
        if (!gl) {
          throw new Error("WebGL 不支持");
        }
        return true;
      case "wasm":
        return true;
      default:
        return false;
    }
  } catch (e) {
    console.warn(`检查 ${backend} 可用性失败:`, e);
    return false;
  }
}

// 切换后端
async function switchBackend(backend) {
  try {
    // 先检查后端是否可用
    const isAvailable = await checkBackendAvailability(backend);
    if (!isAvailable) {
      throw new Error(`${backend} 后端不可用`);
    }

    if (session) {
      await session.release();
      session = null;
    }

    // 尝试切换后端
    try {
      currentBackend = backend;
      const sessionOptions = {
        executionProviders: [backend],
        graphOptimizationLevel: "all",
      };

      // 对于 WebGL 后端，添加特殊配置
      if (backend === "webgl") {
        sessionOptions.graphOptimizationLevel = "disabled"; // 禁用图优化
      }

      session = await ort.InferenceSession.create(
        getModelPath(currentModel),
        sessionOptions
      );

      console.log(`已切换到 ${backend.toUpperCase()} 后端`);

      // 更新UI状态
      const backendStatus = document.getElementById("backendStatus");
      if (backendStatus) {
        backendStatus.textContent = `✓ ${backend.toUpperCase()} 已启用`;
        backendStatus.className = "status-success";
      }

      return true;
    } catch (error) {
      // 如果切换失败，尝试回退到 WASM
      console.warn(`切换到 ${backend} 失败，尝试回退到 WASM: ${error.message}`);
      currentBackend = "wasm";
      session = await ort.InferenceSession.create(getModelPath(currentModel), {
        executionProviders: ["wasm"],
        graphOptimizationLevel: "all",
      });

      // 更新UI状态
      const backendStatus = document.getElementById("backendStatus");
      if (backendStatus) {
        backendStatus.textContent = `! 已回退到 WASM`;
        backendStatus.className = "status-error";
      }

      // 禁用不可用的后端选项
      const backendSelect = document.getElementById("backendSelect");
      if (backendSelect) {
        const option = backendSelect.querySelector(
          `option[value="${backend}"]`
        );
        if (option) {
          option.disabled = true;
          option.text += " (不可用)";
        }
        backendSelect.value = "wasm";
      }

      throw new Error(
        `${backend} 后端初始化失败，已回退到 WASM: ${error.message}`
      );
    }
  } catch (error) {
    console.error(`切换后端时发生错误:`, error);
    alert(error.message);
    return false;
  }
}

// 切换模型
export async function switchModel(modelName) {
  console.log("开始切换模型:", modelName);

  if (ModelConfigs[modelName]) {
    try {
      // 释放当前会话
      if (session) {
        console.log("释放当前模型会话...");
        await session.release();
      }

      currentModel = modelName;
      console.log("当前模型已更新为:", currentModel);

      // 重新初始化ONNX会话
      console.log("重新初始化模型会话...");
      const success = await initONNX();

      if (success) {
        console.log("模型切换成功");
        // 更新UI状态
        const modelStatus = document.getElementById("modelStatus");
        if (modelStatus) {
          modelStatus.textContent = `✓ ${modelName} 已加载`;
          modelStatus.style.color = "green";
        }
        return true;
      } else {
        throw new Error("模型初始化失败");
      }
    } catch (error) {
      console.error("模型切换失败:", error);
      const modelStatus = document.getElementById("modelStatus");
      if (modelStatus) {
        modelStatus.textContent = `× 切换失败`;
        modelStatus.style.color = "red";
      }
      return false;
    }
  }
  console.warn("未找到指定的模型配置:", modelName);
  return false;
}

// 获取模型路径
function getModelPath(modelName) {
  return `./models/${modelName}.onnx`;
}

// 移除或标记为废弃
async function preprocessImage(imageData) {
  console.warn(
    "preprocessImage is deprecated. Please use model specific preprocessing."
  );
  // 保留作为兼容层或完全移除
}

async function postprocessTensor(tensor, width, height) {
  console.warn(
    "postprocessTensor is deprecated. Please use model specific postprocessing."
  );
  // 保留作为兼容层或完全移除
}

window.addEventListener("load", async () => {
  try {
    const device = await checkBackendAvailability("webgpu");
    console.log("WebGPU 支持正常", device);
  } catch (error) {
    if (currentBackend === "webgpu") {
      console.warn("WebGPU 不可用，自动切换到 WebGL");
      currentBackend = "wasm";
    }
    console.error("WebGPU 错误:", error.message);
  }
});

export {
  checkBackendAvailability,
  switchBackend,
  initONNX,
  preprocessImage,
  postprocessTensor,
  session,
  currentBackend,
  state,
};
