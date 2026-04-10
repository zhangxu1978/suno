const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const querystring = require('querystring');

const songManager = require('./song-manager');
const aiLyric = require('./ai-lyric');

const PORT = 3088;
const UPLOAD_DIR = path.join(__dirname, 'backgrounds');

// 确保上传目录存在
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
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
  '.wav': 'audio/wav'
};

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
        
        const topic = songData.topic || '通用主题';
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
  if (pathname.startsWith('/audio/') && req.method === 'GET') {
    const filename = pathname.split('/')[2];
    const audioPath = path.join(__dirname, 'download', filename);
    
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
  
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'API端点未找到' }));
}

// 创建HTTP服务器
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  
  // API请求
  if (pathname.startsWith('/api/') || pathname.startsWith('/audio/') || pathname.startsWith('/backgrounds/')) {
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