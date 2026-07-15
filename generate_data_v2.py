import csv
import random

# 定义北师大版八年级下册数学的章节与小节
chapters = {
    "第一章 三角形的证明": { "sections": ["1.1 等腰三角形", "1.2 直角三角形", "1.3 线段的垂直平分线", "1.4 角平分线"], "date": "3月15日" },
    "第二章 一元一次不等式与一元一次不等式组": { "sections": ["2.1 不等关系", "2.2 不等式的基本性质", "2.3 不等式的解集", "2.4 一元一次不等式", "2.5 一元一次不等式与一次函数", "2.6 一元一次不等式组"], "date": "4月10日" },
    "第三章 图形的平移与旋转": { "sections": ["3.1 图形的平移", "3.2 图形的旋转", "3.3 中心对称"], "date": "4月20日" },
    "第四章 因式分解": { "sections": ["4.1 因式分解", "4.2 提公因式法", "4.3 公式法"], "date": "5月10日" },
    "第五章 分式与分式方程": { "sections": ["5.1 认识分式", "5.2 分式的乘除法", "5.3 分式的加减法", "5.4 分式方程"], "date": "6月5日" },
    "第六章 平行四边形": { "sections": ["6.1 平行四边形的性质", "6.2 平行四边形的判定", "6.3 三角形的中位线", "6.4 多边形的内角和与外角和"], "date": "6月20日" }
}

zxw_exams = [
    {"name": "第一次月考", "date": "3月28日"},
    {"name": "期中考试", "date": "4月25日"},
    {"name": "第二次月考", "date": "5月20日"},
    {"name": "期末考试", "date": "6月28日"}
]

grades = ["A+", "A", "A-", "B+", "B", "B-", "C", "未交"]
tasks = ["优秀", "良好", "合格", "不合格", "未交"]
corrections = ["优秀", "良好", "合格", "未改错"]

zyrl_headers = ["学号"]
for chap_name, chap_info in chapters.items():
    for sec in chap_info["sections"]:
        zyrl_headers.append(f"{sec}_作业等级")
        zyrl_headers.append(f"{sec}_课堂任务单")
        zyrl_headers.append(f"{sec}_改错情况")
    zyrl_headers.append(f"{chap_name}_单元检测成绩({chap_info['date']})")

zxw_headers = ["学号"]
for exam in zxw_exams:
    zxw_headers.append(f"{exam['name']}({exam['date']})")

zyrl_rows = []
zxw_rows = []

for i in range(1, 51):
    student_id = f"{i:02d}"
    zyrl_row = {"学号": student_id}
    zxw_row = {"学号": student_id}
    
    # 基底能力
    base_ability = random.choice(["high", "medium", "low"])
    
    # 填充作业日历
    for chap_name, chap_info in chapters.items():
        for sec in chap_info["sections"]:
            is_anomaly = random.random() < 0.05
            is_missing = random.random() < 0.02
            
            if is_missing:
                zyrl_row[f"{sec}_作业等级"] = ""
                zyrl_row[f"{sec}_课堂任务单"] = ""
                zyrl_row[f"{sec}_改错情况"] = ""
            else:
                if base_ability == "high":
                    zyrl_row[f"{sec}_作业等级"] = random.choice(["A+", "A", "A-"]) if not is_anomaly else "C"
                    zyrl_row[f"{sec}_课堂任务单"] = random.choice(["优秀", "良好"])
                    zyrl_row[f"{sec}_改错情况"] = random.choice(["优秀", "良好"])
                elif base_ability == "medium":
                    zyrl_row[f"{sec}_作业等级"] = random.choice(["A-", "B+", "B", "B-"])
                    zyrl_row[f"{sec}_课堂任务单"] = random.choice(["良好", "合格"])
                    zyrl_row[f"{sec}_改错情况"] = random.choice(["良好", "合格"])
                else:
                    zyrl_row[f"{sec}_作业等级"] = random.choice(["B-", "C", "未交"]) if not is_anomaly else "A"
                    zyrl_row[f"{sec}_课堂任务单"] = random.choice(["合格", "不合格", "未交"])
                    zyrl_row[f"{sec}_改错情况"] = random.choice(["合格", "未改错"])
        
        # 单元检测成绩 (满分150)
        if base_ability == "high":
            test_score = random.randint(130, 150)
        elif base_ability == "medium":
            test_score = random.randint(100, 129)
        else:
            test_score = random.randint(60, 99)
            
        zyrl_row[f"{chap_name}_单元检测成绩({chap_info['date']})"] = str(test_score)
        
    zyrl_rows.append(zyrl_row)

    # 填充智学网
    for exam in zxw_exams:
        if base_ability == "high":
            score = random.randint(130, 150)
        elif base_ability == "medium":
            score = random.randint(100, 129)
        else:
            score = random.randint(60, 99)
        # 引入少量大考失常
        if random.random() < 0.05:
            score -= random.randint(15, 30)
        zxw_row[f"{exam['name']}({exam['date']})"] = str(score)
    zxw_rows.append(zxw_row)

with open("八下数学全册学情数据_作业日历.csv", "w", encoding="utf-8-sig", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=zyrl_headers)
    writer.writeheader()
    writer.writerows(zyrl_rows)

with open("八下智学网考试数据.csv", "w", encoding="utf-8-sig", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=zxw_headers)
    writer.writeheader()
    writer.writerows(zxw_rows)

print("Both ZYRL and ZXW Data generated successfully.")
