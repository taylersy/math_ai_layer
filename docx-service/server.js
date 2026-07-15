const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const AdmZip = require('adm-zip');

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

  // 预处理 Markdown，确保公式能被 Pandoc 正确识别为原生公式
  // 1. 将块级公式 $$ ... $$ 内部的首尾空格去除，变成 $$...$$
  let processedMarkdown = markdown.replace(/\$\$([\s\S]*?)\$\$/g, (match, math) => '$$' + math.trim() + '$$');
  // 2. 将行内公式 $ ... $ 内部的首尾空格去除，变成 $...$ (使用负向先行/后发断言避免匹配到 $$)
  processedMarkdown = processedMarkdown.replace(/(?<!\$)\$((?:\\.|[^$\\])+)\$(?!\$)/g, (match, math) => '$' + math.trim() + '$');
  // 3. 将 LaTeX 原生行内公式 \( ... \) 转为 $...$
  processedMarkdown = processedMarkdown.replace(/\\\(([\s\S]*?)\\\)/g, (match, math) => '$' + math.trim() + '$');
  // 4. 将 LaTeX 原生块级公式 \[ ... \] 转为 $$...$$
  processedMarkdown = processedMarkdown.replace(/\\\[([\s\S]*?)\\\]/g, (match, math) => '$$' + math.trim() + '$$');

  // 将处理后的 markdown 写入临时文件
  fs.writeFile(mdPath, processedMarkdown, (err) => {
    if (err) {
      console.error('Error writing temp file:', err);
      return res.status(500).json({ error: 'Failed to write temp file' });
    }

    // 调用 pandoc，使用默认引擎进行转换
    const cmd = `pandoc "${mdPath}" -o "${docxPath}"`;
    
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error('Pandoc execution error:', error);
        console.error('Pandoc stderr:', stderr);
        // 清理
        fs.unlink(mdPath, () => {});
        return res.status(500).json({ error: 'Failed to convert to docx via Pandoc' });
      }

      try {
        // 修复 WPS Office 渲染 Pandoc OMML 公式时，数字丢失/不可见的 Bug
        const zip = new AdmZip(docxPath);
        
        // 1. 修复 settings.xml，强制声明 MathFont
        let settingsXml = zip.readAsText('word/settings.xml');
        if (settingsXml && !settingsXml.includes('m:mathFont')) {
          settingsXml = settingsXml.replace('</w:settings>', '<m:mathPr><m:mathFont m:val="Cambria Math"/></m:mathPr></w:settings>');
          zip.updateFile('word/settings.xml', Buffer.from(settingsXml, 'utf8'));
        }
        
        // 2. 修复 document.xml，为没有 <m:rPr> 的数学字符 <m:r> 强制注入字体属性，防止 WPS 丢字
        let docXml = zip.readAsText('word/document.xml');
        if (docXml) {
          docXml = docXml.replace(/<m:r>(?!\s*<m:rPr>)/g, '<m:r><m:rPr><m:rFonts m:ascii="Cambria Math" m:hAnsi="Cambria Math" m:cs="Cambria Math"/></m:rPr>');
          zip.updateFile('word/document.xml', Buffer.from(docXml, 'utf8'));
        }
        
        zip.writeZip(docxPath);
      } catch (patchErr) {
        console.error('Failed to patch docx for WPS:', patchErr);
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

const PORT = process.env.PORT || 8789;
app.listen(PORT, () => {
  console.log(`Docx Exporter Service is running on http://localhost:${PORT}`);
});
