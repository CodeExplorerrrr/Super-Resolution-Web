import { session, state, initONNX, currentModel, currentBackend } from "./core.js";
import { ModelConfigs } from "./modelConfigs.js";

// 文件选择预览
async function previewImage(event) {
  const input = event.target;
  if (input.files && input.files[0]) {
    const image = new Image();
    image.src = URL.createObjectURL(input.files[0]);
    await new Promise((resolve) => (image.onload = resolve));
    document.getElementById("inputImage").src = image.src;
    // 立即更新输入图片信息
    updateInputInfo(image, input.files[0]);
    // 清除之前的处理结果
    document.getElementById("outputImage").src = "";
    document.getElementById("outputInfo").innerHTML = getDefaultOutputInfo();
  }
}

// 添加默认信息显示
function getDefaultInputInfo() {
  return `
    <h4>输入图片信息</h4>
    <div class="info-item">
      <span class="info-label">尺寸:</span>
      <span class="info-value">等待输入</span>
    </div>
    <div class="info-item">
      <span class="info-label">文件大小:</span>
      <span class="info-value">等待输入</span>
    </div>
  `;
}

function getDefaultOutputInfo() {
  return `
    <h4>输出图片信息</h4>
    <div class="info-item">
      <span class="info-label">尺寸:</span>
      <span class="info-value">等待处理</span>
    </div>
    <div class="info-item">
      <span class="info-label">文件大小:</span>
      <span class="info-value">等待处理</span>
    </div>
  `;
}

function getDefaultProcessInfo() {
  return `
    <h4>处理信息</h4>
    <div class="info-item">
      <span class="info-label">WASM多线程:</span>
      <span class="info-value">等待处理</span>
    </div>
    <div class="info-item">
      <span class="info-label">处理方式:</span>
      <span class="info-value">等待处理</span>
    </div>
    <div class="info-item">
      <span class="info-label">预处理耗时:</span>
      <span class="info-value">等待处理</span>
    </div>
    <div class="info-item">
      <span class="info-label">推理耗时:</span>
      <span class="info-value">等待处理</span>
    </div>
    <div class="info-item">
      <span class="info-label">后处理耗时:</span>
      <span class="info-value">等待处理</span>
    </div>
    <div class="info-item">
      <span class="info-label">总耗时:</span>
      <span class="info-value">等待处理</span>
    </div>
  `;
}

// 更输入信息显示函数
function updateInputInfo(image, file) {
  const inputInfo = document.getElementById("inputInfo");
  inputInfo.innerHTML = `
    <h4>输入图片信息</h4>
    <div class="info-item">
      <span class="info-label">尺寸:</span>
      <span class="info-value">${image.width} × ${image.height}</span>
    </div>
    <div class="info-item">
      <span class="info-label">文件大小:</span>
      <span class="info-value">${(file.size / 1024).toFixed(2)} KB</span>
    </div>
  `;
}

// 更新输出信息显示函数
function updateOutputInfo(image) {
  const outputInfo = document.getElementById("outputInfo");
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const imageContainer = document.querySelector(".image-comparison-slider");
  const container = document.querySelector(".image-comparison-container");
  container.style.display = "flex";
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0);
  const blob = canvas.toBlob((blob) => {
    outputInfo.innerHTML = `
      <h4>输出图片信息</h4>
      <div class="info-item">
        <span class="info-label">尺寸:</span>
        <span class="info-value">${image.width} × ${image.height}</span>
      </div>
      <div class="info-item">
        <span class="info-label">文件大小:</span>
        <span class="info-value">${(blob.size / 1024).toFixed(2)} KB</span>
      </div>
    `;
  }, "image/png");
}

// 更新处理信息显示函数
function updateProcessInfo(info) {
  const processInfo = document.getElementById("processInfo");
  processInfo.innerHTML = `
    <h4>处理信息</h4>
    <div class="info-item">
      <span class="info-label">WASM多线程:</span>
      <span class="info-value">${info.wasmThreads} 线程</span>
    </div>
    <div class="info-item">
      <span class="info-label">处理方式:</span>
      <span class="info-value">${info.isTiled ? "分块处理" : "整图处理"}</span>
    </div>
    <div class="info-item">
      <span class="info-label">预处理耗时:</span>
      <span class="info-value">${info.timings.preprocess.toFixed(2)} ms</span>
    </div>
    <div class="info-item">
      <span class="info-label">推理耗时:</span>
      <span class="info-value">${info.timings.inference.toFixed(2)} ms</span>
    </div>
    <div class="info-item">
      <span class="info-label">后处理耗时:</span>
      <span class="info-value">${info.timings.postprocess.toFixed(2)} ms</span>
    </div>
    <div class="info-item">
      <span class="info-label">总耗时:</span>
      <span class="info-value">${info.totalTime.toFixed(2)} ms</span>
    </div>
  `;
}

// 在页面加载时初始化默认信息
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("inputInfo").innerHTML = getDefaultInputInfo();
  document.getElementById("outputInfo").innerHTML = getDefaultOutputInfo();
  document.getElementById("processInfo").innerHTML = getDefaultProcessInfo();
});

// 处理图像的主函数
async function processImage() {
  console.log("当前使用的模型:", currentModel);
  console.log("当前模型配置:", ModelConfigs[currentModel]);

  if (!session) {
    console.log("正在加载模型...");
    const success = await initONNX();
    if (!success) {
      console.error("模型初始化失败");
      return;
    }
  }

  const input = document.getElementById("imageInput");
  const loadingDiv = document.getElementById("loading");
  const progressContainer = document.getElementById("progressContainer");
  const processingIndicator = document.getElementById("processingIndicator");

  if (!input.files || !input.files[0]) {
    alert("请选择图片");
    return;
  }

  const file = input.files[0];
  const image = new Image();
  image.src = URL.createObjectURL(file);
  // 检查图片尺寸
  await new Promise((resolve) => {
    image.onload = () => {
      const { width, height } = image;
      // 限制条件
      if (width > 1000 || height > 1000) {
        alert("不建议输入过大图片，会导致推理时间过长或推理失败");
      }
      if (currentModel === "RealESRGAN_x4plus_anime" && currentBackend === "webgpu") {
        if (width > 400 || height > 400) {
          alert("不建议输入过大图片，当前模型和后端限制为 400x400");
        }
      }
      resolve();
    };
  });
  loadingDiv.style.display = "block";
  processingIndicator.style.display = "block";
  state.isInterrupted = false;
  if (ModelConfigs[currentModel].needTile) {
    progressContainer.style.display = "block";
  }

  try {
    // 更新输入图片信息
    updateInputInfo(image, file);

    let result;
    let startTime = performance.now();
    let timings = {
      preprocess: 0,
      inference: 0,
      postprocess: 0,
    };

    // 对于例如 Real-ESRGAN 模型，使用分块处理
    if (ModelConfigs[currentModel].needTile) {
      console.log("使用分块处理方式");
      const { result: processedResult, timings: tileTimings } =
        await processImageWithTiles(image);
      const progressBar = document.getElementById("progressBar");
      progressBar.value = 0;
      result = processedResult;
      timings = tileTimings;
    } else {
      const modelConfig = ModelConfigs[currentModel];

      console.log("开始预处理...");
      const preprocessStart = performance.now();
      const { tensor, colorInfo } = await modelConfig.preprocess(image);
      const preprocessEnd = performance.now();
      timings.preprocess = preprocessEnd - preprocessStart;
      console.log(`预处理完成，耗时: ${timings.preprocess.toFixed(2)}ms`);

      console.log("开始推理...");
      const inferenceStart = performance.now();
      const inferencePromise = session.run({
        [modelConfig.inputName]: tensor,
      });
      const resultPromise = await Promise.race([
        inferencePromise,
        new Promise((_, reject) => {
          const checkInterval = setInterval(() => {
            if (state.isInterrupted) {
              clearInterval(checkInterval);
              reject(new Error("推理被中断"));
            }
          }, 100);
        }),
      ]);
      const inferenceEnd = performance.now();
      timings.inference = inferenceEnd - inferenceStart;
      console.log(`推理完成，耗时: ${timings.inference.toFixed(2)}ms`);

      console.log("开始后处理...");
      const postprocessStart = performance.now();
      result = await modelConfig.postprocess(
        resultPromise[modelConfig.outputName],
        colorInfo
      );
      const postprocessEnd = performance.now();
      timings.postprocess = postprocessEnd - postprocessStart;
      console.log(`后处理完成，耗时: ${timings.postprocess.toFixed(2)}ms`);
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    // 更新处理信息
    updateProcessInfo({
      wasmThreads: ort.env.wasm.numThreads || "未启用",
      timings,
      isTiled: currentModel === "Real-ESRGAN-General-x4v3",
      totalTime,
    });

    // 更新输出图片
    const outputImage = new Image();
    outputImage.src = result;
    await new Promise((resolve) => (outputImage.onload = resolve));
    updateOutputInfo(outputImage);

    document.getElementById("outputImage").src = result;
    // 设置对比图像
    document.getElementById("originalImage").src = image.src;
    document.getElementById("processedImage").src = result;

    // 初始化对比效果
    initImageComparison();
  } catch (error) {
    console.error("处理失败:", error);
    alert("处理失败: " + error.message);
  } finally {
    loadingDiv.style.display = "none";
    progressContainer.style.display = "none";
    processingIndicator.style.display = "none";
  }
}

function initImageComparison() {
  const slider = document.querySelector(".slider");
  const sliderHandle = document.querySelector(".slider-handle");
  const processedImage = document.getElementById("processedImage");
  const container = document.querySelector(".image-comparison-slider");
  let isSliding = false;

  const startSliding = () => {
    isSliding = true;
  };

  const stopSliding = () => {
    isSliding = false;
  };

  const slide = (event) => {
    if (!isSliding) return;

    const containerRect = container.getBoundingClientRect();
    let offsetX = event.clientX - containerRect.left;

    // 限制滑动范围
    if (offsetX < 0) offsetX = 0;
    if (offsetX > containerRect.width) offsetX = containerRect.width;

    const percentage = (offsetX / containerRect.width) * 100;
    slider.style.left = `${percentage}%`;
    processedImage.style.clipPath = `inset(0 ${100 - percentage}% 0 0)`;
  }; 

  sliderHandle.addEventListener("mousedown", startSliding);
  document.addEventListener("mouseup", stopSliding);
  document.addEventListener("mousemove", slide);
}

//下载
function downloadImage(){
  // 获取处理后的图片元素
  const processedImage = document.getElementById("outputImage");

  // 检查是否有生成的图片
  if (!processedImage || !processedImage.src) {
    alert("没有生成的图片可供下载！");
    return;
  }

  // 创建一个隐藏的 <a> 元素，用于触发下载
  const downloadLink = document.createElement("a");
  downloadLink.href = processedImage.src;
  downloadLink.download = "processed_image.png"; // 设置下载文件名

  // 触发下载
  downloadLink.click();
}

//test
function downloadProcessedTile(dataUrl, filename) {
  const downloadLink = document.createElement("a");
  downloadLink.href = dataUrl;
  downloadLink.download = filename; // 设置下载文件名
  downloadLink.click(); // 触发下载
}

// 分块处理大图像
async function processImageWithTiles(imageElement) {
  const modelConfig = ModelConfigs[currentModel];
  const tileSize = modelConfig.tileSize;
  const scale = modelConfig.scale;

  // 创建输出画布
  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = imageElement.width * scale;
  outputCanvas.height = imageElement.height * scale;
  const outputCtx = outputCanvas.getContext("2d");

  // 计算切割起点坐标
  let tiles = [];

  let destWidth = imageElement.width;
  let destHeight = imageElement.height;
  if(destWidth < tileSize && destHeight < tileSize){
    tiles.push({ x: 0, y: 0 });
  }else if(destHeight < tileSize){
    let tempWidth = 0;
    while(destWidth > tileSize){
      tiles = [...tiles, { x: tempWidth, y: 0 }];
      tempWidth += tileSize;
      destWidth -= tileSize;
    }
    tiles = [...tiles, { x: imageElement.width - tileSize, y : 0 }];
  }else if(destWidth < tileSize){
    let tempHeight = 0;
    while(destHeight > tileSize){
      tiles = [...tiles, { x: 0, y: tempHeight }];
      tempHeight += tileSize;
      destHeight -= tileSize;
    }
    tiles = [...tiles, { x: 0, y : imageElement.height - tileSize }];
  }else{
    let tempWidth = 0;
    let tempHeight = 0;
    while(destHeight > tileSize){
      tempWidth = 0;
      destWidth = imageElement.width;
      while(destWidth > tileSize){
        tiles = [...tiles, { x: tempWidth, y: tempHeight }];
        destWidth -= tileSize;
        tempWidth += tileSize;
      }
      tiles = [...tiles, { x: imageElement.width - tileSize, y: tempHeight }];
      destHeight -= tileSize;
      tempHeight += tileSize;
    }
    destWidth = imageElement.width;
    tempWidth = 0;
    while(destWidth > tileSize){
      tiles = [...tiles, { x: tempWidth, y: imageElement.height - tileSize }];
      destWidth -= tileSize;
      tempWidth += tileSize;
    }
    tiles = [...tiles, { x: imageElement.width - tileSize, y: imageElement.height - tileSize }];
  }

  let totalPreprocessTime = 0;
  let totalInferenceTime = 0;
  let totalPostprocessTime = 0;

  const progressBar = document.getElementById("progressBar");
  progressBar.max = tiles.length;

  for (let i = 0; i < tiles.length; i++) {
    const { x, y } = tiles[i];

    // 创建临时画布
    const tileCanvas = document.createElement("canvas");
    tileCanvas.width = tileSize;
    tileCanvas.height = tileSize;
    const tileCtx = tileCanvas.getContext("2d");

    // 绘制当前块
    tileCtx.drawImage(
      imageElement,
      x,
      y,
      tileSize,
      tileSize,
      0,
      0,
      tileSize,
      tileSize
    );

    // 处理当前块
    const preprocessStart = performance.now();
    const { tensor, colorInfo } = await modelConfig.preprocess(tileCanvas);
    totalPreprocessTime += performance.now() - preprocessStart;

    const inferenceStart = performance.now();
    const feeds = { [modelConfig.inputName]: tensor };
    const outputTensor = (await session.run(feeds))[modelConfig.outputName];
    totalInferenceTime += performance.now() - inferenceStart;

    const postprocessStart = performance.now();
    const processedTileDataUrl = await modelConfig.postprocess(
      outputTensor,
      colorInfo
    );
    totalPostprocessTime += performance.now() - postprocessStart;

    const processedTile = new Image();
    await new Promise((resolve) => {
      processedTile.onload = resolve;
      processedTile.src = processedTileDataUrl;
    });

    // 绘制到输出画布
    outputCtx.drawImage(
      processedTile,
      0,
      0,
      tileSize * scale,
      tileSize * scale,
      x * scale,
      y * scale,
      tileSize * scale,
      tileSize * scale
    );
    // downloadProcessedTile(processedTileDataUrl, `processed_tile_${i}.png`);
    // 更新进度条
    progressBar.value = i + 1;
  }

  return {
    result: outputCanvas.toDataURL("image/png", 1.0),
    timings: {
      preprocess: totalPreprocessTime,
      inference: totalInferenceTime,
      postprocess: totalPostprocessTime,
    },
  };
}


// 处理测试图像上传
async function handleTestImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const image = new Image();
    image.src = URL.createObjectURL(file);
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
    });

    window.customTestImage = image;

    console.log("已上传测试图像:", {
      文件名: file.name,
      文件大小: `${(file.size / 1024).toFixed(2)}KB`,
      图像尺寸: `${image.width}x${image.height}`,
      预计内存: `约 ${(
        (image.width * image.height * 4 * 4 * 4) /
        1024 /
        1024
      ).toFixed(2)}MB (RGBA)`,
    });

    document.getElementById("testImageInfo").innerHTML = `
            <strong>测试图像信息:</strong><br>
            文件名: ${file.name}<br>
            尺寸: ${image.width}x${image.height}<br>
            文件大小: ${(file.size / 1024).toFixed(2)}KB<br>
            预计内存: ${(
              (image.width * image.height * 4 * 4 * 4) /
              1024 /
              1024
            ).toFixed(2)}MB
        `;
  } catch (error) {
    console.error("图像加载失败:", error);
    alert("图像加载失败，请重试");
  }
}

export {
  processImage,
  processImageWithTiles,
  handleTestImageUpload,
  previewImage,
  downloadImage
};
