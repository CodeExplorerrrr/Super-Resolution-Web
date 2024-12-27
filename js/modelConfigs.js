// 定义不同模型的配置
export const ModelConfigs = {
  srcnn_x4: {
    name: "srcnn_x4",
    scale: 4,
    tileSize: 33,
    overlapSize: 6,
    needTile: false,
    inputName: "input",
    outputName: "output",
    preprocess: async (imageElement) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = imageElement.width;
      canvas.height = imageElement.height;

      ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      const yData = new Float32Array(canvas.width * canvas.height);
      const cbData = new Float32Array(canvas.width * canvas.height);
      const crData = new Float32Array(canvas.width * canvas.height);

      for (let i = 0; i < imageData.data.length / 4; i++) {
        const r = imageData.data[i * 4];
        const g = imageData.data[i * 4 + 1];
        const b = imageData.data[i * 4 + 2];

        yData[i] = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0;
        cbData[i] = (-0.169 * r - 0.331 * g + 0.5 * b + 128) / 255.0;
        crData[i] = (0.5 * r - 0.419 * g - 0.081 * b + 128) / 255.0;
      }

      return {
        tensor: new ort.Tensor("float32", yData, [
          1,
          1,
          canvas.height,
          canvas.width,
        ]),
        colorInfo: {
          cb: cbData,
          cr: crData,
          width: canvas.width,
          height: canvas.height,
        },
      };
    },
    postprocess: async (tensor, colorInfo) => {
      console.log("开始后处理，输出张量:", tensor);
      console.log("颜色信息:", colorInfo);
      const canvas = document.createElement("canvas");
      const width = tensor.dims[3];
      const height = tensor.dims[2];
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      const imageData = ctx.createImageData(width, height);

      const yData = tensor.data;
      const { cb: cbData, cr: crData } = colorInfo;

      for (let i = 0; i < width * height; i++) {
        const y = yData[i] * 255.0;
        const cb = cbData[i] * 255.0;
        const cr = crData[i] * 255.0;

        let r = y + 1.403 * (cr - 128);
        let g = y - 0.344 * (cb - 128) - 0.714 * (cr - 128);
        let b = y + 1.773 * (cb - 128);

        r = Math.min(255, Math.max(0, r));
        g = Math.min(255, Math.max(0, g));
        b = Math.min(255, Math.max(0, b));

        const idx = i * 4;
        imageData.data[idx] = r;
        imageData.data[idx + 1] = g;
        imageData.data[idx + 2] = b;
        imageData.data[idx + 3] = 255;
      }

      ctx.putImageData(imageData, 0, 0);
      return canvas.toDataURL("image/png", 1.0);
    },
  },
  "ESRGAN": {
    name: "ESRGAN",
    scale: 4,
    tileSize: 128,
    overlapSize: 6, // 如果需要重叠，可以调整此值
    needTile: true,
    inputName: "image",
    outputName: "upscaled_image",
    preprocess: async (imageElement) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = imageElement.width;
      canvas.height = imageElement.height;

      ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      const data = new Float32Array(3 * canvas.width * canvas.height);

      for (let i = 0; i < canvas.width * canvas.height; i++) {
        data[i] = imageData.data[i * 4] / 255.0; // R
        data[canvas.width * canvas.height + i] = imageData.data[i * 4 + 1] / 255.0; // G
        data[2 * canvas.width * canvas.height + i] = imageData.data[i * 4 + 2] / 255.0; // B
      }

      return {
        tensor: new ort.Tensor("float32", data, [1, 3, canvas.height, canvas.width]),
        colorInfo: {
          width: canvas.width,
          height: canvas.height,
        },
      };
    },
    postprocess: async (tensor, colorInfo) => {
      const canvas = document.createElement("canvas");
      const width = tensor.dims[3];
      const height = tensor.dims[2];
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      const imageData = ctx.createImageData(width, height);

      const outputData = tensor.data;

      for (let i = 0; i < width * height; i++) {
        imageData.data[i * 4] = outputData[i] * 255; // R
        imageData.data[i * 4 + 1] = outputData[width * height + i] * 255; // G
        imageData.data[i * 4 + 2] = outputData[2 * width * height + i] * 255; // B
        imageData.data[i * 4 + 3] = 255; // A
      }

      ctx.putImageData(imageData, 0, 0);
      return canvas.toDataURL("image/png", 1.0);
    },
  },
  "RealESRGAN_x4plus_anime": {
    name: "RealESRGAN_x4plus_anime",
    scale: 4,
    tileSize: 128,
    overlapSize: 1,
    needTile: false,
    inputName: "image.1",
    outputName: "image",
    preprocess: async (imageElement) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = imageElement.width;
      canvas.height = imageElement.height;
    
      ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
      const data = new Float32Array(3 * canvas.width * canvas.height);
    
      for (let i = 0; i < canvas.width * canvas.height; i++) {
        data[i] = imageData.data[i * 4] / 255.0; // R
        data[canvas.width * canvas.height + i] = imageData.data[i * 4 + 1] / 255.0; // G
        data[2 * canvas.width * canvas.height + i] = imageData.data[i * 4 + 2] / 255.0; // B
      }
    
      return {
        tensor: new ort.Tensor("float32", data, [1, 3, canvas.height, canvas.width]),
        colorInfo: {
          width: canvas.width,
          height: canvas.height,
        },
      };
    },
    postprocess: async (tensor, colorInfo) => {
      const canvas = document.createElement("canvas");
      const width = tensor.dims[3];
      const height = tensor.dims[2];
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      const imageData = ctx.createImageData(width, height);
    
      const outputData = tensor.data;
    
      for (let i = 0; i < width * height; i++) {
        imageData.data[i * 4] = outputData[i] * 255; // R
        imageData.data[i * 4 + 1] = outputData[width * height + i] * 255; // G
        imageData.data[i * 4 + 2] = outputData[2 * width * height + i] * 255; // B
        imageData.data[i * 4 + 3] = 255; // A
      }
    
      ctx.putImageData(imageData, 0, 0);
      return canvas.toDataURL("image/png", 1.0);
    },
  },
  "Real-ESRGAN-General-x4v3": {
    name: "Real-ESRGAN-General-x4v3",
    scale: 4,
    tileSize: 128,
    overlapSize: 1,
    needTile: true,
    inputName: "image",
    outputName: "upscaled_image",
    preprocess: async (image) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      // 确保输入尺寸是128的倍数
      const targetWidth = Math.ceil(image.width / 128) * 128;
      const targetHeight = Math.ceil(image.height / 128) * 128;

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      // 填充黑色背景
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 在中心绘制图像
      const x = (targetWidth - image.width) / 2;
      const y = (targetHeight - image.height) / 2;
      ctx.drawImage(image, x, y);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const { data } = imageData;

      // Real-ESRGAN 需要 [1, 3, H, W] 格式的输入
      const tensor = new Float32Array(3 * canvas.height * canvas.width);

      // RGB 通道分离
      for (let i = 0; i < data.length / 4; i++) {
        tensor[i] = data[i * 4] / 255.0; // R
        tensor[i + canvas.width * canvas.height] = data[i * 4 + 1] / 255.0; // G
        tensor[i + 2 * canvas.width * canvas.height] = data[i * 4 + 2] / 255.0; // B
      }

      return {
        tensor: new ort.Tensor("float32", tensor, [
          1,
          3, // 3通道
          canvas.height,
          canvas.width,
        ]),
        colorInfo: {
          width: image.width, // 保存原始尺寸
          height: image.height,
          padWidth: targetWidth,
          padHeight: targetHeight,
          offsetX: x,
          offsetY: y,
        },
      };
    },
    postprocess: async (outputTensor, colorInfo) => {
      console.log("开始后处理，输出张量:", outputTensor);
      console.log("颜色信息:", colorInfo);

      try {
        // 检查输出张量
        if (!outputTensor || typeof outputTensor !== "object") {
          throw new Error("输出张量无效");
        }

        // 获取输出尺寸
        let width, height;
        if (outputTensor.dims) {
          [, , height, width] = outputTensor.dims;
        } else {
          // 如果没有dims，使用colorInfo计算尺寸
          width = colorInfo.padWidth * 4;
          height = colorInfo.padHeight * 4;
          console.log("使用计算的尺寸:", { width, height });
        }

        if (!width || !height) {
          throw new Error(`无效的输出尺寸: ${width}x${height}`);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");

        const imageData = ctx.createImageData(width, height);
        const data = imageData.data;

        // 检查张量数据
        if (!outputTensor.data || !outputTensor.data.length) {
          throw new Error("张量数据为空");
        }
        console.log("张量数据长度:", outputTensor.data.length);

        const tensorData = outputTensor.data;
        const pixelCount = width * height;

        // 确保数据长度正确
        if (tensorData.length < pixelCount * 3) {
          throw new Error(
            `张量数据长度不足: ${tensorData.length} < ${pixelCount * 3}`
          );
        }

        // 处理输出数据
        for (let i = 0; i < pixelCount; i++) {
          const idx = i * 4;
          // 确保我们正确访问每个通道的数据
          data[idx] = Math.min(255, Math.max(0, tensorData[i] * 255)); // R
          data[idx + 1] = Math.min(
            255,
            Math.max(0, tensorData[i + pixelCount] * 255)
          ); // G
          data[idx + 2] = Math.min(
            255,
            Math.max(0, tensorData[i + 2 * pixelCount] * 255)
          ); // B
          data[idx + 3] = 255; // Alpha
        }

        ctx.putImageData(imageData, 0, 0);

        // 如果需要裁剪回原始比例
        if (colorInfo.width !== width || colorInfo.height !== height) {
          const finalCanvas = document.createElement("canvas");
          const finalCtx = finalCanvas.getContext("2d");
          const scale = 4; // 模型的放大倍数

          finalCanvas.width = colorInfo.width * scale;
          finalCanvas.height = colorInfo.height * scale;

          // 从放大后的图像中裁剪出原始区域
          finalCtx.drawImage(
            canvas,
            colorInfo.offsetX * scale,
            colorInfo.offsetY * scale,
            colorInfo.width * scale,
            colorInfo.height * scale,
            0,
            0,
            finalCanvas.width,
            finalCanvas.height
          );

          return finalCanvas.toDataURL("image/png", 1.0);
        }

        return canvas.toDataURL("image/png", 1.0);
      } catch (error) {
        console.error("后处理错误:", error);
        console.error("输出张量:", outputTensor);
        console.error("颜色信息:", colorInfo);
        throw error;
      }
    },
  },
  "Real-ESRGAN-x4plus": {
    name: "Real-ESRGAN-x4plus",
    scale: 4,
    tileSize: 128,
    needTile: true,
    overlapSize: 1,
    inputName: "image",
    outputName: "upscaled_image",
    preprocess: async (image) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      // 确保输入尺寸严格为128x128
      canvas.width = 128;
      canvas.height = 128;

      // 填充黑色背景
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 直接绘制对应区域的图像，不进行缩放
      ctx.drawImage(
        image,
        0,
        0,
        128,
        128, // 源图像区域
        0,
        0,
        128,
        128 // 目标区域
      );

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const { data } = imageData;

      // Real-ESRGAN 需要 [1, 3, H, W] 格式的输入
      const tensor = new Float32Array(3 * 128 * 128);

      // RGB 通道分离
      for (let i = 0; i < data.length / 4; i++) {
        tensor[i] = data[i * 4] / 255.0; // R
        tensor[i + 128 * 128] = data[i * 4 + 1] / 255.0; // G
        tensor[i + 2 * 128 * 128] = data[i * 4 + 2] / 255.0; // B
      }

      return {
        tensor: new ort.Tensor("float32", tensor, [1, 3, 128, 128]),
        colorInfo: {
          width: 128,
          height: 128,
          padWidth: 128,
          padHeight: 128,
          offsetX: 0,
          offsetY: 0,
        },
      };
    },
    postprocess: async (outputTensor, colorInfo) => {
      console.log("开始后处理，输出张量:", outputTensor);
      console.log("颜色信息:", colorInfo);

      try {
        // 检查输出张量
        if (!outputTensor || !outputTensor.dims) {
          throw new Error("输出张量无效或缺少维度信息");
        }

        // 获取输出尺寸
        let outputWidth, outputHeight;
        const [batch, channels, tensorHeight, tensorWidth] = outputTensor.dims;
        console.log("输出张量维度:", {
          batch,
          channels,
          tensorHeight,
          tensorWidth,
        });

        // 确定输出尺寸
        if (tensorWidth && tensorHeight) {
          outputWidth = tensorWidth;
          outputHeight = tensorHeight;
        } else {
          // 如果无法从张量获取尺寸，使用colorInfo计算
          outputWidth = colorInfo.padWidth * 4;
          outputHeight = colorInfo.padHeight * 4;
          console.log("使用计算的尺寸:", { outputWidth, outputHeight });
        }

        if (!outputWidth || !outputHeight) {
          throw new Error(`无效的输出尺寸: ${outputWidth}x${outputHeight}`);
        }

        const canvas = document.createElement("canvas");
        canvas.width = outputWidth;
        canvas.height = outputHeight;
        const ctx = canvas.getContext("2d");

        const imageData = ctx.createImageData(outputWidth, outputHeight);
        const data = imageData.data;

        // 检查张量数据
        if (!outputTensor.data || !outputTensor.data.length) {
          throw new Error("张量数据为空");
        }
        console.log("张量数据长度:", outputTensor.data.length);

        const tensorData = outputTensor.data;
        const pixelCount = outputWidth * outputHeight;

        // 确保数据长度正确
        if (tensorData.length < pixelCount * 3) {
          throw new Error(
            `张量数据长度不足: ${tensorData.length} < ${pixelCount * 3}`
          );
        }

        // 处理输出数据
        for (let i = 0; i < pixelCount; i++) {
          const idx = i * 4;
          data[idx] = Math.min(255, Math.max(0, tensorData[i] * 255)); // R
          data[idx + 1] = Math.min(
            255,
            Math.max(0, tensorData[i + pixelCount] * 255)
          ); // G
          data[idx + 2] = Math.min(
            255,
            Math.max(0, tensorData[i + 2 * pixelCount] * 255)
          ); // B
          data[idx + 3] = 255; // Alpha
        }

        ctx.putImageData(imageData, 0, 0);

        // 如果需要裁剪回原始比例
        if (
          colorInfo.width !== outputWidth ||
          colorInfo.height !== outputHeight
        ) {
          const finalCanvas = document.createElement("canvas");
          const finalCtx = finalCanvas.getContext("2d");
          const scale = 4; // 模型的放大倍数

          finalCanvas.width = colorInfo.width * scale;
          finalCanvas.height = colorInfo.height * scale;

          // 从放大后的图像中裁剪出原始区域
          finalCtx.drawImage(
            canvas,
            colorInfo.offsetX * scale,
            colorInfo.offsetY * scale,
            colorInfo.width * scale,
            colorInfo.height * scale,
            0,
            0,
            finalCanvas.width,
            finalCanvas.height
          );

          return finalCanvas.toDataURL("image/png", 1.0);
        }

        return canvas.toDataURL("image/png", 1.0);
      } catch (error) {
        console.error("后处理错误:", error);
        console.error("输出张量:", outputTensor);
        console.error("颜色信息:", colorInfo);
        throw error;
      }
    },
  },
};
