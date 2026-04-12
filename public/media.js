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
                <span class="media-published-badge ${media.published ? 'published' : 'draft'}">
                    ${media.published ? '已发布' : '草稿'}
                </span>
            </div>
            <div class="media-info">
                <div class="media-title">${media.title || media.originalName}</div>
                <div class="media-description">${media.description || '暂无描述'}</div>
                <div class="media-meta">
                    ${media.lyric ? '📝 有歌词' : ''} | ${formatFileSize(media.size)}
                </div>
                <div class="media-actions">
                    <button class="btn-play" onclick="playMedia('${media.filename}')">▶ 播放</button>
                    <button class="btn-edit" onclick="editMedia('${media.filename}')">✏️ 编辑</button>
                    <button class="btn-delete" onclick="deleteMedia('${media.filename}')">🗑️ 删除</button>
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

function editMedia(filename) {
    const media = mediaList.find(m => m.filename === filename);
    if (!media) return;

    document.getElementById('editFilename').value = filename;
    document.getElementById('editTitle').value = media.title || '';
    document.getElementById('editDescription').value = media.description || '';
    document.getElementById('editType').value = media.type || 1;
    document.getElementById('editWaveform').value = media.waveform || 'bars';
    document.getElementById('editPublished').value = media.published ? 'true' : 'false';
    
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
    const published = document.getElementById('editPublished').value === 'true';

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
        closeEditModal();
        loadMediaList();
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

document.addEventListener('DOMContentLoaded', function() {
    loadMediaList();
});
