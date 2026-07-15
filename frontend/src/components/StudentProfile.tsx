import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { getStudentMetrics } from '../utils/studentMetrics';
import ReactECharts from 'echarts-for-react';
import { AlertCircle, BrainCircuit, Printer, Maximize2, X } from 'lucide-react';
import { CURRICULUM_BNU } from '../curriculum';

interface StudentData {
  id: string;
  name: string;
  tier_level: string;
  base_l_score: number;
  anomaly_s_score: number;
  anomaly_details: any;
  progression?: any[];
  knowledgeGraph?: any[];
  zxwData?: any[];
}

interface Props {
  student: StudentData | null;
  selectedBookId?: string;
}

export const StudentProfile: React.FC<Props> = ({ student, selectedBookId }) => {
  const [isKgExpanded, setIsKgExpanded] = useState(false);
  
  if (!student) {
    return (
      <div className="h-full flex items-center justify-center bg-surface-dark/60 rounded-2xl border border-gray-800/80 backdrop-blur-xl">
        <div className="text-gray-500 text-center">
          <BrainCircuit className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p>请在左侧名单中选择一名学生</p>
        </div>
      </div>
    );
  }

  const handlePrint = () => {
    window.print();
  };

  const getColorForScore = (score: number) => {
    if (score >= 85) return '#10b981'; // 反思层 绿
    if (score >= 75) return '#3b82f6'; // 表达层 蓝
    if (score >= 65) return '#a855f7'; // 运用层 紫
    return '#ef4444'; // 理解层 红
  };

  const getTierForScore = (score: number) => {
    if (score >= 85) return '反思层';
    if (score >= 75) return '表达层';
    if (score >= 65) return '运用层';
    return '理解层';
  };

  // 动态图谱过滤逻辑
  const buildFullCurriculumTree = () => {
    let treeChildren: any[] = [];
    const chaptersData = student.knowledgeGraph || [];

    // 如果选了特定教材，只展示该教材；否则展示全学段（所有教材）
    let booksToRender = (selectedBookId && selectedBookId !== 'all') 
      ? CURRICULUM_BNU.filter(b => b.id === selectedBookId) 
      : CURRICULUM_BNU;

    // 在全学段模式下，为了让知识树更紧凑，过滤掉该学生完全没有数据的学段（比如还没学到的初三教材）
    if (!selectedBookId || selectedBookId === 'all') {
      const booksWithData = booksToRender.filter(book => {
        return book.chapters.some(chapConf => 
          chaptersData.some(c => c.chapterName === chapConf.name)
        );
      });
      // 只要有任何数据，就只展示有数据的书；如果完全没数据，就兜底展示全部，表现“暂无数据”
      if (booksWithData.length > 0) {
        booksToRender = booksWithData;
      }
    }

    booksToRender.forEach(book => {
      book.chapters.forEach(chapConf => {
        // Find if student has data for this chapter
        const studentChap = chaptersData.find(c => c.chapterName === chapConf.name);
        
        // Count valid sections to calculate average
        let validScores = 0;
        let totalScore = 0;

        const childrenNodes = chapConf.sections.map(sec => {
          const studentNode = studentChap?.nodes.find(n => n.name === sec.name);
          const val = studentNode?.lScore;
          
          if (val !== undefined && val !== null) {
            validScores++;
            totalScore += val;
          }

          return {
            name: sec.name,
            value: val,
            itemStyle: {
              color: val !== undefined && val !== null ? getColorForScore(val) : '#4b5563'
            }
          };
        });

        const avgScore = validScores > 0 ? totalScore / validScores : null;

        treeChildren.push({
          name: chapConf.name.split(' ')[1] || chapConf.name,
          isChapter: true,
          avgScore: avgScore,
          itemStyle: {
            color: avgScore !== null ? getColorForScore(avgScore) : '#4b5563'
          },
          children: childrenNodes
        });
      });
    });

    return {
      name: student.name,
      children: treeChildren
    };
  };

  const kgTreeData = buildFullCurriculumTree();

  const kgOption = {
    tooltip: { 
      trigger: 'item', 
      triggerOn: 'mousemove',
      formatter: (params: any) => {
        if (params.data.isChapter) {
          const score = params.data.avgScore;
          if (score === null || score === undefined) {
             return `<b>${params.data.name}</b><br/>暂无学情数据`;
          }
          return `<b>${params.data.name}</b><br/>平均得分: ${score.toFixed(1)}<br/>掌握层次: <span style="color:${getColorForScore(score)}">${getTierForScore(score)}</span>`;
        }
        if (params.data.value !== undefined && params.data.value !== null) {
          const score = params.data.value;
          return `<b>${params.data.name}</b><br/>掌握度 (L Score): ${score.toFixed(1)}<br/>掌握层次: <span style="color:${getColorForScore(score)}">${getTierForScore(score)}</span>`;
        }
        return `<b>${params.data.name}</b><br/>暂无学情数据`;
      }
    },
    series: [
      {
        type: 'tree',
        data: [kgTreeData],
        top: '5%', left: '15%', bottom: '5%', right: '20%',
        symbolSize: 10,
        label: { position: 'left', verticalAlign: 'middle', align: 'right', fontSize: 12, color: '#d1d5db' },
        leaves: { label: { position: 'right', verticalAlign: 'middle', align: 'left' } },
        expandAndCollapse: false,
        animationDuration: 550,
        animationDurationUpdate: 750,
        lineStyle: { width: 2, curveness: 0.5, color: '#4b5563' }
      }
    ]
  };

  // 辅助函数：根据章节名找到对应的书名简称
  const getBookNameForChapter = (chapterName: string) => {
    for (const book of CURRICULUM_BNU) {
      if (book.chapters.some(c => c.name === chapterName)) {
        const match = book.name.match(/([七八九]年级)([上下]册)/);
        if (match) {
           return match[1].charAt(0) + match[2].charAt(0);
        }
        return book.name;
      }
    }
    return '';
  };

  // Progression Line Chart Data
  let filteredProgression = student.progression || [];
  if (selectedBookId && selectedBookId !== 'all') {
    const book = CURRICULUM_BNU.find(b => b.id === selectedBookId);
    if (book) {
      const bookChapterNames = book.chapters.map(c => c.name);
      filteredProgression = filteredProgression.filter(p => bookChapterNames.includes(p.chapterName));
    }
  }

  const progChapters = filteredProgression.map(p => {
    // 简短化章节名称，例如“第一章”
    const match = p.chapterName.match(/第(.)章/);
    let shortName = match ? match[0] : p.chapterName;
    if (!selectedBookId || selectedBookId === 'all') {
      const bookName = getBookNameForChapter(p.chapterName);
      if (bookName) {
        shortName += `\n{bookLabel|${bookName}}`;
      }
    }
    return shortName;
  });
  const progLScores = filteredProgression.map(p => p.lScore);
  
  const progOption = {
    tooltip: { trigger: 'axis' },
    grid: { left: '10%', right: '5%', bottom: '15%', top: '10%' },
    xAxis: { 
      type: 'category', 
      data: progChapters, 
      axisLabel: { 
        color: '#9ca3af', 
        interval: 'auto', 
        rotate: 30,
        rich: {
          bookLabel: {
            color: '#60a5fa',
            fontSize: 10,
            padding: [2, 0, 0, 0]
          }
        }
      }, 
      axisLine: { lineStyle: { color: '#374151' } } 
    },
    yAxis: { type: 'value', min: 40, max: 100, axisLabel: { color: '#9ca3af' }, splitLine: { lineStyle: { color: '#1f2937', type: 'dashed' } } },
    series: [
      {
        data: progLScores,
        type: 'line',
        smooth: true,
        symbolSize: 8,
        itemStyle: { color: '#3b82f6' },
        lineStyle: { width: 3, shadowColor: 'rgba(59,130,246,0.5)', shadowBlur: 10 },
        areaStyle: {
          color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(59,130,246,0.3)' }, { offset: 1, color: 'rgba(59,130,246,0)' }] }
        },
        markLine: {
          silent: true, symbol: 'none', label: { position: 'start', color: '#9ca3af' },
          data: [
            { yAxis: 85, label: { formatter: '反思层' }, lineStyle: { color: '#10b981' } }, // 绿
            { yAxis: 75, label: { formatter: '表达层' }, lineStyle: { color: '#3b82f6' } }, // 蓝
            { yAxis: 65, label: { formatter: '运用层' }, lineStyle: { color: '#a855f7' } }, // 紫
            { yAxis: 55, label: { formatter: '理解层' }, lineStyle: { color: '#ef4444' } }  // 红
          ]
        }
      }
    ]
  };

  // Score Tracking Data
  const parseDate = (dateStr: string) => {
    const match = dateStr.match(/(\d+)月(\d+)日/);
    if (match) {
      return parseInt(match[1]) * 100 + parseInt(match[2]);
    }
    return 0;
  };

  const allExams: any[] = [];
  let filteredKG = student.knowledgeGraph || [];
  
  if (selectedBookId && selectedBookId !== 'all') {
    const book = CURRICULUM_BNU.find(b => b.id === selectedBookId);
    if (book) {
      const bookChapterNames = book.chapters.map(c => c.name);
      filteredKG = filteredKG.filter(c => bookChapterNames.includes(c.chapterName));
    }
  }

  if (filteredKG) {
    filteredKG.forEach(c => {
      if (c.unitTest) {
        allExams.push({ ...c.unitTest, type: 'ZYRL', ts: parseDate(c.unitTest.date), chapterName: c.chapterName });
      }
    });
  }
  if (student.zxwData) {
    student.zxwData.forEach(e => {
      // 只有在全学段，或者智学网名称中包含该学段特征（简化处理：如果选择了具体学段，暂时展示所有大考，因为大考通常是全册综合）
      // 这里为精确匹配，若名字带有特定关键字则保留。为避免过度过滤导致图表无数据，暂保留 ZXW 考点
      allExams.push({ ...e, type: 'ZXW', ts: parseDate(e.date) });
    });
  }

  allExams.sort((a, b) => a.ts - b.ts);

  // 简短化标签
  const scoreNames = allExams.map(e => {
    let shortName = e.name;
    let originalChapterName = e.chapterName;
    if (shortName.includes('测验')) {
      const match = shortName.match(/第(.)章/);
      shortName = match ? match[0] + '测' : shortName;
    }
    // 控制标签长度
    if (shortName.length > 8) shortName = shortName.substring(0, 8) + '...';

    if (!selectedBookId || selectedBookId === 'all') {
      if (originalChapterName) {
        const bookName = getBookNameForChapter(originalChapterName);
        if (bookName) {
          shortName += `\n{bookLabel|${bookName}}`;
        }
      } else if (e.type === 'ZXW') {
        shortName += `\n{bookLabel|大考}`;
      }
    }

    return `${shortName}\n${e.date}`;
  });
  const scoreValues = allExams.map(e => e.score);

  const scoreOption = {
    tooltip: { trigger: 'axis' },
    grid: { left: '10%', right: '5%', bottom: '25%', top: '10%' },
    dataZoom: [
      { type: 'inside', start: 0, end: 100 },
      { type: 'slider', height: 20, bottom: 5, textStyle: { color: '#9ca3af' } }
    ],
    xAxis: {
      type: 'category',
      data: scoreNames,
      axisLabel: { 
        color: '#9ca3af', 
        interval: 'auto', 
        rotate: 45, 
        fontSize: 10,
        rich: {
          bookLabel: {
            color: '#fcd34d',
            fontSize: 9,
            padding: [2, 0, 0, 0]
          }
        }
      },
      axisLine: { lineStyle: { color: '#374151' } }
    },
    yAxis: {
      type: 'value',
      name: '分数',
      min: 0,
      max: 150,
      axisLabel: { color: '#9ca3af' },
      splitLine: { lineStyle: { color: '#1f2937' } }
    },
    series: [
      {
        data: scoreValues,
        type: 'line',
        smooth: true,
        symbolSize: 10,
        itemStyle: { color: '#f59e0b' },
        lineStyle: { width: 3, color: '#f59e0b', shadowColor: 'rgba(245,158,11,0.5)', shadowBlur: 10 },
        areaStyle: {
          color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(245,158,11,0.3)' }, { offset: 1, color: 'rgba(245,158,11,0)' }] }
        }
      }
    ]
  };

  const { lScore: dynamicScore, tier: dynamicTier } = buildFullCurriculumTree() ? getStudentMetrics(student as any, selectedBookId) : { lScore: 0, tier: 'N/A' };

  return (
    <div className="flex flex-col h-full bg-surface-dark/60 rounded-2xl border border-gray-800/80 backdrop-blur-xl p-6 overflow-y-auto printable-area">
      
      {/* Header Info */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-3xl font-black text-white mb-2 tracking-tight flex items-center gap-3">
            {student.name} 的全景画像
            <button onClick={handlePrint} className="print-hide p-2 bg-gray-800 hover:bg-primary/20 text-gray-300 hover:text-primary rounded-lg transition-colors" title="导出学生报告 (保存为PDF)">
              <Printer className="w-5 h-5" />
            </button>
          </h2>
          <div className="flex items-center space-x-2 text-sm">
            <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 font-bold">
              当前阶层：{dynamicTier}
            </span>
            <span className="text-gray-400">当前视角基底: {dynamicScore}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-5xl font-black bg-gradient-to-br from-white to-gray-500 bg-clip-text text-transparent">
            {dynamicScore}
          </div>
          <div className="text-xs text-gray-500 font-bold tracking-widest mt-1">L SCORE</div>
        </div>
      </div>

      {/* Anomaly Alert */}
      {student.anomaly_s_score < -0.5 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 animate-pulse-slow">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-red-400 font-bold text-sm">S 矩阵异常干预警报</h4>
              <p className="text-red-400/80 text-xs mt-1 leading-relaxed">
                该生在 <strong>{student.anomaly_details?.chapterName} - {student.anomaly_details?.sectionName}</strong> 出现剧烈异常得分 
                ({student.anomaly_s_score})，严重偏离其基底能力，极有可能存在核心概念混淆或学习态度突变，请教研员重点干预！
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 垂直图表展示 */}
      <div className="flex flex-col space-y-8 pb-10">
        <div className="bg-gray-900/40 rounded-xl border border-gray-800/50 p-4 relative group">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-bold text-gray-200 border-l-4 border-emerald-500 pl-3">
              知识树结构
            </h3>
            
            <div className="flex items-center space-x-6">
              {/* 图例 */}
              <div className="flex items-center space-x-3 text-xs font-medium bg-surface-dark/50 px-3 py-1.5 rounded-lg border border-gray-800">
                <div className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-[#10b981] mr-1.5 shadow-[0_0_8px_#10b981]"></span>反思层 (优)</div>
                <div className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6] mr-1.5 shadow-[0_0_8px_#3b82f6]"></span>表达层 (良)</div>
                <div className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-[#a855f7] mr-1.5 shadow-[0_0_8px_#a855f7]"></span>运用层 (中)</div>
                <div className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-[#ef4444] mr-1.5 shadow-[0_0_8px_#ef4444]"></span>理解层 (差)</div>
              </div>

              {/* 放大按钮 */}
              <button 
                onClick={() => setIsKgExpanded(true)}
                className="flex items-center space-x-1.5 bg-primary/20 hover:bg-primary/40 text-primary border border-primary/30 px-3 py-1.5 rounded-lg transition-all shadow-[0_0_10px_rgba(59,130,246,0.3)] animate-pulse hover:animate-none"
              >
                <Maximize2 className="w-4 h-4" />
                <span className="text-sm font-bold">点击全屏放大</span>
              </button>
            </div>
          </div>
          <div className="h-[400px]">
            <ReactECharts option={kgOption} style={{ height: '100%', width: '100%' }} />
          </div>
        </div>

        <div className="bg-gray-900/40 rounded-xl border border-gray-800/50 p-4 page-break-before">
          <h3 className="text-lg font-bold text-gray-200 mb-2 border-l-4 border-blue-500 pl-3">学情跃迁轨迹</h3>
          <div className="h-[300px]">
            <ReactECharts option={progOption} style={{ height: '100%', width: '100%' }} />
          </div>
        </div>

        <div className="bg-gray-900/40 rounded-xl border border-gray-800/50 p-4">
          <h3 className="text-lg font-bold text-gray-200 mb-2 border-l-4 border-amber-500 pl-3">全景分数画像</h3>
          <div className="h-[350px]">
            <ReactECharts option={scoreOption} style={{ height: '100%', width: '100%' }} />
          </div>
        </div>
      </div>

      {/* 知识图谱全屏 Modal */}
      {isKgExpanded && createPortal(
        <div className="fixed inset-0 z-[100] flex flex-col bg-black/95 backdrop-blur-3xl overflow-y-auto">
          <div className="sticky top-0 z-[110] flex justify-between items-center p-6 bg-surface-dark/90 border-b border-gray-800 shadow-2xl">
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <BrainCircuit className="w-8 h-8 text-primary" />
              {student.name} 的知识图谱全景放大
            </h2>
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-3 text-sm font-medium bg-gray-900 px-4 py-2 rounded-lg border border-gray-800">
                <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-[#10b981] mr-2 shadow-[0_0_8px_#10b981]"></span>反思层 (优)</div>
                <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-[#3b82f6] mr-2 shadow-[0_0_8px_#3b82f6]"></span>表达层 (良)</div>
                <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-[#a855f7] mr-2 shadow-[0_0_8px_#a855f7]"></span>运用层 (中)</div>
                <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-[#ef4444] mr-2 shadow-[0_0_8px_#ef4444]"></span>理解层 (差)</div>
                <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-[#4b5563] mr-2"></span>暂无数据</div>
              </div>
              <button 
                onClick={() => setIsKgExpanded(false)}
                className="bg-gray-800 hover:bg-red-500/20 text-gray-400 hover:text-red-400 p-2 rounded-xl transition-colors border border-transparent hover:border-red-500/30"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
          
          <div className="w-full flex-1 p-8">
            <div style={{ height: `${Math.max(window.innerHeight - 150, (kgTreeData.children.reduce((acc, c) => acc + c.children.length, 0)) * 30)}px`, width: '100%' }}>
              <ReactECharts 
                option={{
                  ...kgOption,
                  series: [{
                    ...kgOption.series[0],
                    top: '2%', bottom: '2%', left: '15%', right: '25%',
                    symbolSize: 16,
                    label: { ...kgOption.series[0].label, fontSize: 16 },
                    initialTreeDepth: -1,
                  }]
                }} 
                style={{ height: '100%', width: '100%' }} 
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
