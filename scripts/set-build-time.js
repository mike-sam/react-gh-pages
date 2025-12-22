/**
 * 设置构建时间环境变量
 * 在构建前运行此脚本来设置 REACT_APP_BUILD_TIME
 */

const fs = require('fs');
const path = require('path');

// 获取当前时间（ISO 格式）
const buildTime = new Date().toISOString();

// 创建 .env 文件或更新现有的
const envPath = path.join(__dirname, '..', '.env');
const envContent = `REACT_APP_BUILD_TIME=${buildTime}\n`;

fs.writeFileSync(envPath, envContent, 'utf8');

console.log(`Build time set to: ${buildTime}`);

