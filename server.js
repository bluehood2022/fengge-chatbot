// 加载环境变量（本地开发需要，Vercel 会自动注入环境变量）
require('dotenv').config();

const express = require('express');
const path = require('path');
const { loadSkill, loadKnowledgeBase } = require('./skill-loader');

const app = express();

// 动态加载峰哥 skill - 独立部署，不依赖 MCP 服务
const skillPath = path.join(__dirname, 'fengge-roleplay', 'SKILL.md');
const knowledgeBasePath = path.join(__dirname, 'fengge-roleplay', 'knowledge_base');

// 加载 skill 和知识库
const fenggeSkill = loadSkill(skillPath);
const knowledgeBase = loadKnowledgeBase(knowledgeBasePath);

// 使用 skill 中的系统提示词
const FENGGE_SYSTEM_PROMPT = fenggeSkill.systemPrompt;

console.log(`✅ 已加载 Skill: ${fenggeSkill.name} v${fenggeSkill.version}`);
console.log(`📚 知识库分类：${Object.keys(knowledgeBase).join(', ')}`);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 调用 DeepSeek API（非流式）
async function callDeepSeekAPI(userMessage) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: FENGGE_SYSTEM_PROMPT },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DeepSeek API error: ${error}`);
  }

  const data = await response.json();
  return {
    reply: data.choices[0].message.content
  };
}

// 调用 DeepSeek Reasoner API（流式）- 展示思考过程
async function streamDeepSeekAPI(userMessage, onChunk) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  
  // 调试：检查环境变量
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
        { role: 'system', content: FENGGE_SYSTEM_PROMPT },
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

// API 路由 - 非流式
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: '请输入问题' });
    }

    const result = await callDeepSeekAPI(message);
    res.json({ 
      reply: result.reply 
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: '峰哥暂时无法回答，请稍后再试' });
  }
});

// API 路由 - 流式输出（Server-Sent Events）
app.post('/api/chat/stream', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: '请输入问题' });
    }

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // 流式处理 DeepSeek API 响应
    await streamDeepSeekAPI(message, (chunk) => {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    });

    // 发送结束标记
    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error) {
    console.error('Stream Error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', content: error.message })}\n\n`);
    res.end();
  }
});

// Vercel Serverless 导出
module.exports = app;

// 本地开发时启动服务器
if (process.env.VERCEL !== '1') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`峰哥解答万物已启动！`);
    console.log(`访问 http://localhost:${PORT} 开始聊天`);
    console.log(`流式输出端点：/api/chat/stream`);
  });
}