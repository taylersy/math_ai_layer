import csv
import random
import os

CURRICULUM = {
    '7a': {
        'name': '七年级上册',
        'chapters': {
            '第一章 丰富的图形世界': ['1.1 生活中的立体图形', '1.2 展开与折叠', '1.3 截一个几何体', '1.4 从三个方向看物体的形状'],
            '第二章 有理数及其运算': ['2.1 有理数', '2.2 数轴', '2.3 绝对值', '2.4 有理数的加法', '2.5 有理数的减法'],
            '第三章 整式及其加减': ['3.1 字母表示数', '3.2 代数式', '3.3 整式', '3.4 整式的加减'],
            '第四章 基本平面图形': ['4.1 线段、射线、直线', '4.2 比较线段的长短', '4.3 角', '4.4 角的比较', '4.5 多边形和圆的初步认识'],
            '第五章 一元一次方程': ['5.1 认识一元一次方程', '5.2 求解一元一次方程', '5.3 应用一元一次方程'],
            '第六章 数据的收集与整理': ['6.1 数据的收集', '6.2 普查和抽样调查', '6.3 数据的表示']
        }
    },
    '7b': {
        'name': '七年级下册',
        'chapters': {
            '第一章 整式的乘除': ['1.1 同底数幂的乘法', '1.2 幂的乘方与积的乘方', '1.3 同底数幂的除法', '1.4 整式的乘法', '1.5 平方差公式', '1.6 完全平方公式', '1.7 整式的除法'],
            '第二章 相交线与平行线': ['2.1 两条直线的位置关系', '2.2 探索直线平行的条件', '2.3 平行线的性质', '2.4 用尺规作角'],
            '第三章 变量之间的关系': ['3.1 用表格表示的变量间关系', '3.2 用关系式表示的变量间关系', '3.3 用图象表示的变量间关系'],
            '第四章 三角形': ['4.1 认识三角形', '4.2 图形的全等', '4.3 探索三角形全等的条件', '4.4 用尺规作三角形'],
            '第五章 生活中的轴对称': ['5.1 轴对称现象', '5.2 探索轴对称的性质', '5.3 简单的轴对称图形'],
            '第六章 概率初步': ['6.1 感受可能性', '6.2 频率的稳定性', '6.3 等可能事件的概率']
        }
    },
    '8a': {
        'name': '八年级上册',
        'chapters': {
            '第一章 勾股定理': ['1.1 探索勾股定理', '1.2 一定是直角三角形吗', '1.3 勾股定理的应用'],
            '第二章 实数': ['2.1 认识无理数', '2.2 平方根', '2.3 立方根', '2.4 估算', '2.5 用计算器开方', '2.6 实数', '2.7 二次根式'],
            '第三章 位置与坐标': ['3.1 确定位置', '3.2 平面直角坐标系', '3.3 轴对称与坐标变化'],
            '第四章 一次函数': ['4.1 函数', '4.2 一次函数与正比例函数', '4.3 一次函数的图象', '4.4 一次函数的应用'],
            '第五章 二元一次方程组': ['5.1 认识二元一次方程组', '5.2 求解二元一次方程组', '5.3 应用二元一次方程组', '5.4 二元一次方程与一次函数'],
            '第六章 数据的分析': ['6.1 平均数', '6.2 中位数与众数', '6.3 从折线统计图可以看出什么', '6.4 数据的离散程度'],
            '第七章 平行线的证明': ['7.1 为什么要证明', '7.2 定义与命题', '7.3 平行线的判定', '7.4 平行线的性质', '7.5 三角形内角和定理']
        }
    },
    '8b': {
        'name': '八年级下册',
        'chapters': {
            '第一章 三角形的证明': ['1.1 等腰三角形', '1.2 直角三角形', '1.3 线段的垂直平分线', '1.4 角平分线'],
            '第二章 一元一次不等式与一元一次不等式组': ['2.1 不等关系', '2.2 不等式的基本性质', '2.3 不等式的解集', '2.4 一元一次不等式', '2.5 一元一次不等式与一次函数', '2.6 一元一次不等式组'],
            '第三章 图形的平移与旋转': ['3.1 图形的平移', '3.2 图形的旋转', '3.3 中心对称'],
            '第四章 因式分解': ['4.1 因式分解', '4.2 提公因式法', '4.3 公式法'],
            '第五章 分式与分式方程': ['5.1 认识分式', '5.2 分式的乘除法', '5.3 分式的加减法', '5.4 分式方程'],
            '第六章 平行四边形': ['6.1 平行四边形的性质', '6.2 平行四边形的判定', '6.3 三角形的中位线', '6.4 多边形的内角和与外角和']
        }
    },
    '9a': {
        'name': '九年级上册',
        'chapters': {
            '第一章 特殊平行四边形': ['1.1 菱形的性质与判定', '1.2 矩形的性质与判定', '1.3 正方形的性质与判定'],
            '第二章 一元二次方程': ['2.1 认识一元二次方程', '2.2 用配方法求解一元二次方程', '2.3 用公式法求解一元二次方程', '2.4 用因式分解法求解一元二次方程', '2.5 一元二次方程的根与系数的关系', '2.6 应用一元二次方程'],
            '第三章 概率的进一步认识': ['3.1 用树状图或表格求概率', '3.2 用频率估计概率'],
            '第四章 图形的相似': ['4.1 成比例线段', '4.2 平行线分线段成比例', '4.3 相似多边形', '4.4 探索三角形相似的条件', '4.5 相似三角形判定定理的证明', '4.6 利用相似三角形测高', '4.7 相似三角形的性质', '4.8 图形的位似'],
            '第五章 投影与视图': ['5.1 投影', '5.2 视图'],
            '第六章 反比例函数': ['6.1 反比例函数', '6.2 反比例函数的图象与性质', '6.3 反比例函数的应用']
        }
    },
    '9b': {
        'name': '九年级下册',
        'chapters': {
            '第一章 直角三角形的边角关系': ['1.1 锐角三角函数', '1.2 30度、45度、60度角的三角函数值', '1.3 三角函数的计算', '1.4 解直角三角形', '1.5 三角函数的应用'],
            '第二章 二次函数': ['2.1 二次函数', '2.2 二次函数的图象与性质', '2.3 确定二次函数的表达式', '2.4 二次函数的应用', '2.5 二次函数与一元二次方程'],
            '第三章 圆': ['3.1 圆', '3.2 圆的对称性', '3.3 垂径定理', '3.4 圆心角和圆周角', '3.5 确定圆的条件', '3.6 直线和圆的位置关系', '3.7 切线长定理', '3.8 圆内接正多边形', '3.9 弧长及扇形的面积']
        }
    }
}

zxw_exams = [
    {"name": "第一次月考", "date": "3月28日"},
    {"name": "期中考试", "date": "4月25日"},
    {"name": "第二次月考", "date": "5月20日"},
    {"name": "期末考试", "date": "6月28日"}
]

baselines = {}
try:
    with open("八下数学全册学情数据_作业日历.csv", "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            sid = row.get("学号", "")
            if not sid: continue
            scores = [int(v) for k,v in row.items() if "成绩" in k and str(v).isdigit()]
            avg = sum(scores)/len(scores) if scores else 0
            
            if avg >= 130: b = "high"
            elif avg >= 100: b = "medium"
            else: b = "low"
            baselines[sid] = {'base': b, 'avg_8b': avg, 'type': 'normal'}
except Exception as e:
    print("WARNING: Could not find base data. Creating random baseline.")
    for i in range(1, 51):
        sid = f"{i:02d}"
        avg = random.randint(60, 150)
        if avg >= 130: b = "high"
        elif avg >= 100: b = "medium"
        else: b = "low"
        baselines[sid] = {'base': b, 'avg_8b': avg, 'type': 'normal'}

sids = list(baselines.keys())
if len(sids) > 5:
    drop_candidates = [s for s in sids if baselines[s]['base'] in ['high', 'medium']]
    for c in drop_candidates[:2]: baselines[c]['type'] = 'sudden_drop'
    
    bloom_candidates = [s for s in sids if baselines[s]['base'] == 'high' and baselines[s]['type'] == 'normal']
    for c in bloom_candidates[:2]: baselines[c]['type'] = 'late_bloomer'
        
    decline_candidates = [s for s in sids if baselines[s]['base'] == 'low' and baselines[s]['type'] == 'normal']
    for c in decline_candidates[:2]: baselines[c]['type'] = 'gradual_decline'

def get_performance(sid, grade_level):
    info = baselines[sid]
    t = info['type']
    
    diff_adj = {7: 15, 8: 0, 9: -15}[grade_level]
    
    if t == 'sudden_drop':
        if grade_level == 7: return "high", 135
        if grade_level == 8: return "medium", 115
        if grade_level == 9: return "low", 70
        
    if t == 'late_bloomer':
        if grade_level == 7: return "low", 90
        if grade_level == 8: return "high", 135
        if grade_level == 9: return "high", 145
        
    if t == 'gradual_decline':
        if grade_level == 7: return "high", 130
        if grade_level == 8: return "low", 85
        if grade_level == 9: return "low", 60

    base_score = info['avg_8b']
    target_score = base_score + diff_adj
    target_score = max(50, min(150, target_score))
    
    if target_score >= 125: return "high", target_score
    if target_score >= 100: return "medium", target_score
    return "low", target_score

def generate_book_data(book_id, book_info):
    grade = int(book_id[0])
    
    zyrl_headers = ["学号", "姓名"]
    for chap_name, sections in book_info["chapters"].items():
        for sec in sections:
            zyrl_headers.append(f"{sec}_作业等级")
            zyrl_headers.append(f"{sec}_课堂任务单")
            zyrl_headers.append(f"{sec}_改错情况")
        zyrl_headers.append(f"{chap_name}_单元检测成绩(测试)")
        
    zxw_headers = ["学号", "姓名"]
    for exam in zxw_exams:
        zxw_headers.append(f"{exam['name']}({exam['date']})")
        
    zyrl_rows = []
    zxw_rows = []
    
    for sid in baselines.keys():
        zyrl_row = {"学号": sid, "姓名": f"测试学生{sid}"}
        zxw_row = {"学号": sid, "姓名": f"测试学生{sid}"}
        
        perf_level, center_score = get_performance(sid, grade)
        
        for chap_name, sections in book_info["chapters"].items():
            for sec in sections:
                is_anomaly = random.random() < 0.05
                is_missing = random.random() < 0.02
                
                if is_missing:
                    zyrl_row[f"{sec}_作业等级"] = "未交"
                    zyrl_row[f"{sec}_课堂任务单"] = "未交"
                    zyrl_row[f"{sec}_改错情况"] = "未改错"
                else:
                    if perf_level == "high":
                        zyrl_row[f"{sec}_作业等级"] = random.choice(["A+", "A", "A-"]) if not is_anomaly else "C"
                        zyrl_row[f"{sec}_课堂任务单"] = random.choice(["优秀", "良好"])
                        zyrl_row[f"{sec}_改错情况"] = random.choice(["优秀", "良好"])
                    elif perf_level == "medium":
                        zyrl_row[f"{sec}_作业等级"] = random.choice(["A-", "B+", "B", "B-"])
                        zyrl_row[f"{sec}_课堂任务单"] = random.choice(["良好", "合格"])
                        zyrl_row[f"{sec}_改错情况"] = random.choice(["良好", "合格"])
                    else:
                        zyrl_row[f"{sec}_作业等级"] = random.choice(["B-", "C", "未交"]) if not is_anomaly else "A"
                        zyrl_row[f"{sec}_课堂任务单"] = random.choice(["合格", "不合格", "未交"])
                        zyrl_row[f"{sec}_改错情况"] = random.choice(["合格", "未改错"])
                        
            score = int(random.gauss(center_score, 8))
            score = max(30, min(150, score))
            zyrl_row[f"{chap_name}_单元检测成绩(测试)"] = str(score)
            
        zyrl_rows.append(zyrl_row)
        
        for exam in zxw_exams:
            score = int(random.gauss(center_score, 10))
            score = max(30, min(150, score))
            if random.random() < 0.05: score -= random.randint(15, 30)
            zxw_row[f"{exam['name']}({exam['date']})"] = str(score)
            
        zxw_rows.append(zxw_row)
        
    return zyrl_headers, zyrl_rows, zxw_headers, zxw_rows

for bid, binfo in CURRICULUM.items():
    z_h, z_r, x_h, x_r = generate_book_data(bid, binfo)
    
    with open(f"全学段数据_{binfo['name']}_作业日历.csv", "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=z_h)
        writer.writeheader()
        writer.writerows(z_r)
        
    with open(f"全学段数据_{binfo['name']}_智学网.csv", "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=x_h)
        writer.writeheader()
        writer.writerows(x_r)
        
print("Successfully generated all books data.")
