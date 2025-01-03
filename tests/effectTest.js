import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { createCanvas, ImageData } from 'canvas'; // 导入 canvas 库
import { ssim } from 'ssim.js'; // 使用命名导入

// 输入和输出文件夹路径
const inputDir = './tests/image_input';
const outputDir = './tests/image_output';

// 获取输入图片路径
const inputImages = fs.readdirSync(inputDir).filter((file) => /\.(png|jpe?g)$/i.test(file));
if (inputImages.length === 0) {
  console.error('输入文件夹中没有图片，请检查输入文件夹！');
  process.exit(1);
}

async function calculatePSNR(img1, img2) {
  const mse = img1.reduce((acc, val, index) => acc + Math.pow(val - img2[index], 2), 0) / img1.length;
  if (mse === 0) return Infinity; // 完全相同
  const maxPixelValue = 255; // 对于8位图像
  return 10 * Math.log10((maxPixelValue * maxPixelValue) / mse);
}

async function calculateSSIM(img1, img2, width, height) {
  // 使用 canvas 创建 ImageData
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // 将原始数据加载到 canvas 上，创建 ImageData
  const imageData1 = new ImageData(new Uint8ClampedArray(img1), width, height);
  const imageData2 = new ImageData(new Uint8ClampedArray(img2), width, height);

  // 使用 ssim.js 计算 SSIM
  const ssimResult = ssim(imageData1, imageData2);
  return ssimResult;
}

async function compareImages() {
  for (const inputImage of inputImages) {
    const inputImagePath = path.join(inputDir, inputImage);
    const inputBuffer = await sharp(inputImagePath).raw().toBuffer({ resolveWithObject: true });
    const inputWidth = inputBuffer.info.width;
    const inputHeight = inputBuffer.info.height;
    const inputChannels = inputBuffer.info.channels;

    console.log(`输入图像: ${inputImage}`);
    console.log(`输入图像尺寸: ${inputWidth}x${inputHeight}`);
    console.log(`输入图像通道数: ${inputChannels}`);

    // 获取该输入图像对应的输出文件夹
    const outputSubDir = path.join(outputDir, path.basename(inputImage, path.extname(inputImage)));
    if (!fs.existsSync(outputSubDir)) {
      console.warn(`警告: 输出文件夹中找不到 ${inputImage} 的对应文件夹，跳过此图像`);
      continue;
    }

    // 获取该输入图像对应的输出图片列表
    const outputImages = fs.readdirSync(outputSubDir).filter((file) => /\.(png|jpe?g)$/i.test(file));
    if (outputImages.length === 0) {
      console.warn(`警告: ${inputImage} 的输出文件夹中没有图片，跳过此图像`);
      continue;
    }

    for (const outputImageName of outputImages) {
      const outputImagePath = path.join(outputSubDir, outputImageName);

      // 读取输出图像并调整尺寸
      const outputBuffer = await sharp(outputImagePath)
          .resize({ width: inputWidth, height: inputHeight }) // 调整为输入图像的尺寸
          .raw()
          .toBuffer({ resolveWithObject: true });

      console.log(`输出图像: ${outputImageName}`);
      console.log(`输出图像尺寸: ${outputBuffer.info.width}x${outputBuffer.info.height}`);
      console.log(`输出图像通道数: ${outputBuffer.info.channels}`);

      // 检查通道数是否一致
      if (inputChannels !== outputBuffer.info.channels) {
        console.warn(`警告: 输入图像和输出图像通道数不一致`);
        continue; // 跳过此图像
      }

      // 计算 PSNR
      const psnrValue = await calculatePSNR(inputBuffer.data, outputBuffer.data);
      console.log(`PSNR: ${psnrValue.toFixed(2)}`);

      // 计算 SSIM
      const ssimValue = await calculateSSIM(inputBuffer.data, outputBuffer.data, inputWidth, inputHeight);
      console.log(`SSIM: ${ssimValue.mssim.toFixed(4)}`); // 输出 mssim 值

      console.log('--------------------------------');
    }
  }
}

// 调用比较函数
compareImages().catch((error) => {
  console.error('发生错误:', error);
});
