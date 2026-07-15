import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { processMathData, StudentData } from './math-engine'
import { CURRICULUM_BNU } from './curriculum'
import OpenAI from 'openai'

type Bindings = {
  KV: KVNamespace
  DEEPSEEK_API_KEY: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', cors())

async function getUsers(env: Bindings): Promise<Map<string, string>> {
  const data = await env.KV.get('users');
  if (!data) return new Map();
  return new Map(Object.entries(JSON.parse(data)));
}

async function saveUsers(env: Bindings, users: Map<string, string>) {
  await env.KV.put('users', JSON.stringify(Object.fromEntries(users)));
}

async function getDb(env: Bindings): Promise<Map<string, any>> {
  const data = await env.KV.get('db');
  if (!data) return new Map();
  return new Map(Object.entries(JSON.parse(data)));
}

async function saveDb(env: Bindings, db: Map<string, any>) {
  await env.KV.put('db', JSON.stringify(Object.fromEntries(db)));
}

app.post('/api/register', async (c) => {
  const { teacherId, password } = await c.req.json()
  if (!teacherId || !password) return c.json({ success: false, error: '缺少账号或密码' })
  const users = await getUsers(c.env)
  if (users.has(teacherId)) return c.json({ success: false, error: '该账号已存在，请直接登录' })
  users.set(teacherId, password)
  await saveUsers(c.env, users)
  return c.json({ success: true, teacherId })
})

app.post('/api/login', async (c) => {
  const { teacherId, password } = await c.req.json()
  const users = await getUsers(c.env)
  if (!users.has(teacherId)) return c.json({ success: false, error: '该账号不存在，请先注册' })
  if (users.get(teacherId) !== password) return c.json({ success: false, error: '密码错误' })
  return c.json({ success: true, teacherId })
})

app.post('/api/upload/zyrl', async (c) => {
  try {
    const { teacherId, students } = await c.req.json()
    if (!teacherId) throw new Error('Missing teacherId')

    const db = await getDb(c.env)

    for (const s of students) {
      const key = `${s.id}_${teacherId}`
      const existing = db.get(key) || { id: s.id, name: s.name, teacherId, zyrlData: [], zxwData: [] }
      
      // Merge zyrlData
      for (const newChap of s.chapters) {
        const idx = existing.zyrlData.findIndex((c: any) => c.chapterName === newChap.chapterName)
        if (idx !== -1) {
          existing.zyrlData[idx] = newChap
        } else {
          existing.zyrlData.push(newChap)
        }
      }
      db.set(key, existing)
    }

    await saveDb(c.env, db)

    return c.json({ success: true })
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500)
  }
})

app.post('/api/upload/zxw', async (c) => {
  try {
    const { teacherId, students } = await c.req.json()
    if (!teacherId) throw new Error('Missing teacherId')

    const db = await getDb(c.env)

    for (const s of students) {
      const key = `${s.id}_${teacherId}`
      const existing = db.get(key) || { id: s.id, name: s.name, teacherId, zyrlData: [], zxwData: [] }
      
      // Merge zxwData
      for (const newExam of s.exams) {
        const idx = existing.zxwData.findIndex((e: any) => e.name === newExam.name && e.date === newExam.date)
        if (idx !== -1) {
          existing.zxwData[idx] = newExam
        } else {
          existing.zxwData.push(newExam)
        }
      }
      db.set(key, existing)
    }

    await saveDb(c.env, db)

    return c.json({ success: true })
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500)
  }
})

app.get('/api/students', async (c) => {
  const teacherId = c.req.query('teacherId')
  if (!teacherId) return c.json({ data: [] })

  const db = await getDb(c.env)
  const teacherStudents = Array.from(db.values()).filter(s => s.teacherId === teacherId)
  
  // Format for Math Engine (only chapters from ZYRL)
  const mathEngineInput = teacherStudents
    .filter(s => s.zyrlData && s.zyrlData.length > 0)
    .map(s => ({
      id: s.id,
      name: s.name,
      chapters: s.zyrlData
    }))

  let results: any[] = []
  if (mathEngineInput.length > 0) {
    results = processMathData(mathEngineInput)
  } else {
    // If no ZYRL data, just return students with basic info and ZXW data
    results = teacherStudents.map(s => ({
      id: s.id,
      name: s.name,
      tier_level: '暂无',
      base_l_score: 0,
      anomaly_s_score: 0,
      anomaly_details: null,
      progression: [],
      knowledgeGraph: []
    }))
  }

  // Merge ZXW data back into the results
  const finalResults = results.map(r => {
    const orig = db.get(`${r.id}_${teacherId}`)
    return {
      ...r,
      zxwData: orig?.zxwData || []
    }
  })

  return c.json({ data: finalResults })
})

app.post('/api/analyze', async (c) => {
  const { studentId, tierLevel, lScore, sScore, anomalyDetails, messages, progression } = await c.req.json()

  try {
    if (!c.env.DEEPSEEK_API_KEY) {
      return c.json({ error: '请在 backend/.dev.vars 文件中配置 DEEPSEEK_API_KEY。' }, 401)
    }

    const openai = new OpenAI({
      apiKey: c.env.DEEPSEEK_API_KEY,
      baseURL: 'https://api.deepseek.com/v1'
    })

    const progressionText = progression ? progression.map((p: any) => `${p.chapterName}: ${p.tier_level}`).join(' -> ') : '暂无时序数据';

    const systemPrompt = `
[Role]
你是一位资深的初中数学教研专家兼“个性化学情智能体”。你擅长基于数据深度追踪学生的个性化学情，并为教师制定科学、合理的个性化学习任务。

[Context]
目标学生 ID：${studentId}
该学生的近期综合真实能力基底(L矩阵估值)：${lScore}。
当前最新动态分层落点：【${tierLevel}】。
该生的历史跨章节层级跃迁轨迹：${progressionText}。
异常状态预警(S矩阵)：近期最大异常得分 ${sScore}，异常细节：${JSON.stringify(anomalyDetails)}。

[Task]
教师正在与你探讨该学生的学情。请务必严格按照以下教研员专业模板进行回复，输出内容必须翔实、结构清晰、逻辑严密，并直接给出具体的学习任务。

【回复模板】（请严格按此结构输出，不要随意使用多余的星号加粗，保持排版清爽，可以使用标题和列表）：

### 一、 核心学情诊断
（基于学生的 L基底、S矩阵异常得分、以及历史层级跃迁轨迹，进行深度的微观归因分析，例如：知识漏洞、运算习惯、或思维定势，不少于100字）

### 二、 最近发展区突破策略
（基于上述诊断，结合该生的当前分层落点，指出本阶段急需解决的核心矛盾，以及具体的辅导切入点）

### 三、 个性化学习任务制定
（必须给出 1 到 2 道具体的、针对该生弱点的数学变式训练题。要求：必须有清晰的题目题干，公式必须使用标准的单行 LaTeX 语法如 $\\frac{a}{b}$，严禁使用任何形式的文本拼凑图形或分数线。并附带该题的“设计意图”与“教师点拨话术”。）
`
  
    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...(messages || [])
    ];

    const stream = await openai.chat.completions.create({
      model: 'deepseek-chat',
      messages: apiMessages,
      stream: true,
    })

    return new Response(
      new ReadableStream({
        async start(controller) {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || ''
            if (content) {
              controller.enqueue(new TextEncoder().encode(content))
            }
          }
          controller.close()
        }
      }),
      { headers: { 'Content-Type': 'text/event-stream' } }
    )
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

app.post('/api/chat/macro', async (c) => {
  const { teacherId, messages } = await c.req.json()

  try {
    if (!c.env.DEEPSEEK_API_KEY) {
      return c.json({ error: '请在 backend/.dev.vars 文件中配置 DEEPSEEK_API_KEY。' }, 401)
    }

    const openai = new OpenAI({
      apiKey: c.env.DEEPSEEK_API_KEY,
      baseURL: 'https://api.deepseek.com/v1'
    })

    const systemPrompt = `
[Role]
你是顶尖的初中数学教研专家。你正在为一线大班额课堂设计“动态分层个性化教学”的宏观学情诊断报告。
本研究的理论依据是“最近发展区理论”与“支架理论”。我们将学情动态分层界定为四个层次：理解层、运用层、表达层、反思层。

[Workflow]
1. 教师正在通过聊天面板向你询问关于班级的宏观学情。
2. 你必须基于教师的意图，决定是否需要调用工具 \`query_class_stats\` 去数据库中拉取数据。
   - 如果教师询问“八上整体学情”，则调用工具 \`bookId="8a"\`。
   - 如果教师询问“八下第一章学情”，则调用工具 \`bookId="8b", chapterName="第一章 三角形的证明"\`。
   - 如果教师仅模糊询问“九年级”、“八年级”等且未指定上下册，请默认推断为上册（例如调用 \`bookId="9a"\` 或 \`bookId="8a"\`）。
3. 获取数据后，仔细阅读返回的班级四维分层数据和全班平均 L 基底，基于这些真实的量化指标，输出宏观学情分析。

[Guidelines]
1. 请使用 Markdown 格式排版。请多使用清晰的 Markdown 表格来展示数据。
2. 切忌捏造数据！如果工具返回暂无数据，请直接告知教师当前学段/章节缺少数据。
3. 你的分析要专业、落地，重点放在不同分层级的最近发展区诊断和后续宏观组织策略上。请按照以下结构输出：
   - ### 一、班级整体数据画像
   - ### 二、四维分层精细化诊断（使用表格展示分层建议）
   - ### 三、宏观教学组织建议
`

    const tools: any = [
      {
        type: "function",
        function: {
          name: "query_class_stats",
          description: "从底层学情数据库中检索对应学段或章节的班级宏观数据（分层人数、平均 L 基底得分）",
          parameters: {
            type: "object",
            properties: {
              bookId: {
                type: "string",
                description: "学段的标识符（例如: 7a, 7b, 8a, 8b, 9a, 9b）。如果是全学段传 'all'。如果用户未明确上下册，请默认传上册（如 '9a'）。"
              },
              chapterName: {
                type: "string",
                description: "具体的章节名称（例如: 第一章 三角形的证明）。如果查询整个学段则省略或传 'all'。"
              }
            },
            required: ["bookId"]
          }
        }
      }
    ];

    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...(messages || [])
    ];

    // 第一轮对话：意图识别与工具调用
    const response = await openai.chat.completions.create({
      model: 'deepseek-chat',
      messages: apiMessages,
      tools: tools,
      tool_choice: 'auto'
    });

    const responseMessage = response.choices[0].message;
    
    // 如果大模型决定调用工具
    if (responseMessage.tool_calls) {
      apiMessages.push(responseMessage as any); // 将助手的工具调用加入历史

      for (const toolCall of responseMessage.tool_calls) {
        if (toolCall.function.name === 'query_class_stats') {
          const args = JSON.parse(toolCall.function.arguments);
          const { bookId, chapterName } = args;

          // ======= 执行数据库查询 =======
          const dbData = await getDb(c.env);
          const teacherStudents = Array.from(dbData.values()).filter(s => s.teacherId === teacherId);
          
          let filteredStudents = teacherStudents.map(s => {
            let chapters = s.zyrlData || [];
            if (bookId && bookId !== 'all') {
              let normalizedBookId = bookId;
              if (bookId === '7' || bookId === '七年级') normalizedBookId = '7a';
              if (bookId === '8' || bookId === '八年级') normalizedBookId = '8a';
              if (bookId === '9' || bookId === '九年级') normalizedBookId = '9a';
              
              const book = CURRICULUM_BNU.find(b => b.id === normalizedBookId);
              if (book) {
                const validChapterNames = book.chapters.map(ch => ch.name);
                chapters = chapters.filter((c: any) => validChapterNames.includes(c.chapterName));
              }
            }
            if (chapterName && chapterName !== 'all') {
              const normalizeStr = (str: string) => str.replace(/[\s的]/g, '');
              const normalizedQuery = normalizeStr(chapterName);
              chapters = chapters.filter((c: any) => {
                const normalizedTarget = normalizeStr(c.chapterName);
                return normalizedTarget.includes(normalizedQuery) || normalizedQuery.includes(normalizedTarget);
              });
            }
            return { id: s.id, name: s.name, chapters };
          }).filter(s => s.chapters.length > 0);

          const mathResults = processMathData(filteredStudents);

          // 统计数据
          let total = mathResults.length;
          let totalLScore = 0;
          let tiers: any = {};
          
          mathResults.forEach(r => {
            totalLScore += r.base_l_score || 0;
            const tier = r.tier_level;
            tiers[tier] = (tiers[tier] || 0) + 1;
          });

          let statsResult;
          if (total > 0) {
            statsResult = {
              total,
              avgLScore: Math.round(totalLScore / total),
              tiers,
              message: `成功提取该特定章节数据！总人数: ${total}。请依据此特定数据生成针对性报告。`
            };
          } else {
            // 如果所查章节没有数据，自动降级为查询全局基底数据
            let globalFiltered = teacherStudents.map(s => ({ id: s.id, name: s.name, chapters: s.zyrlData || [] })).filter(s => s.chapters.length > 0);
            const globalMath = processMathData(globalFiltered);
            let gTotal = globalMath.length;
            if (gTotal > 0) {
              let gLScore = 0;
              let gTiers: any = {};
              globalMath.forEach(r => { 
                gLScore += r.base_l_score || 0; 
                gTiers[r.tier_level] = (gTiers[r.tier_level] || 0) + 1; 
              });
              statsResult = {
                error: `你查询的特定章节/学段目前暂无学情数据（可能由于教师尚未录入该章节）。但是！我已经自动为你提取了该班级的【全局历史综合学情基底】，请基于此全局基底数据（L值和四维层级）以及你作为教研专家的先验知识，来推断和提供这节新课的宏观教学与备课建议：`,
                globalStats: {
                  total: gTotal,
                  avgLScore: Math.round(gLScore / gTotal),
                  tiers: gTiers
                }
              };
            } else {
              statsResult = { error: "该班级没有任何学情数据，请提示教师先上传数据。" };
            }
          }

          apiMessages.push({
            tool_call_id: toolCall.id,
            role: "tool",
            name: "query_class_stats",
            content: JSON.stringify(statsResult)
          } as any);
        }
      }

      // 第二轮对话：携带数据生成报告，开启流式输出
      const stream = await openai.chat.completions.create({
        model: 'deepseek-chat',
        messages: apiMessages,
        stream: true,
      });

      return new Response(
        new ReadableStream({
          async start(controller) {
            for await (const chunk of stream) {
              const content = chunk.choices[0]?.delta?.content || '';
              if (content) {
                controller.enqueue(new TextEncoder().encode(content));
              }
            }
            controller.close();
          }
        }),
        { headers: { 'Content-Type': 'text/event-stream' } }
      );
    } else {
      // 若大模型认为无需调工具，直接返回文本（例如闲聊）
      return new Response(
        new ReadableStream({
          start(controller) {
            const content = responseMessage.content || '';
            controller.enqueue(new TextEncoder().encode(content));
            controller.close();
          }
        }),
        { headers: { 'Content-Type': 'text/event-stream' } }
      );
    }

  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// === 废弃旧的 Macro API ===
app.post('/api/recommend', async (c) => {
  const { type, bookName, chapterName, sectionName, classStats } = await c.req.json()

  try {
    if (!c.env.DEEPSEEK_API_KEY) {
      return c.json({ error: '请在 backend/.dev.vars 文件中配置 DEEPSEEK_API_KEY。' }, 401)
    }

    const openai = new OpenAI({
      apiKey: c.env.DEEPSEEK_API_KEY,
      baseURL: 'https://api.deepseek.com/v1'
    })

    let typeStr = '';
    let systemPrompt = '';

    if (type === 'macro') {
      typeStr = '宏观学情诊断报告';
      systemPrompt = `
[Role]
你是顶尖的初中数学教研专家。你正在为一线大班额课堂设计“动态分层个性化教学”的${typeStr}。
本研究的理论依据是“最近发展区理论”与“支架理论”。我们将学情动态分层界定为四个层次：理解层、运用层、表达层、反思层。

[Context]
当前班级学情分布：
- 总人数：${classStats.total}
- 理解层：${classStats.tiers['理解层'] || 0} 人
- 运用层：${classStats.tiers['运用层'] || 0} 人
- 表达层：${classStats.tiers['表达层'] || 0} 人
- 反思层：${classStats.tiers['反思层'] || 0} 人

[Task]
你需要基于上述的班级四维分层数据，生成一份高质量的《宏观班级学情诊断与教学策略报告》。请严格按照以下要求生成内容：

【设计规范】
1. **班级整体态势分析**：简述当前班级在四个维度上的分布比例，必须使用 Markdown 表格形式直观展现各层人数。
2. **各层级诊断与教研建议**：使用表格（表头为：层级 | 核心学情特征 | 最近发展区目标 | 专属突破策略）详细列出四个层级的应对策略。
3. **整体课堂组织策略建议**：给出大班额背景下的分层走班或小组合作方案。

【格式要求】
1. 请使用 Markdown 格式。所有的表格必须包含表头、分割线和数据行。
2. 语言要专业、落地，严禁废话，直接输出教研干货。
`;
    } else {
      typeStr = type === 'task' ? '课堂任务' : '课后作业';
      systemPrompt = `
[Role]
你是顶尖的初中数学教研专家。你正在为一线大班额课堂设计“动态分层个性化教学”的${typeStr}。
本研究的理论依据是“最近发展区理论”与“支架理论”。我们将学情动态分层界定为四个层次：理解层、运用层、表达层、反思层。

[Context]
当前教学进度：${bookName} - ${chapterName} - ${sectionName}
当前班级学情分布：
- 总人数：${classStats.total}
- 理解层：${classStats.tiers['理解层'] || 0} 人
- 运用层：${classStats.tiers['运用层'] || 0} 人
- 表达层：${classStats.tiers['表达层'] || 0} 人
- 反思层：${classStats.tiers['反思层'] || 0} 人

[Task]
你需要生成一份高度专业、美观、可以直接导出Word分发的《分层${typeStr}设计方案》。请严格按照以下结构输出：

### 一、 ${typeStr}整体设计理念
简述本次设计的知识点核心，以及为什么这样为班级四层学生进行分层设计。

### 二、 具体分层${typeStr}规划（核心表格）
请提供一个详细的 Markdown 表格，表头必须为：**目标层级 | 知识点聚焦 | 题目核心干货 | 教师辅导/点拨建议**。
每一行分别对应：
- **理解层**（关注概念混淆，提供“概念辨析题”）
- **运用层**（关注迁移应用，提供“变式训练题”）
- **表达层**（关注思维外显，提供“讲题交流题”）
- **反思层**（关注方法概括，提供“规律总结题”）

### 三、 题目明细与解析
在表格下方，分别列出四个层级对应的具体数学题目。

【格式要求】
1. 请使用严密的 Markdown 格式，表格必须结构完整，可以直接被转化为 Word 表格。
2. 包含具体的数学题目题干，紧扣《${sectionName}》的知识点。
3. ⚠️【严重警告】⚠️ 绝对禁止使用回车换行、空格、下划线、短横线等去拼凑上下两行的“字符画”分数或公式！
4. 所有数学公式（包括分式、根式、指数等）必须在一行内使用标准的 LaTeX 语法输出。例如：必须写成 $\\frac{x}{2}$ 或 $x^2$，绝不允许手工绘制。行内公式用 $...$，独立公式用 $$...$$。
`;
    }
  
    const stream = await openai.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'system', content: systemPrompt }],
      stream: true,
      temperature: 0.7
    })

    return new Response(
      new ReadableStream({
        async start(controller) {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || ''
            if (content) {
              controller.enqueue(new TextEncoder().encode(content))
            }
          }
          controller.close()
        }
      }),
      { headers: { 'Content-Type': 'text/event-stream' } }
    )
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

export default app
