/**
 * Suno 中国风音乐一键创作脚本
 * 使用 agent-browser CLI 通过 CDP 连接已有 Chrome 浏览器
 *
 * 使用前提：Chrome 需以调试模式运行（端口 48840）
 */

const { execSync, exec } = require('child_process');
const path = require('path');

const CDP_PORT = 48840;
const SUNO_CREATE_URL = 'https://suno.com/create';
const SCREENSHOT_DIR = path.dirname(__filename);

// 中国风音乐配置
const MUSIC_CONFIG = {
  prompt: '古色古香的中国风音乐，二胡与古筝交织，五声调式，意境悠远，如诗如画',
  style: 'chinese traditional, erhu, guqin, pentatonic scale, ancient dynasty, peaceful elegant instrumental',
  title: '山水墨韵'
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
  console.log('   ║    Suno 中国风音乐一键创作         ║');
  console.log('   ╚════════════════════════════════════╝');
  console.log('');

  // Step 1: 打开创作页面
  console.log('📡 Step 1/5  连接浏览器并打开 Suno 创作页面...');
  ab(`open ${SUNO_CREATE_URL}`);
  await sleep(3000);

  const currentUrl = ab('get url');
  console.log(`   ✅ 当前页面：${currentUrl}`);

  // Step 2: 获取页面快照，找到输入框 ref
  console.log('🔍 Step 2/5  分析页面结构...');
  const snapshot = ab('snapshot');

  // 解析 ref 编号
  const promptMatch = snapshot.match(/textbox "Write some lyrics[^"]*" \[ref=(e\d+)\]/);
  const styleMatch = snapshot.match(/textbox "([^"]*(?:guitar|whistle|hichiriki|electronic)[^"]*)" \[ref=(e\d+)\]/);
  const titleMatch = snapshot.match(/textbox "Song Title[^"]*" \[ref=(e\d+)\]/);
  const createBtnMatch = snapshot.match(/button "Create song"[^[]*\[(?:disabled, )?ref=(e\d+)\]/);

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
  ab(`fill ${promptRef} "${MUSIC_CONFIG.prompt}"`);
  console.log(`   ✍️  提示词：${MUSIC_CONFIG.prompt}`);
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
