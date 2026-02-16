// ==================== KONFIGURASI API ====================
const API_BASE = 'https://www.sankavollerei.com/anime/samehadaku';

// ==================== STATE MANAGEMENT ====================
let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
let favorites = JSON.parse(localStorage.getItem('favorites')) || [];
let watchHistory = JSON.parse(localStorage.getItem('watchHistory')) || [];
let downloads = JSON.parse(localStorage.getItem('downloads')) || [];
let offlineData = JSON.parse(localStorage.getItem('offlineData')) || {};
let isOnline = navigator.onLine;
let searchTimeout = null;
let currentPage = 'home';
let selectedPlan = null;
let selectedPayment = 'SociaBuzz';

// ==================== GOOGLE LOGIN CONFIG ====================
const GOOGLE_CLIENT_ID = 'YOUR_CLIENT_ID.apps.googleusercontent.com';

// ==================== DOM ELEMENTS ====================
const splash = document.getElementById('splash');
const app = document.getElementById('app');
const mainContent = document.getElementById('mainContent');
const searchBar = document.getElementById('searchBar');
const searchInput = document.getElementById('searchInput');
const sideMenu = document.getElementById('sideMenu');
const overlay = document.getElementById('overlay');
const loginModal = document.getElementById('loginModal');
const premiumModal = document.getElementById('premiumModal');
const offlineNotification = document.getElementById('offlineNotification');
const userName = document.getElementById('userName');
const userStatus = document.getElementById('userStatus');
const historyBadge = document.getElementById('historyBadge');
const continueBadge = document.getElementById('continueBadge');
const downloadBadge = document.getElementById('downloadBadge');

// ==================== VIDEO PLAYER GLOBAL ====================
let currentEpisodeData = null;
let currentEpisodeId = null;
let availableServers = {};

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
        splash.style.display = 'none';
        app.style.display = 'block';
        loadPage('home');
    }, 2500);

    setupEventListeners();
    updateUserUI();
    
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    updateBadges();
    loadOfflineData();
    
    initGoogleLogin();
    checkPremiumActivation();
    
    if (!currentUser) {
        setTimeout(function() {
            showLoginModal();
        }, 3000);
    }
});

function setupEventListeners() {
    document.getElementById('searchToggle').addEventListener('click', toggleSearch);
    document.getElementById('closeSearch').addEventListener('click', toggleSearch);
    
    searchInput.addEventListener('input', function(e) {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(function() {
            if (e.target.value.trim()) {
                searchAnime(e.target.value);
            }
        }, 500);
    });
    
    document.getElementById('menuToggle').addEventListener('click', openMenu);
    document.getElementById('closeMenu').addEventListener('click', closeMenu);
    overlay.addEventListener('click', closeMenu);
    
    document.querySelectorAll('.nav-item').forEach(function(item) {
        item.addEventListener('click', function() {
            var page = item.dataset.page;
            if (page === 'search') {
                toggleSearch();
            } else {
                navigateTo(page);
            }
        });
    });
    
    document.querySelectorAll('.menu-item').forEach(function(item) {
        item.addEventListener('click', function() {
            var page = item.dataset.page;
            closeMenu();
            if (page) {
                if (page === 'logout') {
                    handleLogout();
                } else {
                    navigateTo(page);
                }
            }
        });
    });
    
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
}

// ==================== NAVIGATION ====================
function navigateTo(page) {
    currentPage = page;
    
    document.querySelectorAll('.nav-item').forEach(function(item) {
        if (item.dataset.page === page) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    document.querySelectorAll('.menu-item').forEach(function(item) {
        if (item.dataset.page === page) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    loadPage(page);
}

async function loadPage(page) {
    showLoading();
    
    try {
        if (page === 'home') {
            await loadHome();
        } else if (page === 'schedule') {
            await loadSchedule();
        } else if (page === 'ongoing') {
            await loadOngoing();
        } else if (page === 'completed') {
            await loadCompleted();
        } else if (page === 'popular') {
            await loadPopular();
        } else if (page === 'movies') {
            await loadMovies();
        } else if (page === 'genres') {
            loadGenres();
        } else if (page === 'batch') {
            loadBatch();
        } else if (page === 'favorites') {
            loadFavorites();
        } else if (page === 'history') {
            loadHistory();
        } else if (page === 'continue') {
            loadContinue();
        } else if (page === 'downloads') {
            loadDownloads();
        } else if (page === 'premium') {
            showPremiumModal();
        } else if (page === 'settings') {
            loadSettings();
        } else {
            await loadHome();
        }
        
        offlineNotification.style.display = 'none';
        
    } catch (error) {
        console.error('Page error:', error);
        if (!isOnline && offlineData[page]) {
            renderOfflinePage(page);
        } else {
            showError('Gagal memuat halaman. ' + error.message);
        }
    }
}

// ==================== API FUNCTIONS ====================
async function fetchAPI(endpoint) {
    var url = API_BASE + endpoint;
    console.log('Fetching:', url);
    
    try {
        var response = await fetch(url);
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            throw new Error('HTTP ' + response.status);
        }
        
        var data = await response.json();
        console.log('Response data:', data);
        
        if (data.status === 'success' && data.data) {
            var key = endpoint.split('?')[0].replace(/\//g, '_');
            cacheOfflineData(key, data);
        }
        
        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

function cacheOfflineData(key, data) {
    offlineData[key] = {
        data: data,
        timestamp: Date.now()
    };
    localStorage.setItem('offlineData', JSON.stringify(offlineData));
}

function loadOfflineData() {
    offlineData = JSON.parse(localStorage.getItem('offlineData')) || {};
}

function renderOfflinePage(page) {
    var data = offlineData[page]?.data;
    if (data) {
        mainContent.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <i class="fas fa-database" style="font-size: 48px; color: var(--primary);"></i>
                <h3>Mode Offline</h3>
                <p>Menampilkan data tersimpan dari ${new Date(offlineData[page].timestamp).toLocaleString()}</p>
            </div>
        `;
    } else {
        showError('Tidak ada data offline');
    }
}

// ==================== HOME PAGE ====================
async function loadHome() {
    showLoading();
    
    try {
        var popularData, ongoingData;
        
        try {
            popularData = await fetchAPI('/popular?page=1');
        } catch (e) {
            console.log('Gagal ambil popular, coba dari cache');
            popularData = offlineData['_popular?page=1']?.data;
        }
        
        try {
            ongoingData = await fetchAPI('/ongoing?page=1');
        } catch (e) {
            console.log('Gagal ambil ongoing, coba dari cache');
            ongoingData = offlineData['_ongoing?page=1']?.data;
        }
        
        var popularAnime = popularData?.data?.animeList || [];
        var ongoingAnime = ongoingData?.data?.animeList || [];
        
        var html = '';
        
        if (popularAnime.length > 0) {
            html += `
                <div class="section-header">
                    <h2>🔥 Popular Anime</h2>
                    <span class="view-all" onclick="navigateTo('popular')">Lihat Semua</span>
                </div>
                <div class="horizontal-scroll">
            `;
            
            popularAnime.slice(0, 15).forEach(function(anime) {
                html += `
                    <div class="horizontal-card" onclick="showAnimeDetail('${anime.animeId}')">
                        <img src="${anime.poster || 'https://via.placeholder.com/120x180'}" 
                             alt="${anime.title}"
                             onerror="this.src='https://via.placeholder.com/120x180'">
                        <div class="title">${anime.title || 'Unknown'}</div>
                        <span class="score">⭐ ${anime.score || 'N/A'}</span>
                    </div>
                `;
            });
            
            html += `</div>`;
        }
        
        if (ongoingAnime.length > 0) {
            html += `
                <div class="section-header" style="margin-top: 30px;">
                    <h2>📺 Ongoing Anime</h2>
                    <span class="view-all" onclick="navigateTo('ongoing')">Lihat Semua</span>
                </div>
                <div class="horizontal-scroll">
            `;
            
            ongoingAnime.slice(0, 15).forEach(function(anime) {
                html += `
                    <div class="horizontal-card" onclick="showAnimeDetail('${anime.animeId}')">
                        <img src="${anime.poster || 'https://via.placeholder.com/120x180'}" 
                             alt="${anime.title}"
                             onerror="this.src='https://via.placeholder.com/120x180'">
                        <div class="title">${anime.title || 'Unknown'}</div>
                        <span class="status ongoing">Ongoing</span>
                    </div>
                `;
            });
            
            html += `</div>`;
        }
        
        if (!html) {
            html = getMockHomeData();
        }
        
        mainContent.innerHTML = html;
        
    } catch (error) {
        console.error('Home error, using mock data:', error);
        mainContent.innerHTML = getMockHomeData();
    }
}

function getMockHomeData() {
    var mockPopular = [
        { title: 'One Piece', score: '8.73', poster: 'https://via.placeholder.com/120x180', animeId: 'one-piece' },
        { title: 'Jujutsu Kaisen', score: '8.5', poster: 'https://via.placeholder.com/120x180', animeId: 'jujutsu-kaisen' },
        { title: 'Kimetsu no Yaiba', score: '8.7', poster: 'https://via.placeholder.com/120x180', animeId: 'kimetsu' },
        { title: 'Attack on Titan', score: '9.0', poster: 'https://via.placeholder.com/120x180', animeId: 'aot' }
    ];
    
    var mockOngoing = [
        { title: 'One Piece', poster: 'https://via.placeholder.com/120x180', animeId: 'one-piece' },
        { title: 'Spy x Family', poster: 'https://via.placeholder.com/120x180', animeId: 'spy-x-family' },
        { title: 'Bleach', poster: 'https://via.placeholder.com/120x180', animeId: 'bleach' }
    ];
    
    var html = `
        <div class="section-header">
            <h2>🔥 Popular Anime</h2>
            <span class="view-all" onclick="navigateTo('popular')">Lihat Semua</span>
        </div>
        <div class="horizontal-scroll">
    `;
    
    mockPopular.forEach(function(anime) {
        html += `
            <div class="horizontal-card" onclick="showAnimeDetail('${anime.animeId}')">
                <img src="${anime.poster}" alt="${anime.title}">
                <div class="title">${anime.title}</div>
                <span class="score">⭐ ${anime.score}</span>
            </div>
        `;
    });
    
    html += `</div>`;
    
    html += `
        <div class="section-header" style="margin-top: 30px;">
            <h2>📺 Ongoing Anime</h2>
            <span class="view-all" onclick="navigateTo('ongoing')">Lihat Semua</span>
        </div>
        <div class="horizontal-scroll">
    `;
    
    mockOngoing.forEach(function(anime) {
        html += `
            <div class="horizontal-card" onclick="showAnimeDetail('${anime.animeId}')">
                <img src="${anime.poster}" alt="${anime.title}">
                <div class="title">${anime.title}</div>
                <span class="status ongoing">Ongoing</span>
            </div>
        `;
    });
    
    html += `</div>`;
    
    return html;
}

// ==================== VIDEO PLAYER (VERSION SUPER SIMPLE) ====================
async function showEpisode(episodeId) {
    showLoading();
    
    try {
        var response = await fetch('https://www.sankavollerei.com/anime/samehadaku/episode/' + episodeId);
        var data = await response.json();
        var episode = data?.data || {};
        
        console.log('Episode data:', episode);
        
        addToHistory({
            animeId: episode.animeId || episodeId.split('-')[0],
            episodeId: episodeId,
            title: episode.title || 'Episode',
            poster: episode.poster || 'https://via.placeholder.com/60x80',
            episode: episode.episode || episodeId.split('-').pop(),
            progress: 0,
            timestamp: new Date().toLocaleString()
        });
        
        // Kumpulkan semua server
        var serverList = [];
        if (episode.server && episode.server.qualities) {
            for (var i = 0; i < episode.server.qualities.length; i++) {
                var quality = episode.server.qualities[i];
                if (quality.serverList && quality.serverList.length > 0) {
                    for (var j = 0; j < quality.serverList.length; j++) {
                        var server = quality.serverList[j];
                        serverList.push({
                            name: quality.title + ' - ' + server.title,
                            id: server.serverId
                        });
                    }
                }
            }
        }
        
        // Buat HTML dengan dropdown resolusi
        var optionsHtml = '';
        if (serverList.length > 0) {
            for (var k = 0; k < serverList.length; k++) {
                var s = serverList[k];
                optionsHtml += '<option value="' + s.id + '">' + s.name + '</option>';
            }
        }
        
        var html = `
            <div class="video-container">
                <div class="video-player" id="videoPlayerContainer" style="background: #000; min-height: 300px; display: flex; align-items: center; justify-content: center;">
                    <div style="text-align: center; color: white;">
                        <i class="fas fa-spinner fa-spin" style="font-size: 48px; margin-bottom: 15px;"></i>
                        <p>Memuat video...</p>
                    </div>
                </div>
                
                <div class="video-info">
                    <h2 class="video-title">${episode.title || 'Episode ' + episodeId}</h2>
                    
                    <div style="display: flex; align-items: center; gap: 15px; margin: 15px 0;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <label for="serverSelect" style="font-weight: 600;">Resolusi:</label>
                            <select id="serverSelect" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface); width: 200px;">
                                ${optionsHtml || '<option>Tidak ada server</option>'}
                            </select>
                        </div>
                        
                        <div style="display: flex; gap: 10px; margin-left: auto;">
                            ${episode.hasPrevEpisode ? 
                                '<button class="nav-btn" onclick="showEpisode(\'' + episode.prevEpisode.episodeId + '\')"><i class="fas fa-chevron-left"></i> Prev</button>' : ''}
                            <button class="nav-btn" onclick="showAnimeDetail(\'' + (episode.animeId || episodeId.split('-')[0]) + '\')"><i class="fas fa-info-circle"></i> Detail</button>
                            ${episode.hasNextEpisode ? 
                                '<button class="nav-btn" onclick="showEpisode(\'' + episode.nextEpisode.episodeId + '\')">Next <i class="fas fa-chevron-right"></i></button>' : ''}
                        </div>
                    </div>
                    
                    <h3 style="margin-top: 20px;">📥 Download</h3>
                    <div class="download-links">
        `;
        
        // Tambah link download
        if (episode.downloadUrl && episode.downloadUrl.formats) {
            for (var f = 0; f < episode.downloadUrl.formats.length; f++) {
                var format = episode.downloadUrl.formats[f];
                if (format.qualities) {
                    for (var q = 0; q < format.qualities.length; q++) {
                        var quality = format.qualities[q];
                        if (quality.urls) {
                            for (var u = 0; u < quality.urls.length; u++) {
                                var url = quality.urls[u];
                                html += '<a href="' + url.url + '" target="_blank" class="download-link" rel="noopener noreferrer">' + url.title + ' - ' + quality.title + '</a>';
                            }
                        }
                    }
                }
            }
        } else {
            html += '<p>Tidak ada link download tersedia</p>';
        }
        
        html += `
                    </div>
                </div>
            </div>
        `;
        
        mainContent.innerHTML = html;
        
        // Auto pilih server pertama dan play
        if (serverList.length > 0) {
            var firstServerId = serverList[0].id;
            loadSimpleServer(firstServerId, episodeId);
        }
        
        // Event listener untuk ganti server
        var serverSelect = document.getElementById('serverSelect');
        if (serverSelect) {
            serverSelect.addEventListener('change', function(e) {
                var container = document.getElementById('videoPlayerContainer');
                container.innerHTML = `
                    <div style="text-align: center; color: white;">
                        <i class="fas fa-spinner fa-spin" style="font-size: 48px; margin-bottom: 15px;"></i>
                        <p>Mengganti resolusi...</p>
                    </div>
                `;
                loadSimpleServer(e.target.value, episodeId);
            });
        }
        
    } catch (error) {
        console.error('Episode error:', error);
        showError('Gagal memuat episode: ' + error.message);
    }
}

// Fungsi sederhana untuk load server
async function loadSimpleServer(serverId, episodeId) {
    var container = document.getElementById('videoPlayerContainer');
    if (!container) return;
    
    try {
        var response = await fetch('https://www.sankavollerei.com/anime/samehadaku/server/' + serverId);
        var data = await response.json();
        
        var videoUrl = data.data?.url || data.url || data.video || data.stream || data.source || data.link;
        
        if (!videoUrl) {
            throw new Error('URL video tidak ditemukan');
        }
        
        // Bersihkan container
        container.innerHTML = '';
        
        // Cek tipe video
        if (videoUrl.indexOf('blogger.com') > -1) {
            var iframe = document.createElement('iframe');
            iframe.src = videoUrl;
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.border = 'none';
            iframe.allowFullscreen = true;
            container.appendChild(iframe);
        } else {
            var video = document.createElement('video');
            video.controls = true;
            video.autoplay = true;
            video.playsInline = true;
            video.style.width = '100%';
            video.style.height = '100%';
            
            var source = document.createElement('source');
            source.src = videoUrl;
            source.type = 'video/mp4';
            
            video.appendChild(source);
            container.appendChild(video);
            
            // Tracking progress
            video.addEventListener('timeupdate', function() {
                var progress = (video.currentTime / video.duration) * 100;
                if (!isNaN(progress)) {
                    updateHistoryProgress(episodeId, progress);
                }
            });
        }
        
    } catch (error) {
        console.error('Server error:', error);
        container.innerHTML = `
            <div style="text-align: center; color: white;">
                <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 15px; color: #f56565;"></i>
                <p>Gagal memuat video</p>
                <button class="nav-btn" style="margin-top: 10px;" onclick="showEpisode('${episodeId}')">
                    Kembali
                </button>
            </div>
        `;
    }
}

// ==================== SEARCH ====================
async function searchAnime(keyword) {
    if (!keyword) return;
    
    showLoading();
    
    try {
        var data;
        try {
            data = await fetchAPI('/search?q=' + encodeURIComponent(keyword));
        } catch (e) {
            data = offlineData['_search?q=' + keyword]?.data;
        }
        
        var results = data?.data?.animeList || [];
        
        var html = '<h2 style="margin-bottom: 20px;">Hasil pencarian: "' + keyword + '"</h2>';
        
        if (results.length === 0) {
            html += '<p>Tidak ditemukan.</p>';
        } else {
            html += '<div class="anime-grid">';
            results.forEach(function(anime) {
                html += createAnimeCard(anime);
            });
            html += '</div>';
        }
        
        mainContent.innerHTML = html;
    } catch (error) {
        showError('Pencarian gagal: ' + error.message);
    }
}

// ==================== FAVORITES ====================
function toggleFavorite(animeId) {
    if (!currentUser) {
        showLoginModal();
        return;
    }
    
    if (favorites.indexOf(animeId) > -1) {
        favorites = favorites.filter(function(id) { return id !== animeId; });
    } else {
        favorites.push(animeId);
    }
    
    localStorage.setItem('favorites', JSON.stringify(favorites));
    
    var btn = document.querySelector('.favorite-btn');
    if (btn) {
        var isFavorite = favorites.indexOf(animeId) > -1;
        btn.className = 'favorite-btn ' + (isFavorite ? 'in-favorite' : 'not-favorite');
        btn.innerHTML = '<i class="fas fa-heart"></i> ' + (isFavorite ? 'Hapus dari Favorit' : 'Tambah ke Favorit');
    }
    
    updateBadges();
}

function removeFromFavorites(animeId) {
    favorites = favorites.filter(function(id) { return id !== animeId; });
    localStorage.setItem('favorites', JSON.stringify(favorites));
    loadFavorites();
    updateBadges();
}

// ==================== HISTORY ====================
function addToHistory(item) {
    watchHistory = [item].concat(watchHistory.filter(function(h) { return h.episodeId !== item.episodeId; })).slice(0, 50);
    localStorage.setItem('watchHistory', JSON.stringify(watchHistory));
    updateBadges();
}

function updateHistoryProgress(episodeId, progress) {
    var index = -1;
    for (var i = 0; i < watchHistory.length; i++) {
        if (watchHistory[i].episodeId === episodeId) {
            index = i;
            break;
        }
    }
    if (index !== -1) {
        watchHistory[index].progress = progress;
        localStorage.setItem('watchHistory', JSON.stringify(watchHistory));
    }
}

function removeFromHistory(episodeId) {
    watchHistory = watchHistory.filter(function(h) { return h.episodeId !== episodeId; });
    localStorage.setItem('watchHistory', JSON.stringify(watchHistory));
    loadHistory();
    updateBadges();
}

function continueWatching(animeId, episodeId) {
    showEpisode(episodeId);
}

// ==================== LOAD OTHER PAGES (SIMPLIFIED) ====================
async function loadOngoing() {
    try {
        var data;
        try {
            data = await fetchAPI('/ongoing?page=1');
        } catch (e) {
            data = offlineData['_ongoing?page=1']?.data;
        }
        
        var animeList = data?.data?.animeList || [];
        
        var html = '<h2 style="margin-bottom: 20px;">Ongoing Anime</h2>';
        
        if (animeList.length === 0) {
            html += '<p>Tidak ada data.</p>';
        } else {
            html += '<div class="anime-grid">';
            animeList.forEach(function(anime) {
                html += createAnimeCard(anime);
            });
            html += '</div>';
        }
        
        mainContent.innerHTML = html;
    } catch (error) {
        showError('Gagal memuat ongoing');
    }
}

async function loadCompleted() {
    try {
        var data;
        try {
            data = await fetchAPI('/completed?page=1');
        } catch (e) {
            data = offlineData['_completed?page=1']?.data;
        }
        
        var animeList = data?.data?.animeList || [];
        
        var html = '<h2 style="margin-bottom: 20px;">Completed Anime</h2>';
        
        if (animeList.length === 0) {
            html += '<p>Tidak ada data.</p>';
        } else {
            html += '<div class="anime-grid">';
            animeList.forEach(function(anime) {
                html += createAnimeCard(anime);
            });
            html += '</div>';
        }
        
        mainContent.innerHTML = html;
    } catch (error) {
        showError('Gagal memuat completed');
    }
}

async function loadPopular() {
    try {
        var data;
        try {
            data = await fetchAPI('/popular?page=1');
        } catch (e) {
            data = offlineData['_popular?page=1']?.data;
        }
        
        var animeList = data?.data?.animeList || [];
        
        var html = '<h2 style="margin-bottom: 20px;">Popular Anime</h2>';
        
        if (animeList.length === 0) {
            html += '<p>Tidak ada data.</p>';
        } else {
            html += '<div class="anime-grid">';
            animeList.forEach(function(anime) {
                html += createAnimeCard(anime);
            });
            html += '</div>';
        }
        
        mainContent.innerHTML = html;
    } catch (error) {
        showError('Gagal memuat popular');
    }
}

async function loadMovies() {
    try {
        var data;
        try {
            data = await fetchAPI('/movies');
        } catch (e) {
            data = offlineData['_movies']?.data;
        }
        
        var movies = data?.data?.animeList || [];
        
        var html = '<h2 style="margin-bottom: 20px;">Movie Anime</h2>';
        
        if (movies.length === 0) {
            html += '<p>Tidak ada data.</p>';
        } else {
            html += '<div class="anime-grid">';
            movies.forEach(function(movie) {
                html += createAnimeCard(movie);
            });
            html += '</div>';
        }
        
        mainContent.innerHTML = html;
    } catch (error) {
        showError('Gagal memuat movies');
    }
}

function loadGenres() {
    var genres = [
        'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror',
        'Mecha', 'Mystery', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports',
        'Supernatural', 'Thriller', 'Ecchi', 'Harem', 'Shounen', 'Seinen'
    ];
    
    var html = '<h2 style="margin-bottom: 20px;">Genre Anime</h2>';
    html += '<div style="display: flex; flex-wrap: wrap; gap: 10px;">';
    
    genres.forEach(function(genre) {
        html += '<div class="genre-card" onclick="searchAnime(\'' + genre + '\')"><i class="fas fa-tag"></i> ' + genre + '</div>';
    });
    
    html += '</div>';
    
    mainContent.innerHTML = html;
}

function loadBatch() {
    mainContent.innerHTML = '<h2 style="margin-bottom: 20px;">Batch Download</h2><p>Fitur batch akan segera tersedia</p>';
}

function loadFavorites() {
    if (favorites.length === 0) {
        mainContent.innerHTML = `
            <div style="text-align: center; padding: 50px 20px;">
                <i class="fas fa-heart" style="font-size: 48px; color: var(--text-secondary); margin-bottom: 15px;"></i>
                <p>Belum ada anime favorit</p>
                <p style="color: var(--text-secondary); font-size: 14px; margin-top: 10px;">Tambahkan anime ke favorit dari halaman detail</p>
            </div>
        `;
        return;
    }
    
    var html = '<h2 style="margin-bottom: 20px;">Favorit Saya</h2><div class="anime-grid">';
    favorites.forEach(function(animeId) {
        html += '<div class="anime-card" onclick="showAnimeDetail(\'' + animeId + '\')">' +
                '<img src="https://via.placeholder.com/200x300" alt="' + animeId + '">' +
                '<div class="title">' + animeId.replace(/-/g, ' ') + '</div>' +
                '<button class="delete-btn" style="position: absolute; top: 5px; right: 5px; width: 25px; height: 25px; border-radius: 50%; padding: 0;" onclick="removeFromFavorites(\'' + animeId + '\'); event.stopPropagation();">' +
                '<i class="fas fa-times"></i></button></div>';
    });
    html += '</div>';
    
    mainContent.innerHTML = html;
}

function loadHistory() {
    if (watchHistory.length === 0) {
        mainContent.innerHTML = `
            <div style="text-align: center; padding: 50px 20px;">
                <i class="fas fa-history" style="font-size: 48px; color: var(--text-secondary); margin-bottom: 15px;"></i>
                <p>Belum ada riwayat nonton</p>
                <p style="color: var(--text-secondary); font-size: 14px; margin-top: 10px;">Mulai nonton anime untuk melihat riwayat</p>
            </div>
        `;
        return;
    }
    
    var html = '<h2 style="margin-bottom: 20px;">Riwayat Nonton</h2>';
    
    watchHistory.slice(0, 20).forEach(function(item) {
        html += '<div class="history-item" onclick="continueWatching(\'' + item.animeId + '\', \'' + item.episodeId + '\')">' +
                '<img src="' + (item.poster || 'https://via.placeholder.com/60x80') + '" class="history-poster" onerror="this.src=\'https://via.placeholder.com/60x80\'">' +
                '<div class="history-info">' +
                '<h4 class="history-title">' + item.title + '</h4>' +
                '<div class="history-episode">Episode ' + item.episode + '</div>' +
                '<div class="history-time">' + item.timestamp + '</div>' +
                '<div class="progress-bar"><div class="progress-fill" style="width: ' + item.progress + '%"></div></div>' +
                '</div>' +
                '<button class="delete-btn" onclick="removeFromHistory(\'' + item.episodeId + '\'); event.stopPropagation();"><i class="fas fa-trash"></i></button>' +
                '</div>';
    });
    
    mainContent.innerHTML = html;
}

function loadContinue() {
    var continueList = watchHistory.filter(function(item) { return item.progress < 95; });
    
    if (continueList.length === 0) {
        mainContent.innerHTML = `
            <div style="text-align: center; padding: 50px 20px;">
                <i class="fas fa-play-circle" style="font-size: 48px; color: var(--text-secondary); margin-bottom: 15px;"></i>
                <p>Tidak ada episode yang belum selesai</p>
            </div>
        `;
        return;
    }
    
    var html = '<h2 style="margin-bottom: 20px;">Lanjut Nonton</h2>';
    
    continueList.slice(0, 10).forEach(function(item) {
        html += '<div class="continue-item" onclick="continueWatching(\'' + item.animeId + '\', \'' + item.episodeId + '\')">' +
                '<img src="' + (item.poster || 'https://via.placeholder.com/60x80') + '" class="continue-poster" onerror="this.src=\'https://via.placeholder.com/60x80\'">' +
                '<div class="continue-info">' +
                '<h4 class="continue-title">' + item.title + '</h4>' +
                '<div class="continue-episode">Episode ' + item.episode + '</div>' +
                '<div class="continue-progress">' + Math.round(item.progress) + '% selesai</div>' +
                '<div class="progress-bar"><div class="progress-fill" style="width: ' + item.progress + '%"></div></div>' +
                '</div></div>';
    });
    
    mainContent.innerHTML = html;
}

function loadDownloads() {
    if (downloads.length === 0) {
        mainContent.innerHTML = `
            <div style="text-align: center; padding: 50px 20px;">
                <i class="fas fa-download" style="font-size: 48px; color: var(--text-secondary); margin-bottom: 15px;"></i>
                <p>Belum ada download</p>
                ${currentUser?.premium ? 
                    '<p style="color: var(--text-secondary);">Download episode untuk nonton offline</p>' : 
                    '<p style="color: var(--warning);">Upgrade Premium untuk download unlimited</p>'}
            </div>
        `;
        return;
    }
    
    var html = '<h2 style="margin-bottom: 20px;">Download Saya</h2>';
    
    downloads.forEach(function(item) {
        html += '<div class="download-item">' +
                '<img src="' + (item.poster || 'https://via.placeholder.com/60x80') + '" class="download-poster" onerror="this.src=\'https://via.placeholder.com/60x80\'">' +
                '<div class="download-info">' +
                '<h4 class="download-title">' + item.title + '</h4>' +
                '<div class="download-meta">' +
                '<span class="download-quality">' + item.quality + '</span>' +
                '<span class="download-size">' + item.size + '</span>' +
                '</div>' +
                '<div class="download-progress">' + item.status + '</div>' +
                '<div class="download-actions">' +
                '<button class="download-btn" onclick="playDownload(\'' + item.fileId + '\')"><i class="fas fa-play"></i> Putar</button>' +
                '<button class="delete-btn" onclick="deleteDownload(\'' + item.fileId + '\')"><i class="fas fa-trash"></i> Hapus</button>' +
                '</div></div></div>';
    });
    
    mainContent.innerHTML = html;
}

function loadSettings() {
    var isDark = localStorage.getItem('darkMode') === 'true';
    var notifEnabled = localStorage.getItem('notifications') === 'true';
    
    mainContent.innerHTML = `
        <div class="settings-container">
            <h2 style="margin-bottom: 20px;">Pengaturan</h2>
            
            <div class="settings-section">
                <h3>Akun</h3>
                <div class="setting-item">
                    <span>Status Premium</span>
                    <span class="${currentUser?.premium ? 'badge-live' : ''}">
                        ${currentUser?.premium ? 'Aktif' : 'Tidak Aktif'}
                    </span>
                </div>
                <div class="setting-item">
                    <span>Username</span>
                    <span>${currentUser?.username || 'Guest'}</span>
                </div>
            </div>
            
            <div class="settings-section">
                <h3>Tampilan</h3>
                <div class="setting-item">
                    <span>Mode Gelap</span>
                    <label class="switch">
                        <input type="checkbox" id="darkMode" ${isDark ? 'checked' : ''} onchange="toggleDarkMode()">
                        <span class="slider round"></span>
                    </label>
                </div>
            </div>
            
            <div class="settings-section">
                <h3>Cache</h3>
                <button class="clear-cache-btn" onclick="clearCache()">
                    <i class="fas fa-trash"></i> Hapus Cache
                </button>
            </div>
            
            <div class="about-section">
                <h3>Tentang</h3>
                <p><strong>TeNIME v1.0.0</strong></p>
                <p style="margin-top: 10px;">Aplikasi streaming anime dari Samehadaku API</p>
                <p style="margin-top: 5px; font-size: 11px;">© 2025 TeNIME</p>
            </div>
        </div>
    `;
    
    if (isDark) enableDarkMode();
}

// ==================== ANIME DETAIL ====================
async function showAnimeDetail(animeId) {
    showLoading();
    
    try {
        var data;
        try {
            data = await fetchAPI('/anime/' + animeId);
        } catch (e) {
            console.log('Gagal ambil detail, pakai data mock');
        }
        
        var anime = data?.data || {
            title: animeId.replace(/-/g, ' '),
            poster: 'https://via.placeholder.com/300x400',
            score: { value: '8.5' },
            status: 'Ongoing',
            type: 'TV',
            duration: '24 min',
            genreList: [
                { title: 'Action' },
                { title: 'Adventure' },
                { title: 'Fantasy' }
            ],
            synopsis: { paragraphs: ['Sinopsis tidak tersedia.'] },
            episodeList: []
        };
        
        // Buat episode list dummy kalau kosong
        if (!anime.episodeList || anime.episodeList.length === 0) {
            anime.episodeList = [];
            for (var i = 1; i <= 12; i++) {
                anime.episodeList.push({
                    title: i,
                    episodeId: animeId + '-episode-' + i
                });
            }
        }
        
        var isFavorite = favorites.indexOf(animeId) > -1;
        
        var episodeHtml = '';
        for (var j = 0; j < anime.episodeList.length; j++) {
            var ep = anime.episodeList[j];
            episodeHtml += '<div class="episode-item" onclick="showEpisode(\'' + ep.episodeId + '\')">Episode ' + ep.title + '</div>';
        }
        
        var genreHtml = '';
        if (anime.genreList) {
            for (var g = 0; g < anime.genreList.length; g++) {
                genreHtml += '<span class="genre-tag" onclick="searchAnime(\'' + anime.genreList[g].title + '\')">' + anime.genreList[g].title + '</span>';
            }
        }
        
        var html = `
            <div class="detail-container">
                <div class="detail-header">
                    <img src="${anime.poster || ''}" class="detail-backdrop" alt="" onerror="this.style.display='none'">
                    <img src="${anime.poster || 'https://via.placeholder.com/150x200'}" class="detail-poster" alt="${anime.title}" onerror="this.src='https://via.placeholder.com/150x200'">
                </div>
                
                <div class="detail-info">
                    <h1>${anime.title || anime.english || 'Unknown'}</h1>
                    
                    <div class="detail-meta">
                        <span class="meta-item">⭐ ${anime.score?.value || anime.score || 'N/A'}</span>
                        <span class="meta-item">${anime.status || 'Unknown'}</span>
                        <span class="meta-item">${anime.type || 'Unknown'}</span>
                        <span class="meta-item">${anime.duration || 'Unknown'}</span>
                    </div>
                    
                    <div class="genre-tags">
                        ${genreHtml}
                    </div>
                    
                    <div class="detail-synopsis">
                        ${(anime.synopsis?.paragraphs?.join(' ') || anime.synopsis || 'Tidak ada sinopsis.')}
                    </div>
                    
                    <h3 style="margin: 20px 0 10px;">Daftar Episode</h3>
                    <div class="episode-list">
                        ${episodeHtml}
                    </div>
                    
                    <button class="favorite-btn ${isFavorite ? 'in-favorite' : 'not-favorite'}" onclick="toggleFavorite('${animeId}')">
                        <i class="fas fa-heart"></i> ${isFavorite ? 'Hapus dari Favorit' : 'Tambah ke Favorit'}
                    </button>
                </div>
            </div>
        `;
        
        mainContent.innerHTML = html;
    } catch (error) {
        showError('Gagal memuat detail: ' + error.message);
    }
}

// ==================== SCHEDULE PAGE (SIMPLIFIED) ====================
async function loadSchedule() {
    showLoading();
    
    try {
        var response = await fetch('https://www.sankavollerei.com/anime/samehadaku/schedule');
        var data = await response.json();
        
        if (data.status === 'success' && data.data?.days) {
            var daysData = data.data.days;
            renderSchedule(daysData);
        } else {
            renderMockSchedule();
        }
    } catch (error) {
        console.log('Using mock schedule data');
        renderMockSchedule();
    }
}

function renderSchedule(daysData) {
    var dayMapping = {
        'Monday': 'senin', 'Tuesday': 'selasa', 'Wednesday': 'rabu',
        'Thursday': 'kamis', 'Friday': 'jumat', 'Saturday': 'sabtu', 'Sunday': 'minggu'
    };
    
    var dayDisplay = {
        'senin': 'Senin', 'selasa': 'Selasa', 'rabu': 'Rabu', 'kamis': 'Kamis',
        'jumat': 'Jumat', 'sabtu': 'Sabtu', 'minggu': 'Minggu'
    };
    
    var today = new Date().toLocaleDateString('id-ID', { weekday: 'long' }).toLowerCase();
    var currentDay = localStorage.getItem('currentDay') || 'senin';
    
    var daysTabs = '';
    var dayKeys = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];
    for (var i = 0; i < dayKeys.length; i++) {
        var dayId = dayKeys[i];
        daysTabs += '<div class="day-tab ' + (dayId === currentDay ? 'active' : '') + '" onclick="changeDay(\'' + dayId + '\')">' + dayDisplay[dayId] + '</div>';
    }
    
    var currentDayData = null;
    for (var j = 0; j < daysData.length; j++) {
        var day = daysData[j];
        var mappedDay = dayMapping[day.day];
        if (mappedDay === currentDay) {
            currentDayData = day;
            break;
        }
    }
    
    var animeList = currentDayData?.animeList || [];
    
    var scheduleHTML = '';
    for (var k = 0; k < animeList.length; k++) {
        var anime = animeList[k];
        scheduleHTML += `
            <div class="schedule-item" onclick="showAnimeDetail('${anime.animeId}')">
                <div class="schedule-time"><i class="fas fa-clock"></i> ${anime.estimation || '??:??'}</div>
                <div class="schedule-content">
                    <img src="${anime.poster || 'https://via.placeholder.com/60x80'}" alt="${anime.title}" class="schedule-poster" onerror="this.src='https://via.placeholder.com/60x80'">
                    <div class="schedule-info">
                        <h3 class="schedule-title">${anime.title}</h3>
                        <div class="schedule-meta">
                            <span class="badge-type">${anime.type || 'TV'}</span>
                            <span class="badge-score">⭐ ${anime.score || 'N/A'}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    var html = `
        <div class="schedule-container">
            <div class="schedule-header">
                <h2>📅 Jadwal Rilis Anime</h2>
                <p class="schedule-date">${new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
            <div class="day-tabs">${daysTabs}</div>
            <div class="schedule-list">${scheduleHTML || '<p class="no-schedule">Tidak ada jadwal</p>'}</div>
        </div>
    `;
    
    mainContent.innerHTML = html;
    localStorage.setItem('currentDay', currentDay);
}

function renderMockSchedule() {
    var dayDisplay = {
        'senin': 'Senin', 'selasa': 'Selasa', 'rabu': 'Rabu', 'kamis': 'Kamis',
        'jumat': 'Jumat', 'sabtu': 'Sabtu', 'minggu': 'Minggu'
    };
    
    var today = new Date().toLocaleDateString('id-ID', { weekday: 'long' }).toLowerCase();
    var currentDay = localStorage.getItem('currentDay') || (dayDisplay[today] ? today : 'senin');
    
    var daysTabs = '';
    var dayKeys = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];
    for (var i = 0; i < dayKeys.length; i++) {
        var dayId = dayKeys[i];
        daysTabs += '<div class="day-tab ' + (dayId === currentDay ? 'active' : '') + '" onclick="changeDay(\'' + dayId + '\')">' + dayDisplay[dayId] + '</div>';
    }
    
    var mockData = [
        { time: '12:00', title: 'One Piece', type: 'TV', score: '8.73', animeId: 'one-piece' },
        { time: '13:30', title: 'Jujutsu Kaisen', type: 'TV', score: '8.5', animeId: 'jujutsu-kaisen' },
        { time: '15:00', title: 'Kimetsu no Yaiba', type: 'TV', score: '8.7', animeId: 'kimetsu' }
    ];
    
    var scheduleHTML = '';
    for (var j = 0; j < mockData.length; j++) {
        var anime = mockData[j];
        scheduleHTML += `
            <div class="schedule-item" onclick="showAnimeDetail('${anime.animeId}')">
                <div class="schedule-time"><i class="fas fa-clock"></i> ${anime.time}</div>
                <div class="schedule-content">
                    <img src="https://via.placeholder.com/60x80" class="schedule-poster">
                    <div class="schedule-info">
                        <h3 class="schedule-title">${anime.title}</h3>
                        <div class="schedule-meta">
                            <span class="badge-type">${anime.type}</span>
                            <span class="badge-score">⭐ ${anime.score}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    var html = `
        <div class="schedule-container">
            <h2>📅 Jadwal Rilis Anime</h2>
            <div class="day-tabs">${daysTabs}</div>
            <div class="schedule-list">${scheduleHTML}</div>
        </div>
    `;
    
    mainContent.innerHTML = html;
    localStorage.setItem('currentDay', currentDay);
}

function changeDay(day) {
    localStorage.setItem('currentDay', day);
    loadSchedule();
}

// ==================== UTILITIES ====================
function showLoading() {
    mainContent.innerHTML = `
        <div class="loading-spinner">
            <div class="spinner"></div>
            <p>Memuat data...</p>
        </div>
    `;
}

function showError(message) {
    mainContent.innerHTML = `
        <div style="text-align: center; padding: 50px 20px; color: var(--error);">
            <i class="fas fa-exclamation-circle" style="font-size: 48px; margin-bottom: 15px;"></i>
            <p>${message}</p>
            <button onclick="loadPage('${currentPage}')" style="margin-top: 15px; padding: 10px 20px; background: var(--primary); color: white; border: none; border-radius: 25px; cursor: pointer;">
                Coba Lagi
            </button>
        </div>
    `;
}

function createAnimeCard(anime) {
    var title = anime.title || 'Unknown';
    var poster = anime.poster || 'https://via.placeholder.com/200x300';
    var animeId = anime.animeId || anime.id || '';
    var status = anime.status || '';
    var score = anime.score || '';
    var episodes = anime.episodes || '';
    
    var statusClass = '';
    if (status.toLowerCase() === 'ongoing') statusClass = 'ongoing';
    else if (status.toLowerCase() === 'completed') statusClass = 'completed';
    
    var scoreHtml = score ? '<span class="score">⭐ ' + score + '</span>' : '';
    var episodesHtml = episodes ? '<span class="episodes">' + episodes + ' eps</span>' : '';
    var statusHtml = status ? '<span class="status ' + statusClass + '">' + status + '</span>' : '';
    
    return '<div class="anime-card" onclick="showAnimeDetail(\'' + animeId + '\')">' +
           '<img src="' + poster + '" alt="' + title + '" loading="lazy" onerror="this.src=\'https://via.placeholder.com/200x300\'">' +
           '<div class="title">' + title + '</div>' +
           scoreHtml + episodesHtml + statusHtml +
           '</div>';
}

function updateBadges() {
    if (historyBadge) historyBadge.textContent = watchHistory.length;
    if (continueBadge) continueBadge.textContent = watchHistory.filter(function(h) { return h.progress < 95; }).length;
    if (downloadBadge) downloadBadge.textContent = downloads.length;
}

function toggleSearch() {
    if (searchBar) {
        if (searchBar.style.display === 'none') {
            searchBar.style.display = 'flex';
            if (searchInput) searchInput.focus();
        } else {
            searchBar.style.display = 'none';
            if (searchInput) searchInput.value = '';
        }
    }
}

function openMenu() {
    if (sideMenu) sideMenu.classList.add('open');
    if (overlay) overlay.classList.add('show');
}

function closeMenu() {
    if (sideMenu) sideMenu.classList.remove('open');
    if (overlay) overlay.classList.remove('show');
}

function updateOnlineStatus() {
    isOnline = navigator.onLine;
    
    if (offlineNotification) {
        if (!isOnline) {
            offlineNotification.style.display = 'flex';
            offlineNotification.innerHTML = '<i class="fas fa-wifi-slash"></i><span>Kamu sedang offline. Menampilkan data tersimpan.</span>';
        } else {
            offlineNotification.style.display = 'none';
        }
    }
}

function toggleDarkMode() {
    var darkModeCheckbox = document.getElementById('darkMode');
    if (!darkModeCheckbox) return;
    
    var isDark = darkModeCheckbox.checked;
    localStorage.setItem('darkMode', isDark);
    
    if (isDark) {
        enableDarkMode();
    } else {
        disableDarkMode();
    }
}

function enableDarkMode() {
    document.documentElement.style.setProperty('--background', '#1a202c');
    document.documentElement.style.setProperty('--surface', '#2d3748');
    document.documentElement.style.setProperty('--text-primary', '#f7fafc');
    document.documentElement.style.setProperty('--text-secondary', '#a0aec0');
    document.documentElement.style.setProperty('--border', '#4a5568');
}

function disableDarkMode() {
    document.documentElement.style.setProperty('--background', '#f8fafc');
    document.documentElement.style.setProperty('--surface', '#ffffff');
    document.documentElement.style.setProperty('--text-primary', '#2d3748');
    document.documentElement.style.setProperty('--text-secondary', '#718096');
    document.documentElement.style.setProperty('--border', '#e2e8f0');
}

function clearCache() {
    if (confirm('Hapus semua cache?')) {
        localStorage.removeItem('darkMode');
        localStorage.removeItem('offlineData');
        localStorage.removeItem('currentDay');
        offlineData = {};
        alert('Cache berhasil dihapus');
        location.reload();
    }
}

// ==================== AUTH (SIMPLIFIED) ====================
function showLoginModal() {
    if (loginModal) {
        loginModal.classList.add('show');
    }
}

function closeModal() {
    if (loginModal) {
        loginModal.classList.remove('show');
    }
}

function switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(function(t) { t.classList.remove('active'); });
    document.querySelectorAll('form').forEach(function(f) { f.style.display = 'none'; });
    
    if (tab === 'login') {
        document.querySelector('[onclick="switchAuthTab(\'login\')"]').classList.add('active');
        var loginForm = document.getElementById('loginForm');
        if (loginForm) loginForm.style.display = 'block';
    } else {
        document.querySelector('[onclick="switchAuthTab(\'register\')"]').classList.add('active');
        var registerForm = document.getElementById('registerForm');
        if (registerForm) registerForm.style.display = 'block';
    }
}

function handleLogin(e) {
    e.preventDefault();
    
    var username = document.getElementById('loginUsername')?.value;
    var password = document.getElementById('loginPassword')?.value;
    
    if (!username || !password) {
        alert('Username dan password harus diisi');
        return;
    }
    
    currentUser = {
        username: username,
        email: username + '@email.com',
        premium: false
    };
    
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    updateUserUI();
    closeModal();
    
    alert('Login berhasil!');
}

function handleRegister(e) {
    e.preventDefault();
    
    var username = document.getElementById('regUsername')?.value;
    var email = document.getElementById('regEmail')?.value;
    var password = document.getElementById('regPassword')?.value;
    var confirm = document.getElementById('regConfirm')?.value;
    
    if (!username || !email || !password || !confirm) {
        alert('Semua field harus diisi');
        return;
    }
    
    if (password !== confirm) {
        alert('Password tidak cocok');
        return;
    }
    
    currentUser = {
        username: username,
        email: email,
        premium: false
    };
    
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    updateUserUI();
    closeModal();
    
    alert('Registrasi berhasil!');
}

function handleLogout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    updateUserUI();
    navigateTo('home');
}

function updateUserUI() {
    if (userName) {
        userName.textContent = currentUser?.username || 'Guest';
    }
    if (userStatus) {
        userStatus.textContent = currentUser?.premium ? 'Premium User' : 'Free User';
        if (currentUser?.premium) {
            userStatus.classList.add('premium');
        } else {
            userStatus.classList.remove('premium');
        }
    }
}

// ==================== PREMIUM (SIMPLIFIED) ====================
function showPremiumModal() {
    alert('Fitur premium akan segera hadir!');
}

function closePremiumModal() {}

function selectPlan(plan) {
    alert('Pilih paket: ' + plan);
}

function selectPayment(method) {}

function confirmPayment() {
    alert('Pembayaran akan diproses');
}

function checkPremiumActivation() {}

function downloadAnime(animeId) {
    alert('Fitur download batch akan segera tersedia');
}

function downloadEpisode(episodeId) {
    alert('Fitur download episode akan segera tersedia');
}

function deleteDownload(fileId) {
    downloads = downloads.filter(function(d) { return d.fileId !== fileId; });
    localStorage.setItem('downloads', JSON.stringify(downloads));
    loadDownloads();
    updateBadges();
}

function playDownload(fileId) {
    alert('Fitur putar download akan segera tersedia');
}

// ==================== GOOGLE LOGIN (SIMPLIFIED) ====================
function initGoogleLogin() {
    // Google login akan diimplementasikan nanti
}

// ==================== GLOBAL FUNCTIONS ====================
window.navigateTo = navigateTo;
window.showAnimeDetail = showAnimeDetail;
window.showEpisode = showEpisode;
window.searchAnime = searchAnime;
window.toggleFavorite = toggleFavorite;
window.removeFromFavorites = removeFromFavorites;
window.continueWatching = continueWatching;
window.removeFromHistory = removeFromHistory;
window.deleteDownload = deleteDownload;
window.playDownload = playDownload;
window.changeDay = changeDay;
window.toggleDarkMode = toggleDarkMode;
window.clearCache = clearCache;
window.showLoginModal = showLoginModal;
window.closeModal = closeModal;
window.switchAuthTab = switchAuthTab;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.handleLogout = handleLogout;
window.showPremiumModal = showPremiumModal;
window.closePremiumModal = closePremiumModal;
window.selectPlan = selectPlan;
window.selectPayment = selectPayment;
window.confirmPayment = confirmPayment;
window.downloadAnime = downloadAnime;
window.downloadEpisode = downloadEpisode;
window.loadSchedule = loadSchedule;

setInterval(function() {
    if (currentPage === 'schedule') {
        loadSchedule();
    }
}, 60000);
