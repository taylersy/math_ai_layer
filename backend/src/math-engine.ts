import { Matrix, SVD } from 'ml-matrix';

export interface SectionScore {
  sectionName: string;
  score: number | null;
}

export interface ChapterScore {
  chapterName: string;
  sections: SectionScore[];
}

export interface StudentData {
  id: string;
  name: string;
  chapters: ChapterScore[];
}

export interface ChapterProgression {
  chapterName: string;
  tier_level: string;
  lScore: number;
  sScore: number;
}

export interface KnowledgeNode {
  name: string;
  rawScore: number;
  lScore: number;
}

export interface MathEngineResult {
  id: string;
  name: string;
  tier_level: string;
  base_l_score: number;
  anomaly_s_score: number;
  anomaly_details: any;
  progression: ChapterProgression[];
  knowledgeGraph: { chapterName: string, nodes: KnowledgeNode[] }[];
}

function processMatrixForChapter(students: StudentData[], chapIdx: number) {
  // Extract scores for this specific chapter across all students
  const numFeatures = students[0].chapters[chapIdx].sections.length;
  if (numFeatures === 0) return null;

  const colMeans = new Array(numFeatures).fill(0);
  const colCounts = new Array(numFeatures).fill(0);
  let totalDataPoints = 0;

  // 1. MICE Approximation (Column Mean Imputation)
  for (const s of students) {
    const scores = s.chapters[chapIdx].sections.map(sec => sec.score);
    for (let j = 0; j < numFeatures; j++) {
      if (scores[j] !== null && scores[j] !== undefined) {
        colMeans[j] += scores[j] as number;
        colCounts[j]++;
        totalDataPoints++;
      }
    }
  }

  // 若全员该章都没有数据，跳过该章处理
  if (totalDataPoints === 0) return null;

  for (let j = 0; j < numFeatures; j++) {
    colMeans[j] = colCounts[j] > 0 ? colMeans[j] / colCounts[j] : 60; // default 60 if empty
  }

  const imputedData: number[][] = [];
  for (const s of students) {
    const scores = s.chapters[chapIdx].sections.map(sec => sec.score);
    const row = scores.map((val, j) => (val === null || val === undefined ? colMeans[j] : val));
    imputedData.push(row);
  }

  // 2. RPCA Approximation via truncated SVD
  const M = new Matrix(imputedData);
  const svd = new SVD(M, { computeLeftSingularVectors: true, computeRightSingularVectors: true, autoTranspose: true });
  
  const U = svd.leftSingularVectors;
  const S_diag = svd.diagonal;
  const V = svd.rightSingularVectors;
  
  const L = new Matrix(M.rows, M.columns);
  if (S_diag.length > 0) {
    for (let i = 0; i < M.rows; i++) {
      for (let j = 0; j < M.columns; j++) {
        L.set(i, j, U.get(i, 0) * S_diag[0] * V.get(j, 0));
      }
    }
  }

  const S_matrix = Matrix.sub(M, L);
  
  const lAverages = [];
  for (let i = 0; i < M.rows; i++) {
    let sum = 0;
    for (let j = 0; j < M.columns; j++) {
      sum += L.get(i, j);
    }
    lAverages.push(sum / M.columns);
  }
  
  const minL = Math.min(...lAverages);
  const maxL = Math.max(...lAverages);
  const range = maxL - minL || 1; 

  const results = [];
  for (let i = 0; i < students.length; i++) {
    const lAvg = lAverages[i];
    let tier = '理解层';
    if (lAvg >= minL + 0.75 * range) tier = '反思层';
    else if (lAvg >= minL + 0.5 * range) tier = '表达层';
    else if (lAvg >= minL + 0.25 * range) tier = '运用层';

    let minAnomaly = 0;
    let anomalyCol = -1;
    const lVector = [];
    
    for (let j = 0; j < M.columns; j++) {
      const sVal = S_matrix.get(i, j);
      if (sVal < minAnomaly) {
        minAnomaly = sVal;
        anomalyCol = j;
      }
      lVector.push(Math.round(L.get(i, j) * 100) / 100);
    }

    results.push({
      tier,
      lAvg: Math.round(lAvg * 100) / 100,
      minAnomaly: Math.round(minAnomaly * 100) / 100,
      anomalyCol,
      rawScores: imputedData[i].map(v => Math.round(v * 100) / 100),
      lVector
    });
  }

  return results;
}

export function processMathData(students: StudentData[]): MathEngineResult[] {
  if (students.length === 0 || students[0].chapters.length === 0) return [];

  const numChapters = students[0].chapters.length;
  
  // Array of arrays: chapterResults[chapIdx][studentIdx]
  const chapterResults = [];
  for (let c = 0; c < numChapters; c++) {
    chapterResults.push(processMatrixForChapter(students, c));
  }

  const finalResults: MathEngineResult[] = [];

  for (let i = 0; i < students.length; i++) {
    const student = students[i];
    const progression: ChapterProgression[] = [];
    const knowledgeGraph: { chapterName: string, nodes: KnowledgeNode[] }[] = [];
    
    let latestTier = '理解层';
    let latestLScore = 0;
    let latestSScore = 0;
    let anomalyDetails = null;

    for (let c = 0; c < numChapters; c++) {
      const chapName = student.chapters[c].chapterName;
      const res = chapterResults[c]?.[i];
      if (!res) continue;

      progression.push({
        chapterName: chapName,
        tier_level: res.tier,
        lScore: res.lAvg,
        sScore: res.minAnomaly
      });

      const nodes: KnowledgeNode[] = student.chapters[c].sections.map((sec, idx) => ({
        name: sec.sectionName,
        rawScore: res.rawScores[idx],
        lScore: res.lVector[idx]
      }));

      knowledgeGraph.push({ 
        chapterName: chapName, 
        nodes,
        unitTest: student.chapters[c].unitTest 
      });

      // Update latest properties
      latestTier = res.tier;
      latestLScore = res.lAvg;
      
      // Track the worst anomaly across all chapters for the alert
      if (res.minAnomaly < latestSScore) {
        latestSScore = res.minAnomaly;
        anomalyDetails = { chapterName: chapName, sectionName: student.chapters[c].sections[res.anomalyCol].sectionName, drop: res.minAnomaly };
      }
    }

    finalResults.push({
      id: student.id,
      name: student.name,
      tier_level: latestTier,
      base_l_score: latestLScore,
      anomaly_s_score: latestSScore,
      anomaly_details: anomalyDetails,
      progression,
      knowledgeGraph
    });
  }

  return finalResults;
}
