/**
 * AI歌词生成模块
 * 调用本地AI模型自动生成歌词、风格和题目
 */

const API_URL = 'http://127.0.0.1:3100/v1/chat/completions';

const LYRIC_PROMPT = `你是一位专业的音乐词作家。请为以下音乐风格创作一首原创歌词。

要求：
1. 歌词要意境优美，情感真挚
2. 结构清晰，包含[Verse 1..Verse 4][Chorus][Bridge][Outro]，标签不是固定结构，你需要根据音乐风格和歌词内容来调整标签顺序
3. 每段歌词要有画面感
4. 歌词长度适中，适合2-3分钟歌曲
5. 不要包含任何版权歌词或已知名歌词的复制

请直接输出歌词内容，不要解释。`;

const STYLE_PROMPT = `你是一位专业的音乐制作人。请为刚才的歌曲创作音乐风格描述。

要求：
1. 使用英文描述
2. 包含主要乐器（如有）
3. 包含音乐流派和氛围
4. 风格描述要简洁，控制在100字符以内
5. 不要包含艺人名字

请直接输出风格描述，不要解释。`;

const TITLE_PROMPT = `你是一位专业的音乐策划人。请为刚才的歌词创作一个歌曲标题。

要求：
1. 标题要简洁，2-5个字
2. 要有诗意和意境
3. 能准确反映歌曲的情感主题
4. 中文标题

请直接输出标题，不要解释。`;

function callAI(modelId, messages, maxTokens = 1000, temperature = 0.8) {
  const payload = { messages, max_tokens: maxTokens, temperature };
  
  const https = require('https');
  const http = require('http');
  const url = new URL(API_URL);
  const protocol = url.protocol === 'https:' ? https : http;
  
  return new Promise((resolve, reject) => {
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Model-ID': modelId,
        'Content-Length': Buffer.byteLength(JSON.stringify(payload))
      }
    };
    
    console.log(`   📝 模型: ${modelId}`);
    console.log(`   📝 API: ${API_URL}`);
    
    const req = protocol.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        console.log(`   📝 响应状态: ${res.statusCode}`);
        console.log(`   📝 响应内容: ${data.substring(0, 100)}...`);
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch (e) {
          reject(new Error(`JSON解析失败: ${e.message}`));
        }
      });
    });
    
    req.on('error', (e) => {
      console.log(`   📝 请求错误: ${e.message}`);
      reject(new Error(`API请求失败: ${e.message}`));
    });
    
    req.write(JSON.stringify(payload));
    req.end();
  });
}

function extractContent(response) {
  if (response.choices && response.choices[0] && response.choices[0].message) {
    const content = response.choices[0].message.content;
    if (content) {
      return content.trim();
    }
    throw new Error('AI返回了空内容');
  }
  throw new Error(`AI响应格式错误: ${JSON.stringify(response)}`);
}

async function generateLyric(topic, style = '中国风') {
  console.log(`   🎤 正在生成歌词（主题：${topic}）...`);
  const messages = [
    { role: 'user', content: LYRIC_PROMPT + ` 请为以下风格的歌曲创作歌词：${style}，主题：${topic}` }
  ];
  const response = await callAI('bendi', messages, 2000, 0.8);
  return extractContent(response);
}

async function generateStyle(lyric, title) {
  console.log(`   🎸 正在生成风格描述...`);
  const messages = [
    { role: 'user', content: STYLE_PROMPT  }
  ];
  const response = await callAI('bendi', messages, 200, 0.7);
  return extractContent(response);
}

async function generateTitle(lyric) {
  console.log(`   📝 正在生成歌曲标题...`);
  const messages = [
    { role: 'user', content: TITLE_PROMPT }
  ];
  const response = await callAI('bendi', messages, 50, 0.9);
  return extractContent(response);
}

async function generateMusicContent(topic, style = '中国风') {
  console.log('');
  console.log('🤖 ╔════════════════════════════════════╗');
  console.log('   ║    AI 歌词创作模式                 ║');
  console.log('   ╚════════════════════════════════════╝');
  console.log('');
  
  const lyric = await generateLyric(topic, style);
  //等待1秒，确保歌词生成完成，避免标题生成失败
  await sleep(1000);
  const title = await generateTitle(lyric);
  //等待1秒，确保标题生成完成，避免风格描述生成失败
  await sleep(1000);
  const styleDesc = await generateStyle(lyric, title);
  
  console.log('');
  console.log('✅ ═══════════════════════════════════════');
  console.log('   AI 创作完成！');
  console.log('═══════════════════════════════════════');
  console.log('');
  console.log(`📝 标题：${title}`);
  console.log(`🎸 风格：${styleDesc}`);
  console.log(`📄 歌词：\n${lyric}`);
  console.log('');
  
  return {
    title,
    style: styleDesc,
    lyric
  };
}
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
module.exports = { generateMusicContent, generateLyric, generateStyle, generateTitle };