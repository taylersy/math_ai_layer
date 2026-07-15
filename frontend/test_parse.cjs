const fs = require('fs');
const Papa = require('papaparse');

const csv = fs.readFileSync('/Users/taylersy/project/math_ai_layer/学生学情数据_二次函数_按节拆分_带脏数据.csv', 'utf-8');
const results = Papa.parse(csv, { header: true });

const gradeMap = { 'A+': 100, 'A': 95, 'A-': 90, 'B+': 85, 'B': 80, 'B-': 75, 'C': 60, '未交': 0 };
const taskMap = { '优秀': 100, '良好': 85, '合格': 70, '不合格': 40, '未交': 0 };
const correctionMap = { '优秀': 100, '良好': 85, '合格': 70, '未改错': 0 };

const studentMap = new Map();

results.data.forEach(row => {
  const id = row['学号']?.toString() || row['id'];
  if (!id) return;
  
  let sectionIdx = -1;
  const subSection = row['具体小节'] || '';
  if (subSection.includes('2.1')) sectionIdx = 0;
  else if (subSection.includes('2.2')) sectionIdx = 1;
  else if (subSection.includes('2.3')) sectionIdx = 2;
  else if (subSection.includes('2.4')) sectionIdx = 3;
  else if (subSection.includes('2.5')) sectionIdx = 4;

  if (sectionIdx === -1) return;

  let scoreCount = 0;
  let totalScore = 0;

  const hw = row['作业等级'];
  if (hw && gradeMap[hw] !== undefined) { totalScore += gradeMap[hw]; scoreCount++; }

  const task = row['课堂任务单'];
  if (task && taskMap[task] !== undefined) { totalScore += taskMap[task]; scoreCount++; }

  const correction = row['改错情况'];
  if (correction && correctionMap[correction] !== undefined) { totalScore += correctionMap[correction]; scoreCount++; }

  const testScore = row['本章单元检测成绩'];
  if (testScore && !isNaN(Number(testScore))) {
    totalScore += (Number(testScore) / 150) * 100;
    scoreCount++;
  }

  const finalSectionScore = scoreCount > 0 ? totalScore / scoreCount : null;

  if (!studentMap.has(id)) {
    studentMap.set(id, [null, null, null, null, null]);
  }
  studentMap.get(id)[sectionIdx] = finalSectionScore;
});

const students = Array.from(studentMap.entries()).map(([id, scores]) => ({
  id,
  name: `学生_${id}`,
  scores
})).filter(s => s.scores.some(v => v !== null));

console.log("Total students mapped:", students.length);
if (students.length > 0) {
  console.log("First student scores:", students[0].scores);
}
