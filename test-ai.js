// 测试AI API调用
const API_URL = 'http://127.0.0.1:3100/v1/chat/completions';

const payload = {
  messages: [
    { role: 'user', content: '你好' }
  ],
  max_tokens: 50,
  temperature: 0.7
};

const fs = require('fs');
const { execSync } = require('child_process');

// 写入临时文件
const tempFile = `test-${Date.now()}.json`;
fs.writeFileSync(tempFile, JSON.stringify(payload));

try {
  // 使用文件方式发送
  const cmd = `curl.exe -X POST "${API_URL}" -H "Content-Type: application/json" -H "X-Model-ID: deepseek-r1" --data @"${tempFile}"`;
  console.log('执行命令:', cmd);
  
  const result = execSync(cmd, { encoding: 'utf8', timeout: 30000 });
  console.log('响应:', result);
  
  try {
    const json = JSON.parse(result);
    console.log('解析成功:', json);
  } catch (e) {
    console.log('解析失败:', e.message);
  }
} catch (e) {
  console.log('执行失败:', e.message);
  console.log('输出:', e.stdout || e.stderr);
} finally {
  try { fs.unlinkSync(tempFile); } catch {}
}