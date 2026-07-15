import { Matrix, SVD } from 'ml-matrix';

export interface SectionScore {
  sectionName: string;
  score: number | null;
  taskGrade?: string | null;
  hwGrade?: string | null;
  correctionGrade?: string | null;
}

export interface ChapterScore {
  chapterName: string;
  sections: SectionScore[];
  unitTest?: any;
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
  sScore: number;
  tier: string;
  progressionEvent?: string;
}

export interface MathEngineResult {
  id: string;
  name: string;
  tier_level: string;
  base_l_score: number;
  anomaly_s_score: number;
  anomaly_details: any;
  progression: ChapterProgression[];
  knowledgeGraph: { chapterName: string, nodes: KnowledgeNode[], unitTest?: any }[];
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
  
  const studentFeatures = [];
  let minL = Infinity;
  let maxL = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;

  for (let i = 0; i < M.rows; i++) {
    let lSum = 0;
    let negS_sum = 0;
    let minAnomaly = 0;
    let anomalyCol = -1;
    const lVector = [];

    for (let j = 0; j < M.columns; j++) {
      lSum += L.get(i, j);
      const sVal = S_matrix.get(i, j);
      if (sVal < 0) {
        // Mean squared negative anomaly penalizes large unexpected drops
        negS_sum += sVal * sVal; 
      }
      if (sVal < minAnomaly) {
        minAnomaly = sVal;
        anomalyCol = j;
      }
      lVector.push(Math.round(L.get(i, j) * 100) / 100);
    }
    
    const lAvg = lSum / M.columns;
    const vVal = Math.sqrt(negS_sum / M.columns); // RMSE of negative anomalies (Volatility)

    studentFeatures.push({
      lAvg,
      vVal,
      minAnomaly,
      anomalyCol,
      lVector
    });

    if (lAvg < minL) minL = lAvg;
    if (lAvg > maxL) maxL = lAvg;
    if (vVal < minV) minV = vVal;
    if (vVal > maxV) maxV = vVal;
  }

  const lRange = maxL - minL || 1;
  const vRange = maxV - minV || 1;

  // 定义二维 L-S 空间的语义聚类锚点 (Normalized space: L, V)
  const centroids = [
    { tier: '理解层', l: 0.1, v: 0.2 }, // 基础极度薄弱且稳定的差（概念模糊）
    { tier: '运用层', l: 0.5, v: 0.9 }, // 基础中等但极其不稳定（会例题但不会迁移）
    { tier: '表达层', l: 0.7, v: 0.3 }, // 基础较好且较为稳定（能独立解题但稍欠火候）
    { tier: '反思层', l: 0.9, v: 0.1 }  // 基础极好且极其稳定（具备规律总结与元认知能力）
  ];

  const results = [];
  for (let i = 0; i < students.length; i++) {
    const feature = studentFeatures[i];
    const lNorm = (feature.lAvg - minL) / lRange;
    const vNorm = (feature.vVal - minV) / vRange;

    let minDistance = Infinity;
    let assignedTier = '理解层';

    for (const c of centroids) {
      // 欧式距离聚类分类
      const dist = Math.sqrt(Math.pow(lNorm - c.l, 2) + Math.pow(vNorm - c.v, 2));
      if (dist < minDistance) {
        minDistance = dist;
        assignedTier = c.tier;
      }
    }

    const sectionTiers = [];
    const sVector = [];
    const progressionEvents = [];
    const TIER_LEVELS = ['理解层', '运用层', '表达层', '反思层'];
    const baseTierIdx = TIER_LEVELS.indexOf(assignedTier);

    for (let j = 0; j < M.columns; j++) {
      const sVal = S_matrix.get(i, j);
      sVector.push(Math.round(sVal * 100) / 100);
      
      let drop = 0;
      if (sVal < -25) drop = 3;
      else if (sVal < -15) drop = 2;
      else if (sVal < -8) drop = 1;

      let localTierIdx = Math.max(0, baseTierIdx - drop);
      let event = undefined;

      // 方案三：动态课堂进阶机制 (Scaffolding Fading)
      const secData = students[i].chapters[chapIdx].sections[j];
      
      // 1. 课堂任务完成得好 -> 具备升层潜力 (跃迁)
      if (secData.taskGrade) {
        if (localTierIdx === 0 && ['优秀', '良好', '合格', 'A+', 'A', 'A-', 'B+', 'B'].includes(secData.taskGrade)) {
          localTierIdx += 1;
          event = '🌟 课中跃迁：表现达标，升入运用层';
        } else if (localTierIdx === 1 && ['优秀', '良好', 'A+', 'A', 'A-', 'B+'].includes(secData.taskGrade)) {
          localTierIdx += 1;
          event = '🌟 课中跃迁：表现良好，升入表达层';
        } else if (localTierIdx === 2 && ['优秀', 'A+', 'A'].includes(secData.taskGrade)) {
          localTierIdx += 1;
          event = '🌟 课中跃迁：表现极佳，升入反思层';
        }
      }
      
      // 2. 作业完成得不好 -> 没有巩固住 -> 打回原形或降级
      if (secData.hwGrade) {
        if (localTierIdx === 3 && ['B', 'B-', 'C', '不合格', '未交'].includes(secData.hwGrade)) {
          localTierIdx -= 1;
          event = event ? '⚠️ 跃迁回落：作业未能稳固最高层' : '📉 课后预警：作业表现一般，降入表达层';
        } else if (localTierIdx === 2 && ['B-', 'C', '不合格', '未交'].includes(secData.hwGrade)) {
          localTierIdx -= 1;
          event = event ? '⚠️ 跃迁回落：作业未能稳固进阶' : '📉 课后预警：作业表现不佳，降入运用层';
        } else if (localTierIdx === 1 && ['C', '不合格', '未交'].includes(secData.hwGrade)) {
          localTierIdx -= 1;
          event = event ? '⚠️ 跃迁回落：作业未能及格，打回原形' : '📉 课后预警：作业不合格，降入理解层';
        }
      }

      sectionTiers.push(TIER_LEVELS[localTierIdx]);
      progressionEvents.push(event);
    }

    results.push({
      tier: assignedTier,
      lAvg: Math.round(feature.lAvg * 100) / 100,
      minAnomaly: Math.round(feature.minAnomaly * 100) / 100,
      anomalyCol: feature.anomalyCol,
      rawScores: imputedData[i].map(v => Math.round(v * 100) / 100),
      lVector: feature.lVector,
      sVector,
      sectionTiers,
      progressionEvents
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
        lScore: res.lVector[idx],
        sScore: res.sVector[idx],
        tier: res.sectionTiers[idx],
        progressionEvent: res.progressionEvents[idx]
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
