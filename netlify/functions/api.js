// Netlify Function - 峰哥解答万物 API
const path = require('path');

// 峰哥 skill 内容（直接从文件读取）
function getSystemPrompt() {
  const fs = require('fs');
  // Netlify Functions 中，__dirname 是函数所在目录 /var/task
  // fengge-roleplay 和 skill-loader.js 现在在 netlify/functions/ 目录下
  const skillPath = path.join(__dirname, 'fengge-roleplay', 'SKILL.md');
  const knowledgeBasePath = path.join(__dirname, 'fengge-roleplay', 'knowledge_base');
  
  console.log('Reading skill from:', skillPath);
  console.log('Reading knowledge base from:', knowledgeBasePath);
  
  // 读取 SKILL.md
  const skillContent = fs.readFileSync(skillPath, 'utf-8');
  
  // 解析 system prompt（SKILL.md 格式：第一行是标题，第二行开始是内容）
  const lines = skillContent.split('\n');
  let systemPrompt = '';
  let inSystemPrompt = false;
  
  for (const line of lines) {
    if (line.startsWith('## ') || line.startsWith('# ')) {
      continue;
    }
    if (line.trim()) {
      systemPrompt += line + '\n';
    }
  }
  
  // 加载知识库
  const knowledgeBase = {};
  if (fs.existsSync(knowledgeBasePath)) {
    const files = fs.readdirSync(knowledgeBasePath);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const category = file.replace('.json', '');
        const content = fs.readFileSync(path.join(knowledgeBasePath, file), 'utf-8');
        knowledgeBase[category] = JSON.parse(content);
      }
    }
  }
  
  console.log(`✅ 已加载知识库分类：${Object.keys(knowledgeBase).join(', ')}`);
  
  return systemPrompt.trim();
}

// 缓存 system prompt
let FENGGE_SYSTEM_PROMPT = null;

function getSystemPromptCached() {
  if (!FENGGE_SYSTEM_PROMPT) {
    FENGGE_SYSTEM_PROMPT = getSystemPrompt();
  }
  return FENGGE_SYSTEM_PROMPT;
}

// 调用 DeepSeek Reasoner API（流式）
async function streamDeepSeekAPI(userMessage, onChunk) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  
  console.log('DEEPSEEK_API_KEY exists:', !!apiKey);
  console.log('DEEPSEEK_API_KEY length:', apiKey?.length);
  console.log('DEEPSEEK_API_KEY starts with sk-:', apiKey?.startsWith('sk-'));
  
  if (!apiKey || !apiKey.startsWith('sk-')) {
    throw new Error('Invalid DEEPSEEK_API_KEY: must start with sk-');
  }
  
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'deepseek-reasoner',
      messages: [
        { role: 'system', content: getSystemPromptCached() },
        { role: 'user', content: userMessage }
      ],
      stream: true,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DeepSeek API error: ${error}`);
  }

  // 处理流式响应
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('data: ')) {
        const data = trimmedLine.slice(6);
        if (data === '[DONE]') continue;

        try {
          const chunk = JSON.parse(data);
          const delta = chunk.choices[0]?.delta;
          
          // 发送思考过程
          if (delta?.reasoning_content) {
            onChunk({
              type: 'reasoning',
              content: delta.reasoning_content
            });
          }
          
          // 发送最终回答
          if (delta?.content) {
            onChunk({
              type: 'content',
              content: delta.content
            });
          }
        } catch (e) {
          // 忽略解析错误
        }
      }
    }
  }
}

// Netlify Function handler
exports.handler = async (event, context) => {
  // 只处理 POST 请求
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  // 处理流式输出
  if (event.path.includes('/stream')) {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
      body: await new Promise((resolve, reject) => {
        let result = '';
        
        streamDeepSeekAPI(JSON.parse(event.body).message, (chunk) => {
          result += `data: ${JSON.stringify(chunk)}\n\n`;
        })
        .then(() => {
          result += 'data: [DONE]\n\n';
          resolve(result);
        })
        .catch((error) => {
          console.error('Stream error:', error);
          resolve(`data: ${JSON.stringify({ type: 'error', content: error.message })}\n\n`);
        });
      }),
      isBase64Encoded: false
    };
  }

  // 处理非流式请求
  try {
    const { message } = JSON.parse(event.body);
    
    if (!message) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: '请输入问题' })
      };
    }

    let reply = '';
    
    await streamDeepSeekAPI(message, (chunk) => {
      if (chunk.type === 'content') {
        reply += chunk.content;
      }
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ reply })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: '峰哥暂时无法回答，请稍后再试' })
    };
  }
};