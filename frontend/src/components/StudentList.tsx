import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { getStudentMetrics } from '../utils/studentMetrics';

interface StudentData {
  id: string;
  name: string;
  tier_level: string;
  base_l_score: number;
  anomaly_s_score: number;
  anomaly_details: any;
  progression?: any[];
  knowledgeGraph?: any[];
}

interface Props {
  students: StudentData[];
  selectedId: string | null;
  onSelect: (s: StudentData) => void;
  selectedBookId?: string;
}

const TIER_COLORS: Record<string, string> = {
  '反思层': 'bg-green-500/20 text-green-400 border-green-500/30',
  '表达层': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  '运用层': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  '理解层': 'bg-red-500/20 text-red-400 border-red-500/30',
};

export const StudentList: React.FC<Props> = ({ students, selectedId, onSelect, selectedBookId }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const tiers = ['反思层', '表达层', '运用层', '理解层'];

  // 预先计算所有学生的动态指标并按搜索条件过滤
  const mappedStudents = students
    .filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.id.toLowerCase().includes(searchTerm.toLowerCase()))
    .map(s => {
      const metrics = getStudentMetrics(s, selectedBookId);
      return { ...s, dynamicTier: metrics.tier, dynamicScore: metrics.lScore };
    });

  return (
    <div className="flex flex-col h-full bg-surface-dark/60 rounded-2xl border border-gray-800/80 overflow-hidden backdrop-blur-xl">
      <div className="p-4 border-b border-gray-800/80 bg-gray-900/40">
        <h2 className="text-lg font-bold text-gray-200 mb-3">班级名册 (动态分层)</h2>
        <div className="relative">
          <input
            type="text"
            placeholder="搜索学生姓名..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-800/50 border border-gray-700/50 text-gray-200 text-sm rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:border-primary/50 transition-colors"
          />
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-6 custom-scrollbar">
        {tiers.map(tier => {
          const tierStudents = mappedStudents.filter(s => s.dynamicTier === tier);
          if (tierStudents.length === 0) return null;
          return (
            <div key={tier} className="px-2">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 pl-2">
                {tier} ({tierStudents.length})
              </h3>
              <div className="space-y-1.5">
                {tierStudents.map(s => (
                  <button
                    key={s.id}
                    onClick={() => onSelect(s)}
                    className={`w-full text-left flex items-center justify-between p-3 rounded-xl transition-all duration-300 border ${
                      selectedId === s.id
                        ? 'bg-gray-800/80 border-primary/50 shadow-[0_0_15px_rgba(59,130,246,0.15)]'
                        : 'bg-transparent border-transparent hover:bg-gray-800/40 hover:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border ${TIER_COLORS[s.dynamicTier]}`}>
                          {s.name.slice(-2)}
                        </div>
                        {s.anomaly_s_score < -0.5 && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-surface-dark animate-pulse" />
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-200">{s.name}</div>
                        <div className="text-xs text-gray-500">L基底: {s.dynamicScore}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
