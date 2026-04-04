const fs = require('fs');
const path = require('path');

const SONGS_DB_FILE = path.join(__dirname, 'songs.json');
const DOWNLOAD_DIR = path.join(__dirname, 'download');
const BACKGROUNDS_DIR = path.join(__dirname, 'backgrounds');

// 歌曲数据结构
class SongManager {
  constructor() {
    this.songs = this.loadSongs();
    this.ensureDirectories();
  }

  // 确保必要的目录存在
  ensureDirectories() {
    if (!fs.existsSync(DOWNLOAD_DIR)) {
      fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
    }
    if (!fs.existsSync(BACKGROUNDS_DIR)) {
      fs.mkdirSync(BACKGROUNDS_DIR, { recursive: true });
    }
  }

  // 加载歌曲数据
  loadSongs() {
    try {
      if (fs.existsSync(SONGS_DB_FILE)) {
        const data = fs.readFileSync(SONGS_DB_FILE, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('加载歌曲数据失败:', error.message);
    }
    return [];
  }

  // 保存歌曲数据
  saveSongs() {
    try {
      fs.writeFileSync(SONGS_DB_FILE, JSON.stringify(this.songs, null, 2), 'utf8');
      return true;
    } catch (error) {
      console.error('保存歌曲数据失败:', error.message);
      return false;
    }
  }

  // 添加新歌曲（预创建，未在Suno实际生成）
  addSong(songData) {
    const song = {
      id: this.generateId(),
      title: songData.title || '未命名歌曲',
      style: songData.style || '',
      lyric: songData.lyric || '',
      createdTime: new Date().toISOString(),
      status: {
        created: false,        // 是否已在Suno创建
        downloaded: false,
        hasBackground: false,
        hasLyric: !!songData.lyric,
        hasEffects: false,
        published: false
      },
      stats: {
        createdCount: 0,       // 已创建数量
        downloadedCount: 0     // 已下载数量
      },
      files: {
        audio: '',
        background: '',
        lyric: songData.lyric ? this.saveLyricFile(songData.title, songData.lyric) : ''
      },
      metadata: {
        duration: 0,
        size: 0,
        format: ''
      },
      sunoData: {
        promptRef: '',
        styleRef: '',
        titleRef: '',
        createRef: ''
      }
    };

    this.songs.push(song);
    this.saveSongs();
    return song;
  }

  // 更新歌曲的Suno创建状态
  updateSongCreation(songId, created, sunoData = {}) {
    const song = this.songs.find(s => s.id === songId);
    if (song) {
      song.status.created = created;
      if (created) {
        Object.assign(song.sunoData, sunoData);
        song.stats.createdCount += 2; // 一次创建成功+2
      }
      this.saveSongs();
      return true;
    }
    return false;
  }

  // 增加创建计数
  incrementCreatedCount(songId, count = 2) {
    const song = this.songs.find(s => s.id === songId);
    if (song) {
      song.stats.createdCount += count;
      this.saveSongs();
      return true;
    }
    return false;
  }

  // 增加下载计数
  incrementDownloadedCount(songId, count = 1) {
    const song = this.songs.find(s => s.id === songId);
    if (song) {
      song.stats.downloadedCount += count;
      this.saveSongs();
      return true;
    }
    return false;
  }

  // 检查下载目录中的同名文件
  checkDownloadedFiles(songId) {
    const song = this.songs.find(s => s.id === songId);
    if (!song) return 0;

    const songNameClean = song.title.replace(/[<>:"/\\|?*]/g, '_');
    const audioFiles = fs.readdirSync(DOWNLOAD_DIR)
      .filter(f => f.includes(songNameClean) && (f.endsWith('.mp3') || f.endsWith('.wav')));
    
    return audioFiles.length;
  }

  // 获取未创建的歌曲
  getUncreatedSongs() {
    return this.songs.filter(song => !song.status.created);
  }

  // 获取已创建的歌曲
  getCreatedSongs() {
    return this.songs.filter(song => song.status.created);
  }

  // 生成唯一ID
  generateId() {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }

  // 保存歌词文件
  saveLyricFile(title, lyric) {
    const lyricDir = path.join(__dirname, 'lyric');
    if (!fs.existsSync(lyricDir)) {
      fs.mkdirSync(lyricDir, { recursive: true });
    }
    
    const filename = `${title.replace(/[<>:"/\\|?*]/g, '_')}.txt`;
    const filepath = path.join(lyricDir, filename);
    
    try {
      fs.writeFileSync(filepath, lyric, 'utf8');
      return filepath;
    } catch (error) {
      console.error('保存歌词文件失败:', error.message);
      return '';
    }
  }

  // 更新歌曲状态
  updateSongStatus(songId, statusUpdates) {
    const song = this.songs.find(s => s.id === songId);
    if (song) {
      Object.assign(song.status, statusUpdates);
      
      // 如果设置了下载状态，检查音频文件
      if (statusUpdates.downloaded !== undefined) {
        this.checkAudioFiles(song);
      }
      
      this.saveSongs();
      return true;
    }
    return false;
  }

  // 检查音频文件
  checkAudioFiles(song) {
    const audioFiles = fs.readdirSync(DOWNLOAD_DIR)
      .filter(f => f.includes(song.title.replace(/[<>:"/\\|?*]/g, '_')));
    
    if (audioFiles.length > 0) {
      const audioFile = audioFiles[0];
      const filepath = path.join(DOWNLOAD_DIR, audioFile);
      const stats = fs.statSync(filepath);
      
      song.files.audio = filepath;
      song.metadata.size = stats.size;
      song.metadata.format = path.extname(audioFile).toLowerCase();
      
      // 这里可以添加获取音频时长的逻辑
      song.metadata.duration = 0; // 需要音频处理库
    }
  }

  // 上传背景图片
  uploadBackground(songId, imageBuffer, filename) {
    const song = this.songs.find(s => s.id === songId);
    if (!song) return false;

    const ext = path.extname(filename) || '.jpg';
    const bgFilename = `${song.title.replace(/[<>:"/\\|?*]/g, '_')}_bg_${Date.now()}${ext}`;
    const bgPath = path.join(BACKGROUNDS_DIR, bgFilename);

    try {
      fs.writeFileSync(bgPath, imageBuffer);
      song.files.background = bgPath;
      song.status.hasBackground = true;
      this.saveSongs();
      return true;
    } catch (error) {
      console.error('上传背景图片失败:', error.message);
      return false;
    }
  }

  // 获取所有歌曲
  getAllSongs() {
    return this.songs.sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));
  }

  // 根据ID获取歌曲
  getSongById(songId) {
    return this.songs.find(s => s.id === songId);
  }

  // 删除歌曲
  deleteSong(songId) {
    const index = this.songs.findIndex(s => s.id === songId);
    if (index !== -1) {
      const song = this.songs[index];
      
      // 删除相关文件
      if (song.files.audio && fs.existsSync(song.files.audio)) {
        fs.unlinkSync(song.files.audio);
      }
      if (song.files.background && fs.existsSync(song.files.background)) {
        fs.unlinkSync(song.files.background);
      }
      
      this.songs.splice(index, 1);
      this.saveSongs();
      return true;
    }
    return false;
  }

  // 搜索歌曲
  searchSongs(query) {
    const searchTerm = query.toLowerCase();
    return this.songs.filter(song => 
      song.title.toLowerCase().includes(searchTerm) ||
      song.style.toLowerCase().includes(searchTerm)
    );
  }
}

module.exports = new SongManager();