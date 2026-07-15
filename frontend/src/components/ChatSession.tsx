import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, User, Copy, Trash2, Check } from 'lucide-react';
import { marked } from 'marked';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface StudentData {
  id: string;
  name: string;
  tier_level: string;
  base_l_score: number;
  anomaly_s_score: number;
  anomaly_details: any;
  progression?: any[];
}

interface Props {
  student: StudentData | null;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// 解析 markdown 中的数学公式
const renderMarkdownWithMath = (text: string) => {
  if (!text) return '';
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

export const ChatSession: React.FC<Props> = ({ student }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const handleCopy = (content: string, idx: number) => {
    navigator.clipboard.writeText(content);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const handleDelete = (idx: number) => {
    setMessages(prev => {
      const newMessages = [...prev];
      if (idx > 0 && newMessages[idx - 1].role === 'user') {
        newMessages.splice(idx - 1, 2);
      } else {
        newMessages.splice(idx, 1);
      }
      return newMessages;
    });
  };

  useEffect(() => {
    // Reset chat when student changes
    if (student) {
      setMessages([{
        role: 'assistant',
        content: `你好，我是个性化学情智能体。我已经读取了 **${student.name}** 的 L/S 矩阵数据（当前落点：${student.tier_level}）。你可以向我询问关于他/她的具体学情分析、提问技巧或是专属变式题。`
      }]);
    } else {
      setMessages([]);
    }
  }, [student]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !student || loading) return;

    const userMsg = input;
    setInput('');
    const newMessages: Message[] = [...messages, { role: 'user', content: userMsg }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: student.id,
          tierLevel: student.tier_level,
          lScore: student.base_l_score,
          sScore: student.anomaly_s_score,
          anomalyDetails: student.anomaly_details,
          progression: student.progression,
          messages: newMessages.slice(1).map(m => ({ role: m.role, content: m.content })) // exclude initial greeting
        })
      });

      if (!response.ok) {
        let errStr = '诊断接口调用失败';
        try {
          const errData = await response.json();
          if (errData.error) errStr = errData.error;
        } catch (e) {
          console.error(e);
        }
        throw new Error(errStr);
      }

      if (!response.body) throw new Error('No body');
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        setMessages(prev => {
          const last = prev[prev.length - 1];
          return [
            ...prev.slice(0, -1),
            { ...last, content: last.content + text }
          ];
        });
      }
    } catch (error: any) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'assistant', content: `❌ ${error.message || '诊断接口调用失败，请检查网络或 API Key。'}` }]);
    } finally {
      setLoading(false);
    }
  };

  if (!student) {
    return (
      <div className="h-full bg-surface-dark/60 rounded-2xl border border-gray-800/80 flex items-center justify-center text-gray-500 backdrop-blur-xl">
        <Bot className="w-12 h-12 text-gray-700 mb-4 opacity-50" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-surface-dark/60 rounded-2xl border border-gray-800/80 backdrop-blur-xl">
      <div className="p-4 border-b border-gray-800/80 bg-gray-900/40 flex items-center">
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center mr-3 border border-primary/30">
          <Bot className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-gray-200">个性化学情智能体</h2>
          <p className="text-xs text-gray-500">正在分析: {student.name}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center mt-1 ${
                msg.role === 'user' ? 'bg-gray-700 ml-3' : 'bg-primary/20 border border-primary/30 mr-3'
              }`}>
                {msg.role === 'user' ? <User className="w-4 h-4 text-gray-300" /> : <Bot className="w-4 h-4 text-primary" />}
              </div>
              <div className="flex flex-col">
                <div className={`p-3 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user' ? 'bg-primary text-white rounded-tr-sm' : 'bg-gray-800/60 text-gray-300 border border-gray-700/50 rounded-tl-sm prose prose-invert prose-sm max-w-none'
                }`}>
                  {msg.role === 'user' ? (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  ) : (
                    <div 
                      className="markdown-body" 
                      dangerouslySetInnerHTML={{ __html: renderMarkdownWithMath(msg.content) }} 
                    />
                  )}
                  {loading && idx === messages.length - 1 && msg.role === 'assistant' && (
                    <span className="inline-block w-1.5 h-4 ml-1 bg-primary animate-pulse"></span>
                  )}
                </div>
                {msg.role === 'assistant' && !loading && (
                  <div className="flex items-center space-x-3 mt-1 ml-1 text-gray-500">
                    <button 
                      onClick={() => handleCopy(msg.content, idx)}
                      className="flex items-center space-x-1 hover:text-gray-300 transition-colors"
                      title="复制回复"
                    >
                      {copiedIdx === idx ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      <span className="text-[10px]">{copiedIdx === idx ? '已复制' : '复制'}</span>
                    </button>
                    <button 
                      onClick={() => handleDelete(idx)}
                      className="flex items-center space-x-1 hover:text-red-400 transition-colors"
                      title="删除该回复及提问"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="text-[10px]">删除</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="p-4 border-t border-gray-800/80 bg-gray-900/40">
        <div className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="输入您想探讨的问题（例如：帮我出一道变式题）..."
            className="w-full bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3 pr-12 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors placeholder-gray-500"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="absolute right-2 p-2 bg-primary/20 hover:bg-primary/40 text-primary rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
