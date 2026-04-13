const DOWNLOAD_DIR = 'download';
const MEDIA_DB_FILE = 'media.json';
let mediaList = [];

async function loadMediaList() {
    try {
        const response = await fetch('/api/media');
        if (!response.ok) throw new Error('获取媒体列表失败');
        mediaList = await response.json();
        renderMediaGrid();
        updateStats();
    } catch (error) {
        console.error('加载媒体列表失败:', error);
        document.getElementById('mediaGrid').innerHTML = `
            <div class="empty-state">
                <div class="icon">📁</div>
                <h3>加载失败</h3>
                <p>${error.message}</p>
            </div>
        `;
    }
}

function renderMediaGrid() {
    const grid = document.getElementById('mediaGrid');
    
    if (mediaList.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <div class="icon">🎵</div>
                <h3>暂无音视频文件</h3>
                <p>请将音视频文件放入 download 文件夹</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = mediaList.map(media => `
        <div class="media-card" data-filename="${media.filename}">
            <div class="media-cover">
                ${media.cover ? `<img src="/media/covers/${media.cover}" alt="封面">` : '<div class="cover-placeholder">🎵</div>'}
                <span class="media-type-badge ${media.type === 1 ? 'song' : 'instrumental'}">
                    ${media.type === 1 ? '歌曲' : '纯音乐'}
                </span>
                <span class="media-published-badge ${getPublishedBadgeClass(media.published)}">
                    ${getPublishedStatusText(media.published)}
                </span>
            </div>
            <div class="media-info">
                <div class="media-title">${media.title || media.originalName}</div>
                <div class="media-description">${media.description || '暂无描述'}</div>
                <div class="media-meta">
                    ${media.lyric ? '📝 有歌词' : ''} | ${formatFileSize(media.size)}
                </div>
                <div class="media-actions">
                    <button class="btn-play" onclick="playMedia('${media.filename}')" title="播放">▶</button>
                    <button class="btn-edit" onclick="editMedia('${media.filename}')" title="编辑">✏️</button>
                    <button class="btn-video" onclick="generateVideo('${media.filename}')" title="生成视频">🎬</button>
                    ${media.published === 1 ? `<button class="btn-publish" onclick="publishVideo('${media.filename}')" title="发布到抖音">🚀</button>` : ''}
                    <button class="btn-delete" onclick="deleteMedia('${media.filename}')" title="删除">🗑️</button>
                </div>
            </div>
        </div>
    `).join('');
}

function updateStats() {
    const total = mediaList.length;
    const audio = mediaList.filter(m => m.isAudio).length;
    const video = mediaList.filter(m => m.isVideo).length;
    
    document.getElementById('totalFiles').textContent = total;
    document.getElementById('audioFiles').textContent = audio;
    document.getElementById('videoFiles').textContent = video;
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

function refreshMedia() {
    loadMediaList();
}

function getPublishedBadgeClass(published) {
    if (published === 2) return 'published';
    if (published === 1) return 'video-generated';
    return 'draft';
}

function getPublishedStatusText(published) {
    if (published === 2) return '已发布';
    if (published === 1) return '视频已生成';
    return '未发布';
}

function editMedia(filename) {
    const media = mediaList.find(m => m.filename === filename);
    if (!media) return;

    document.getElementById('editFilename').value = filename;
    document.getElementById('editTitle').value = media.title || '';
    document.getElementById('editDescription').value = media.description || '';
    document.getElementById('editType').value = media.type || 1;
    document.getElementById('editWaveform').value = media.waveform || 'bars';
    document.getElementById('editPublished').value = media.published !== undefined ? media.published : 0;
    
    const coverPreview = document.getElementById('coverPreview');
    const coverImage = document.getElementById('coverImage');
    const coverPlaceholder = document.getElementById('coverPlaceholder');
    
    if (media.cover) {
        coverImage.src = `/media/covers/${media.cover}`;
        coverImage.style.display = 'block';
        coverPlaceholder.style.display = 'none';
    } else {
        coverImage.src = '';
        coverImage.style.display = 'none';
        coverPlaceholder.style.display = 'flex';
    }

    document.getElementById('lyricFilename').textContent = media.lyric ? media.lyric : '未上传歌词';

    document.getElementById('editModal').classList.add('active');
}

function closeEditModal() {
    document.getElementById('editModal').classList.remove('active');
    document.getElementById('editForm').reset();
}

let currentEditFilename = '';

function generateBackground() {
    const filename = document.getElementById('editFilename').value;
    const title = document.getElementById('editTitle').value;
    const description = document.getElementById('editDescription').value;
    const type = parseInt(document.getElementById('editType').value);
    
    if (!filename) {
        alert('请先选择要编辑的文件');
        return;
    }
    
    const btn = document.getElementById('generateBgBtn');
    btn.disabled = true;
    btn.textContent = '⏳ 正在生成提示词...';
    
    fetch('/api/media/generate-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, type })
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            throw new Error(data.error);
        }
        
        btn.textContent = '⏳ 正在生成图片...';
        return fetch('/api/media/generate-background', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename, prompt: data.prompt })
        });
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            throw new Error(data.error);
        }
        
        const coverImage = document.getElementById('coverImage');
        const coverPlaceholder = document.getElementById('coverPlaceholder');
        coverImage.src = `/media/covers/${data.cover}?t=${Date.now()}`;
        coverImage.style.display = 'block';
        coverPlaceholder.style.display = 'none';
        
        btn.textContent = '✅ 生成成功';
        setTimeout(() => {
            btn.disabled = false;
            btn.textContent = '🎨 AI生成背景';
        }, 2000);
        
        loadMediaList();
    })
    .catch(error => {
        alert('生成背景失败: ' + error.message);
        btn.disabled = false;
        btn.textContent = '🎨 AI生成背景';
    });
}

document.getElementById('editCoverFile').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const coverImage = document.getElementById('coverImage');
        const coverPlaceholder = document.getElementById('coverPlaceholder');
        coverImage.src = e.target.result;
        coverImage.style.display = 'block';
        coverPlaceholder.style.display = 'none';
    };
    reader.readAsDataURL(file);
});

document.getElementById('editLyricFile').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    document.getElementById('lyricFilename').textContent = file.name;
});

async function saveMediaInfo() {
    const filename = document.getElementById('editFilename').value;
    const title = document.getElementById('editTitle').value;
    const description = document.getElementById('editDescription').value;
    const type = parseInt(document.getElementById('editType').value);
    const waveform = document.getElementById('editWaveform').value;
    const published = parseInt(document.getElementById('editPublished').value);

    const coverFile = document.getElementById('editCoverFile').files[0];
    const lyricFile = document.getElementById('editLyricFile').files[0];

    const formData = new FormData();
    formData.append('filename', filename);
    formData.append('title', title);
    formData.append('description', description);
    formData.append('type', type);
    formData.append('waveform', waveform);
    formData.append('published', published);

    if (coverFile) {
        formData.append('cover', coverFile);
    }
    if (lyricFile) {
        formData.append('lyric', lyricFile);
    }

    try {
        const response = await fetch('/api/media/update', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || '保存失败');
        }

        alert('保存成功');
        
        await loadMediaList();
        
        const filename = document.getElementById('editFilename').value;
        const updatedMedia = mediaList.find(m => m.filename === filename);
        if (updatedMedia && updatedMedia.cover) {
            document.getElementById('coverImage').src = `/media/covers/${updatedMedia.cover}?t=${Date.now()}`;
            document.getElementById('coverImage').style.display = 'block';
            document.getElementById('coverPlaceholder').style.display = 'none';
        }
        
        closeEditModal();
    } catch (error) {
        alert('保存失败: ' + error.message);
    }
}

function playMedia(filename) {
    const media = mediaList.find(m => m.filename === filename);
    if (!media) return;

    document.getElementById('playTitle').textContent = media.title || media.originalName;
    document.getElementById('playerSongTitle').textContent = media.title || media.originalName;
    document.getElementById('playerDescription').textContent = media.description || '暂无描述';

    const playerCover = document.getElementById('playerCover');
    if (media.cover) {
        playerCover.innerHTML = `<img src="/media/covers/${media.cover}" alt="封面">`;
    } else {
        playerCover.innerHTML = '<div class="cover-placeholder">🎵</div>';
    }

    const audioPlayer = document.getElementById('audioPlayer');
    audioPlayer.src = `/download/${encodeURIComponent(filename)}`;

    document.getElementById('playModal').classList.add('active');
}

function closePlayModal() {
    document.getElementById('playModal').classList.remove('active');
    const audioPlayer = document.getElementById('audioPlayer');
    audioPlayer.pause();
    audioPlayer.src = '';
}

async function generateVideo(filename) {
    const media = mediaList.find(m => m.filename === filename);
    if (!media) {
        alert('未找到媒体文件');
        return;
    }

    if (!media.cover) {
        alert('请先上传封面图片再生成视频');
        return;
    }

    try {
        const coverCheck = await fetch(`/media/covers/${encodeURIComponent(media.cover)}`, { method: 'HEAD' });
        if (!coverCheck.ok) {
            alert('封面图片不存在，请重新上传');
            return;
        }
    } catch (e) {
        alert('封面图片验证失败，请重新上传');
        return;
    }

    if (!confirm(`确定要生成视频吗？\n音频: ${media.filename}\n封面: ${media.cover}\n波形: ${media.waveform === 'bars' ? '柱状波' : media.waveform}`)) {
        return;
    }

    try {
        const formData = new FormData();
        formData.append('audio', await fetchAudioFile(media.filename));
        formData.append('image', await fetchImageFile(media.cover));
        formData.append('configName', media.waveform === 'bars' ? '柱状波' : media.waveform);

        const response = await fetch('http://localhost:3200/api/export-external', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        
        if (result.taskId) {
            alert(`视频生成任务已提交！\n任务ID: ${result.taskId}\n\n正在查询状态...`);
            await checkExportStatus(result.taskId, filename);
        } else {
            alert('视频生成任务已提交: ' + JSON.stringify(result));
        }
    } catch (error) {
        alert('生成视频失败: ' + error.message);
    }
}

async function fetchAudioFile(filename) {
    const response = await fetch(`/download/${encodeURIComponent(filename)}`);
    const blob = await response.blob();
    return new File([blob], filename, { type: blob.type });
}

async function fetchImageFile(filename) {
    const response = await fetch(`/media/covers/${encodeURIComponent(filename)}`);
    const blob = await response.blob();
    const ext = filename.split('.').pop();
    const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
    return new File([blob], filename, { type: mimeType });
}

async function checkExportStatus(taskId, filename) {
    const maxAttempts = 600;
    let attempts = 0;
    
    while (attempts < maxAttempts) {
        try {
            const response = await fetch(`http://localhost:3200/api/export/status/${taskId}`);
            const result = await response.json();
            
            console.log('导出状态:', result);
            
            if (result.status === 'completed' || result.status === 'success') {
                alert('视频生成完成！');
                const outputFile = result.outputUrl || result.outputFile || '';
                await updatePublishedStatus(filename, 1, outputFile);
                loadMediaList();
                return;
            } else if (result.status === 'failed' || result.status === 'error') {
                alert('视频生成失败: ' + (result.message || '未知错误'));
                return;
            }
            
            attempts++;
            await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
            console.error('查询状态失败:', error);
            attempts++;
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    
    alert('视频生成超时，请稍后手动查询状态');
}

async function updatePublishedStatus(filename, published, outputFile = '') {
    const media = mediaList.find(m => m.filename === filename);
    if (!media) return;

    const formData = new FormData();
    formData.append('filename', filename);
    formData.append('title', media.title || '');
    formData.append('description', media.description || '');
    formData.append('type', media.type || 1);
    formData.append('waveform', media.waveform || 'bars');
    formData.append('published', published);
    if (outputFile) {
        formData.append('outputFile', outputFile);
    }

    await fetch('/api/media/update', {
        method: 'POST',
        body: formData
    });
}

async function deleteMedia(filename) {
    if (!confirm(`确定要删除 "${filename}" 吗？此操作不可恢复！`)) {
        return;
    }

    try {
        const response = await fetch(`/api/media/delete?filename=${encodeURIComponent(filename)}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || '删除失败');
        }

        alert('删除成功');
        loadMediaList();
    } catch (error) {
        alert('删除失败: ' + error.message);
    }
}

async function publishVideo(filename) {
    if (!confirm(`确定要发布 "${filename}" 到抖音吗？`)) {
        return;
    }

    try {
        const response = await fetch('/api/media/publish', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ filename })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || '发布失败');
        }

        alert('发布成功！');
        loadMediaList();
    } catch (error) {
        alert('发布失败: ' + error.message);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    loadMediaList();
});
