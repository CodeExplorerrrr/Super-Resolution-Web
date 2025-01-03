import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import psnr from 'psnr';  // 引用安装的 psnr 库
import ssim from 'ssim.js';

// 加载图片并转换为 RGBA 数据
async function loadImageAsData(imagePath) {
  const imageBuffer = fs.readFileSync(imagePath);
  const image = await sharp(imageBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return {
    width: image.info.width,
    height: image.info.height,
    data: image.data,
  };
}

// 计算 PSNR
function calculatePSNR(originalData, generatedData) {
  // 由于 psnr 库期望的是一维的像素数组，我们可以将 RGBA 数据按通道展平
  const originalPixels = Array.from(originalData.data);
  const generatedPixels = Array.from(generatedData.data);
  
  return psnr(originalPixels, generatedPixels);
}

// 计算 SSIM
async function calculateSSIM(originalPath, generatedPath) {
    const originalData = await loadImageAsData(originalPath);
    const generatedData = await loadImageAsData(generatedPath);
  
    // 使用 ssim.js 进行对比
    const { mssim, performance } = ssim({
      imageA: originalData.data,
      imageB: generatedData.data,
      width: originalData.width,
      height: originalData.height,
    });
  
    console.log(`SSIM: ${mssim} (${performance}ms)`);
    return mssim;
}

// 使用例子：对比两张图片
async function testImageQuality(originalPath, generatedPath) {
  try {
    const originalData = await loadImageAsData(originalPath);
    const generatedData = await loadImageAsData(generatedPath);

    const psnrValue = calculatePSNR(originalData, generatedData);
    const ssimValue = calculateSSIM(originalData, generatedData);

    console.log(`对比图像：${generatedPath}`);
    console.log(`PSNR: ${psnrValue.toFixed(2)} dB`);
    console.log(`SSIM: ${ssimValue.toFixed(4)}`);

    // 判断效果是否良好
    if (psnrValue > 30 && ssimValue > 0.9) {
      console.log("图像效果良好，PSNR 和 SSIM 达标");
    } else {
      console.log("图像效果较差，请重新调整超分辨率参数");
    }
  } catch (error) {
    console.error("图片加载或计算错误:", error);
  }
}

// 批量测试生成图像
async function testAllGeneratedImages(originalImagePath, generatedFolderPath) {
  const files = fs.readdirSync(generatedFolderPath);  // 读取文件夹中的所有文件
  const imageFiles = files.filter(file => file.endsWith('.jpg') || file.endsWith('.png'));  // 过滤出图片文件

  for (const imageFile of imageFiles) {
    const generatedImagePath = path.resolve(generatedFolderPath, imageFile);
    await testImageQuality(originalImagePath, generatedImagePath);
  }
}

// 测试函数
const originalImagePath = path.resolve('./tests/image_input/image.jpg');  // 替换为原图路径
const generatedFolderPath = path.resolve('./tests/image_output');  // 生成的图像文件夹路径

testAllGeneratedImages(originalImagePath, generatedFolderPath);
