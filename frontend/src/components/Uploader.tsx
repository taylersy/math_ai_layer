import React, { useState } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { CURRICULUM_BNU } from '../curriculum';

interface UploaderProps {
  onUploadSuccess: () => void;
  selectedBookId: string;
  teacherId: string;
}

export const Uploader: React.FC<UploaderProps> = ({ onUploadSuccess, selectedBookId, teacherId }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const processData = async (data: any[], source: string) => {
    try {
      setLoading(true);
      setError('');
      
      if (selectedBookId === 'all') throw new Error('上传数据前请先选择具体的教材版本（不可在“全景”模式下上传）。');

      const book = CURRICULUM_BNU.find(b => b.id === selectedBookId);
      if (!book) throw new Error('未找到教材配置');

      const students = [];

      if (source === 'calendar') {
        const gradeMap: Record<string, number> = { 'A+': 100, 'A': 95, 'A-': 90, 'B+': 85, 'B': 80, 'B-': 75, 'C': 60, '未交': 0 };
        const taskMap: Record<string, number> = { '优秀': 100, '良好': 85, '合格': 70, '不合格': 40, '未交': 0 };
        const correctionMap: Record<string, number> = { '优秀': 100, '良好': 85, '合格': 70, '未改错': 0 };

        for (const row of data) {
          const idKey = Object.keys(row).find(k => k.includes('学号') || k.toLowerCase().includes('id'));
          const nameKey = Object.keys(row).find(k => k.includes('姓名') || k.toLowerCase().includes('name'));
          const id = idKey ? row[idKey]?.toString() : undefined;
          if (!id) continue;

          const studentData = {
            id,
            name: nameKey ? row[nameKey] : `学生_${id}`,
            chapters: [] as any[]
          };

          for (const chapter of book.chapters) {
            const chapData: any = {
              chapterName: chapter.name,
              sections: [] as any[]
            };

            for (const sec of chapter.sections) {
              let scoreCount = 0;
              let totalScore = 0;

              const hw = row[`${sec.name}_作业等级`];
              if (hw && gradeMap[hw] !== undefined) { totalScore += gradeMap[hw]; scoreCount++; }

              const task = row[`${sec.name}_课堂任务单`];
              if (task && taskMap[task] !== undefined) { totalScore += taskMap[task]; scoreCount++; }

              const correction = row[`${sec.name}_改错情况`];
              if (correction && correctionMap[correction] !== undefined) { totalScore += correctionMap[correction]; scoreCount++; }

              // 提取带日期的单元检测成绩
              const testKey = Object.keys(row).find(k => k.startsWith(`${chapter.name}_单元检测成绩`));
              if (testKey) {
                const dateMatch = testKey.match(/\((.*?)\)/);
                const testScore = row[testKey];
                if (testScore && !isNaN(Number(testScore))) {
                  totalScore += (Number(testScore) / 150) * 100;
                  scoreCount++;
                  chapData.unitTest = {
                    name: `${chapter.name}测验`,
                    date: dateMatch ? dateMatch[1] : '',
                    score: Number(testScore)
                  };
                }
              }

              chapData.sections.push({
                sectionName: sec.name,
                score: scoreCount > 0 ? totalScore / scoreCount : null
              });
            }
            studentData.chapters.push(chapData);
          }
          students.push(studentData);
        }
      } else if (source === 'zhixue') {
        for (const row of data) {
          const idKey = Object.keys(row).find(k => k.includes('学号') || k.toLowerCase().includes('id'));
          const nameKey = Object.keys(row).find(k => k.includes('姓名') || k.toLowerCase().includes('name'));
          const id = idKey ? row[idKey]?.toString() : undefined;
          if (!id) continue;
          
          const exams = [];
          for (const key of Object.keys(row)) {
            const match = key.match(/(.*?)\((.*?)\)/);
            if (match && !key.includes('学号') && !key.includes('姓名')) {
              const score = row[key];
              if (score && !isNaN(Number(score))) {
                exams.push({
                  name: match[1],
                  date: match[2],
                  score: Number(score)
                });
              }
            }
          }
          students.push({ id, name: nameKey ? row[nameKey] : `学生_${id}`, exams });
        }
      }

      if (students.length === 0) throw new Error('未解析到有效数据，请检查文件内容或表头是否包含“学号”');

      const url = source === 'calendar' ? 'http://localhost:8787/api/upload/zyrl' : 'http://localhost:8787/api/upload/zxw';
      
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherId, students })
      });

      if (!res.ok) throw new Error('上传失败');
      
      onUploadSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, source: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        complete: (results) => processData(results.data, source),
        error: (err) => setError(err.message)
      });
    } else {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        processData(data, source);
      };
      reader.readAsBinaryString(file);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
      <div className="relative group rounded-2xl border-2 border-dashed border-primary/50 bg-surface-dark p-10 text-center hover:border-primary transition-all duration-300">
        <input 
          type="file" 
          accept=".csv,.xlsx,.xls" 
          onChange={(e) => handleFileUpload(e, 'calendar')}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
        <Upload className="w-12 h-12 text-primary mx-auto mb-4 group-hover:scale-110 transition-transform" />
        <h3 className="text-xl font-bold text-white mb-2">上传“作业日历”数据</h3>
        <p className="text-gray-400 text-sm">支持 CSV/Excel 格式 (过程性数据)</p>
      </div>

      <div className="relative group rounded-2xl border-2 border-dashed border-secondary/50 bg-surface-dark p-10 text-center hover:border-secondary transition-all duration-300">
        <input 
          type="file" 
          accept=".csv,.xlsx,.xls" 
          onChange={(e) => handleFileUpload(e, 'zhixue')}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
        <FileSpreadsheet className="w-12 h-12 text-secondary mx-auto mb-4 group-hover:scale-110 transition-transform" />
        <h3 className="text-xl font-bold text-white mb-2">上传“智学网”数据</h3>
        <p className="text-gray-400 text-sm">支持 CSV/Excel 格式 (统考总结性数据)</p>
      </div>

      {loading && <div className="col-span-2 text-center text-primary animate-pulse">正在利用 Math Engine 清洗与提纯数据...</div>}
      {error && <div className="col-span-2 text-center text-red-500">{error}</div>}
    </div>
  );
};
