import React, { useState, useEffect, useRef } from 'react';
import { CURRICULUM_BNU } from '../curriculum';
import { BrainCircuit, BookOpen, Download, Loader2, Save } from 'lucide-react';
import { marked } from 'marked';
import katex from 'katex';
import { saveAs } from 'file-saver';
import 'katex/dist/katex.min.css';
import { getStudentMetrics } from '../utils/studentMetrics';

// 解析 markdown 中的数学公式
const renderMarkdownWithMath = (text: string) => {
  // 先把所有的块级公式 $$...$$ 替换为 katex
  let processedText = text.replace(/\$\$([\s\S]*?)\$\$/g, (match, math) => {
    try {
      return katex.renderToString(math, { displayMode: true, output: 'mathml' });
    } catch (e) {
      return match;
    }
  });

  // 再替换行内公式 $...$
  processedText = processedText.replace(/\$((?:\\.|[^$\\])+)\$/g, (match, math) => {
    try {
      return katex.renderToString(math, { displayMode: false, output: 'mathml' });
    } catch (e) {
      return match;
    }
  });

  return marked(processedText) as string;
};

// 导出为真正的 Word (使用后端的 Pandoc 微服务)
const exportToWord = async (markdownText: string, title: string) => {
  try {
    const res = await fetch('https://math-docx-service.onrender.com/api/export/docx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown: markdownText, title })
    });

    if (!res.ok) throw new Error('导出失败');

    const blob = await res.blob();
    saveAs(blob, `${title}.docx`);
  } catch (error) {
    console.error('Export error:', error);
    alert('导出失败，请检查文档微服务是否在端口 8789 上启动。');
  }
};

interface Props {
  teacherId: string;
  students: any[];
  type: 'task' | 'homework';
  selectedBookId?: string;
}

export const RecommendationUI: React.FC<Props> = ({ teacherId, students, type, selectedBookId }) => {
  const [selectedBook, setSelectedBook] = useState(CURRICULUM_BNU[3]); // 默认八下
  const [selectedChapter, setSelectedChapter] = useState(CURRICULUM_BNU[3].chapters[0]);
  const [selectedSection, setSelectedSection] = useState(CURRICULUM_BNU[3].chapters[0].sections[0]);
  
  const [loading, setLoading] = useState(false);
  const [resultText, setResultText] = useState('');
  
  const title = type === 'task' ? '分层课堂任务推荐' : '分层课后作业推荐';

  const dynamicStudents = students.map(s => {
    const metrics = getStudentMetrics(s, selectedBookId);
    return { ...s, dynamicTier: metrics.tier, dynamicScore: metrics.lScore };
  });

  const classStats = {
    total: dynamicStudents.length,
    tiers: dynamicStudents.reduce((acc: any, s: any) => {
      acc[s.dynamicTier] = (acc[s.dynamicTier] || 0) + 1;
      return acc;
    }, {})
  };

  const generateRecommendation = async () => {
    setLoading(true);
    setResultText('');

    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          bookName: selectedBook.name,
          chapterName: selectedChapter.name,
          sectionName: selectedSection.name,
          classStats
        })
      });

      if (!res.body) throw new Error('No readable stream');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) setResultText(prev => prev + decoder.decode(value));
      }
    } catch (e: any) {
      setResultText('生成失败: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!resultText) return;
    setIsExporting(true);
    await exportToWord(resultText, `${selectedChapter.name}_${selectedSection.name}_${title}`);
    setIsExporting(false);
  };

  return (
    <div className="flex flex-col h-full w-full bg-surface-dark/60 rounded-2xl border border-gray-800/80 backdrop-blur-xl p-6 overflow-hidden">
      
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-black text-white flex items-center gap-3">
          <BrainCircuit className="w-8 h-8 text-primary" /> {title}
        </h2>
        {resultText && !loading && (
          <button onClick={handleExport} disabled={isExporting} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg font-bold transition-all shadow-lg shadow-blue-500/20">
            {isExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />} {isExporting ? '生成中...' : '导出为 Word'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6 flex-shrink-0">
        <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700">
          <label className="block text-gray-400 text-sm mb-2 font-bold">选择教材</label>
          <select 
            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none"
            value={selectedBook.id}
            onChange={e => {
              const book = CURRICULUM_BNU.find(b => b.id === e.target.value)!;
              setSelectedBook(book);
              setSelectedChapter(book.chapters[0]);
              setSelectedSection(book.chapters[0].sections[0]);
            }}
          >
            {CURRICULUM_BNU.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700">
          <label className="block text-gray-400 text-sm mb-2 font-bold">选择章节</label>
          <select 
            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none"
            value={selectedChapter.name}
            onChange={e => {
              const chap = selectedBook.chapters.find(c => c.name === e.target.value)!;
              setSelectedChapter(chap);
              setSelectedSection(chap.sections[0]);
            }}
          >
            {selectedBook.chapters.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
        </div>
        <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700">
          <label className="block text-gray-400 text-sm mb-2 font-bold">选择小节</label>
          <select 
            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none"
            value={selectedSection.name}
            onChange={e => {
              setSelectedSection(selectedChapter.sections.find(s => s.name === e.target.value)!);
            }}
          >
            {selectedChapter.sections.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-6 flex-1 min-h-0 overflow-hidden">
        {/* 左侧：学情分布面板 */}
        <div className="w-64 bg-gray-900/40 rounded-xl border border-gray-800/50 p-4 flex flex-col flex-shrink-0">
          <h3 className="text-gray-300 font-bold mb-4 border-l-4 border-primary pl-2">当前班级学情诊断</h3>
          <div className="flex-1 space-y-4">
            <div className="bg-gray-800/50 p-3 rounded-lg flex justify-between items-center border border-gray-700">
              <span className="text-gray-400">总人数</span>
              <span className="text-xl font-black text-white">{classStats.total}</span>
            </div>
            <div className="bg-orange-900/20 p-3 rounded-lg flex justify-between items-center border border-orange-700/50">
              <span className="text-orange-400">理解层</span>
              <span className="text-lg font-bold text-orange-400">{classStats.tiers['理解层'] || 0}</span>
            </div>
            <div className="bg-emerald-900/20 p-3 rounded-lg flex justify-between items-center border border-emerald-700/50">
              <span className="text-emerald-400">运用层</span>
              <span className="text-lg font-bold text-emerald-400">{classStats.tiers['运用层'] || 0}</span>
            </div>
            <div className="bg-blue-900/20 p-3 rounded-lg flex justify-between items-center border border-blue-700/50">
              <span className="text-blue-400">表达层</span>
              <span className="text-lg font-bold text-blue-400">{classStats.tiers['表达层'] || 0}</span>
            </div>
            <div className="bg-purple-900/20 p-3 rounded-lg flex justify-between items-center border border-purple-700/50">
              <span className="text-purple-400">反思层</span>
              <span className="text-lg font-bold text-purple-400">{classStats.tiers['反思层'] || 0}</span>
            </div>
          </div>
          <button 
            onClick={generateRecommendation} 
            disabled={loading || students.length === 0}
            className="w-full bg-primary hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition-all mt-4 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <BrainCircuit className="w-5 h-5" />}
            AI 动态生成
          </button>
        </div>

        {/* 右侧：生成结果 */}
        <div className="flex-1 bg-gray-900/20 rounded-xl border border-gray-800/50 p-6 overflow-y-auto relative prose prose-invert prose-blue max-w-none">
          {!resultText && !loading ? (
            <div className="absolute inset-0 flex items-center justify-center text-gray-500 flex-col">
              <BookOpen className="w-16 h-16 mb-4 opacity-20" />
              <p>请在左侧选择章节并点击生成，Math Engine 将为您出具分层方案</p>
            </div>
          ) : (
            <div dangerouslySetInnerHTML={{ __html: renderMarkdownWithMath(resultText) }} />
          )}
        </div>
      </div>
    </div>
  );
};
