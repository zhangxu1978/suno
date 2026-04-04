// 全局变量
let songs = [];
let currentUploadSongId = null;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    loadSongs();
    setupEventListeners();
});

// 设置事件监听器
function setupEventListeners() {
    // 搜索框回车事件
    document.getElementById('searchInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchSongs();
        }
    });
    
    // 文件选择事件
    document.getElementById('backgroundFile').addEventListener('change', function(e) {
        handleFileSelect(e);
    });
    
    // 拖拽上传事件
    const uploadArea = document.getElementById('uploadArea');
    uploadArea.addEventListener('dragover', function(e) {
        e.preventDefault();
        uploadArea.style.borderColor = '#667eea';
        uploadArea.style.backgroundColor = '#f7fafc';
    });
    
    uploadArea.addEventListener('dragleave', function(e) {
        e.preventDefault();
        uploadArea.style.borderColor = '#cbd5e0';
        uploadArea.style.backgroundColor = 'transparent';
    });
    
    uploadArea.addEventListener('drop', function(e) {
        e.preventDefault();
        uploadArea.style.borderColor = '#cbd5e0';
        uploadArea.style.backgroundColor = 'transparent';
        
        if (e.dataTransfer.files.length > 0) {
            document.getElementById('backgroundFile').files = e.dataTransfer.files;
            handleFileSelect(e);
        }
    });
}

// 加载歌曲列表
async function loadSongs() {
    try {
        const response = await fetch('/api/songs');
        if (!response.ok) throw new Error('获取歌曲列表失败');
        
        songs = await response.json();
        renderSongs();
        updateStats();
    } catch (error) {
        console.error('加载歌曲失败:', error);
        showError('加载歌曲列表失败，请检查服务器是否运行');
    }
}

// 渲染歌曲列表
function renderSongs() {
    const songsGrid = document.getElementById('songsGrid');
    
    if (songs.length === 0) {
        songsGrid.innerHTML = '<div class="loading">暂无歌曲，请先使用 Suno 创建歌曲</div>';
        return;
    }
    
    songsGrid.innerHTML = songs.map(song => createSongCard(song)).join('');
}

// 创建歌曲卡片HTML
function createSongCard(song) {
  const createdTime = new Date(song.createdTime).toLocaleString('zh-CN');
  
  return `
    <div class="song-card" data-song-id="${song.id}">
      <div class="song-header">
        <div>
          <div class="song-title">${escapeHtml(song.title)}</div>
          <div class="song-style">${escapeHtml(song.style)}</div>
        </div>
        <div class="song-time">${createdTime}</div>
      </div>
      
      <div class="status-badges">
        ${song.status.created ? '<span class="status-badge created">🎵 已创建</span>' : '<span class="status-badge uncreated">⏳ 未创建</span>'}
        ${song.status.downloaded ? '<span class="status-badge downloaded">✅ 已下载</span>' : ''}
        ${song.status.hasBackground ? '<span class="status-badge background">🖼️ 有背景</span>' : ''}
        ${song.status.hasLyric ? '<span class="status-badge lyric">📝 有歌词</span>' : ''}
        ${song.status.hasEffects ? '<span class="status-badge effects">✨ 有特效</span>' : ''}
        ${song.status.published ? '<span class="status-badge published">🚀 已发布</span>' : ''}
      </div>
      
      <div class="song-actions">
        ${!song.status.created ? `
          <button class="action-btn create" onclick="createSong('${song.id}')">
            🎵 创建歌曲
          </button>
        ` : ''}
        <button class="action-btn upload" onclick="openUploadModal('${song.id}')" ${song.status.hasBackground ? 'disabled' : ''}>
          ${song.status.hasBackground ? '✅ 已上传' : '📷 上传背景'}
        </button>
        <button class="action-btn lyric" onclick="showLyric('${song.id}')" ${!song.status.hasLyric ? 'disabled' : ''}>
          ${song.status.hasLyric ? '📖 查看歌词' : '📝 无歌词'}
        </button>
        <button class="action-btn download" onclick="toggleDownloadStatus('${song.id}')" ${!song.status.created ? 'disabled' : ''}>
          ${song.status.downloaded ? '↩️ 标记未下载' : '⬇️ 标记已下载'}
        </button>
        <button class="action-btn delete" onclick="deleteSong('${song.id}')">🗑️ 删除</button>
      </div>
    </div>
  `;
}

// 更新统计信息
function updateStats() {
    const total = songs.length;
    const downloaded = songs.filter(s => s.status.downloaded).length;
    const hasBackground = songs.filter(s => s.status.hasBackground).length;
    const published = songs.filter(s => s.status.published).length;
    
    document.getElementById('totalSongs').textContent = total;
    document.getElementById('downloadedSongs').textContent = downloaded;
    document.getElementById('backgroundSongs').textContent = hasBackground;
    document.getElementById('publishedSongs').textContent = published;
}

// 搜索歌曲
async function searchSongs() {
    const query = document.getElementById('searchInput').value.trim();
    
    try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error('搜索失败');
        
        const searchResults = await response.json();
        songs = searchResults;
        renderSongs();
        updateStats();
    } catch (error) {
        console.error('搜索失败:', error);
        showError('搜索失败，请重试');
    }
}

// 刷新歌曲列表
function refreshSongs() {
    document.getElementById('searchInput').value = '';
    loadSongs();
}

// 打开上传模态框
function openUploadModal(songId) {
    currentUploadSongId = songId;
    const modal = document.getElementById('uploadModal');
    const song = songs.find(s => s.id === songId);
    
    if (song) {
        modal.style.display = 'block';
        resetUploadForm();
    }
}

// 关闭上传模态框
function closeUploadModal() {
    document.getElementById('uploadModal').style.display = 'none';
    currentUploadSongId = null;
    resetUploadForm();
}

// 重置上传表单
function resetUploadForm() {
    document.getElementById('backgroundFile').value = '';
    document.getElementById('uploadPreview').style.display = 'none';
    document.getElementById('uploadBtn').disabled = true;
}

// 处理文件选择
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    // 检查文件类型
    if (!file.type.startsWith('image/')) {
        showError('请选择图片文件');
        return;
    }
    
    // 检查文件大小（限制为5MB）
    if (file.size > 5 * 1024 * 1024) {
        showError('图片大小不能超过5MB');
        return;
    }
    
    // 显示预览
    const reader = new FileReader();
    reader.onload = function(e) {
        const preview = document.getElementById('uploadPreview');
        const previewImage = document.getElementById('previewImage');
        
        previewImage.src = e.target.result;
        preview.style.display = 'block';
        document.getElementById('uploadBtn').disabled = false;
    };
    reader.readAsDataURL(file);
}

// 上传背景图片
async function uploadBackground() {
    if (!currentUploadSongId) return;
    
    const fileInput = document.getElementById('backgroundFile');
    const file = fileInput.files[0];
    
    if (!file) {
        showError('请选择要上传的图片');
        return;
    }
    
    try {
        const formData = new FormData();
        formData.append('background', file);
        
        const response = await fetch(`/api/songs/${currentUploadSongId}/background`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) throw new Error('上传失败');
        
        const result = await response.json();
        
        if (result.success) {
            showSuccess('背景图片上传成功');
            closeUploadModal();
            loadSongs(); // 重新加载更新状态
        } else {
            throw new Error(result.error || '上传失败');
        }
    } catch (error) {
        console.error('上传失败:', error);
        showError('上传失败: ' + error.message);
    }
}

// 显示歌词
async function showLyric(songId) {
    const song = songs.find(s => s.id === songId);
    if (!song || !song.lyric) return;
    
    document.getElementById('lyricTitle').textContent = song.title + ' - 歌词';
    document.getElementById('lyricContent').textContent = song.lyric;
    document.getElementById('lyricModal').style.display = 'block';
}

// 关闭歌词模态框
function closeLyricModal() {
    document.getElementById('lyricModal').style.display = 'none';
}

// 切换下载状态
async function toggleDownloadStatus(songId) {
    const song = songs.find(s => s.id === songId);
    if (!song) return;
    
    try {
        const response = await fetch(`/api/songs/${songId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                downloaded: !song.status.downloaded
            })
        });
        
        if (!response.ok) throw new Error('更新状态失败');
        
        showSuccess(`已${!song.status.downloaded ? '标记为已下载' : '标记为未下载'}`);
        loadSongs(); // 重新加载更新状态
    } catch (error) {
        console.error('更新状态失败:', error);
        showError('更新状态失败');
    }
}

// 创建歌曲
async function createSong(songId) {
  const song = songs.find(s => s.id === songId);
  if (!song) return;

  if (!confirm(`确定要在 Suno 创建歌曲"${song.title}"吗？此操作将打开浏览器并自动填写信息。`)) {
    return;
  }

  try {
    const response = await fetch(`/api/songs/${songId}/create`, {
      method: 'POST'
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '创建失败');
    }
    
    const result = await response.json();
    
    if (result.success) {
      showSuccess('歌曲创建已启动，请等待浏览器完成操作');
      
      // 延迟一段时间后重新加载列表，让服务器有时间更新状态
      setTimeout(() => {
        loadSongs();
      }, 5000);
    } else {
      throw new Error(result.error || '创建失败');
    }
  } catch (error) {
    console.error('创建失败:', error);
    showError('创建失败: ' + error.message);
  }
}

// 删除歌曲
async function deleteSong(songId) {
  const song = songs.find(s => s.id === songId);
  if (!song) return;

  if (!confirm(`确定要删除歌曲"${song.title}"吗？此操作不可撤销。`)) {
    return;
  }

  try {
    const response = await fetch(`/api/songs/${songId}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) throw new Error('删除失败');
    
    showSuccess('歌曲删除成功');
    loadSongs(); // 重新加载更新列表
  } catch (error) {
    console.error('删除失败:', error);
    showError('删除失败');
  }
}

// 显示成功消息
function showSuccess(message) {
    showMessage(message, 'success');
}

// 显示错误消息
function showError(message) {
    showMessage(message, 'error');
}

// 显示消息
function showMessage(message, type) {
    // 创建消息元素
    const messageEl = document.createElement('div');
    messageEl.textContent = message;
    messageEl.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
        ${type === 'success' ? 'background: #48bb78;' : 'background: #f56565;'}
    `;
    
    document.body.appendChild(messageEl);
    
    // 3秒后自动移除
    setTimeout(() => {
        messageEl.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.parentNode.removeChild(messageEl);
            }
        }, 300);
    }, 3000);
}

// HTML转义
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 添加CSS动画
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// 点击模态框外部关闭
window.onclick = function(event) {
    const uploadModal = document.getElementById('uploadModal');
    const lyricModal = document.getElementById('lyricModal');
    
    if (event.target === uploadModal) {
        closeUploadModal();
    }
    if (event.target === lyricModal) {
        closeLyricModal();
    }
}