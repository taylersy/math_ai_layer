import React, { useState, useEffect } from 'react';
import { Uploader } from './components/Uploader';
import { StudentList } from './components/StudentList';
import { StudentProfile } from './components/StudentProfile';
import { ChatSession } from './components/ChatSession';
import { ClassTaskRec } from './components/ClassTaskRec';
import { HomeworkRec } from './components/HomeworkRec';
import { MacroAnalysis } from './components/MacroAnalysis';
import { Activity, LayoutDashboard, Settings, BookOpen, User } from 'lucide-react';
import { CURRICULUM_BNU } from './curriculum';

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

function App() {
  const [currentView, setCurrentView] = useState<'dashboard' | 'macro' | 'task' | 'homework'>('dashboard');
  const [teacherId, setTeacherId] = useState<string>('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  const [students, setStudents] = useState<StudentData[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentData | null>(null);
  const [showUploader, setShowUploader] = useState(true);
  const [selectedBookId, setSelectedBookId] = useState('8b');

  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const fetchStudents = async () => {
    if (!teacherId) return;
    try {
      const res = await fetch(`http://localhost:8787/api/students?teacherId=${teacherId}`);
      const data = await res.json();
      if (data.data && data.data.length > 0) {
        setStudents(data.data);
        if (selectedStudent) {
          const updated = data.data.find((s: any) => s.id === selectedStudent.id);
          if (updated) setSelectedStudent(updated);
        }
        setShowUploader(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (isLoggedIn) fetchStudents();
  }, [isLoggedIn, selectedBookId]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!teacherId.trim() || !password.trim()) {
      setLoginError('请输入账号和密码');
      return;
    }

    try {
      const endpoint = isRegisterMode ? '/api/register' : '/api/login';
      const res = await fetch(`http://localhost:8787${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherId, password })
      });
      const data = await res.json();
      if (data.success) {
        setIsLoggedIn(true);
      } else {
        setLoginError(data.error || '验证失败');
      }
    } catch (e: any) {
      setLoginError('服务器连接失败');
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0b1120] text-gray-200">
        <form onSubmit={handleAuth} className="bg-surface-dark/80 p-8 rounded-2xl border border-gray-800 backdrop-blur-xl w-96 text-center shadow-2xl">
          <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center border border-primary/30 mx-auto mb-6">
            <Activity className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-2">常态化教研平台</h1>
          <p className="text-gray-400 text-sm mb-6">老师端入口</p>
          
          <input 
            type="text"
            placeholder="老师账号名称"
            className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-3 mb-4 text-white focus:outline-none focus:border-primary transition-colors"
            value={teacherId}
            onChange={e => setTeacherId(e.target.value)}
            autoFocus
          />
          <input 
            type="password"
            placeholder="密码"
            className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-3 mb-4 text-white focus:outline-none focus:border-primary transition-colors"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
          
          {loginError && <div className="text-red-400 text-sm mb-4">{loginError}</div>}

          <button type="submit" className="w-full bg-primary hover:bg-blue-600 text-white font-bold py-3 rounded-lg transition-colors">
            {isRegisterMode ? '注 册' : '登 录'}
          </button>

          <div className="mt-4 text-sm text-gray-500">
            {isRegisterMode ? '已有账号？' : '没有账号？'}
            <button 
              type="button" 
              className="text-primary hover:underline ml-1"
              onClick={() => { setIsRegisterMode(!isRegisterMode); setLoginError(''); }}
            >
              {isRegisterMode ? '去登录' : '立即注册'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#0b1120] text-gray-200 font-sans overflow-hidden bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(59,130,246,0.15),rgba(255,255,255,0))]">
      {/* Navbar */}
      <nav className="h-14 border-b border-gray-800/80 bg-surface-dark/40 backdrop-blur-md flex-shrink-0 flex items-center justify-between px-6 z-50">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center border border-primary/30">
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            Math-AI 动态分层智能体
          </span>
          <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
            常态教研版
          </span>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 bg-gray-900/50 border border-gray-700 rounded-lg p-1">
            <button 
              onClick={() => setCurrentView('dashboard')}
              className={`px-3 py-1 text-sm rounded-md font-bold transition-colors ${currentView === 'dashboard' ? 'bg-primary text-white' : 'text-gray-400 hover:text-gray-200'}`}
            >
              全景画像
            </button>
            <button 
              onClick={() => setCurrentView('macro')}
              className={`px-3 py-1 text-sm rounded-md font-bold transition-colors ${currentView === 'macro' ? 'bg-primary text-white' : 'text-gray-400 hover:text-gray-200'}`}
            >
              宏观学情分析
            </button>
            <button 
              onClick={() => setCurrentView('task')}
              className={`px-3 py-1 text-sm rounded-md font-bold transition-colors ${currentView === 'task' ? 'bg-primary text-white' : 'text-gray-400 hover:text-gray-200'}`}
            >
              分层课堂任务推荐
            </button>
            <button 
              onClick={() => setCurrentView('homework')}
              className={`px-3 py-1 text-sm rounded-md font-bold transition-colors ${currentView === 'homework' ? 'bg-primary text-white' : 'text-gray-400 hover:text-gray-200'}`}
            >
              分层课后作业推荐
            </button>
          </div>
          
          <div className="flex items-center space-x-2 bg-gray-900/50 border border-gray-700 rounded-lg px-3 py-1">
            <BookOpen className="w-4 h-4 text-gray-400" />
            <select 
              className="bg-transparent text-sm text-gray-200 focus:outline-none cursor-pointer"
              value={selectedBookId}
              onChange={(e) => setSelectedBookId(e.target.value)}
            >
              {CURRICULUM_BNU.map(book => (
                <option key={book.id} value={book.id} className="bg-gray-800">
                  北师大版 - {book.name}
                </option>
              ))}
              <option value="all" className="bg-gray-800 font-bold text-primary">★ 全学段总览 (3年全景)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center space-x-6 text-sm font-medium text-gray-400">
          {currentView === 'dashboard' && (
            <button onClick={() => setShowUploader(!showUploader)} className="flex items-center hover:text-white transition-colors">
              <LayoutDashboard className="w-4 h-4 mr-1.5" /> 数据中枢
            </button>
          )}
          <div className="flex items-center text-gray-300">
            <User className="w-4 h-4 mr-1.5" /> {teacherId}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 relative overflow-hidden flex flex-col">
        
        {currentView === 'dashboard' && (
          <>
            {/* Uploader Overlay */}
            <div className={`transition-all duration-500 ease-in-out ${showUploader ? 'h-auto opacity-100 p-6' : 'h-0 opacity-0 overflow-hidden py-0'}`}>
              <div className="max-w-4xl mx-auto bg-surface-dark/80 backdrop-blur-xl border border-gray-800/80 rounded-2xl shadow-2xl">
                <Uploader onUploadSuccess={fetchStudents} selectedBookId={selectedBookId} teacherId={teacherId} />
              </div>
            </div>

            {/* Three Column Layout */}
            <div className="flex-1 flex overflow-hidden p-6 pt-2 space-x-6">
              {/* Left: Class Roster */}
              <div className="w-80 flex-shrink-0">
                <StudentList 
                  students={students} 
                  selectedId={selectedStudent?.id || null} 
                  onSelect={setSelectedStudent} 
                />
              </div>

              {/* Middle: Student Profile */}
              <div className="flex-1 flex flex-col min-w-0">
                <StudentProfile student={selectedStudent} selectedBookId={selectedBookId} />
              </div>

              {/* Right: AI Chat */}
              <div className="w-[450px] flex-shrink-0">
                <ChatSession student={selectedStudent} />
              </div>
            </div>
          </>
        )}

        {currentView === 'macro' && (
          <div className="flex-1 flex overflow-hidden p-6">
            <MacroAnalysis students={students} teacherId={teacherId} />
          </div>
        )}

        {currentView === 'task' && (
          <div className="flex-1 flex overflow-hidden p-6">
            <ClassTaskRec teacherId={teacherId} students={students} />
          </div>
        )}

        {currentView === 'homework' && (
          <div className="flex-1 flex overflow-hidden p-6">
            <HomeworkRec teacherId={teacherId} students={students} />
          </div>
        )}

      </main>
    </div>
  );
}

export default App;
