import {
  preprocessImage,
  postprocessTensor,
  session,
  currentBackend,
} from "./core.js";

// 计算平均值的辅助函数
function average(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

// 计算标准差
function calculateStdDev(arr) {
  if (!arr || arr.length === 0) return 0;
  const avg = average(arr);
  const squareDiffs = arr.map((value) => {
    const diff = value - avg;
    return diff * diff;
  });
  const avgSquareDiff = average(squareDiffs);
  return Math.sqrt(avgSquareDiff);
}

// 获取内存使用情况（MB）
function getMemoryUsage() {
  if (window.performance && performance.memory) {
    return performance.memory.totalJSHeapSize / (1024 * 1024);
  }
  return null;
}

// 创建测试图案
async function createTestPattern(size) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, "#f0f0f0");
  gradient.addColorStop(1, "#d0d0d0");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = "#4CAF50";
  ctx.fillRect(size / 4, size / 4, size / 2, size / 2);

  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 4, 0, Math.PI * 2);
  ctx.strokeStyle = "#2196F3";
  ctx.lineWidth = size / 50;
  ctx.stroke();

  ctx.font = `${size / 20}px Arial`;
  ctx.fillStyle = "#000";
  ctx.textAlign = "center";
  ctx.fillText(`${size}x${size}`, size / 2, size / 5);

  return canvas.toDataURL();
}

// 性能评估函数
async function benchmarkBackend(backend, testImage = null) {
  try {
    const testSizes = [256, 512, 768];
    const sizeResults = [];

    if (testImage) {
      const timings = {
        preprocess: [],
        inference: [],
        postprocess: [],
        total: [],
      };

      for (let i = 0; i < 5; i++) {
        const startTotal = performance.now();
        console.log("======= 第", i + 1, "次测试", backend, "=======");

        const startPreprocess = performance.now();
        const { tensor, colorInfo } = await preprocessImage(testImage);
        const endPreprocess = performance.now();
        console.log("预处理", endPreprocess - startPreprocess);

        const startInference = performance.now();
        const results = await session.run({
          [session.inputNames[0]]: tensor,
        });
        const endInference = performance.now();
        console.log("推理", endInference - startInference);

        const startPostprocess = performance.now();
        await postprocessTensor(results[session.outputNames[0]], colorInfo);
        const endPostprocess = performance.now();
        console.log("后处理", endPostprocess - startPostprocess);

        const endTotal = performance.now();

        timings.preprocess.push(endPreprocess - startPreprocess);
        timings.inference.push(endInference - startInference);
        timings.postprocess.push(endPostprocess - startPostprocess);
        timings.total.push(endTotal - startTotal);
      }

      const sizeStats = {
        size: testImage.width,
        avgPreprocess: average(timings.preprocess),
        avgInference: average(timings.inference),
        avgPostprocess: average(timings.postprocess),
        avgTotal: average(timings.total),
        minTotal: Math.min(...timings.total),
        maxTotal: Math.max(...timings.total),
        fps: 1000 / average(timings.total),
      };

      sizeResults.push(sizeStats);
    } else {
      for (const size of testSizes) {
        const testImage = new Image();
        testImage.src = await createTestPattern(size);
        await new Promise((resolve) => (testImage.onload = resolve));

        const timings = {
          preprocess: [],
          inference: [],
          postprocess: [],
          total: [],
        };

        for (let i = 0; i < 5; i++) {
          const startTotal = performance.now();
          console.log(
            "== 第",
            i + 1,
            "次测试",
            backend,
            ", 尺寸为",
            size,
            "=="
          );

          const startPreprocess = performance.now();
          const { tensor, colorInfo } = await preprocessImage(testImage);
          const endPreprocess = performance.now();
          console.log("预处理", endPreprocess - startPreprocess);

          const startInference = performance.now();
          const results = await session.run({
            [session.inputNames[0]]: tensor,
          });
          const endInference = performance.now();
          console.log("推理", endInference - startInference);

          const startPostprocess = performance.now();
          await postprocessTensor(results[session.outputNames[0]], colorInfo);
          const endPostprocess = performance.now();
          console.log("后处理", endPostprocess - startPostprocess);

          const endTotal = performance.now();

          timings.preprocess.push(endPreprocess - startPreprocess);
          timings.inference.push(endInference - startInference);
          timings.postprocess.push(endPostprocess - startPostprocess);
          timings.total.push(endTotal - startTotal);
        }

        const sizeStats = {
          size,
          avgPreprocess: average(timings.preprocess),
          avgInference: average(timings.inference),
          avgPostprocess: average(timings.postprocess),
          avgTotal: average(timings.total),
          minTotal: Math.min(...timings.total),
          maxTotal: Math.max(...timings.total),
          fps: 1000 / average(timings.total),
        };

        sizeResults.push(sizeStats);
      }
    }

    return {
      sizeResults,
      avgTotal: average(sizeResults.map((r) => r.avgTotal)),
      minTotal: Math.min(...sizeResults.map((r) => r.minTotal)),
      maxTotal: Math.max(...sizeResults.map((r) => r.maxTotal)),
      fps: average(sizeResults.map((r) => r.fps)),
    };
  } catch (error) {
    console.error("性能测试失败:", error);
    throw error;
  }
}

// 更新性能指标UI
function updateMetricsUI(backend, stats) {
  if (!stats) return;

  const metricsDiv = document.querySelector(
    `#${backend}-metrics .metric-value`
  );
  if (metricsDiv) {
    metricsDiv.innerHTML = `
            平均: ${stats.avgTotal.toFixed(2)} ms<br>
            最小: ${stats.minTotal.toFixed(2)} ms<br>
            最大: ${stats.maxTotal.toFixed(2)} ms<br>
            FPS: ${stats.fps.toFixed(2)}<br>
            内存使用: ${
              stats.avgMemory ? stats.avgMemory + " MB" : "不可用"
            }<br>
            峰值内存: ${stats.peakMemory ? stats.peakMemory + " MB" : "不可用"}
        `;
  }
}

// 运行单个后端测试
async function runSingleBackendTest(backend) {
  const testImage = window.customTestImage;
  const results = await benchmarkBackend(backend, testImage);
  if (
    Object.keys(results).length > 0 &&
    Object.values(results).some((result) => result !== null)
  ) {
    updateMetricsUI(backend, results);
  }
  return results;
}

// 运行所有后端测试
async function runAllBenchmarks() {
  const testImage = window.customTestImage;
  const backends = ["webgpu", "wasm"];
  const results = {};

  for (const backend of backends) {
    try {
      results[backend] = await benchmarkBackend(backend, testImage);
    } catch (e) {
      console.error(`${backend} 测试失败:`, e);
      results[backend] = null;
    }
  }

  if (
    Object.keys(results).length > 0 &&
    Object.values(results).some((result) => result !== null)
  ) {
    const chartCanvas = document.getElementById("perfChart");
    if (!chartCanvas) {
      console.error("未找到图表画布元素");
      return;
    }

    const existingChart = Chart.getChart(chartCanvas);
    if (existingChart) {
      existingChart.destroy();
    }

    const datasets = [];
    const colors = {
      webgpu: {
        time: "rgba(54, 162, 235, 0.5)",
        fps: "rgba(54, 162, 235, 0.7)",
      },
      wasm: {
        time: "rgba(75, 192, 192, 0.5)",
        fps: "rgba(75, 192, 192, 0.7)",
      },
    };

    Object.entries(results).forEach(([backend, result]) => {
      if (result && result.sizeResults) {
        updateMetricsCard(backend, result);

        datasets.push({
          label: `${backend.toUpperCase()} 预处理时间`,
          data: result.sizeResults.map((r) => r.avgPreprocess),
          backgroundColor: "rgba(255, 99, 132, 0.5)",
          type: "bar",
        });

        datasets.push({
          label: `${backend.toUpperCase()} 推理时间`,
          data: result.sizeResults.map((r) => r.avgInference),
          backgroundColor: "rgba(54, 162, 235, 0.5)",
          type: "bar",
        });

        datasets.push({
          label: `${backend.toUpperCase()} 后处理时间`,
          data: result.sizeResults.map((r) => r.avgPostprocess),
          backgroundColor: "rgba(75, 192, 192, 0.5)",
          type: "bar",
        });

        datasets.push({
          label: `${backend.toUpperCase()} FPS`,
          data: result.sizeResults.map((r) => r.fps),
          backgroundColor: colors[backend].fps,
          borderColor: colors[backend].fps,
          type: "line",
          yAxisID: "y_fps",
        });
      }
    });

    new Chart(chartCanvas, {
      type: "bar",
      data: {
        labels:
          results[Object.keys(results)[0]]?.sizeResults.map(
            (r) => `${r.size}x${r.size}`
          ) || [],
        datasets: datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
      },
    });
  }
}

// 更新性能指标卡片
function updateMetricsCard(backend, result) {
  const metricsCard = document.getElementById(`${backend}-metrics`);
  if (metricsCard && result) {
    const metricValue = metricsCard.querySelector(".metric-value");

    const sizeResults = result.sizeResults;
    const times = sizeResults.map((r) => r.avgTotal);
    const stdDev = calculateStdDev(times);

    metricValue.innerHTML = `
            平均: ${result.avgTotal.toFixed(2)} ms<br>
            最小: ${result.minTotal.toFixed(2)} ms<br>
            最大: ${result.maxTotal.toFixed(2)} ms<br>
            标准差: ${stdDev.toFixed(2)} ms<br>
            FPS: ${result.fps.toFixed(2)}
        `;
  }
}

export {
  benchmarkBackend,
  runSingleBackendTest,
  runAllBenchmarks,
  createTestPattern,
  updateMetricsUI,
};
