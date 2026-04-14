const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

// 峰哥头像的像素数据（32x32 灰度图，使用 FC 风格 4 色色板）
// 这是根据上传的峰哥照片手动编码的像素图案

// FC 风格色板（灰度）
const FCPalette = [
  [0, 0, 0],       // 黑
  [85, 85, 85],    // 深灰
  [170, 170, 170], // 浅灰
  [255, 255, 255]  // 白
];

// 32x32 像素数据（每个值代表色板索引 0-3）
// 这是根据峰哥头像编码的简化版本
const pixelData = [];
const size = 32;

// 初始化 32x32 数组，填充 0（黑色背景）
for (let y = 0; y < size; y++) {
  pixelData[y] = [];
  for (let x = 0; x < size; x++) {
    pixelData[y][x] = 0;
  }
}

// 手动绘制峰哥头像（简化版）
// 头发区域（用 1=深灰表示）
for (let y = 2; y < 10; y++) {
  for (let x = 3; x < 29; x++) {
    pixelData[y][x] = 1;
  }
}
// 头发两侧
for (let y = 10; y < 26; y++) {
  for (let x = 3; x < 6; x++) {
    pixelData[y][x] = 1;
  }
  for (let x = 26; x < 29; x++) {
    pixelData[y][x] = 1;
  }
}

// 脸部区域（用 2=浅灰表示）
for (let y = 8; y < 25; y++) {
  for (let x = 6; x < 26; x++) {
    pixelData[y][x] = 2;
  }
}

// 眼睛（用 0=黑色表示）
pixelData[14][10] = 0; pixelData[14][11] = 0;
pixelData[14][20] = 0; pixelData[14][21] = 0;

// 鼻子（用 1=深灰表示）
pixelData[16][15] = 1; pixelData[16][16] = 1;

// 嘴巴（用 0=黑色表示）
for (let x = 12; x < 20; x++) {
  pixelData[19][x] = 0;
}

// 胡子（用 0=黑色表示）
for (let y = 20; y < 24; y++) {
  for (let x = 10; x < 22; x++) {
    pixelData[y][x] = 0;
  }
}

// 下巴渐变
for (let x = 8; x < 24; x++) {
  pixelData[24][x] = 1;
  pixelData[25][x] = 0;
}

// 生成 PNG 文件
function generatePNG() {
  const size = 32;
  const scale = 8; // 放大倍数
  const outputSize = size * scale;
  
  // 创建 canvas
  const canvas = createCanvas(outputSize, outputSize);
  const ctx = canvas.getContext('2d');
  
  // 绘制像素
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const colorIndex = pixelData[y][x];
      const color = FCPalette[colorIndex];
      ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  
  // 保存 PNG 文件
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync('public/fengge-pixel.png', buffer);
  console.log('已生成 public/fengge-pixel.png');
  
  // 生成 SVG 版本
  generateSVG();
}

function generateSVG() {
  const size = 32;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`;
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const colorIndex = pixelData[y][x];
      const color = FCPalette[colorIndex];
      svg += `<rect x="${x}" y="${y}" width="1" height="1" fill="rgb(${color[0]},${color[1]},${color[2]})"/>`;
    }
  }
  
  svg += `</svg>`;
  fs.writeFileSync('public/fengge-pixel.svg', svg);
  console.log('已生成 public/fengge-pixel.svg');
  
  // 生成 CSS
  generateCSS();
}

function generateCSS() {
  const size = 32;
  let css = `/* 峰哥像素头像 - ${size}x${size} FC 风格 */\n\n`;
  
  css += `.fengge-pixel-avatar {\n`;
  css += `  width: ${size * 4}px;\n`;
  css += `  height: ${size * 4}px;\n`;
  css += `  image-rendering: pixelated;\n`;
  css += `  image-rendering: crisp-edges;\n`;
  css += `}\n`;
  
  fs.writeFileSync('public/fengge-pixel.css', css);
  console.log('已生成 public/fengge-pixel.css');
}

// 运行
generatePNG();
