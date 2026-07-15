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
你是一个基于数据驱动的苏格拉底式数学教育专家，正在与教师进行深度交流。
[Context]
目标学生 ID：${studentId}
该学生的近期综合真实能力基底(L矩阵估值)：${lScore}。
当前最新动态分层落点：【${tierLevel}】。
该生的历史跨章节层级跃迁轨迹：${progressionText}。
异常状态预警(S矩阵)：近期最大异常得分 ${sScore}，异常细节：${JSON.stringify(anomalyDetails)}。
[Task]
1. 教师正在通过聊天面板与你探讨该学生的学情。
2. 你需要结合该生的**层级跃迁轨迹**，提供更有前瞻性的微观诊断、个性化辅导建议或出具变式训练题。
3. 如果教师询问原因，你可以从概念混淆、运算粗心、迁移困难等角度推理。
4. 回复要专业、有温度，并且避免长篇大论，注重可操作性。
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
3. 获取数据后，仔细阅读返回的班级四维分层数据和全班平均 L 基底，基于这些真实的量化指标，输出宏观学情分析。

[Guidelines]
1. 请使用 Markdown 格式排版。
2. 切忌捏造数据！如果工具返回暂无数据，请直接告知教师当前学段/章节缺少数据。
3. 你的分析要专业、落地，重点放在不同分层级的最近发展区诊断和后续宏观组织策略上。
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
                description: "学段的标识符（例如: 7a, 7b, 8a, 8b, 9a, 9b）。如果是全学段传 'all'。"
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
              const book = CURRICULUM_BNU.find(b => b.id === bookId);
              if (book) {
                const validChapterNames = book.chapters.map(ch => ch.name);
                chapters = chapters.filter((c: any) => validChapterNames.includes(c.chapterName));
              }
            }
            if (chapterName && chapterName !== 'all') {
              chapters = chapters.filter((c: any) => c.chapterName === chapterName || c.chapterName.includes(chapterName));
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
1. **班级整体态势分析**：简述当前班级在理解、运用、表达、反思四个维度上的分布比例，分析班级整体的最近发展区处于什么位置。
2. **各层级诊断与教研建议**：
   - 针对理解层（关注概念混淆点）
   - 针对运用层（关注知识迁移）
   - 针对表达层（关注思维外显）
   - 针对反思层（关注元认知与规律总结）
3. **整体课堂组织策略建议**：如何在大班额背景下进行有效的分层教学组织。

【格式要求】
1. 请使用 Markdown 格式。
2. 语言要专业、落地，具有指导意义。
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
你需要生成一份高质量的《分层${typeStr}设计方案》。请严格按照以下要求生成内容：

【设计规范】
1. **理解层 (需要概念理解支持)**：学生表现为概念混淆、定义模糊。请提供“概念辨析${typeStr}”。
2. **运用层 (需要迁移运用支持)**：学生表现为能完成例题但迁移应用不足。请提供“变式训练${typeStr}”。
3. **表达层 (需要思维表达支持)**：学生表现为能独立解题但难以清晰表达。请提供“讲题交流${typeStr}”。
4. **反思层 (需要元认知支持)**：学生表现为缺乏方法概括与规律总结意识。请提供“规律总结${typeStr}”。

【格式要求】
1. 请使用 Markdown 格式。
2. 包含具体的数学题目（必须包含题目题干，紧扣当前节段的知识点）。
3. ⚠️绝对禁止⚠️使用多行空格或下划线拼凑的“字符画/ASCII艺术”来表示分数或公式！
4. 所有数学公式（包括分式、根式、指数等）必须、强制使用标准的 LaTeX 语法表示，绝不允许使用纯文本的 x/2 或 x^2，行内公式用 $...$，独立公式用 $$...$$。
5. 在每个分层设计下，附上简短的“教师辅导建议 (支架支持策略)”。
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
