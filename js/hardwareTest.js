import { preprocessImage, postprocessTensor, session } from "./core.js";
import { createTestPattern } from "./benchmark.js";

// 硬件测试函数
async function testHardwareLimits() {
  try {
    const testSizes = [256, 512, 768, 1024, 1560, 2048, 3000, 4000, 5000, 6000];
    console.log(
      "将要测试以下图片尺寸:",
      testSizes.map((size) => `${size}x${size}`).join(", ")
    );

    const testResults = [];
    let completedTests = 0;
    const totalTests = testSizes.length;

    for (const size of testSizes) {
      try {
        console.log(
          `开始测试 ${size}x${size} (${completedTests + 1}/${totalTests})`
        );

        const testImageUrl = await createTestPattern(size);
        const testImage = new Image();
        await new Promise((resolve) => {
          testImage.onload = resolve;
          testImage.src = testImageUrl;
        });

        const startMemory = performance.memory
          ? performance.memory.usedJSHeapSize
          : 0;
        const startTime = performance.now();

        const { tensor } = await preprocessImage(testImage);
        if (session) {
          const inferenceResults = await session.run({
            [session.inputNames[0]]: tensor,
          });

          const endTime = performance.now();
          const endMemory = performance.memory
            ? performance.memory.usedJSHeapSize
            : 0;

          testResults.push({
            size: size,
            success: true,
            time: endTime - startTime,
            memoryUsage: (endMemory - startMemory) / (1024 * 1024),
            fps: 1000 / (endTime - startTime),
            inputSize: (tensor.data.length * 4) / (1024 * 1024),
            outputSize:
              (inferenceResults[session.outputNames[0]].data.length * 4) /
              (1024 * 1024),
          });
        }

        completedTests++;
        console.log(
          `完成测试 ${size}x${size} (${completedTests}/${totalTests})`
        );
      } catch (error) {
        console.error(`尺寸 ${size}x${size} 测试失败:`, error);
        testResults.push({
          size: size,
          success: false,
          time: null,
          memoryUsage: null,
          fps: null,
          inputSize: null,
          outputSize: null,
        });
        completedTests++;
      }
    }

    console.log("所有测试完成！");

    const resultDiv = document.createElement("div");
    resultDiv.innerHTML = `
            <h3>硬件限制测试结果</h3>
            <table style="width:100%; border-collapse: collapse;">
                <tr>
                    <th style="border:1px solid #ddd; padding:8px;">尺寸</th>
                    <th style="border:1px solid #ddd; padding:8px;">状态</th>
                    <th style="border:1px solid #ddd; padding:8px;">处理时间</th>
                    <th style="border:1px solid #ddd; padding:8px;">FPS</th>
                    <th style="border:1px solid #ddd; padding:8px;">内存使用</th>
                    <th style="border:1px solid #ddd; padding:8px;">输入大小</th>
                    <th style="border:1px solid #ddd; padding:8px;">输出大小</th>
                </tr>
                ${testResults
                  .map(
                    (result) => `
                    <tr>
                        <td style="border:1px solid #ddd; padding:8px;">${
                          result.size
                        }x${result.size}</td>
                        <td style="border:1px solid #ddd; padding:8px;">${
                          result.success ? "✓" : "✗"
                        }</td>
                        <td style="border:1px solid #ddd; padding:8px;">${
                          result.success ? result.time.toFixed(2) + "ms" : "-"
                        }</td>
                        <td style="border:1px solid #ddd; padding:8px;">${
                          result.success ? result.fps.toFixed(2) : "-"
                        }</td>
                        <td style="border:1px solid #ddd; padding:8px;">${
                          result.success
                            ? result.memoryUsage.toFixed(2) + "MB"
                            : "-"
                        }</td>
                        <td style="border:1px solid #ddd; padding:8px;">${
                          result.success
                            ? result.inputSize.toFixed(2) + "MB"
                            : "-"
                        }</td>
                        <td style="border:1px solid #ddd; padding:8px;">${
                          result.success
                            ? result.outputSize.toFixed(2) + "MB"
                            : "-"
                        }</td>
                    </tr>
                `
                  )
                  .join("")}
            </table>
            <p><em>注意: 实际使用时建议将限制设置在最大成功尺寸的75%以下，以确保稳定性。</em></p>
        `;

    document.querySelector(".container").appendChild(resultDiv);
  } catch (error) {
    console.error("硬件限制测试失败:", error);
    alert("硬件限制测试失败: " + error.message);
  }
}

// 检查WebGPU适配器
async function checkAdapter() {
  if (!navigator.gpu) {
    console.log("WebGPU is not supported.");
    return;
  }

  const adapter = await navigator.gpu.requestAdapter();
  let output = "";

  if (adapter) {
    console.log("WebGPU adapter found:", adapter);

    const allKeys = Reflect.ownKeys(adapter);
    const adapterDetails = {};
    allKeys.forEach((key) => {
      try {
        adapterDetails[key] = adapter[key];
      } catch (error) {
        adapterDetails[key] = `Error reading property: ${error.message}`;
      }
    });

    output += `WebGPU adapter found:\n${adapterDetails.info}\n`;
    output += `Is fallback adapter: ${adapter.isFallbackAdapter}\n`;
  } else {
    console.log("No WebGPU adapter available.");
    output += "No WebGPU adapter available.\n";
  }

  const blob = new Blob([output], { type: "text/plain" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "webgpu_adapter_info.txt";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
}

export { testHardwareLimits, checkAdapter };
