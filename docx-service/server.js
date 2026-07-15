const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const app = express();
app.use(cors());
// 增加 payload 大小限制，以防大文本
app.use(express.json({ limit: '50mb' }));

app.post('/api/export/docx', (req, res) => {
  const { markdown, title } = req.body;
  if (!markdown) {
    return res.status(400).json({ error: 'Markdown content is required' });
  }

  // 生成临时文件路径
  const tmpDir = os.tmpdir();
  const fileId = crypto.randomBytes(16).toString('hex');
  const mdPath = path.join(tmpDir, `${fileId}.md`);
  const docxPath = path.join(tmpDir, `${fileId}.docx`);

  // 将 markdown 写入临时文件
  fs.writeFile(mdPath, markdown, (err) => {
    if (err) {
      console.error('Error writing temp file:', err);
      return res.status(500).json({ error: 'Failed to write temp file' });
    }

    // 调用 pandoc，使用默认引擎进行转换
    // 如果想要处理中文字体更好，也可以传入特定的 pandoc 参数，例如 --pdf-engine 等，但转 docx 默认就够了。
    const cmd = `pandoc "${mdPath}" -o "${docxPath}"`;
    
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error('Pandoc execution error:', error);
        console.error('Pandoc stderr:', stderr);
        // 清理
        fs.unlink(mdPath, () => {});
        return res.status(500).json({ error: 'Failed to convert to docx via Pandoc' });
      }

      // 将生成的 docx 作为流发送给前端
      const fileName = title ? `${title}.docx` : 'export.docx';
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);

      const fileStream = fs.createReadStream(docxPath);
      fileStream.pipe(res);

      fileStream.on('end', () => {
        // 传输完成后删除临时文件
        fs.unlink(mdPath, () => {});
        fs.unlink(docxPath, () => {});
      });

      fileStream.on('error', (streamErr) => {
        console.error('Stream error:', streamErr);
        res.status(500).end();
        fs.unlink(mdPath, () => {});
        fs.unlink(docxPath, () => {});
      });
    });
  });
});

const PORT = 8789;
app.listen(PORT, () => {
  console.log(`Docx Exporter Service is running on http://localhost:${PORT}`);
});
