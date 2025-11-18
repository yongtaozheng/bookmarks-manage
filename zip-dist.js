import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import archiver from 'archiver';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.join(__dirname, 'dist');
const zipFile = path.join(__dirname, 'dist.zip');

// 检查dist目录是否存在
if (!fs.existsSync(distDir)) {
  console.error('错误: dist目录不存在！');
  process.exit(1);
}

// 删除已存在的zip文件
if (fs.existsSync(zipFile)) {
  fs.unlinkSync(zipFile);
  console.log('已删除旧的dist.zip文件');
}

// 创建文件输出流
const output = fs.createWriteStream(zipFile);
const archive = archiver('zip', {
  zlib: { level: 9 } // 设置压缩级别
});

// 监听所有archive数据都写入完成
output.on('close', () => {
  const sizeInMB = (archive.pointer() / 1024 / 1024).toFixed(2);
  console.log(`✅ 压缩完成！`);
  console.log(`📦 文件大小: ${sizeInMB} MB`);
  console.log(`📁 输出文件: ${zipFile}`);
});

// 监听警告
archive.on('warning', (err) => {
  if (err.code === 'ENOENT') {
    console.warn('警告:', err);
  } else {
    throw err;
  }
});

// 监听错误
archive.on('error', (err) => {
  console.error('压缩错误:', err);
  process.exit(1);
});

// 将archive与文件流关联
archive.pipe(output);

// 添加dist目录下的所有文件
archive.directory(distDir, false);

// 完成压缩
archive.finalize();

