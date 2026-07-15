import csv
import random

# 定义北师大版八年级下册数学的章节与小节
chapters = {
    "第一章 三角形的证明": ["1.1 等腰三角形", "1.2 直角三角形", "1.3 线段的垂直平分线", "1.4 角平分线"],
    "第二章 一元一次不等式与一元一次不等式组": ["2.1 不等关系", "2.2 不等式的基本性质", "2.3 不等式的解集", "2.4 一元一次不等式", "2.5 一元一次不等式与一次函数", "2.6 一元一次不等式组"],
    "第三章 图形的平移与旋转": ["3.1 图形的平移", "3.2 图形的旋转", "3.3 中心对称"],
    "第四章 因式分解": ["4.1 因式分解", "4.2 提公因式法", "4.3 公式法"],
    "第五章 分式与分式方程": ["5.1 认识分式", "5.2 分式的乘除法", "5.3 分式的加减法", "5.4 分式方程"],
    "第六章 平行四边形": ["6.1 平行四边形的性质", "6.2 平行四边形的判定", "6.3 三角形的中位线", "6.4 多边形的内角和与外角和"]
}

grades = ["A+", "A", "A-", "B+", "B", "B-", "C", "未交"]
tasks = ["优秀", "良好", "合格", "不合格", "未交"]
corrections = ["优秀", "良好", "合格", "未改错"]

headers = ["学号"]
for chap_name, sections in chapters.items():
    for sec in sections:
        headers.append(f"{sec}_作业等级")
        headers.append(f"{sec}_课堂任务单")
        headers.append(f"{sec}_改错情况")
    headers.append(f"{chap_name}_单元检测成绩")

# 生成 50 名学生的数据
rows = []
for i in range(1, 51):
    student_id = f"{i:02d}"
    row = {"学号": student_id}
    
    # 模拟学生的基底能力：优秀、中等、较弱
    base_ability = random.choice(["high", "medium", "low"])
    
    for chap_name, sections in chapters.items():
        chap_score = 0
        for sec in sections:
            # 加入一些异常波动和缺失值 (脏数据)
            is_anomaly = random.random() < 0.05
            is_missing = random.random() < 0.02
            
            if is_missing:
                row[f"{sec}_作业等级"] = ""
                row[f"{sec}_课堂任务单"] = ""
                row[f"{sec}_改错情况"] = ""
            else:
                if base_ability == "high":
                    row[f"{sec}_作业等级"] = random.choice(["A+", "A", "A-"]) if not is_anomaly else "C"
                    row[f"{sec}_课堂任务单"] = random.choice(["优秀", "良好"])
                    row[f"{sec}_改错情况"] = random.choice(["优秀", "良好"])
                elif base_ability == "medium":
                    row[f"{sec}_作业等级"] = random.choice(["A-", "B+", "B", "B-"])
                    row[f"{sec}_课堂任务单"] = random.choice(["良好", "合格"])
                    row[f"{sec}_改错情况"] = random.choice(["良好", "合格"])
                else:
                    row[f"{sec}_作业等级"] = random.choice(["B-", "C", "未交"]) if not is_anomaly else "A"
                    row[f"{sec}_课堂任务单"] = random.choice(["合格", "不合格", "未交"])
                    row[f"{sec}_改错情况"] = random.choice(["合格", "未改错"])
        
        # 单元检测成绩 (满分150)
        if base_ability == "high":
            test_score = random.randint(130, 150)
        elif base_ability == "medium":
            test_score = random.randint(100, 129)
        else:
            test_score = random.randint(60, 99)
            
        row[f"{chap_name}_单元检测成绩"] = str(test_score)
        
    rows.append(row)

with open("八下数学全册学情数据_透视表格式.csv", "w", encoding="utf-8-sig", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=headers)
    writer.writeheader()
    writer.writerows(rows)

print("Data generated successfully.")
