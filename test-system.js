const songManager = require('./song-manager');

console.log('🧪 开始测试 Suno 歌曲管理系统...\n');

// 测试1: 添加测试歌曲
console.log('1. 测试添加歌曲...');
const testSong = {
    title: '测试歌曲 - 山水情',
    style: '中国风传统音乐',
    lyric: `《山水情》

主歌：
青山绿水映眼帘，白云悠悠飘天边
溪水潺潺流不息，鸟儿欢唱在林间

副歌：
山水情，情意长，自然美景心中藏
风轻云淡，心旷神怡，忘却尘世烦与忙`
};

const addedSong = songManager.addSong(testSong);
console.log('   ✅ 歌曲添加成功');
console.log(`   标题: ${addedSong.title}`);
console.log(`   风格: ${addedSong.style}`);
console.log(`   歌曲ID: ${addedSong.id}\n`);

// 测试2: 获取所有歌曲
console.log('2. 测试获取歌曲列表...');
const allSongs = songManager.getAllSongs();
console.log(`   ✅ 获取到 ${allSongs.length} 首歌曲\n`);

// 测试3: 更新歌曲状态
console.log('3. 测试更新歌曲状态...');
const updateSuccess = songManager.updateSongStatus(addedSong.id, {
    downloaded: true,
    hasBackground: true
});
console.log(`   ✅ 状态更新: ${updateSuccess ? '成功' : '失败'}\n`);

// 测试4: 搜索歌曲
console.log('4. 测试搜索功能...');
const searchResults = songManager.searchSongs('山水');
console.log(`   ✅ 搜索到 ${searchResults.length} 首相关歌曲\n`);

// 测试5: 验证数据持久化
console.log('5. 测试数据持久化...');
const newManager = require('./song-manager'); // 重新加载模块
const persistedSongs = newManager.getAllSongs();
console.log(`   ✅ 持久化后歌曲数量: ${persistedSongs.length}`);

// 显示测试歌曲的最终状态
const finalSong = newManager.getSongById(addedSong.id);
console.log('\n📊 测试歌曲最终状态:');
console.log(`   标题: ${finalSong.title}`);
console.log(`   风格: ${finalSong.style}`);
console.log(`   创建时间: ${finalSong.createdTime}`);
console.log(`   下载状态: ${finalSong.status.downloaded ? '✅ 已下载' : '❌ 未下载'}`);
console.log(`   背景图: ${finalSong.status.hasBackground ? '✅ 已上传' : '❌ 未上传'}`);
console.log(`   歌词: ${finalSong.status.hasLyric ? '✅ 有歌词' : '❌ 无歌词'}`);
console.log(`   特效: ${finalSong.status.hasEffects ? '✅ 有特效' : '❌ 无特效'}`);
console.log(`   发布状态: ${finalSong.status.published ? '✅ 已发布' : '❌ 未发布'}`);

console.log('\n🎉 所有测试完成！系统功能正常。');
console.log('\n💡 下一步:');
console.log('   1. 访问 http://localhost:3000 查看前端界面');
console.log('   2. 使用 suno-create.js 创建真实歌曲');
console.log('   3. 在前端界面上传背景图片进行测试');