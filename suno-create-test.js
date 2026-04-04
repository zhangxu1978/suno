/**
 * Suno 歌曲创建脚本（支持从JSON数据生成歌曲）
 * 可以预创建歌曲记录，然后选择性地完成实际创建
 */

const { execSync, exec } = require('child_process');
const path = require('path');
const songManager = require('./song-manager');

const CDP_PORT = 48840;
const SUNO_CREATE_URL = 'https://suno.com/create';
const SCREENSHOT_DIR = path.dirname(__filename);

// 默认歌词配置（当没有指定歌曲ID时使用）
const DEFAULT_MUSIC_CONFIG = {
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

// 预创建歌曲记录（不实际在Suno创建）
function preCreateSong(title, style, lyric) {
  console.log('');
  console.log('🎵 ╔════════════════════════════════════╗');
  console.log('   ║       预创建歌曲记录              ║');
  console.log('   ╚════════════════════════════════════╝');
  console.log('');

  const songData = {
    title: title || DEFAULT_MUSIC_CONFIG.title,
    style: style || DEFAULT_MUSIC_CONFIG.style,
    lyric: lyric || DEFAULT_MUSIC_CONFIG.prompt
  };

  const song = songManager.addSong(songData);
  
  console.log(`   📝 标题：${song.title}`);
  console.log(`   🎸 风格：${song.style}`);
  console.log(`   🆔 歌曲ID：${song.id}`);
  console.log(`   📊 歌词长度：${song.lyric.length} 字符`);
  console.log('');
  console.log('✅ 歌曲记录已预创建，可以在前端界面选择创建');
  console.log('');

  return song;
}

// 从JSON数据创建歌曲（实际在Suno创建）
async function createSongFromJson(songId) {
  const song = songManager.getSongById(songId);
  if (!song) {
    console.log('❌ 未找到指定的歌曲ID');
    return false;
  }

  if (song.status.created) {
    console.log('⚠️ 该歌曲已在Suno创建过');
    return false;
  }

  console.log('');
  console.log('🎵 ╔════════════════════════════════════╗');
  console.log(`   ║   创建歌曲: ${song.title}         ║`);
  console.log('   ╚════════════════════════════════════╝');
  console.log('');

  // Step 1: 打开创作页面
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

  // Step 2: 获取页面快照，找到输入框 ref
  console.log('🔍 Step 2/5  分析页面结构...');
  const snapshot = ab('snapshot');

  // 解析 ref 编号
  const promptMatch = snapshot.match(/textbox "Write some lyrics[^"]*" \[ref=(e\d+)\]/);
  const styleMatch = snapshot.match(/textbox "([^"]*(?:guitar|whistle|hichiriki|electronic)[^"]*)" \[ref=(e\d+)\]/);
  const titleMatch = snapshot.match(/textbox "Song Title[^"]*" \[ref=(e\d+)\]/);
  const createBtnMatch = snapshot.match(/button "Create song"[^\[]*\[(?:disabled, )?ref=(e\d+)\]/);

  const promptRef = promptMatch ? promptMatch[1] : null;
  const styleRef = styleMatch ? styleMatch[2] : null;
  const titleRef = titleMatch ? titleMatch[1] : null;
  const createRef = createBtnMatch ? createBtnMatch[1] : null;

  console.log(`   ✅ 提示词框: ${promptRef} | 风格框: ${styleRef} | 标题框: ${titleRef} | 创作按钮: ${createRef}`);

  if (!promptRef || !styleRef || !titleRef || !createRef) {
    console.log('   ⚠️ 部分元素未找到，使用备用方案...');
  }

  // Step 3: 填写歌曲信息
  console.log(`🎼 Step 3/5  填写歌曲信息...`);
  
  // 等待标题框出现并填写
  if (titleRef) {
    console.log('   ⏳ 等待标题框加载...');
    const titleReady = await waitForElement(`ref=${titleRef}`, 10000);
    if (titleReady) {
      ab(`fill ${titleRef} "${song.title}"`);
      console.log(`   📝 标题：${song.title}`);
    }
  }
  await sleep(500);

  // 等待风格框出现并填写
  if (styleRef) {
    console.log('   ⏳ 等待风格框加载...');
    const styleReady = await waitForElement(`ref=${styleRef}`, 10000);
    if (styleReady) {
      ab(`fill ${styleRef} "${song.style}"`);
      console.log(`   🎸 风格：${song.style}`);
    }
  }
  await sleep(500);

  // 填写歌词/提示词
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
      require('fs').writeFileSync(lyricFile, song.lyric, 'utf8');

      const ps1File = path.join(lyricDir, `type-lyric-${Date.now()}.ps1`);
      const ps1Content = `
$lyric = Get-Content -Path '${lyricFile.replace(/\\/g, '/')}' -Encoding UTF8 -Raw
agent-browser --cdp ${CDP_PORT} type ${promptRef} $lyric
`.trim();
      require('fs').writeFileSync(ps1File, ps1Content, 'utf8');

      run(`powershell.exe -ExecutionPolicy Bypass -File "${ps1File.replace(/\\/g, '/')}"`);

      console.log(`   ✍️  提示词：${song.lyric.substring(0, 100)}...`);
      await sleep(1000);
    }
  }

  // Step 4: 截图确认
  console.log('📸 Step 4/5  截图确认填写内容...');
  const screenshotPath = path.join(SCREENSHOT_DIR, 'suno-before-create.png');
  ab(`screenshot "${screenshotPath}"`);
  console.log(`   ✅ 截图已保存：${screenshotPath}`);
  await sleep(500);

  // Step 5: 点击创作按钮
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

  // 更新歌曲创建状态
  songManager.updateSongCreation(songId, true, {
    promptRef: promptRef,
    styleRef: styleRef,
    titleRef: titleRef,
    createRef: createRef
  });

  const finalPath = path.join(SCREENSHOT_DIR, 'suno-creating.png');
  ab(`screenshot "${finalPath}"`);

  console.log('');
  console.log('🎉 ═══════════════════════════════════════');
  console.log(`   歌曲 "${song.title}" 创作已启动！`);
  console.log('   请在浏览器中等待音乐生成（约30-60秒）');
  console.log(`   最终截图：${finalPath}`);
  console.log(`   歌曲状态已更新：已创建`);
  console.log('═══════════════════════════════════════');
  console.log('');

  return true;
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // 没有参数时显示帮助信息
    console.log('');
    console.log('🎵 Suno 歌曲创建工具');
    console.log('═══════════════════════════════════════');
    console.log('');
    console.log('用法:');
    console.log('  node suno-create-test.js [选项]');
    console.log('');
    console.log('选项:');
    console.log('  预创建歌曲记录:');
    console.log('    --precreate "标题" "风格" "歌词"');
    console.log('');
    console.log('  从JSON数据创建歌曲:');
    console.log('    --create <歌曲ID>');
    console.log('');
    console.log('  查看未创建的歌曲:');
    console.log('    --list-uncreated');
    console.log('');
    console.log('示例:');
    console.log('  预创建歌曲: node suno-create-test.js --precreate "月光" "中国风" "月光下的思念..."');
    console.log('  创建歌曲: node suno-create-test.js --create 1775305809345jqerrlo76');
    console.log('  查看未创建列表: node suno-create-test.js --list-uncreated');
    console.log('');
    return;
  }

  const command = args[0];

  if (command === '--precreate') {
    // 预创建歌曲记录
    const title = args[1] || DEFAULT_MUSIC_CONFIG.title;
    const style = args[2] || DEFAULT_MUSIC_CONFIG.style;
    const lyric = args[3] || DEFAULT_MUSIC_CONFIG.prompt;
    
    preCreateSong(title, style, lyric);
    
  } else if (command === '--create') {
    // 从JSON数据创建歌曲
    const songId = args[1];
    if (!songId) {
      console.log('❌ 请提供歌曲ID');
      return;
    }
    
    await createSongFromJson(songId);
    
  } else if (command === '--list-uncreated') {
    // 查看未创建的歌曲列表
    const uncreatedSongs = songManager.getUncreatedSongs();
    
    console.log('');
    console.log('📋 未创建的歌曲列表');
    console.log('═══════════════════════════════════════');
    console.log('');
    
    if (uncreatedSongs.length === 0) {
      console.log('暂无未创建的歌曲');
    } else {
      uncreatedSongs.forEach((song, index) => {
        console.log(`${index + 1}. ${song.title} (ID: ${song.id})`);
        console.log(`   风格: ${song.style}`);
        console.log(`   创建时间: ${new Date(song.createdTime).toLocaleString('zh-CN')}`);
        console.log('');
      });
    }
    
  } else {
    console.log('❌ 未知命令，请使用 --help 查看帮助');
  }
}

main().catch(err => {
  console.error('❌ 出错：', err.message);
  process.exit(1);
});