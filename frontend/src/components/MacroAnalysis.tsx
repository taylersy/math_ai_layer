import React, { useState, useRef, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { ActivitySquare, Bot, Users, BarChart3, Loader2, Send, User, BrainCircuit } from 'lucide-react';
import { marked } from 'marked';

interface Props {
  teacherId: string;
  students: any[];
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export const MacroAnalysis: React.FC<Props> = ({ teacherId, students }) => {
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (students.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-surface-dark/60 rounded-2xl border border-gray-800/80 backdrop-blur-xl">
        <div className="text-gray-500 text-center">
          <Users className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p>当前教研员暂无学生数据，请先上传</p>
        </div>
      </div>
    );
  }

  const classStats = {
    total: students.length,
    avgLScore: Math.round(students.reduce((acc, s) => acc + (s.base_l_score || 0), 0) / students.length),
    tiers: students.reduce((acc: any, s: any) => {
      acc[s.tier_level] = (acc[s.tier_level] || 0) + 1;
      return acc;
    }, {})
  };

  const pieOption = {
    tooltip: { trigger: 'item', formatter: '{b}: {c} 人 ({d}%)' },
    legend: { top: '5%', left: 'center', textStyle: { color: '#9ca3af' } },
    series: [
      {
        name: '全局学情分布',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#0b1120',
          borderWidth: 2
        },
        label: { show: false, position: 'center' },
        emphasis: {
          label: { show: true, fontSize: '20', fontWeight: 'bold', color: '#fff' }
        },
        labelLine: { show: false },
        data: [
          { value: classStats.tiers['理解层'] || 0, name: '理解层', itemStyle: { color: '#f97316' } },
          { value: classStats.tiers['运用层'] || 0, name: '运用层', itemStyle: { color: '#10b981' } },
          { value: classStats.tiers['表达层'] || 0, name: '表达层', itemStyle: { color: '#3b82f6' } },
          { value: classStats.tiers['反思层'] || 0, name: '反思层', itemStyle: { color: '#a855f7' } }
        ]
      }
    ]
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const newMsg = { role: 'user', content: input } as Message;
    const currentMessages = [...messages, newMsg];
    setMessages(currentMessages);
    setInput('');
    setLoading(true);

    // Add empty assistant message for streaming
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      const res = await fetch('http://localhost:8787/api/chat/macro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherId,
          messages: currentMessages
        })
      });

      if (!res.body) throw new Error('No readable stream');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value);
          setMessages(prev => {
            const lastMsg = prev[prev.length - 1];
            return [
              ...prev.slice(0, -1),
              { ...lastMsg, content: lastMsg.content + chunk }
            ];
          });
        }
      }
    } catch (e: any) {
      setMessages(prev => {
        const lastMsg = prev[prev.length - 1];
        return [
          ...prev.slice(0, -1),
          { ...lastMsg, content: lastMsg.content + '\n\n**分析失败: ' + e.message + '**' }
        ];
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-surface-dark/60 rounded-2xl border border-gray-800/80 backdrop-blur-xl p-6 overflow-hidden">
      
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-black text-white flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-primary" /> 宏观学情分析智能体
        </h2>
      </div>

      <div className="flex gap-6 flex-1 min-h-0 overflow-hidden">
        {/* 左侧：全局学情分布面板 */}
        <div className="w-80 bg-gray-900/40 rounded-xl border border-gray-800/50 p-4 flex flex-col flex-shrink-0">
          <h3 className="text-gray-300 font-bold mb-4 border-l-4 border-primary pl-2">班级全局指标</h3>
          
          <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700 mb-4 flex justify-between items-center shadow-inner">
            <div>
              <div className="text-sm text-gray-400 mb-1">全局平均 L 基底</div>
              <div className="text-3xl font-black text-white">{classStats.avgLScore}</div>
            </div>
            <ActivitySquare className="w-10 h-10 text-primary opacity-50" />
          </div>

          <div className="flex-1 min-h-[250px] relative">
            <ReactECharts option={pieOption} style={{ height: '100%', width: '100%' }} />
          </div>

          <div className="mt-4 p-4 rounded-xl bg-primary/10 border border-primary/20 text-sm text-blue-300 flex items-start gap-3">
            <Bot className="w-5 h-5 flex-shrink-0 text-primary mt-0.5" />
            <p>你好，我是宏观学情分析智能体。你可以让我分析特定学段（如八下）或特定章节的宏观数据，我将自动从数据库为您提取分析。</p>
          </div>
        </div>

        {/* 右侧：Chat 面板 */}
        <div className="flex flex-col flex-1 bg-gray-900/40 rounded-xl border border-gray-800/50 overflow-hidden shadow-inner">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-500 opacity-50">
                <BarChart3 className="w-16 h-16 mb-4" />
                <p>在下方输入您想要分析的宏观学情范围，例如“分析八上整体学情”</p>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                  {msg.role !== 'user' && (
                    <div className="w-10 h-10 rounded-full bg-blue-900/30 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-6 h-6 text-blue-400" />
                    </div>
                  )}
                  <div className={`max-w-[80%] rounded-2xl p-5 ${
                    msg.role === 'user' 
                      ? 'bg-primary/20 border border-primary/30 text-white rounded-tr-none'
                      : 'bg-gray-800/60 border border-gray-700/60 text-gray-200 rounded-tl-none prose prose-invert prose-blue max-w-none'
                  }`}>
                    {msg.role === 'user' ? msg.content : (
                      msg.content ? (
                        <div dangerouslySetInnerHTML={{ __html: marked(msg.content) as string }} />
                      ) : (
                        <div className="flex gap-1.5 items-center h-6">
                          <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce"></div>
                          <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                          <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                        </div>
                      )
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
                      <User className="w-6 h-6 text-primary" />
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="p-4 bg-gray-800/80 border-t border-gray-700/80 backdrop-blur-md">
            <form 
              onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
              className="flex gap-3 bg-gray-900/80 border border-gray-700 rounded-xl p-2 items-end focus-within:border-primary/50 transition-colors"
            >
              <textarea 
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="例如：请帮我分析一下八下第一章的整体情况..."
                className="flex-1 bg-transparent border-none text-white focus:ring-0 resize-none min-h-[44px] max-h-32 py-3 px-2 text-sm"
                rows={1}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="w-12 h-12 flex-shrink-0 bg-primary hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg flex items-center justify-center transition-colors mb-0.5"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </form>
            <div className="text-center text-xs text-gray-500 mt-3 flex items-center justify-center gap-2">
              <BrainCircuit className="w-4 h-4" /> Math-AI Macro Agent 会主动检索底层数据库，生成深度教研分析
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
