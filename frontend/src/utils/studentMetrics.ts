import { CURRICULUM_BNU } from '../curriculum';

export interface StudentData {
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

export const getStudentMetrics = (student: StudentData, selectedBookId?: string): { lScore: number, tier: string } => {
  // If 'all' is selected or no specific book is selected, use the global latest score from the backend
  if (!selectedBookId || selectedBookId === 'all') {
    return { lScore: student.base_l_score, tier: student.tier_level };
  }

  const book = CURRICULUM_BNU.find(b => b.id === selectedBookId);
  if (!book) {
    return { lScore: student.base_l_score, tier: student.tier_level };
  }

  const bookChapterNames = book.chapters.map(c => c.name);
  const relevantChapters = (student.knowledgeGraph || []).filter(c => bookChapterNames.includes(c.chapterName));

  if (relevantChapters.length === 0) {
    // If the student has completely no data for this specific book, 
    // we can either return a fallback or 0. Since the system treats missing data as something needing a fallback,
    // let's fallback to the global base_l_score to prevent everything showing up as 0 and breaking the UI tiering.
    // However, conceptually, returning undefined or a default value might be better. 
    // Let's use base_l_score as a fallback approximation.
    return { lScore: student.base_l_score, tier: student.tier_level };
  }

  let totalScore = 0;
  let validScores = 0;

  relevantChapters.forEach(chap => {
    chap.nodes.forEach((n: any) => {
      if (n.lScore !== undefined && n.lScore !== null) {
        totalScore += n.lScore;
        validScores++;
      }
    });
  });

  if (validScores === 0) {
    return { lScore: student.base_l_score, tier: student.tier_level };
  }

  const avg = Number((totalScore / validScores).toFixed(1));
  let tier = '理解层';
  if (avg >= 85) tier = '反思层';
  else if (avg >= 75) tier = '表达层';
  else if (avg >= 65) tier = '运用层';

  return { lScore: avg, tier };
};
