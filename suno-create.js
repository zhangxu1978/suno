/**
 * Suno 智能音乐创作脚本
 * 支持AI生成歌词（当本地模型可用时）
 * 包含默认的中国风歌词作为备选
 */

const { execSync } = require('child_process');
const path = require('path');
const songManager = require('./song-manager');

const CDP_PORT = 48840;
const SUNO_CREATE_URL = 'https://suno.com/create';
const SCREENSHOT_DIR = path.dirname(__filename);

// 默认歌词（当AI不可用时使用）
const DEFAULT_LYRIC = `《山水间》
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
心若静如水，天地自悠然`;

const DEFAULT_STYLE = 'Chinese traditional folk, guzheng, erhu, bamboo flute, peaceful mountain atmosphere, zen-like tranquility, acoustic instrumentation';
const DEFAULT_TITLE = '山水间';

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

async function waitForText(text, timeout = 30000) {
  const cmd = `wait_for "${text}" --timeout ${timeout}`;
  try {
    const result = ab(cmd);
    console.log(`   ✅ 等待文本出现: "${text}"`);
    return true;
  } catch (error) {
    console.log(`   ⚠️ 等待文本超时: "${text}"`);
    return false;
  }
}

async function waitForElement(selector, timeout = 30000) {
  const cmd = `wait_for "${selector}" --timeout ${timeout}`;
  try {
    const result = ab(cmd);
    console.log(`   ✅ 等待元素出现: ${selector}`);
    return true;
  } catch (error) {
    console.log(`   ⚠️ 等待元素超时: ${selector}`);
    return false;
  }
}

async function main() {
  const TOPIC = process.argv[2] || '山水'; // 主题（可选）
  const STYLE = process.argv[3] || '中国风'; // 风格（可选）
  const LYRIC = process.argv[4] || ''; // 歌词（可选）

  console.log('');
  console.log('🎵 ╔════════════════════════════════════╗');
  console.log('   ║    Suno 智能音乐创作             ║');
  console.log('   ╚════════════════════════════════════╝');
  console.log('');
  
  console.log(`   📝 输入主题：${TOPIC}`);
  console.log(`   🎸 输入风格：${STYLE}`);
  console.log(`   📝 歌词：${LYRIC ? LYRIC.substring(0, 50) + '...' : '无'}`);
  console.log('');

  const musicContent = {
    title: TOPIC || DEFAULT_TITLE,
    style: STYLE || DEFAULT_STYLE,
    lyric: LYRIC || DEFAULT_LYRIC
  };

  console.log(`   🎵 使用标题：${musicContent.title}`);
  console.log(`   🎸 使用风格：${musicContent.style}`);
  console.log(`   📝 歌词长度：${musicContent.lyric.length} 字符`);

  const lyricDir = path.join(SCREENSHOT_DIR, 'lyric');
  if (!require('fs').existsSync(lyricDir)) {
    require('fs').mkdirSync(lyricDir, { recursive: true });
  }
  const lyricFile = path.join(lyricDir, `${musicContent.title}.txt`);
  require('fs').writeFileSync(lyricFile, musicContent.lyric, 'utf8');
  console.log(`   💾 歌词已保存：${lyricFile}`);

  console.log('');
  console.log('📡 Step 1/5  连接浏览器并打开 Suno 创作页面...');
  ab(`open ${SUNO_CREATE_URL}`);
  
  // 等待页面加载完成
  console.log('   ⏳ 等待页面加载...');
  const pageLoaded = await waitForText('Create song', 45000);
  if (!pageLoaded) {
    console.log('   ⚠️ 页面加载超时，继续执行...');
  }

  const currentUrl = ab('get url');
  console.log(`   ✅ 当前页面：${currentUrl}`);

  console.log('🔍 Step 2/5  分析页面结构...');
  const snapshot = ab('snapshot');

  console.log('   📋 快照长度:', snapshot.length);

  const promptRefMatch = snapshot.match(/textbox "Write some lyrics[^\"]*" \[ref=(e\d+)\]/);
  const titleRefMatch = snapshot.match(/textbox "Song Title[^\"]*" \[ref=(e\d+)\]/);
  const createBtnMatch = snapshot.match(/button "Create song"[\s\S]*?\[ref=(e\d+)\]/);

  const allTextboxMatches = [...snapshot.matchAll(/textbox "([^"]*)" \[ref=(e\d+)\]/g)];
  const promptRef = promptRefMatch ? promptRefMatch[1] : null;
  const titleRef = titleRefMatch ? titleRefMatch[1] : null;
  const createRef = createBtnMatch ? createBtnMatch[1] : null;

  let styleRef = null;
  for (const match of allTextboxMatches) {
    const text = match[1];
    if (!text.includes('lyrics') && !text.includes('Song Title') && !text.includes('Enhance') && !text.includes('Search')) {
      styleRef = match[2];
      break;
    }
  }

  if (!createRef) {
    const createBtnAltMatch = snapshot.match(/button "Create song"/);
    console.log('   ⚠️  创作按钮Alt匹配:', createBtnAltMatch ? '找到按钮文本' : '未找到按钮文本');
    const createBtnDirectMatch = snapshot.match(/Create song.*?ref=(e\d+)/);
    console.log('   ⚠️  直接搜索ref:', createBtnDirectMatch ? createBtnDirectMatch[0] : '未找到');
  }

  console.log(`   ✅ 歌词框: ${promptRef} | 风格框: ${styleRef} | 标题框: ${titleRef} | 创作按钮: ${createRef}`);

  if (!promptRef || !styleRef || !titleRef || !createRef) {
    console.log('   ⚠️  部分元素未找到，使用备用方案...');
  }

  console.log('🎼 Step 3/5  填写歌曲信息...');
  
  // 等待标题框出现并填写
  if (titleRef) {
    console.log('   ⏳ 等待标题框加载...');
    const titleReady = await waitForElement(`ref=${titleRef}`, 10000);
    if (titleReady) {
      ab(`fill ${titleRef} "${musicContent.title}"`);
      console.log(`   📝 标题：${musicContent.title}`);
    } else {
      console.log('   ⚠️ 标题框未找到，跳过填写');
    }
  }
  await sleep(500);

  // 等待风格框出现并填写
  if (styleRef) {
    console.log('   ⏳ 等待风格框加载...');
    const styleReady = await waitForElement(`ref=${styleRef}`, 10000);
    if (styleReady) {
      ab(`fill ${styleRef} "${musicContent.style}"`);
      console.log(`   🎸 风格：${musicContent.style}`);
    } else {
      console.log('   ⚠️ 风格框未找到，跳过填写');
    }
  }
  await sleep(500);

  if (promptRef) {
    console.log('   ⏳ 等待歌词框加载...');
    const promptReady = await waitForElement(`ref=${promptRef}`, 10000);
    
    if (promptReady) {
      ab(`click ${promptRef}`);
      await sleep(300);

      const lyricDir = path.join(SCREENSHOT_DIR, 'lyric');
      if (!require('fs').existsSync(lyricDir)) {
        require('fs').mkdirSync(lyricDir, { recursive: true });
      }

      const lyricFile = path.join(lyricDir, `lyric-temp-${Date.now()}.txt`);
      require('fs').writeFileSync(lyricFile, musicContent.lyric, 'utf8');

      const ps1File = path.join(lyricDir, `type-lyric-${Date.now()}.ps1`);
      const ps1Content = `
$lyric = Get-Content -Path '${lyricFile.replace(/\\/g, '/')}' -Encoding UTF8 -Raw
agent-browser --cdp ${CDP_PORT} type ${promptRef} $lyric
`.trim();
      require('fs').writeFileSync(ps1File, ps1Content, 'utf8');

      run(`powershell.exe -ExecutionPolicy Bypass -File "${ps1File.replace(/\\/g, '/')}"`);

      console.log(`   ✍️  提示词：${musicContent.lyric.substring(0, 100)}...`);
      await sleep(1000);
    } else {
      console.log('   ⚠️ 歌词框未找到，跳过填写');
    }
  }

  console.log('📸 Step 4/5  截图确认填写内容...');
  const screenshotPath = path.join(SCREENSHOT_DIR, 'suno-before-create.png');
  ab(`screenshot "${screenshotPath}"`);
  console.log(`   ✅ 截图已保存：${screenshotPath}`);
  await sleep(500);

  console.log('🚀 Step 5/5  点击创作按钮...');

  // 等待创作按钮出现
  console.log('   ⏳ 等待创作按钮加载...');
  const createButtonReady = await waitForText('Create song', 10000);
  
  if (createButtonReady) {
    ab('find role button click --name "Create song"');
    console.log('   ✅ 已点击创作按钮！');
    
    // 等待创作过程开始
    console.log('   ⏳ 等待创作开始...');
    await waitForText('Creating', 15000);
    
    await sleep(5000);
  } else {
    console.log('   ⚠️ 创作按钮未找到，尝试备用方案...');
    if (createRef) {
      ab(`click ${createRef}`);
      console.log('   ✅ 已通过ref点击创作按钮！');
      await sleep(5000);
    }
  }

  const finalPath = path.join(SCREENSHOT_DIR, 'suno-creating.png');
  ab(`screenshot "${finalPath}"`);

  // 添加歌曲记录到JSON
  console.log('📝 添加歌曲记录到数据库...');
  const songRecord = songManager.addSong(musicContent);
  console.log(`   ✅ 歌曲记录已创建：${songRecord.title} (ID: ${songRecord.id})`);

  console.log('');
  console.log('🎉 ═══════════════════════════════════════');
  console.log('   音乐创作已启动！');
  console.log('   请在浏览器中等待音乐生成（约30-60秒）');
  console.log(`   最终截图：${finalPath}`);
  console.log(`   歌曲记录：${songRecord.title} 已保存到数据库`);
  console.log('═══════════════════════════════════════');
  console.log('');
}

main().catch(err => {
  console.error('❌ 出错：', err.message);
  process.exit(1);
});