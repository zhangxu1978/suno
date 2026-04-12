const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const querystring = require('querystring');

const songManager = require('./song-manager');
const aiLyric = require('./ai-lyric');

const PORT = 3088;
const UPLOAD_DIR = path.join(__dirname, 'backgrounds');
const MEDIA_DIR = path.join(__dirname, 'download');
const MEDIA_COVERS_DIR = path.join(__dirname, 'media', 'covers');
const MEDIA_LYRICS_DIR = path.join(__dirname, 'media', 'lyrics');
const MEDIA_DB_FILE = path.join(__dirname, 'media.json');

// 确保上传目录存在
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// 确保媒体相关目录存在
if (!fs.existsSync(MEDIA_COVERS_DIR)) {
  fs.mkdirSync(MEDIA_COVERS_DIR, { recursive: true });
}
if (!fs.existsSync(MEDIA_LYRICS_DIR)) {
  fs.mkdirSync(MEDIA_LYRICS_DIR, { recursive: true });
}

// MIME类型映射
const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm'
};

// 媒体数据管理
function loadMediaData() {
  try {
    if (fs.existsSync(MEDIA_DB_FILE)) {
      return JSON.parse(fs.readFileSync(MEDIA_DB_FILE, 'utf8'));
    }
    return {};
  } catch (error) {
    console.error('加载媒体数据失败:', error);
    return {};
  }
}

function saveMediaData(data) {
  try {
    fs.writeFileSync(MEDIA_DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('保存媒体数据失败:', error);
    return false;
  }
}

// 获取媒体文件列表
function getMediaFiles() {
  const mediaData = loadMediaData();
  const supportedExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac', '.mp4', '.webm', '.avi', '.mkv'];
  
  if (!fs.existsSync(MEDIA_DIR)) {
    return [];
  }
  
  const files = fs.readdirSync(MEDIA_DIR);
  const mediaFiles = [];
  
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (!supportedExtensions.includes(ext)) continue;
    
    const filePath = path.join(MEDIA_DIR, file);
    const stat = fs.statSync(filePath);
    
    const mediaInfo = mediaData[file] || {};
    
    mediaFiles.push({
      filename: file,
      originalName: file.replace(ext, ''),
      title: mediaInfo.title || file.replace(ext, ''),
      description: mediaInfo.description || '',
      type: mediaInfo.type || 1,
      waveform: mediaInfo.waveform || 'bars',
      published: mediaInfo.published || false,
      cover: mediaInfo.cover || null,
      lyric: mediaInfo.lyric || null,
      size: stat.size,
      createdTime: stat.birthtime,
      modifiedTime: stat.mtime,
      isAudio: ['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac'].includes(ext),
      isVideo: ['.mp4', '.webm', '.avi', '.mkv'].includes(ext)
    });
  }
  
  return mediaFiles.sort((a, b) => new Date(b.modifiedTime) - new Date(a.modifiedTime));
}

// 处理静态文件
function serveStaticFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('文件未找到');
      return;
    }
    
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

// 处理API请求
function handleApiRequest(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // 获取所有歌曲
  if (pathname === '/api/songs' && req.method === 'GET') {
    const songs = songManager.getAllSongs();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(songs));
    return;
  }

  // 重新加载歌曲数据（从文件重新读取）
  if (pathname === '/api/reload' && req.method === 'POST') {
    try {
      const songs = songManager.reloadSongs();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        message: '数据已重新加载',
        count: songs.length 
      }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: '重新加载数据失败',
        message: error.message 
      }));
    }
    return;
  }

  // 按日期筛选歌曲
  if (pathname === '/api/filter-by-date' && req.method === 'GET') {
    const startDate = parsedUrl.query.startDate || '';
    const endDate = parsedUrl.query.endDate || '';
    
    try {
      const songs = songManager.filterSongsByDate(startDate, endDate);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(songs));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: '日期筛选失败',
        message: error.message 
      }));
    }
    return;
  }

  // 创建新歌曲
  if (pathname === '/api/songs' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', async () => {
      try {
        const songData = JSON.parse(body);
        
        const topic = songData.title || '通用主题';
        const style = songData.style || '中国风';
        
        const musicContent = await aiLyric.generateMusicContent(topic, style);
        
        const newSong = songManager.addSong({
          title: musicContent.title,
          style: musicContent.style,
          lyric: musicContent.lyric
        });
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          message: '歌曲创建成功',
          song: newSong
        }));
        
      } catch (error) {
        console.error('创建歌曲失败:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          error: '创建歌曲失败',
          message: error.message 
        }));
      }
    });
    return;
  }
  
  // 获取单个歌曲
  if (pathname.startsWith('/api/songs/') && req.method === 'GET') {
    const songId = pathname.split('/')[3];
    const song = songManager.getSongById(songId);
    
    if (song) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(song));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '歌曲未找到' }));
    }
    return;
  }
  
  // 更新歌曲状态
  if (pathname.startsWith('/api/songs/') && req.method === 'PUT') {
    const songId = pathname.split('/')[3];
    
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const updates = JSON.parse(body);
        const success = songManager.updateSongStatus(songId, updates);
        
        if (success) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: '歌曲未找到' }));
        }
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '无效的JSON数据' }));
      }
    });
    return;
  }

  // 创建歌曲（调用外部脚本）
  if (pathname.startsWith('/api/songs/') && pathname.endsWith('/create') && req.method === 'POST') {
    const songId = pathname.split('/')[3];
    const song = songManager.getSongById(songId);
    
    if (!song) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '歌曲未找到' }));
      return;
    }

    if (song.status.created) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '歌曲已创建过' }));
      return;
    }

    // 异步调用创建脚本
    const { spawn } = require('child_process');
    const createProcess = spawn('node', ['suno-create.js', song.title, song.style, song.lyric], {
      cwd: __dirname,
      stdio: 'inherit'  // 让子进程的输出直接显示在终端
    });

    let output = '';
    createProcess.stdout && createProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    createProcess.stderr && createProcess.stderr.on('data', (data) => {
      output += data.toString();
    });

    createProcess.on('close', (code) => {
      if (code === 0) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          message: '歌曲创建已启动',
          output: output
        }));
      } else {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          error: '创建过程出错',
          output: output
        }));
      }
    });

    // 设置超时
    setTimeout(() => {
      if (!createProcess.killed) {
        createProcess.kill();
      }
    }, 120000); // 2分钟超时
    
    return;
  }
  
  // 上传背景图片
  if (pathname.startsWith('/api/songs/') && pathname.endsWith('/background') && req.method === 'POST') {
    const songId = pathname.split('/')[3];
    
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    
    req.on('end', () => {
      const buffer = Buffer.concat(chunks);
      const contentType = req.headers['content-type'];
      
      // 简单的文件类型检测
      let ext = '.jpg';
      if (contentType.includes('png')) ext = '.png';
      if (contentType.includes('gif')) ext = '.gif';
      
      const filename = `upload_${Date.now()}${ext}`;
      const success = songManager.uploadBackground(songId, buffer, filename);
      
      if (success) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '上传失败' }));
      }
    });
    return;
  }
  
  // 下载歌曲
  if (pathname.startsWith('/api/songs/') && pathname.endsWith('/download') && req.method === 'POST') {
    const songId = pathname.split('/')[3];
    const song = songManager.getSongById(songId);
    
    if (!song) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '歌曲未找到' }));
      return;
    }

    // 异步调用下载脚本
    const { spawn } = require('child_process');
    const downloadProcess = spawn('node', ['suno-download.js', song.title], {
      cwd: __dirname,
      stdio: 'inherit'  // 让子进程的输出直接显示在终端
    });

    let output = '';
    downloadProcess.stdout && downloadProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    downloadProcess.stderr && downloadProcess.stderr.on('data', (data) => {
      output += data.toString();
    });

    downloadProcess.on('close', (code) => {
      if (code === 0) {
        // 检查下载的文件数量并更新计数
        const downloadedCount = songManager.checkDownloadedFiles(songId);
        songManager.incrementDownloadedCount(songId, downloadedCount);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          message: '歌曲下载已启动',
          downloadedCount: downloadedCount,
          output: output
        }));
      } else {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          error: '下载过程出错',
          output: output
        }));
      }
    });

    // 设置超时
    setTimeout(() => {
      if (!downloadProcess.killed) {
        downloadProcess.kill();
      }
    }, 180000); // 3分钟超时
    
    return;
  }

  // 删除歌曲
  if (pathname.startsWith('/api/songs/') && req.method === 'DELETE') {
    const songId = pathname.split('/')[3];
    const success = songManager.deleteSong(songId);
    
    if (success) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '歌曲未找到' }));
    }
    return;
  }
  
  // 搜索歌曲
  if (pathname === '/api/search' && req.method === 'GET') {
    const query = parsedUrl.query.q || '';
    const songs = songManager.searchSongs(query);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(songs));
    return;
  }
  
  // 获取音频文件
  if ((pathname.startsWith('/audio/') || pathname.startsWith('/download/')) && req.method === 'GET') {
    const filename = pathname.startsWith('/audio/') ? pathname.split('/')[2] : pathname.split('/')[2];
    const audioPath = path.join(MEDIA_DIR, decodeURIComponent(filename));
    
    if (fs.existsSync(audioPath)) {
      const stat = fs.statSync(audioPath);
      const ext = path.extname(audioPath).toLowerCase();
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': stat.size
      });
      
      const readStream = fs.createReadStream(audioPath);
      readStream.pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('音频文件未找到');
    }
    return;
  }
  
  // 获取背景图片
  if (pathname.startsWith('/backgrounds/') && req.method === 'GET') {
    const filename = pathname.split('/')[2];
    const bgPath = path.join(UPLOAD_DIR, filename);
    
    if (fs.existsSync(bgPath)) {
      const stat = fs.statSync(bgPath);
      const ext = path.extname(bgPath).toLowerCase();
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': stat.size
      });
      
      const readStream = fs.createReadStream(bgPath);
      readStream.pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('背景图片未找到');
    }
    return;
  }
  
  // 获取媒体文件列表
  if (pathname === '/api/media' && req.method === 'GET') {
    const files = getMediaFiles();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(files));
    return;
  }
  
  // 更新媒体信息（包括封面上传和歌词上传）
  if (pathname === '/api/media/update' && req.method === 'POST') {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const contentType = req.headers['content-type'];
      
      if (contentType && contentType.includes('multipart/form-data')) {
        const boundary = contentType.split('boundary=')[1];
        const parts = parseMultipartData(Buffer.concat(chunks), boundary);
        
        const filename = parts.fields.filename;
        const title = parts.fields.title;
        const description = parts.fields.description;
        const type = parseInt(parts.fields.type) || 1;
        const waveform = parts.fields.waveform || 'bars';
        const published = parts.fields.published === 'true';
        
        let coverFilename = null;
        let lyricFilename = null;
        
        if (parts.files.cover) {
          const ext = path.extname(parts.files.cover.filename).toLowerCase();
          coverFilename = `${Date.now()}_cover${ext}`;
          fs.writeFileSync(path.join(MEDIA_COVERS_DIR, coverFilename), parts.files.cover.data);
        }
        
        if (parts.files.lyric) {
          const ext = path.extname(parts.files.lyric.filename).toLowerCase();
          lyricFilename = `${Date.now()}_lyric${ext}`;
          fs.writeFileSync(path.join(MEDIA_LYRICS_DIR, lyricFilename), parts.files.lyric.data);
        }
        
        const mediaData = loadMediaData();
        
        if (!mediaData[filename]) {
          mediaData[filename] = {};
        }
        
        if (title !== undefined) mediaData[filename].title = title;
        if (description !== undefined) mediaData[filename].description = description;
        if (type) mediaData[filename].type = type;
        if (waveform) mediaData[filename].waveform = waveform;
        if (published !== undefined) mediaData[filename].published = published;
        if (coverFilename) mediaData[filename].cover = coverFilename;
        if (lyricFilename) mediaData[filename].lyric = lyricFilename;
        
        saveMediaData(mediaData);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } else {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '无效的请求格式' }));
      }
    });
    return;
  }
  
  // 删除媒体文件
  if (pathname.startsWith('/api/media/delete') && req.method === 'DELETE') {
    const filename = parsedUrl.query.filename;
    
    if (!filename) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '缺少文件名' }));
      return;
    }
    
    const filePath = path.join(MEDIA_DIR, filename);
    
    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '文件不存在' }));
      return;
    }
    
    try {
      fs.unlinkSync(filePath);
      
      const mediaData = loadMediaData();
      if (mediaData[filename]) {
        if (mediaData[filename].cover) {
          const coverPath = path.join(MEDIA_COVERS_DIR, mediaData[filename].cover);
          if (fs.existsSync(coverPath)) fs.unlinkSync(coverPath);
        }
        if (mediaData[filename].lyric) {
          const lyricPath = path.join(MEDIA_LYRICS_DIR, mediaData[filename].lyric);
          if (fs.existsSync(lyricPath)) fs.unlinkSync(lyricPath);
        }
        delete mediaData[filename];
        saveMediaData(mediaData);
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '删除失败: ' + error.message }));
    }
    return;
  }
  
  // 获取封面图片
  if (pathname.startsWith('/media/covers/') && req.method === 'GET') {
    const filename = pathname.split('/')[3];
    const coverPath = path.join(MEDIA_COVERS_DIR, filename);
    
    if (fs.existsSync(coverPath)) {
      const stat = fs.statSync(coverPath);
      const ext = path.extname(coverPath).toLowerCase();
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': stat.size
      });
      
      const readStream = fs.createReadStream(coverPath);
      readStream.pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('封面图片未找到');
    }
    return;
  }
  
  // 获取歌词文件
  if (pathname.startsWith('/media/lyrics/') && req.method === 'GET') {
    const filename = pathname.split('/')[3];
    const lyricPath = path.join(MEDIA_LYRICS_DIR, filename);
    
    if (fs.existsSync(lyricPath)) {
      const stat = fs.statSync(lyricPath);
      const contentType = 'text/plain; charset=utf-8';
      
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': stat.size
      });
      
      const readStream = fs.createReadStream(lyricPath);
      readStream.pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('歌词文件未找到');
    }
    return;
  }
  
  // 辅助函数：解析multipart数据
  function parseMultipartData(buffer, boundary) {
    const fields = {};
    const files = {};
    const parts = buffer.toString('binary').split('--' + boundary);
    
    for (const part of parts) {
      if (!part || !part.includes('\r\n\r\n')) continue;
      
      const headerEnd = part.indexOf('\r\n\r\n');
      const headers = part.substring(0, headerEnd);
      const content = part.substring(headerEnd + 4, part.length - 2);
      
      let name = null;
      let filename = null;
      
      const nameMatch = headers.match(/name="([^"]+)"/);
      if (nameMatch) name = nameMatch[1];
      
      const filenameMatch = headers.match(/filename="([^"]+)"/);
      if (filenameMatch) filename = filenameMatch[1];
      
      if (filename) {
        const contentTypeMatch = headers.match(/Content-Type:\s*([^\r\n]+)/);
        const contentType = contentTypeMatch ? contentTypeMatch[1] : 'application/octet-stream';
        
        const binaryContent = Buffer.from(content, 'binary');
        
        files[name] = {
          filename: filename,
          contentType: contentType,
          data: binaryContent
        };
      } else if (name) {
        fields[name] = content;
      }
    }
    
    return { fields, files };
  }
  
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'API端点未找到' }));
}

// 创建HTTP服务器
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  
  // API请求
  if (pathname.startsWith('/api/') || pathname.startsWith('/audio/') || pathname.startsWith('/backgrounds/') || pathname.startsWith('/media/') || pathname.startsWith('/download/')) {
    handleApiRequest(req, res);
    return;
  }
  
  // 静态文件服务
  let filePath = path.join(__dirname, 'public', pathname === '/' ? 'index.html' : pathname);
  
  // 如果文件不存在，尝试添加.html扩展名
  if (!fs.existsSync(filePath) && !path.extname(filePath)) {
    filePath += '.html';
  }
  
  serveStaticFile(filePath, res);
});

server.listen(PORT, () => {
  console.log(`🎵 歌曲管理系统服务器已启动`);
  console.log(`📡 访问地址: http://localhost:${PORT}`);
  console.log(`📊 歌曲数量: ${songManager.getAllSongs().length}`);
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n🛑 正在关闭服务器...');
  server.close(() => {
    console.log('✅ 服务器已关闭');
    process.exit(0);
  });
});