const { execSync } = require('child_process');
const path = require('path');

const CDP_PORT = 48840;

function run(cmd) {
  try {
    const result = execSync(cmd, { encoding: 'utf8', timeout: 60000 });
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

async function findSongInList(songName) {
  console.log('🔍 Step 1/4  获取页面快照...');
  const snapshot = ab('snapshot');

  const songNameClean = songName.trim();
  const songNameForMatch = songNameClean.includes('《') ? songNameClean : `《${songNameClean}》`;

  const lines = snapshot.split('\n');

  let moreOptionsRef = null;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(songNameForMatch)) {
      for (let j = i; j < Math.min(i + 50, lines.length); j++) {
        if (lines[j].includes('"More options"')) {
          const match = lines[j].match(/ref=(e\d+)/);
          if (match) {
            moreOptionsRef = match[1];
            break;
          }
        }
      }
      break;
    }
  }

  if (moreOptionsRef) {
    console.log(`   ✅ 找到歌曲 "${songName}" 的 More options: ${moreOptionsRef}`);
    return moreOptionsRef;
  }

  console.log(`   ❌ 未找到歌曲的 More options 按钮`);
  return null;
}

async function openDownloadMenu(moreOptionsRef) {
  console.log('📂 Step 2/4  打开下载菜单...');
  ab(`click ${moreOptionsRef}`);
  await sleep(500);

  const snapshot = ab('snapshot');
  const lines = snapshot.split('\n');

  let downloadRef = null;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Download')) {
      const match = lines[i].match(/ref=(e\d+)/);
      if (match) {
        downloadRef = match[1];
        break;
      }
    }
  }

  if (downloadRef) {
    console.log(`   ✅ 找到 Download 按钮: ${downloadRef}`);
    ab(`click ${downloadRef}`);
    await sleep(500);
    return true;
  }

  console.log(`   ❌ 未找到 Download 按钮`);
  return false;
}

async function selectMp3Format() {
  console.log('🎵 Step 3/4  选择 MP3 格式...');
  const snapshot = ab('snapshot');
  const lines = snapshot.split('\n');

  let mp3Ref = null;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('"MP3 Audio"') || lines[i].includes('button') && lines[i + 1] && lines[i + 1].includes('MP3')) {
      const match = lines[i].match(/ref=(e\d+)/);
      if (match) {
        mp3Ref = match[1];
        break;
      }
    }
  }

  if (mp3Ref) {
    console.log(`   ✅ 找到 MP3 Audio: ${mp3Ref}`);
    ab(`click ${mp3Ref}`);
    await sleep(1000);
    return true;
  }

  console.log(`   ❌ 未找到 MP3 Audio 选项`);
  return false;
}

async function confirmDownload() {
  console.log('⬇️  Step 4/4  确认下载...');
  const snapshot = ab('snapshot');

  if (snapshot.includes('"Download Anyway"')) {
    const lines = snapshot.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('"Download Anyway"')) {
        const match = lines[i].match(/ref=(e\d+)/);
        if (match) {
          console.log(`   ✅ 确认下载: ${match[1]}`);
          ab(`click ${match[1]}`);
          await sleep(500);
          console.log('   ✅ 下载已开始！');
          return true;
        }
      }
    }
  }

  if (snapshot.includes('MP3 Audio') || snapshot.includes('WAV Audio')) {
    console.log('   ⚠️  未出现商业版权确认对话框，可能不需要确认');
    return true;
  }

  console.log('   ❌ 未找到确认下载按钮');
  return false;
}

async function main() {
  const songName = process.argv[2];

  if (!songName) {
    console.log('用法: node suno-download.js <歌曲名称>');
    console.log('示例: node suno-download.js 追纸鸢');
    process.exit(1);
  }

  console.log(`\n🎶 开始下载歌曲: ${songName}\n`);

  const moreOptionsRef = await findSongInList(songName);
  if (!moreOptionsRef) {
    process.exit(1);
  }

  const menuOpened = await openDownloadMenu(moreOptionsRef);
  if (!menuOpened) {
    process.exit(1);
  }

  const mp3Selected = await selectMp3Format();
  if (!mp3Selected) {
    process.exit(1);
  }

  const downloaded = await confirmDownload();
  if (!downloaded) {
    process.exit(1);
  }

  console.log(`\n✅ 歌曲 "${songName}" 下载完成！\n`);
}

main().catch(console.error);
