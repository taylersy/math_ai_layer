import * as fs from 'fs';
import { CURRICULUM_BNU } from './frontend/src/curriculum';

// 工具：生成带 BOM 的 CSV 文件
const writeCsvWithBom = (filename: string, headers: string[], rows: any[]) => {
  const BOM = '\uFEFF';
  const csvContent = [
    headers.join(','),
    ...rows.map(row => headers.map(h => row[h] ?? '').join(','))
  ].join('\n');
  
  fs.writeFileSync(filename, BOM + csvContent, { encoding: 'utf-8' });
};

// 工具：随机生成成绩和等第
const getRandomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomChoice = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const zxw_exams = [
  {"name": "第一次月考", "date": "3月28日"},
  {"name": "期中考试", "date": "4月25日"},
  {"name": "第二次月考", "date": "5月20日"},
  {"name": "期末考试", "date": "6月28日"}
];

const processBook = (book: any) => {
  const zyrl_headers = ["学号", "姓名"];
  const zxw_headers = ["学号", "姓名", ...zxw_exams.map(e => `${e.name}(${e.date})`)];
  
  let dateCounter = 1;

  book.chapters.forEach((chap: any) => {
    // 自动为章节分配日期
    chap.date = `4月${dateCounter++}日`;
    chap.sections.forEach((sec: any) => {
      zyrl_headers.push(`${sec.name}_作业等级`);
      zyrl_headers.push(`${sec.name}_课堂任务单`);
      zyrl_headers.push(`${sec.name}_改错情况`);
    });
    zyrl_headers.push(`${chap.name}_单元检测成绩(${chap.date})`);
  });

  const zyrl_rows: any[] = [];
  const zxw_rows: any[] = [];

  for (let i = 1; i <= 30; i++) {
    const student_id = i.toString().padStart(2, '0');
    const name = `测试学生${student_id}`;
    const zyrl_row: any = { "学号": student_id, "姓名": name };
    const zxw_row: any = { "学号": student_id, "姓名": name };
    
    const base_ability = randomChoice(["high", "medium", "low"]);

    book.chapters.forEach((chap: any) => {
      chap.sections.forEach((sec: any) => {
        const is_anomaly = Math.random() < 0.05;
        const is_missing = Math.random() < 0.02;

        if (is_missing) {
          zyrl_row[`${sec.name}_作业等级`] = "";
          zyrl_row[`${sec.name}_课堂任务单`] = "";
          zyrl_row[`${sec.name}_改错情况`] = "";
        } else {
          if (base_ability === "high") {
            zyrl_row[`${sec.name}_作业等级`] = is_anomaly ? "C" : randomChoice(["A+", "A", "A-"]);
            zyrl_row[`${sec.name}_课堂任务单`] = randomChoice(["优秀", "良好"]);
            zyrl_row[`${sec.name}_改错情况`] = randomChoice(["优秀", "良好"]);
          } else if (base_ability === "medium") {
            zyrl_row[`${sec.name}_作业等级`] = randomChoice(["A-", "B+", "B", "B-"]);
            zyrl_row[`${sec.name}_课堂任务单`] = randomChoice(["良好", "合格"]);
            zyrl_row[`${sec.name}_改错情况`] = randomChoice(["良好", "合格"]);
          } else {
            zyrl_row[`${sec.name}_作业等级`] = is_anomaly ? "A" : randomChoice(["B-", "C", "未交"]);
            zyrl_row[`${sec.name}_课堂任务单`] = randomChoice(["合格", "不合格", "未交"]);
            zyrl_row[`${sec.name}_改错情况`] = randomChoice(["合格", "未改错"]);
          }
        }
      });
      
      let test_score = 0;
      if (base_ability === "high") test_score = getRandomInt(130, 150);
      else if (base_ability === "medium") test_score = getRandomInt(100, 129);
      else test_score = getRandomInt(60, 99);
        
      zyrl_row[`${chap.name}_单元检测成绩(${chap.date})`] = test_score;
    });

    zyrl_rows.push(zyrl_row);

    zxw_exams.forEach((exam) => {
      let score = 0;
      if (base_ability === "high") score = getRandomInt(130, 150);
      else if (base_ability === "medium") score = getRandomInt(100, 129);
      else score = getRandomInt(60, 99);
      
      if (Math.random() < 0.05) score -= getRandomInt(15, 30);
      zxw_row[`${exam.name}(${exam.date})`] = score;
    });

    zxw_rows.push(zxw_row);
  }

  writeCsvWithBom(`全学段数据_${book.name}_作业日历.csv`, zyrl_headers, zyrl_rows);
  writeCsvWithBom(`全学段数据_${book.name}_智学网.csv`, zxw_headers, zxw_rows);
  console.log(`Generated data for ${book.name}`);
};

CURRICULUM_BNU.forEach(processBook);
console.log("All data generated successfully.");
