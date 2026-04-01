/**
 * Suno 中国风音乐一键创作脚本（测试版）
 * 使用硬编码歌词来测试流程
 */

const { execSync, exec } = require('child_process');
const path = require('path');

const CDP_PORT = 48840;
const SUNO_CREATE_URL = 'https://suno.com/create';
const SCREENSHOT_DIR = path.dirname(__filename);

// 测试用歌词配置
const MUSIC_CONFIG = {
  prompt: `《山水间》
作词：AI

主歌 A1：
青峦叠翠入云间，溪流潺潺绕山巅
古寺钟声远，林深听松风
石径通幽处，山花映人面
心若静如水，天地自悠然

主歌 A2：
日出东方照峰峦，云雾缭绕似仙境
飞鸟相与还，蝉鸣林愈静
竹杖芒鞋轻，踏碎满地影
不问尘世事，只慕山水情

副歌：
山水间，心自闲，远离喧嚣天地宽
风轻云淡，花开花落，任时光流转
山水间，梦相连，与自然共舞千年
看尽繁华，归来依然，是最初的眷恋

桥段：
山高水长，人生路远
多少过往，尽付笑谈
不如归去，山水之间
与天地同眠，与日月为伴

结尾：
青峦叠翠入云间，溪流潺潺绕山巅
古寺钟声远，林深听松风
心若静如水，天地自悠然`,
  style: 'Chinese traditional folk, guzheng, erhu, bamboo flute, peaceful mountain atmosphere, zen-like tranquility, acoustic instrumentation',
  title: '山水间'
};

function run(cmd) {
  try {
    const result = execSync(cmd, { encoding: 'utf8', timeout: 30000 });
    return result.trim();
  } catch (e) {
    return e.stdout ? e.stdout.trim() : '';
  }
}

function ab(action) {
  return run(`agent-browser --cdp ${CDP_PORT} ${action}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('');
  console.log('🎵 ╔════════════════════════════════════╗');
  console.log('   ║    Suno 中国风音乐一键创作（测试） ║');
  console.log('   ╚════════════════════════════════════╝');
  console.log('');

  // Step 1: 打开创作页面
  console.log('📡 Step 1/5  连接浏览器并打开 Suno 创作页面...');
  ab(`open ${SUNO_CREATE_URL}`);
  await sleep(30000);

  const currentUrl = ab('get url');
  console.log(`   ✅ 当前页面：${currentUrl}`);

  // Step 2: 获取页面快照，找到输入框 ref
  console.log('🔍 Step 2/5  分析页面结构...');
  const snapshot = ab('snapshot');

  // 解析 ref 编号
  const promptMatch = snapshot.match(/textbox "Write some lyrics[^\"]*" \[ref=(e\d+)\]/);
  const styleMatch = snapshot.match(/textbox "([^\"]*(?:guitar|whistle|hichiriki|electronic)[^\"]*)" \[ref=(e\d+)\]/);
  const titleMatch = snapshot.match(/textbox "Song Title[^\"]*" \[ref=(e\d+)\]/);
  const createBtnMatch = snapshot.match(/button "Create song"[^\[]*\[(?:disabled, )?ref=(e\d+)\]/);

  const promptRef = promptMatch ? promptMatch[1] : 'e224';
  const styleRef = styleMatch ? styleMatch[2] : 'e226';
  const titleRef = titleMatch ? titleMatch[1] : 'e94';
  const createRef = createBtnMatch ? createBtnMatch[1] : 'e48';

  console.log(`   ✅ 提示词框: ${promptRef} | 风格框: ${styleRef} | 标题框: ${titleRef} | 创作按钮: ${createRef}`);

  // Step 3: 填写歌曲标题
  console.log(`🎼 Step 3/5  填写歌曲信息...`);
  ab(`fill ${titleRef} "${MUSIC_CONFIG.title}"`);
  console.log(`   📝 标题：${MUSIC_CONFIG.title}`);
  await sleep(500);

  // 填写风格
  ab(`fill ${styleRef} "${MUSIC_CONFIG.style}"`);
  console.log(`   🎸 风格：${MUSIC_CONFIG.style}`);
  await sleep(500);

  // 填写歌词/提示词
  const lyricDir = path.join(SCREENSHOT_DIR, 'lyric');
  const lyricFile = path.join(lyricDir, `${MUSIC_CONFIG.title}.txt`);
  require('fs').writeFileSync(lyricFile, MUSIC_CONFIG.prompt, 'utf8');
  console.log(`   💾 歌词已保存：${lyricFile}`);
  run(`powershell -Command "Get-Content -Path '${lyricFile}' -Encoding UTF8 | Set-Clipboard"`);
  ab(`click ${promptRef}`);
  await sleep(300);
  ab('clipboard read paste');
  console.log(`   ✍️  提示词：${MUSIC_CONFIG.prompt.substring(0, 100)}...`);
  await sleep(1000);

  // Step 4: 截图确认
  console.log('📸 Step 4/5  截图确认填写内容...');
  const screenshotPath = path.join(SCREENSHOT_DIR, 'suno-before-create.png');
  ab(`screenshot "${screenshotPath}"`);
  console.log(`   ✅ 截图已保存：${screenshotPath}`);
  await sleep(500);

  // Step 5: 点击创作按钮
  console.log('🚀 Step 5/5  点击创作按钮...');

  // 重新获取快照，检查按钮是否已激活
  const snapshot2 = ab('snapshot');
  const btnEnabled = !snapshot2.includes(`button "Create song" [disabled`);

  if (btnEnabled) {
    ab(`click ${createRef}`);
    console.log('   ✅ 已点击创作按钮！');
  } else {
    // 按钮还是 disabled，尝试按 Enter 提交
    console.log('   ⚠️  按钮尚未激活，尝试键盘 Enter 提交...');
    ab(`press ${promptRef} Enter`);
  }

  await sleep(5000);

  // 最终截图
  const finalPath = path.join(SCREENSHOT_DIR, 'suno-creating.png');
  ab(`screenshot "${finalPath}"`);

  console.log('');
  console.log('🎉 ═══════════════════════════════════════');
  console.log('   中国风音乐创作已启动！');
  console.log('   请在浏览器中等待音乐生成（约30-60秒）');
  console.log(`   最终截图：${finalPath}`);
  console.log('═══════════════════════════════════════');
  console.log('');
}

main().catch(err => {
  console.error('❌ 出错：', err.message);
  process.exit(1);
});