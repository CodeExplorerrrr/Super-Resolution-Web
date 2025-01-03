import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';

const backends = ['webgpu', 'wasm'];
const models = [
    'srcnn_x4',
    'Real-ESRGAN-General-x4v3',
    'Real-ESRGAN-x4plus',
    'RealESRGAN_x4plus_anime'
];
let lastSrc = null;
const inputDir = './tests/image_input';  // 输入图片目录
const outputDir = './tests/image_output';  // 输出图片目录

// 确保输出目录存在
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// 读取输入图片列表
const inputImages = fs.readdirSync(inputDir).filter((file) => {
    const ext = path.extname(file).toLowerCase();
    return ['.jpg', '.jpeg', '.png'].includes(ext); // 只处理常见图片格式
});

if (inputImages.length === 0) {
    console.error('未找到任何输入图片，请检查输入目录！');
    process.exit(1);
}

(async () => {
    const browser = await chromium.launch(); // 可设置 { headless: false } 进行调试
    const page = await browser.newPage();

    // 访问测试页面
    await page.goto('http://localhost:8000');

    // 验证页面加载是否成功
    const title = await page.title();
    if (title !== '图像超分辨率') {
        console.error('页面加载失败，标题不匹配！');
        await browser.close();
        return;
    }
    console.log('页面加载成功。');

    for (const backend of backends) {
        let skipBackend = false;

        page.on('dialog', async (dialog) => {
            console.log(`弹窗检测: ${dialog.message()}`);
            if (dialog.message().includes(backend)) {
                console.log(`检测到不支持的后端 (${backend})，跳过此后端测试。`);
                await dialog.dismiss();
                skipBackend = true;
            } else {
                await dialog.dismiss();
            }
        });

        try {
            await page.selectOption('#backendSelect', backend);
            console.log(`选择后端: ${backend}`);

            await page.waitForFunction(
                (backend) => {
                    const backendStatus = document.getElementById("backendStatus");
                    return backendStatus && backendStatus.textContent.includes(backend);
                },
                backend,
                { timeout: 10000 },
            );

            if (skipBackend) {
                console.log(`跳过后端: ${backend}`);
                continue;
            }

            for (const model of models) {
                for (const inputImage of inputImages) {
                    try {
                        const filePath = path.join(inputDir, inputImage);
                        const baseName = path.basename(inputImage, path.extname(inputImage));
                        const imageSubDir = path.join(outputDir, baseName);

                        // 确保每张输入图片的子文件夹存在
                        if (!fs.existsSync(imageSubDir)) {
                            fs.mkdirSync(imageSubDir, { recursive: true });
                        }

                        await page.selectOption('#modelSelect', model);
                        console.log(`选择模型: ${model}`);

                        await page.waitForFunction((model) => {
                            const modelStatus = document.getElementById("modelStatus");
                            return modelStatus && modelStatus.textContent.includes(model);
                        }, model, { timeout: 20000 });

                        const fileInput = await page.$('#imageInput');
                        await fileInput.setInputFiles(filePath);

                        await page.waitForSelector('#inputImage', { visible: true });
                        console.log(`图片预览显示成功：${inputImage}`);

                        await page.click('#startProcessingButton');
                        console.log('开始处理...');

                        try {
                            await page.waitForFunction((lastSrc) => {
                                const img = document.getElementById('outputImage');
                                return img && img.src && img.src !== 'http://localhost:8000/' && img.src !== lastSrc;
                            }, lastSrc, { timeout: 300000 });

                            const outputImageSrc = await page.evaluate(() => {
                                const img = document.getElementById('outputImage');
                                return img ? img.src : null;
                            });

                            if (!outputImageSrc) {
                                console.error(`推理失败，输出图片未生成！后端: ${backend}, 模型: ${model}, 输入图片: ${inputImage}`);
                            } else {
                                console.log(`推理成功，输出图片地址: [...${outputImageSrc.slice(-50)}]，后端: ${backend}, 模型: ${model}`);

                                //保存
                                if (outputImageSrc.startsWith('data:image/')) {
                                    // 获取图片的 MIME 类型
                                    const mimeType = outputImageSrc.split(';')[0].split(':')[1];
                                    // 提取扩展名
                                    const extension = path.extname(inputImage).substring(1);

                                    const base64Data = outputImageSrc.split(',')[1];
                                    const buffer = Buffer.from(base64Data, 'base64');

                                    // 获取原始图片名称（假设你有 model 和 backend 变量作为文件名的一部分）
                                    const imageName = `${baseName}_${model}_${backend}.${extension}`;

                                    // 目标路径
                                    const imagePath = path.join(imageSubDir, imageName);

                                    const jpgBuffer = await sharp(buffer)
                                        .jpeg({quality: 90})
                                        .toBuffer();

                                    fs.writeFileSync(imagePath, jpgBuffer); // 写入文件
                                    console.log(`图片已保存：${imagePath}`);

                                }


                                lastSrc = outputImageSrc;
                            }
                        } catch (error) {
                            console.error(`超时：输出图片未生成，后端: ${backend}, 模型: ${model}, 输入图片: ${inputImage}`);
                        }
                    } catch (error) {
                        console.error(`测试失败，跳过模型: ${model}, 输入图片: ${inputImage}，后端: ${backend}。错误: ${error.message}`);
                    }
                }
            }
        } catch (error) {
            console.error(`测试失败，跳过后端: ${backend}。错误: ${error.message}`);
        } finally {
            skipBackend = false;
        }
    }

    await browser.close();
})();
