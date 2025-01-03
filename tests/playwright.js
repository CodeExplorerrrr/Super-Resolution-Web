import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const backends = ['webgpu', 'wasm'];
const models = [
    'srcnn_x4',
    'Real-ESRGAN-General-x4v3',
    'Real-ESRGAN-x4plus',
    'RealESRGAN_x4plus_anime'
];
let lastSrc = null;
const outputDir = './tests/image_output';  // 保存图片的输出目录

// 确保保存目录存在
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

(async () => {
    // const browser = await chromium.launch({headless: false});
    const browser = await chromium.launch();
    const page = await browser.newPage();

    // 访问测试页面
    await page.goto('http://localhost:8003'); // 确保使用正确的 URL

    // 验证页面加载是否成功
    const title = await page.title();
    if (title !== '图像超分辨率') {
        console.error('页面加载失败，标题不匹配！');
        await browser.close();
        return;
    }
    console.log('页面加载成功。');

    // 验证模型选择器是否存在
    const modelSelect = await page.$('#modelSelect');
    if (!modelSelect) {
        console.error('模型选择器未找到！');
        await browser.close();
        return;
    }
    console.log('模型选择器存在。');

    // 循环遍历每个后端和模型
    for (const backend of backends) {
        await page.selectOption('#backendSelect', backend); // 选择后端
        console.log(`选择后端: ${backend}`);

        // 等待后端状态更新
        await page.waitForFunction(
            (backend) => {
                const backendStatus = document.getElementById("backendStatus");
                return backendStatus && backendStatus.textContent.includes(backend);
            },
            backend,  // 传递的参数
            { timeout: 20000 },  // 配置对象
        );        

        for (const model of models) {
            await page.selectOption('#modelSelect', model); // 选择模型
            console.log(`选择模型: ${model}`);

            // 等待模型状态更新
            await page.waitForFunction((model) => {
                const modelStatus = document.getElementById("modelStatus");
                return modelStatus && modelStatus.textContent.includes(model);
            }, model, { timeout: 20000 }); // 将 model 作为参数传递

            // 上传图片
            const fileInput = await page.$('#imageInput');
            const filePath = path.resolve('./tests/image_input/image.jpg'); // 使用绝对路径
            await fileInput.setInputFiles(filePath); // 上传图片

            // 等待图片预览显示
            await page.waitForSelector('#inputImage', { visible: true });
            console.log('图片预览显示成功。');

            // 点击开始处理按钮
            await page.click('#startProcessingButton'); // 确保按钮选择器正确
            console.log('开始处理...'); // 添加调试输出

            // 等待推理完成，检查输出图片
            try {
                await page.waitForFunction((lastSrc) => {
                    const img = document.getElementById('outputImage');
                    return img && img.src && img.src !== 'http://localhost:8003/' && img.src !== lastSrc;
                }, lastSrc, { timeout: 60000 }); // 最多等待 60 秒（推理等待）

                // 使用 page.evaluate 获取 src 属性
                const outputImageSrc = await page.evaluate(() => {
                    const img = document.getElementById('outputImage');
                    return img ? img.src : null; // 添加时间戳
                });

                if (!outputImageSrc) {
                    console.error(`推理失败，输出图片未生成！后端: ${backend}, 模型: ${model}`);
                } else {
                    console.log(`推理成功，输出图片地址: [...${outputImageSrc.slice(-50)}]，后端: ${backend}, 模型: ${model}`);
                    
                    // 如果图片是 base64 格式
                    if (outputImageSrc.startsWith('data:image/')) {
                        // 获取图片的 MIME 类型
                        const mimeType = outputImageSrc.split(';')[0].split(':')[1]; // "image/png"
                        // 提取 base64 数据部分
                        const base64Data = outputImageSrc.split(',')[1];
                        // 生成文件名
                        const imageName = `${model}_${backend}_${Date.now()}.png`;
                        const imagePath = path.join(outputDir, imageName);
                        
                        // 将 base64 数据保存为文件
                        const buffer = Buffer.from(base64Data, 'base64');
                        fs.writeFileSync(imagePath, buffer); // 写入文件
                        console.log(`图片已保存：${imagePath}`);
                    }
                    
                    lastSrc = outputImageSrc;
                }
            } catch (error) {
                console.error(`超时：输出图片未生成，后端: ${backend}, 模型: ${model}`);
            }

            // 清理状态，准备下一个测试
            await page.click('#modelSelect'); // 重新选择模型以清理状态
        }
    }

    await browser.close();
})();
