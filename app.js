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

// ==================== DETEKSI APK ====================
const isInApp = navigator.userAgent.includes('wv') || 
                navigator.userAgent.includes('Android') && 
                document.referrer.includes('app');

console.log('Running in APK:', isInApp);

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
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
        setTimeout(() => {
            showLoginModal();
        }, 3000);
    }
});

function setupEventListeners() {
    document.getElementById('searchToggle').addEventListener('click', toggleSearch);
    document.getElementById('closeSearch').addEventListener('click', toggleSearch);
    
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            if (e.target.value.trim()) {
                searchAnime(e.target.value);
            }
        }, 500);
    });
    
    document.getElementById('menuToggle').addEventListener('click', openMenu);
    document.getElementById('closeMenu').addEventListener('click', closeMenu);
    overlay.addEventListener('click', closeMenu);
    
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const page = item.dataset.page;
            if (page === 'search') {
                toggleSearch();
            } else {
                navigateTo(page);
            }
        });
    });
    
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', () => {
            const page = item.dataset.page;
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
    
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });
    
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });
    
    loadPage(page);
}

async function loadPage(page) {
    showLoading();
    
    try {
        switch(page) {
            case 'home': await loadHome(); break;
            case 'schedule': await loadSchedule(); break;
            case 'ongoing': await loadOngoing(); break;
            case 'completed': await loadCompleted(); break;
            case 'popular': await loadPopular(); break;
            case 'movies': await loadMovies(); break;
            case 'genres': loadGenres(); break;
            case 'batch': loadBatch(); break;
            case 'favorites': loadFavorites(); break;
            case 'history': loadHistory(); break;
            case 'continue': loadContinue(); break;
            case 'downloads': loadDownloads(); break;
            case 'premium': showPremiumModal(); break;
            case 'settings': loadSettings(); break;
            default: await loadHome();
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
    const url = `${API_BASE}${endpoint}`;
    console.log('Fetching:', url);
    
    try {
        const response = await fetch(url);
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Response data:', data);
        
        if (data.status === 'success' && data.data) {
            const key = endpoint.split('?')[0].replace(/\//g, '_');
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
    const data = offlineData[page]?.data;
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
        let popularData, ongoingData;
        
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
        
        const popularAnime = popularData?.data?.animeList || [];
        const ongoingAnime = ongoingData?.data?.animeList || [];
        
        console.log('Popular anime:', popularAnime.length);
        console.log('Ongoing anime:', ongoingAnime.length);
        
        let html = '';
        
        if (popularAnime.length > 0) {
            html += `
                <div class="section-header">
                    <h2>🔥 Popular Anime</h2>
                    <span class="view-all" onclick="navigateTo('popular')">Lihat Semua</span>
                </div>
                <div class="horizontal-scroll">
            `;
            
            popularAnime.slice(0, 15).forEach(anime => {
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
            
            ongoingAnime.slice(0, 15).forEach(anime => {
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
    const mockPopular = [
        { title: 'One Piece', score: '8.73', poster: 'https://via.placeholder.com/120x180', animeId: 'one-piece' },
        { title: 'Jujutsu Kaisen', score: '8.5', poster: 'https://via.placeholder.com/120x180', animeId: 'jujutsu-kaisen' },
        { title: 'Kimetsu no Yaiba', score: '8.7', poster: 'https://via.placeholder.com/120x180', animeId: 'kimetsu' },
        { title: 'Attack on Titan', score: '9.0', poster: 'https://via.placeholder.com/120x180', animeId: 'aot' },
    ];
    
    const mockOngoing = [
        { title: 'One Piece', poster: 'https://via.placeholder.com/120x180', animeId: 'one-piece' },
        { title: 'Spy x Family', poster: 'https://via.placeholder.com/120x180', animeId: 'spy-x-family' },
        { title: 'Bleach', poster: 'https://via.placeholder.com/120x180', animeId: 'bleach' },
    ];
    
    let html = `
        <div class="section-header">
            <h2>🔥 Popular Anime</h2>
            <span class="view-all" onclick="navigateTo('popular')">Lihat Semua</span>
        </div>
        <div class="horizontal-scroll">
    `;
    
    mockPopular.forEach(anime => {
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
    
    mockOngoing.forEach(anime => {
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

// ==================== SCHEDULE PAGE ====================
async function loadSchedule() {
    showLoading();
    
    try {
        const response = await fetch('https://www.sankavollerei.com/anime/samehadaku/schedule');
        
        if (!response.ok) {
            throw new Error('Schedule error');
        }
        
        const data = await response.json();
        
        if (data.status === 'success' && data.data?.days) {
            renderSchedule(data.data.days);
            cacheOfflineData('schedule', data);
        } else {
            throw new Error('Invalid schedule data');
        }
    } catch (error) {
        console.log('Using mock schedule data');
        
        if (offlineData['schedule']) {
            renderSchedule(offlineData['schedule'].data.data.days);
        } else {
            renderMockSchedule();
        }
    }
}

function renderSchedule(daysData) {
    const dayMapping = {
        'Monday': 'senin', 'Tuesday': 'selasa', 'Wednesday': 'rabu',
        'Thursday': 'kamis', 'Friday': 'jumat', 'Saturday': 'sabtu', 'Sunday': 'minggu'
    };
    
    const dayDisplay = {
        'senin': 'Senin', 'selasa': 'Selasa', 'rabu': 'Rabu', 'kamis': 'Kamis',
        'jumat': 'Jumat', 'sabtu': 'Sabtu', 'minggu': 'Minggu'
    };
    
    let scheduleByDay = {
        senin: [], selasa: [], rabu: [], kamis: [], jumat: [], sabtu: [], minggu: []
    };
    
    daysData.forEach(day => {
        const dayId = dayMapping[day.day] || day.day?.toLowerCase() || '';
        if (scheduleByDay[dayId] && day.animeList) {
            scheduleByDay[dayId] = day.animeList.map(anime => ({
                time: anime.estimation || '??:??',
                title: anime.title || 'Unknown',
                type: anime.type || 'TV',
                score: anime.score || 'N/A',
                poster: anime.poster || 'https://via.placeholder.com/60x80',
                animeId: anime.animeId || '',
                genres: anime.genres || ''
            }));
        }
    });
    
    const today = new Date().toLocaleDateString('id-ID', { weekday: 'long' }).toLowerCase();
    let currentDay = localStorage.getItem('currentDay') || 'senin';
    
    const daysTabs = Object.keys(dayDisplay).map(dayId => `
        <div class="day-tab ${dayId === currentDay ? 'active' : ''}" onclick="changeDay('${dayId}')">
            ${dayDisplay[dayId]}
        </div>
    `).join('');
    
    const animeList = scheduleByDay[currentDay] || [];
    
    const totalEpisodes = animeList.length;
    const liveNow = animeList.filter(item => {
        if (item.time === '??:??' || item.time === 'Update') return false;
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const [hour, minute] = item.time.split(':').map(Number);
        return hour === currentHour && Math.abs(minute - currentMinute) <= 30;
    }).length;
    
    const scheduleHTML = animeList.map(anime => {
        const isLive = anime.time !== '??:??' && anime.time !== 'Update' && (() => {
            const now = new Date();
            const [hour, minute] = anime.time.split(':').map(Number);
            return now.getHours() === hour && Math.abs(now.getMinutes() - minute) <= 30;
        })();
        
        const genres = anime.genres ? 
            (Array.isArray(anime.genres) ? anime.genres : anime.genres.split(',').map(g => g.trim())) 
            : [];
        
        return `
            <div class="schedule-item ${isLive ? 'live' : ''}" onclick="showAnimeDetail('${anime.animeId}')">
                <div class="schedule-time">
                    <i class="fas fa-clock"></i> 
                    ${anime.time === 'Update' ? 'Jadwal menyusul' : anime.time}
                    ${anime.time === 'Update' ? '<span class="badge-update">Update</span>' : ''}
                    ${isLive ? '<span class="badge-live">LIVE</span>' : ''}
                </div>
                <div class="schedule-content">
                    <img src="${anime.poster}" alt="${anime.title}" class="schedule-poster" onerror="this.src='https://via.placeholder.com/60x80'">
                    <div class="schedule-info">
                        <h3 class="schedule-title">${anime.title}</h3>
                        <div class="schedule-meta">
                            <span class="badge-type">${anime.type}</span>
                            <span class="badge-score">⭐ ${anime.score}</span>
                        </div>
                        ${genres.length > 0 ? `
                            <div class="schedule-genres">
                                ${genres.slice(0, 2).map(g => 
                                    `<span class="genre-pill">${g}</span>`
                                ).join('')}
                                ${genres.length > 2 ? `<span class="genre-pill">+${genres.length-2}</span>` : ''}
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    const html = `
        <div class="schedule-container">
            <div class="schedule-header">
                <div>
                    <h2>📅 Jadwal Rilis Anime</h2>
                    <p class="schedule-date">
                        ${new Date().toLocaleDateString('id-ID', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                        })}
                    </p>
                </div>
                <div class="schedule-stats">
                    <span class="stat-badge">
                        <i class="fas fa-calendar-day"></i> ${totalEpisodes} Episode
                    </span>
                    ${liveNow > 0 ? `
                        <span class="stat-badge live">
                            <i class="fas fa-circle"></i> ${liveNow} Sedang Tayang
                        </span>
                    ` : ''}
                </div>
            </div>
            
            <div class="day-tabs">
                ${daysTabs}
            </div>
            
            <div class="schedule-list">
                ${scheduleHTML || '<p class="no-schedule">Tidak ada jadwal untuk hari ini</p>'}
            </div>
            
            <div class="schedule-note">
                <i class="fas fa-info-circle"></i>
                <span>Jam tayang dalam WIB. ${liveNow > 0 ? '🔴 Live sekarang!' : 'Jadwal dapat berubah sewaktu-waktu.'}</span>
            </div>
        </div>
    `;
    
    mainContent.innerHTML = html;
    localStorage.setItem('currentDay', currentDay);
}

function renderMockSchedule() {
    const mockData = {
        sabtu: [
            { time: '03:30', title: 'Tensei shitara Dragon no Tamago datta', type: 'TV', score: '6.59', poster: 'https://via.placeholder.com/60x80', animeId: 'tensei-shitara-dragon-no-tamago-datta', genres: 'Action, Adventure' },
            { time: 'Update', title: 'Dead Account', type: 'TV', score: '6.5', poster: 'https://via.placeholder.com/60x80', animeId: 'dead-account', genres: 'Action, Supernatural' },
            { time: 'Update', title: 'Hell Mode Yarikomizuki no Gamer', type: 'TV', score: '6.76', poster: 'https://via.placeholder.com/60x80', animeId: 'hell-mode-yarikomizuki-no-gamer', genres: 'Action, Adventure' },
            { time: 'Update', title: 'Fire Force Season 3 Part 2', type: 'TV', score: '8.05', poster: 'https://via.placeholder.com/60x80', animeId: 'fire-force-season-3-part-2', genres: 'Action, Fantasy' },
            { time: '03:30', title: 'Kekkon Yubiwa Monogatari Season 2', type: 'TV', score: '6.4', poster: 'https://via.placeholder.com/60x80', animeId: 'kekkon-yubiwa-monogatari-season-2', genres: 'Action, Ecchi' }
        ],
        minggu: [
            { time: '06:30', title: 'Medalist Season 2', type: 'TV', score: '8.1', poster: 'https://via.placeholder.com/60x80', animeId: 'medalist-season-2', genres: 'Drama, Sports' },
            { time: '04:20', title: 'Jigokuraku Season 2', type: 'TV', score: '8.1', poster: 'https://via.placeholder.com/60x80', animeId: 'jigokuraku-season-2', genres: 'Action, Adventure' },
            { time: '04:30', title: 'Trigun Stargaze', type: 'TV', score: '7.35', poster: 'https://via.placeholder.com/60x80', animeId: 'trigun-stargaze', genres: 'Action, Adventure' },
            { time: '04:00', title: 'One Punch Man Season 3', type: 'TV', score: '4.6', poster: 'https://via.placeholder.com/60x80', animeId: 'one-punch-man-season-3', genres: 'Action, Adult Cast' }
        ],
        senin: [
            { time: '04:29', title: 'Vigilante Boku no Hero Academia Illegals Season 2', type: 'TV', score: '7.37', poster: 'https://via.placeholder.com/60x80', animeId: 'vigilante-boku-no-hero-academia-illegals-season-2', genres: 'Action, Shounen' },
            { time: '05:30', title: 'Kizoku Tensei: Megumareta Umare kara Saikyou no Chikara wo Eru', type: 'TV', score: '6.26', poster: 'https://via.placeholder.com/60x80', animeId: 'kizoku-tensei-megumareta-umare-kara-saikyou-no-chikara-wo-eru', genres: 'Action, Adventure' }
        ]
    };
    
    const dayDisplay = { senin: 'Senin', selasa: 'Selasa', rabu: 'Rabu', kamis: 'Kamis', jumat: 'Jumat', sabtu: 'Sabtu', minggu: 'Minggu' };
    
    const today = new Date().toLocaleDateString('id-ID', { weekday: 'long' }).toLowerCase();
    let currentDay = localStorage.getItem('currentDay') || (dayDisplay[today] ? today : 'senin');
    
    const daysTabs = Object.keys(dayDisplay).map(dayId => `
        <div class="day-tab ${dayId === currentDay ? 'active' : ''}" onclick="changeDay('${dayId}')">
            ${dayDisplay[dayId]}
        </div>
    `).join('');
    
    const animeList = mockData[currentDay] || [];
    
    const totalEpisodes = animeList.length;
    const liveNow = animeList.filter(a => a.time !== 'Update').filter(a => {
        const [hour, minute] = a.time.split(':').map(Number);
        const now = new Date();
        return now.getHours() === hour && Math.abs(now.getMinutes() - minute) <= 30;
    }).length;
    
    const scheduleHTML = animeList.map(anime => {
        const isLive = anime.time !== 'Update' && (() => {
            const now = new Date();
            const [hour, minute] = anime.time.split(':').map(Number);
            return now.getHours() === hour && Math.abs(now.getMinutes() - minute) <= 30;
        })();
        
        const genres = anime.genres ? anime.genres.split(',').map(g => g.trim()) : [];
        
        return `
            <div class="schedule-item ${isLive ? 'live' : ''}" onclick="showAnimeDetail('${anime.animeId}')">
                <div class="schedule-time">
                    <i class="fas fa-clock"></i> 
                    ${anime.time === 'Update' ? 'Jadwal menyusul' : anime.time}
                    ${anime.time === 'Update' ? '<span class="badge-update">Update</span>' : ''}
                    ${isLive ? '<span class="badge-live">LIVE</span>' : ''}
                </div>
                <div class="schedule-content">
                    <img src="${anime.poster}" alt="${anime.title}" class="schedule-poster">
                    <div class="schedule-info">
                        <h3 class="schedule-title">${anime.title}</h3>
                        <div class="schedule-meta">
                            <span class="badge-type">${anime.type}</span>
                            <span class="badge-score">⭐ ${anime.score}</span>
                        </div>
                        <div class="schedule-genres">
                            ${genres.slice(0, 2).map(g => 
                                `<span class="genre-pill">${g}</span>`
                            ).join('')}
                            ${genres.length > 2 ? `<span class="genre-pill">+${genres.length-2}</span>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    const html = `
        <div class="schedule-container">
            <div class="schedule-header">
                <div>
                    <h2>📅 Jadwal Rilis Anime</h2>
                    <p class="schedule-date">
                        ${new Date().toLocaleDateString('id-ID', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                        })}
                    </p>
                </div>
                <div class="schedule-stats">
                    <span class="stat-badge">
                        <i class="fas fa-calendar-day"></i> ${totalEpisodes} Episode
                    </span>
                    ${liveNow > 0 ? `
                        <span class="stat-badge live">
                            <i class="fas fa-circle"></i> ${liveNow} Sedang Tayang
                        </span>
                    ` : ''}
                </div>
            </div>
            
            <div class="day-tabs">
                ${daysTabs}
            </div>
            
            <div class="schedule-list">
                ${scheduleHTML || '<p class="no-schedule">Tidak ada jadwal untuk hari ini</p>'}
            </div>
            
            <div class="schedule-note">
                <i class="fas fa-info-circle"></i>
                <span>Jam tayang dalam WIB. ${liveNow > 0 ? '🔴 Live sekarang!' : 'Jadwal dapat berubah sewaktu-waktu.'}</span>
            </div>
        </div>
    `;
    
    mainContent.innerHTML = html;
    localStorage.setItem('currentDay', currentDay);
}

function changeDay(day) {
    localStorage.setItem('currentDay', day);
    loadSchedule();
}

// ==================== ONGOING PAGE ====================
async function loadOngoing() {
    try {
        let data;
        try {
            data = await fetchAPI('/ongoing?page=1');
        } catch (e) {
            data = offlineData['_ongoing?page=1']?.data;
        }
        
        const animeList = data?.data?.animeList || [];
        
        let html = '<h2 style="margin-bottom: 20px;">Ongoing Anime</h2>';
        
        if (animeList.length === 0) {
            html += '<p>Tidak ada data.</p>';
        } else {
            html += '<div class="anime-grid">';
            animeList.forEach(anime => {
                html += createAnimeCard(anime);
            });
            html += '</div>';
        }
        
        mainContent.innerHTML = html;
    } catch (error) {
        showError('Gagal memuat ongoing');
    }
}

// ==================== COMPLETED PAGE ====================
async function loadCompleted() {
    try {
        let data;
        try {
            data = await fetchAPI('/completed?page=1');
        } catch (e) {
            data = offlineData['_completed?page=1']?.data;
        }
        
        const animeList = data?.data?.animeList || [];
        
        let html = '<h2 style="margin-bottom: 20px;">Completed Anime</h2>';
        
        if (animeList.length === 0) {
            html += '<p>Tidak ada data.</p>';
        } else {
            html += '<div class="anime-grid">';
            animeList.forEach(anime => {
                html += createAnimeCard(anime);
            });
            html += '</div>';
        }
        
        mainContent.innerHTML = html;
    } catch (error) {
        showError('Gagal memuat completed');
    }
}

// ==================== POPULAR PAGE ====================
async function loadPopular() {
    try {
        let data;
        try {
            data = await fetchAPI('/popular?page=1');
        } catch (e) {
            data = offlineData['_popular?page=1']?.data;
        }
        
        const animeList = data?.data?.animeList || [];
        
        let html = '<h2 style="margin-bottom: 20px;">Popular Anime</h2>';
        
        if (animeList.length === 0) {
            html += '<p>Tidak ada data.</p>';
        } else {
            html += '<div class="anime-grid">';
            animeList.forEach(anime => {
                html += createAnimeCard(anime);
            });
            html += '</div>';
        }
        
        mainContent.innerHTML = html;
    } catch (error) {
        showError('Gagal memuat popular');
    }
}

// ==================== MOVIES PAGE ====================
async function loadMovies() {
    try {
        let data;
        try {
            data = await fetchAPI('/movies');
        } catch (e) {
            data = offlineData['_movies']?.data;
        }
        
        const movies = data?.data?.animeList || [];
        
        let html = '<h2 style="margin-bottom: 20px;">Movie Anime</h2>';
        
        if (movies.length === 0) {
            html += '<p>Tidak ada data.</p>';
        } else {
            html += '<div class="anime-grid">';
            movies.forEach(movie => {
                html += createAnimeCard(movie);
            });
            html += '</div>';
        }
        
        mainContent.innerHTML = html;
    } catch (error) {
        showError('Gagal memuat movies');
    }
}

// ==================== GENRES PAGE ====================
function loadGenres() {
    const genres = [
        'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror',
        'Mecha', 'Mystery', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports',
        'Supernatural', 'Thriller', 'Ecchi', 'Harem', 'Shounen', 'Seinen'
    ];
    
    let html = '<h2 style="margin-bottom: 20px;">Genre Anime</h2>';
    html += '<div style="display: flex; flex-wrap: wrap; gap: 10px;">';
    
    genres.forEach(genre => {
        html += `
            <div class="genre-card" onclick="searchAnime('${genre}')">
                <i class="fas fa-tag"></i>
                <span>${genre}</span>
            </div>
        `;
    });
    
    html += '</div>';
    
    mainContent.innerHTML = html;
}

// ==================== BATCH PAGE ====================
function loadBatch() {
    mainContent.innerHTML = '<h2 style="margin-bottom: 20px;">Batch Download</h2><p>Fitur batch akan segera tersedia</p>';
}

// ==================== FAVORITES PAGE ====================
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
    
    let html = '<h2 style="margin-bottom: 20px;">Favorit Saya</h2><div class="anime-grid">';
    favorites.forEach(animeId => {
        html += `
            <div class="anime-card" onclick="showAnimeDetail('${animeId}')">
                <img src="https://via.placeholder.com/200x300" alt="${animeId}">
                <div class="title">${animeId.replace(/-/g, ' ')}</div>
                <button class="delete-btn" style="position: absolute; top: 5px; right: 5px; width: 25px; height: 25px; border-radius: 50%; padding: 0;" onclick="removeFromFavorites('${animeId}'); event.stopPropagation();">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    });
    html += '</div>';
    
    mainContent.innerHTML = html;
}

// ==================== HISTORY PAGE ====================
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
    
    let html = '<h2 style="margin-bottom: 20px;">Riwayat Nonton</h2>';
    
    watchHistory.slice(0, 20).forEach(item => {
        html += `
            <div class="history-item" onclick="continueWatching('${item.animeId}', '${item.episodeId}')">
                <img src="${item.poster || 'https://via.placeholder.com/60x80'}" class="history-poster" onerror="this.src='https://via.placeholder.com/60x80'">
                <div class="history-info">
                    <h4 class="history-title">${item.title}</h4>
                    <div class="history-episode">Episode ${item.episode}</div>
                    <div class="history-time">${item.timestamp}</div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${item.progress}%"></div>
                    </div>
                </div>
                <button class="delete-btn" onclick="removeFromHistory('${item.episodeId}'); event.stopPropagation();">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    });
    
    mainContent.innerHTML = html;
}

// ==================== CONTINUE PAGE ====================
function loadContinue() {
    const continueList = watchHistory.filter(item => item.progress < 95);
    
    if (continueList.length === 0) {
        mainContent.innerHTML = `
            <div style="text-align: center; padding: 50px 20px;">
                <i class="fas fa-play-circle" style="font-size: 48px; color: var(--text-secondary); margin-bottom: 15px;"></i>
                <p>Tidak ada episode yang belum selesai</p>
            </div>
        `;
        return;
    }
    
    let html = '<h2 style="margin-bottom: 20px;">Lanjut Nonton</h2>';
    
    continueList.slice(0, 10).forEach(item => {
        html += `
            <div class="continue-item" onclick="continueWatching('${item.animeId}', '${item.episodeId}')">
                <img src="${item.poster || 'https://via.placeholder.com/60x80'}" class="continue-poster" onerror="this.src='https://via.placeholder.com/60x80'">
                <div class="continue-info">
                    <h4 class="continue-title">${item.title}</h4>
                    <div class="continue-episode">Episode ${item.episode}</div>
                    <div class="continue-progress">${Math.round(item.progress)}% selesai</div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${item.progress}%"></div>
                    </div>
                </div>
            </div>
        `;
    });
    
    mainContent.innerHTML = html;
}

// ==================== DOWNLOADS PAGE ====================
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
    
    let html = '<h2 style="margin-bottom: 20px;">Download Saya</h2>';
    
    downloads.forEach(item => {
        html += `
            <div class="download-item">
                <img src="${item.poster || 'https://via.placeholder.com/60x80'}" class="download-poster" onerror="this.src='https://via.placeholder.com/60x80'">
                <div class="download-info">
                    <h4 class="download-title">${item.title}</h4>
                    <div class="download-meta">
                        <span class="download-quality">${item.quality}</span>
                        <span class="download-size">${item.size}</span>
                    </div>
                    <div class="download-progress">${item.status}</div>
                    <div class="download-actions">
                        <button class="download-btn" onclick="playDownload('${item.fileId}')">
                            <i class="fas fa-play"></i> Putar
                        </button>
                        <button class="delete-btn" onclick="deleteDownload('${item.fileId}')">
                            <i class="fas fa-trash"></i> Hapus
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
    
    mainContent.innerHTML = html;
}

// ==================== SETTINGS PAGE ====================
function loadSettings() {
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
                <div class="setting-item">
                    <span>Email</span>
                    <span>${currentUser?.email || '-'}</span>
                </div>
                ${currentUser?.premium ? `
                <div class="setting-item">
                    <span>Masa Aktif Premium</span>
                    <span>${new Date(currentUser.premiumExpiry).toLocaleDateString('id-ID') || '-'}</span>
                </div>
                ` : ''}
            </div>
            
            <div class="settings-section">
                <h3>Tampilan</h3>
                <div class="setting-item">
                    <span>Mode Gelap</span>
                    <label class="switch">
                        <input type="checkbox" id="darkMode" onchange="toggleDarkMode()">
                        <span class="slider round"></span>
                    </label>
                </div>
            </div>
            
            <div class="settings-section">
                <h3>Notifikasi</h3>
                <div class="setting-item">
                    <span>Notifikasi Episode Baru</span>
                    <label class="switch">
                        <input type="checkbox" id="notifications" onchange="toggleNotifications()">
                        <span class="slider round"></span>
                    </label>
                </div>
            </div>
            
            <div class="settings-section">
                <h3>Download</h3>
                <div class="setting-item">
                    <span>Download via WiFi only</span>
                    <label class="switch">
                        <input type="checkbox" id="wifiOnly" checked>
                        <span class="slider round"></span>
                    </label>
                </div>
                <div class="setting-item">
                    <span>Kualitas Download</span>
                    <select id="downloadQuality">
                        <option>360p</option>
                        <option selected>480p</option>
                        <option>720p</option>
                        <option>1080p</option>
                    </select>
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
                <p style="margin-top: 5px;">Package: com.dtest.tenime</p>
                <p style="margin-top: 5px; font-size: 11px;">© 2025 TeNIME. All rights reserved.</p>
            </div>
        </div>
    `;
    
    const darkMode = localStorage.getItem('darkMode') === 'true';
    const notifications = localStorage.getItem('notifications') === 'true';
    
    const darkModeCheckbox = document.getElementById('darkMode');
    const notificationsCheckbox = document.getElementById('notifications');
    
    if (darkModeCheckbox) darkModeCheckbox.checked = darkMode;
    if (notificationsCheckbox) notificationsCheckbox.checked = notifications;
    
    if (darkMode) enableDarkMode();
}

// ==================== ANIME DETAIL ====================
async function showAnimeDetail(animeId) {
    showLoading();
    
    try {
        let data;
        try {
            data = await fetchAPI(`/anime/${animeId}`);
        } catch (e) {
            console.log('Gagal ambil detail, pakai data mock');
        }
        
        const anime = data?.data || {
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
            episodeList: Array.from({ length: 12 }, (_, i) => ({ 
                title: i + 1, 
                episodeId: `${animeId}-episode-${i + 1}` 
            }))
        };
        
        const isFavorite = favorites.includes(animeId);
        
        let html = `
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
                        ${(anime.genreList || []).map(g => 
                            `<span class="genre-tag" onclick="searchAnime('${g.title}')">${g.title}</span>`
                        ).join('')}
                    </div>
                    
                    <div class="detail-synopsis">
                        ${anime.synopsis?.paragraphs?.join(' ') || anime.synopsis || 'Tidak ada sinopsis.'}
                    </div>
                    
                    <h3 style="margin: 20px 0 10px;">Daftar Episode</h3>
                    <div class="episode-list">
                        ${(anime.episodeList || []).map(ep => 
                            `<div class="episode-item" onclick="showEpisode('${ep.episodeId}')">Episode ${ep.title}</div>`
                        ).join('')}
                        ${(!anime.episodeList || anime.episodeList.length === 0) ? 
                            '<p>Belum ada episode.</p>' : ''}
                    </div>
                    
                    <button class="favorite-btn ${isFavorite ? 'in-favorite' : 'not-favorite'}" onclick="toggleFavorite('${animeId}')">
                        <i class="fas fa-heart"></i> ${isFavorite ? 'Hapus dari Favorit' : 'Tambah ke Favorit'}
                    </button>
                    
                    ${currentUser?.premium ? `
                        <button class="download-btn" style="margin-top: 10px; width: 100%; padding: 12px; background: var(--success); color: white; border: none; border-radius: 10px; cursor: pointer;" onclick="downloadAnime('${animeId}')">
                            <i class="fas fa-download"></i> Download Batch
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
        
        mainContent.innerHTML = html;
    } catch (error) {
        showError('Gagal memuat detail: ' + error.message);
    }
}

// ==================== VIDEO PLAYER PREMIUM CLASS (FIX UNTUK APK) ====================
class PremiumVideoPlayer {
    constructor(containerId, episodeData, episodeId) {
        this.container = document.getElementById(containerId);
        this.episodeData = episodeData;
        this.episodeId = episodeId;
        this.currentResolution = 'auto';
        this.currentServer = null;
        this.servers = this.organizeServers();
        this.isFullscreen = false;
        this.isPiP = false;
        this.video = null;
        this.playPauseBtn = null;
        this.progressFill = null;
        this.progressBuffer = null;
        this.timeDisplay = null;
        this.volumeSlider = null;
        this.muteBtn = null;
        this.fullscreenBtn = null;
        this.pipBtn = null;
        this.qualityBadge = null;
        this.videoLoading = null;
        this.videoError = null;
        this.currentResolutionSpan = null;
        this.progressContainer = null;
        this.progressBar = null;
        this.init();
    }
    
    organizeServers() {
        const servers = {
            '4k': [],
            '1080p': [],
            '720p': [],
            '480p': [],
            '360p': [],
            'unknown': []
        };
        
        if (this.episodeData.server?.qualities) {
            this.episodeData.server.qualities.forEach(quality => {
                const qualityName = quality.title.toLowerCase();
                if (quality.serverList && quality.serverList.length > 0) {
                    if (qualityName.includes('4k')) servers['4k'].push(...quality.serverList);
                    else if (qualityName.includes('1080')) servers['1080p'].push(...quality.serverList);
                    else if (qualityName.includes('720')) servers['720p'].push(...quality.serverList);
                    else if (qualityName.includes('480')) servers['480p'].push(...quality.serverList);
                    else if (qualityName.includes('360')) servers['360p'].push(...quality.serverList);
                    else servers['unknown'].push(...quality.serverList);
                }
            });
        }
        
        return servers;
    }
    
    render() {
        const html = `
            <div class="video-player-premium" id="premiumPlayer">
                <video id="mainVideo" preload="auto" playsinline>
                    <source src="" type="video/mp4">
                </video>
                
                <div class="video-loading" id="videoLoading">
                    <div class="spinner"></div>
                </div>
                
                <div class="video-error" id="videoError">
                    <i class="fas fa-exclamation-circle" style="font-size: 40px; margin-bottom: 10px;"></i>
                    <p>Gagal memuat video</p>
                    <button class="retry-btn" onclick="window.playerRef.retry()">Coba Lagi</button>
                </div>
                
                <div class="quality-badge" id="qualityBadge">
                    Auto
                </div>
                
                <div class="video-controls" id="videoControls">
                    <div class="progress-container" id="progressContainer">
                        <div class="progress-bar" id="progressBar">
                            <div class="progress-fill" id="progressFill"></div>
                            <div class="progress-buffer" id="progressBuffer"></div>
                        </div>
                    </div>
                    
                    <div class="controls-row">
                        <div class="controls-left">
                            <button class="control-btn" id="playPauseBtn">
                                <i class="fas fa-play"></i>
                            </button>
                            
                            <div class="volume-control">
                                <button class="control-btn" id="muteBtn">
                                    <i class="fas fa-volume-up"></i>
                                </button>
                                <input type="range" class="volume-slider" id="volumeSlider" min="0" max="1" step="0.1" value="1">
                            </div>
                            
                            <span class="time-display" id="timeDisplay">00:00 / 00:00</span>
                        </div>
                        
                        <div class="controls-right">
                            <button class="control-btn" id="pipBtn">
                                <i class="fas fa-closed-captioning"></i>
                            </button>
                            
                            <div class="resolution-selector">
                                <button class="resolution-btn" id="resolutionBtn">
                                    <i class="fas fa-cog"></i>
                                    <span id="currentResolution">Auto</span>
                                </button>
                                <div class="resolution-menu" id="resolutionMenu">
                                    ${this.renderResolutionOptions()}
                                </div>
                            </div>
                            
                            <button class="control-btn" id="fullscreenBtn">
                                <i class="fas fa-expand"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        this.container.innerHTML = html;
        this.initElements();
        this.initEvents();
        this.loadDefaultServer();
        
        // Referensi global yang stabil untuk APK
        window.playerRef = this;
    }
    
    renderResolutionOptions() {
        const resolutions = ['Auto', '4K', '1080p', '720p', '480p', '360p'];
        return resolutions.map(res => {
            const resKey = res.toLowerCase().replace('k', 'k');
            const hasServer = res === 'Auto' || this.servers[resKey]?.length > 0;
            return `
                <div class="resolution-item ${res === 'Auto' ? 'active' : ''} ${!hasServer && res !== 'Auto' ? 'disabled' : ''}" 
                     data-resolution="${resKey}"
                     onclick="window.playerRef.changeResolution('${resKey}')">
                    <span>${res}</span>
                    ${hasServer || res === 'Auto' ? '<i class="fas fa-check"></i>' : '<i class="fas fa-times" style="color: #f56565;"></i>'}
                </div>
            `;
        }).join('');
    }
    
    initElements() {
        this.video = document.getElementById('mainVideo');
        this.playPauseBtn = document.getElementById('playPauseBtn');
        this.progressFill = document.getElementById('progressFill');
        this.progressBuffer = document.getElementById('progressBuffer');
        this.timeDisplay = document.getElementById('timeDisplay');
        this.volumeSlider = document.getElementById('volumeSlider');
        this.muteBtn = document.getElementById('muteBtn');
        this.fullscreenBtn = document.getElementById('fullscreenBtn');
        this.pipBtn = document.getElementById('pipBtn');
        this.qualityBadge = document.getElementById('qualityBadge');
        this.videoLoading = document.getElementById('videoLoading');
        this.videoError = document.getElementById('videoError');
        this.currentResolutionSpan = document.getElementById('currentResolution');
        this.progressContainer = document.getElementById('progressContainer');
        this.progressBar = document.getElementById('progressBar');
    }
    
    initEvents() {
        this.playPauseBtn.addEventListener('click', () => this.togglePlay());
        this.video.addEventListener('click', () => this.togglePlay());
        
        this.video.addEventListener('timeupdate', () => this.updateProgress());
        this.video.addEventListener('progress', () => this.updateBuffer());
        this.progressContainer.addEventListener('click', (e) => this.seek(e));
        
        this.volumeSlider.addEventListener('input', (e) => this.setVolume(e.target.value));
        this.muteBtn.addEventListener('click', () => this.toggleMute());
        
        this.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
        document.addEventListener('fullscreenchange', () => this.handleFullscreenChange());
        
        if ('pictureInPictureEnabled' in document) {
            this.pipBtn.addEventListener('click', () => this.togglePiP());
            this.video.addEventListener('enterpictureinpicture', () => this.handlePiPEnter());
            this.video.addEventListener('leavepictureinpicture', () => this.handlePiPLeave());
        } else {
            this.pipBtn.style.display = 'none';
        }
        
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
        this.video.addEventListener('error', (e) => this.handleVideoError(e));
        
        window.addEventListener('orientationchange', () => this.handleOrientationChange());
        this.handleOrientationChange();
    }
    
    async loadDefaultServer() {
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        let recommendedRes = '720p';
        
        if (connection) {
            const speed = connection.downlink;
            if (speed > 5) recommendedRes = '1080p';
            else if (speed > 2) recommendedRes = '720p';
            else if (speed > 1) recommendedRes = '480p';
            else recommendedRes = '360p';
        }
        
        const resolutions = ['4k', '1080p', '720p', '480p', '360p'];
        let loaded = false;
        
        if (this.servers[recommendedRes]?.length > 0) {
            this.currentResolution = recommendedRes;
            this.currentServer = this.servers[recommendedRes][0];
            await this.loadServer(this.currentServer.serverId);
            loaded = true;
        }
        
        if (!loaded) {
            for (const res of resolutions) {
                if (this.servers[res]?.length > 0) {
                    this.currentResolution = res;
                    this.currentServer = this.servers[res][0];
                    await this.loadServer(this.currentServer.serverId);
                    loaded = true;
                    break;
                }
            }
        }
        
        if (!loaded && this.servers['unknown']?.length > 0) {
            this.currentResolution = 'unknown';
            this.currentServer = this.servers['unknown'][0];
            await this.loadServer(this.currentServer.serverId);
        }
        
        this.updateQualityBadge();
    }
    
    async loadServer(serverId) {
        this.showLoading();
        this.hideError();
        
        try {
            const response = await fetch(`https://www.sankavollerei.com/anime/samehadaku/server/${serverId}`);
            const data = await response.json();
            
            let videoUrl = data.data?.url || data.url || data.video || data.stream || data.source || data.link;
            
            if (!videoUrl) throw new Error('URL video tidak ditemukan');
            
            const oldIframe = this.container.querySelector('iframe');
            if (oldIframe) oldIframe.remove();
            
            if (videoUrl.includes('blogger.com')) {
                this.video.style.display = 'none';
                const iframe = document.createElement('iframe');
                iframe.src = videoUrl;
                iframe.style.width = '100%';
                iframe.style.height = '100%';
                iframe.style.border = 'none';
                iframe.allowFullscreen = true;
                this.video.parentNode.insertBefore(iframe, this.video);
            } else {
                this.video.style.display = 'block';
                this.video.src = videoUrl;
                this.video.load();
                await this.video.play();
            }
            
            this.hideLoading();
            
        } catch (error) {
            console.error('Server error:', error);
            this.hideLoading();
            this.showError();
        }
    }
    
    async changeResolution(resolution) {
        if (resolution === 'auto') {
            const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
            if (connection) {
                const speed = connection.downlink;
                if (speed > 5) resolution = '1080p';
                else if (speed > 2) resolution = '720p';
                else if (speed > 1) resolution = '480p';
                else resolution = '360p';
            } else {
                resolution = '720p';
            }
        }
        
        const servers = this.servers[resolution];
        if (!servers || servers.length === 0) {
            alert(`Tidak ada server untuk resolusi ${resolution}`);
            return;
        }
        
        this.currentResolution = resolution;
        this.currentResolutionSpan.textContent = resolution.toUpperCase();
        this.updateQualityBadge();
        
        document.querySelectorAll('.resolution-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.resolution === resolution) {
                item.classList.add('active');
            }
        });
        
        await this.loadServer(servers[0].serverId);
    }
    
    togglePlay() {
        if (this.video.paused) {
            this.video.play();
            this.playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
        } else {
            this.video.pause();
            this.playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
        }
    }
    
    updateProgress() {
        if (!this.video.duration) return;
        const percent = (this.video.currentTime / this.video.duration) * 100;
        this.progressFill.style.width = `${percent}%`;
        
        const current = this.formatTime(this.video.currentTime);
        const duration = this.formatTime(this.video.duration);
        this.timeDisplay.textContent = `${current} / ${duration}`;
        
        updateHistoryProgress(this.episodeId, percent);
    }
    
    updateBuffer() {
        if (this.video.buffered.length > 0) {
            const bufferedEnd = this.video.buffered.end(this.video.buffered.length - 1);
            const percent = (bufferedEnd / this.video.duration) * 100;
            this.progressBuffer.style.width = `${percent}%`;
        }
    }
    
    seek(e) {
        const rect = this.progressBar.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        this.video.currentTime = pos * this.video.duration;
    }
    
    setVolume(value) {
        this.video.volume = value;
        this.volumeSlider.value = value;
        this.updateMuteIcon();
    }
    
    toggleMute() {
        this.video.muted = !this.video.muted;
        this.updateMuteIcon();
    }
    
    updateMuteIcon() {
        if (this.video.muted || this.video.volume === 0) {
            this.muteBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
        } else if (this.video.volume < 0.5) {
            this.muteBtn.innerHTML = '<i class="fas fa-volume-down"></i>';
        } else {
            this.muteBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
        }
    }
    
    async toggleFullscreen() {
        if (!this.isFullscreen) {
            if (this.video.requestFullscreen) {
                await this.video.requestFullscreen();
            } else if (this.video.webkitRequestFullscreen) {
                await this.video.webkitRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                await document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                await document.webkitExitFullscreen();
            }
        }
    }
    
    handleFullscreenChange() {
        this.isFullscreen = !!document.fullscreenElement;
        this.fullscreenBtn.innerHTML = this.isFullscreen ? 
            '<i class="fas fa-compress"></i>' : 
            '<i class="fas fa-expand"></i>';
    }
    
    async togglePiP() {
        if (!this.isPiP) {
            try {
                await this.video.requestPictureInPicture();
            } catch (error) {
                console.log('PiP not supported');
            }
        } else {
            try {
                await document.exitPictureInPicture();
            } catch (error) {
                console.log('Exit PiP failed');
            }
        }
    }
    
    handlePiPEnter() {
        this.isPiP = true;
        this.pipBtn.innerHTML = '<i class="fas fa-compress"></i>';
    }
    
    handlePiPLeave() {
        this.isPiP = false;
        this.pipBtn.innerHTML = '<i class="fas fa-closed-captioning"></i>';
    }
    
    handleKeyboard(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        switch(e.key.toLowerCase()) {
            case ' ':
            case 'k':
                e.preventDefault();
                this.togglePlay();
                break;
            case 'f':
                e.preventDefault();
                this.toggleFullscreen();
                break;
            case 'm':
                e.preventDefault();
                this.toggleMute();
                break;
            case 'arrowright':
                e.preventDefault();
                this.video.currentTime += 10;
                break;
            case 'arrowleft':
                e.preventDefault();
                this.video.currentTime -= 10;
                break;
            case 'arrowup':
                e.preventDefault();
                this.setVolume(Math.min(1, this.video.volume + 0.1));
                break;
            case 'arrowdown':
                e.preventDefault();
                this.setVolume(Math.max(0, this.video.volume - 0.1));
                break;
        }
    }
    
    handleVideoError(e) {
        console.error('Video error:', e);
        this.showError();
    }
    
    handleOrientationChange() {
        if (window.matchMedia("(orientation: landscape)").matches && window.innerWidth <= 768) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
    }
    
    retry() {
        this.hideError();
        this.loadDefaultServer();
    }
    
    formatTime(seconds) {
        if (isNaN(seconds)) return '00:00';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        
        if (h > 0) {
            return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    
    showLoading() {
        if (this.videoLoading) this.videoLoading.classList.add('show');
    }
    
    hideLoading() {
        if (this.videoLoading) this.videoLoading.classList.remove('show');
    }
    
    showError() {
        if (this.videoError) this.videoError.classList.add('show');
    }
    
    hideError() {
        if (this.videoError) this.videoError.classList.remove('show');
    }
    
    updateQualityBadge() {
        if (this.qualityBadge) {
            this.qualityBadge.textContent = this.currentResolution.toUpperCase();
        }
    }
}

// Global player instance - PASTIKAN PAKAI let BUKAN const
let player;

function initVideoPlayer(containerId, episodeData, episodeId) {
    player = new PremiumVideoPlayer(containerId, episodeData, episodeId);
    player.render();
    window.player = player;
}

// ==================== FALLBACK VIDEO PLAYER UNTUK APK ====================
function fallbackVideoPlayer(episodeId, episode) {
    const videoUrl = episode.defaultStreamingUrl || '';
    
    let html = `
        <div class="video-container">
            <div class="video-player">
                ${videoUrl.includes('blogger.com') ? 
                    `<iframe src="${videoUrl}" frameborder="0" allowfullscreen style="width:100%; height:100%;"></iframe>` :
                    `<video id="fallbackVideo" controls autoplay playsinline style="width:100%; height:100%;">
                        <source src="${videoUrl}" type="video/mp4">
                    </video>`
                }
            </div>
            <div class="video-info">
                <h2 class="video-title">${episode.title || 'Episode ' + episodeId}</h2>
                <div class="video-nav">
                    <button class="nav-btn" onclick="showAnimeDetail('${episode.animeId || episodeId.split('-')[0]}')">
                        <i class="fas fa-info-circle"></i> Kembali ke Detail
                    </button>
                </div>
            </div>
        </div>
    `;
    
    const container = document.getElementById('premiumPlayerContainer');
    if (container) {
        container.innerHTML = html;
    }
}

// ==================== EPISODE PLAYER DENGAN PREMIUM PLAYER ====================
async function showEpisode(episodeId) {
    showLoading();
    
    try {
        const response = await fetch(`https://www.sankavollerei.com/anime/samehadaku/episode/${episodeId}`);
        const data = await response.json();
        const episode = data?.data || {};
        
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
        
        const html = `
            <div class="video-wrapper">
                <div id="premiumPlayerContainer"></div>
                
                <div class="video-info">
                    <h2 class="video-title">${episode.title || 'Episode ' + episodeId}</h2>
                    
                    <div class="video-nav">
                        ${episode.hasPrevEpisode ? 
                            `<button class="nav-btn" onclick="showEpisode('${episode.prevEpisode.episodeId}')">
                                <i class="fas fa-chevron-left"></i> Prev
                            </button>` : ''}
                        <button class="nav-btn" onclick="showAnimeDetail('${episode.animeId || episodeId.split('-')[0]}')">
                            <i class="fas fa-info-circle"></i> Detail
                        </button>
                        ${episode.hasNextEpisode ? 
                            `<button class="nav-btn" onclick="showEpisode('${episode.nextEpisode.episodeId}')">
                                Next <i class="fas fa-chevron-right"></i>
                            </button>` : ''}
                    </div>
                    
                    <h3 style="margin-top: 20px;">📥 Download</h3>
                    <div class="download-links">
        `;
        
        if (episode.downloadUrl?.formats) {
            episode.downloadUrl.formats.forEach(format => {
                if (format.qualities) {
                    format.qualities.forEach(quality => {
                        if (quality.urls) {
                            quality.urls.forEach(url => {
                                html += `
                                    <a href="${url.url}" target="_blank" class="download-link" rel="noopener noreferrer">
                                        ${url.title} - ${quality.title}
                                    </a>
                                `;
                            });
                        }
                    });
                }
            });
        } else {
            html += '<p>Tidak ada link download tersedia</p>';
        }
        
        html += `
                    </div>
                </div>
            </div>
        `;
        
        mainContent.innerHTML = html;
        
        try {
            initVideoPlayer('premiumPlayerContainer', episode, episodeId);
        } catch (e) {
            console.error('Premium player failed, using fallback:', e);
            fallbackVideoPlayer(episodeId, episode);
        }
        
    } catch (error) {
        console.error('Episode error:', error);
        showError('Gagal memuat episode: ' + error.message);
    }
}

// ==================== SEARCH ====================
async function searchAnime(keyword) {
    if (!keyword) return;
    
    showLoading();
    
    try {
        let data;
        try {
            data = await fetchAPI(`/search?q=${encodeURIComponent(keyword)}`);
        } catch (e) {
            data = offlineData[`_search?q=${keyword}`]?.data;
        }
        
        const results = data?.data?.animeList || [];
        
        let html = `<h2 style="margin-bottom: 20px;">Hasil pencarian: "${keyword}"</h2>`;
        
        if (results.length === 0) {
            html += '<p>Tidak ditemukan.</p>';
        } else {
            html += '<div class="anime-grid">';
            results.forEach(anime => {
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
    
    if (favorites.includes(animeId)) {
        favorites = favorites.filter(id => id !== animeId);
    } else {
        favorites.push(animeId);
    }
    
    localStorage.setItem('favorites', JSON.stringify(favorites));
    
    const btn = document.querySelector('.favorite-btn');
    if (btn) {
        const isFavorite = favorites.includes(animeId);
        btn.className = `favorite-btn ${isFavorite ? 'in-favorite' : 'not-favorite'}`;
        btn.innerHTML = `<i class="fas fa-heart"></i> ${isFavorite ? 'Hapus dari Favorit' : 'Tambah ke Favorit'}`;
    }
    
    updateBadges();
}

function removeFromFavorites(animeId) {
    favorites = favorites.filter(id => id !== animeId);
    localStorage.setItem('favorites', JSON.stringify(favorites));
    loadFavorites();
    updateBadges();
}

// ==================== HISTORY ====================
function addToHistory(item) {
    watchHistory = [item, ...watchHistory.filter(h => h.episodeId !== item.episodeId)].slice(0, 50);
    localStorage.setItem('watchHistory', JSON.stringify(watchHistory));
    updateBadges();
}

function updateHistoryProgress(episodeId, progress) {
    const index = watchHistory.findIndex(h => h.episodeId === episodeId);
    if (index !== -1) {
        watchHistory[index].progress = progress;
        localStorage.setItem('watchHistory', JSON.stringify(watchHistory));
    }
}

function removeFromHistory(episodeId) {
    watchHistory = watchHistory.filter(h => h.episodeId !== episodeId);
    localStorage.setItem('watchHistory', JSON.stringify(watchHistory));
    loadHistory();
    updateBadges();
}

function continueWatching(animeId, episodeId) {
    showEpisode(episodeId);
}

// ==================== DOWNLOADS ====================
function downloadAnime(animeId) {
    if (!currentUser?.premium) {
        alert('Fitur download hanya untuk pengguna premium');
        showPremiumModal();
        return;
    }
    
    alert('Download batch akan segera tersedia');
}

function downloadEpisode(episodeId) {
    if (!currentUser?.premium) {
        alert('Fitur download hanya untuk pengguna premium');
        showPremiumModal();
        return;
    }
    
    const newDownload = {
        fileId: 'DL' + Date.now(),
        title: 'Downloading...',
        quality: '480p',
        size: '150 MB',
        status: 'Mengunduh...',
        progress: 0,
        poster: 'https://via.placeholder.com/60x80'
    };
    
    downloads.push(newDownload);
    localStorage.setItem('downloads', JSON.stringify(downloads));
    updateBadges();
    
    alert('Download dimulai');
    
    setTimeout(() => {
        const index = downloads.findIndex(d => d.fileId === newDownload.fileId);
        if (index !== -1) {
            downloads[index].status = 'Selesai';
            downloads[index].progress = 100;
            localStorage.setItem('downloads', JSON.stringify(downloads));
            if (currentPage === 'downloads') {
                loadDownloads();
            }
        }
    }, 5000);
}

function deleteDownload(fileId) {
    downloads = downloads.filter(d => d.fileId !== fileId);
    localStorage.setItem('downloads', JSON.stringify(downloads));
    loadDownloads();
    updateBadges();
}

function playDownload(fileId) {
    const download = downloads.find(d => d.fileId === fileId);
    if (download) {
        alert('Fitur putar download akan segera tersedia. File: ' + download.title);
    }
}

// ==================== GOOGLE LOGIN ====================
function initGoogleLogin() {
    if (typeof google !== 'undefined' && google.accounts) {
        google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGoogleCredential,
            auto_select: false,
            cancel_on_tap_outside: true
        });
        
        google.accounts.id.prompt((notification) => {
            if (notification.isNotDisplayed()) {
                console.log('Google One Tap not displayed');
            }
        });
    }
}

function handleGoogleCredential(response) {
    console.log('Google credential received');
    
    try {
        const payload = JSON.parse(atob(response.credential.split('.')[1]));
        console.log('User data:', payload);
        
        if (!payload || !payload.email) {
            throw new Error('Invalid Google response');
        }
        
        currentUser = {
            username: payload.name || payload.email.split('@')[0],
            email: payload.email,
            picture: payload.picture || null,
            googleId: payload.sub,
            premium: false,
            loginMethod: 'google',
            loginTime: new Date().toISOString()
        };
        
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        updateUserUI();
        closeModal();
        
        alert(`Selamat datang, ${currentUser.username}!`);
        
    } catch (error) {
        console.error('Google login error:', error);
        alert('Gagal login dengan Google. Silakan coba lagi.');
    }
}

function renderGoogleButton(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (typeof google !== 'undefined' && google.accounts) {
        google.accounts.id.renderButton(
            container,
            {
                theme: 'outline',
                size: 'large',
                text: 'signin_with',
                shape: 'rectangular',
                logo_alignment: 'left',
                width: '100%'
            }
        );
    }
}

// ==================== AUTH ====================
function showLoginModal() {
    if (loginModal) {
        loginModal.classList.add('show');
        
        setTimeout(() => {
            renderGoogleButton('googleButton');
        }, 100);
    }
}

function closeModal() {
    if (loginModal) {
        loginModal.classList.remove('show');
    }
}

function switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('form').forEach(f => f.style.display = 'none');
    
    if (tab === 'login') {
        document.querySelector('[onclick="switchAuthTab(\'login\')"]').classList.add('active');
        const loginForm = document.getElementById('loginForm');
        if (loginForm) loginForm.style.display = 'block';
    } else {
        document.querySelector('[onclick="switchAuthTab(\'register\')"]').classList.add('active');
        const registerForm = document.getElementById('registerForm');
        if (registerForm) registerForm.style.display = 'block';
    }
}

function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('loginUsername')?.value;
    const password = document.getElementById('loginPassword')?.value;
    
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
    
    const username = document.getElementById('regUsername')?.value;
    const email = document.getElementById('regEmail')?.value;
    const password = document.getElementById('regPassword')?.value;
    const confirm = document.getElementById('regConfirm')?.value;
    
    if (!username || !email || !password || !confirm) {
        alert('Semua field harus diisi');
        return;
    }
    
    if (password !== confirm) {
        alert('Password tidak cocok');
        return;
    }
    
    if (password.length < 6) {
        alert('Password minimal 6 karakter');
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
        if (currentUser?.premium) {
            const expiry = currentUser.premiumExpiry ? new Date(currentUser.premiumExpiry) : null;
            const daysLeft = expiry ? Math.ceil((expiry - new Date()) / (1000 * 60 * 60 * 24)) : 0;
            
            userStatus.textContent = `Premium ${currentUser.premiumPlan || ''} • ${daysLeft} hari lagi`;
            userStatus.classList.add('premium');
        } else {
            userStatus.textContent = 'Free User';
            userStatus.classList.remove('premium');
        }
    }
}

// ==================== PREMIUM ====================
function showPremiumModal() {
    if (premiumModal) {
        premiumModal.classList.add('show');
        document.getElementById('selectedPlan').textContent = '-';
        document.getElementById('totalPrice').textContent = 'Rp 0';
    }
}

function closePremiumModal() {
    if (premiumModal) {
        premiumModal.classList.remove('show');
        const paymentSection = document.getElementById('paymentSection');
        if (paymentSection) {
            paymentSection.style.display = 'none';
        }
    }
}

function selectPlan(plan) {
    selectedPlan = plan;
    
    let price = 0;
    switch(plan) {
        case 'Mingguan': price = 15000; break;
        case 'Bulanan': price = 45000; break;
        case '3 Bulan': price = 120000; break;
        case 'Tahunan': price = 350000; break;
        default: price = 0;
    }
    
    document.getElementById('selectedPlan').textContent = plan;
    document.getElementById('totalPrice').textContent = `Rp ${price.toLocaleString()}`;
    document.getElementById('paymentSection').style.display = 'block';
    
    document.querySelectorAll('.plan-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    if (event && event.target) {
        const card = event.target.closest('.plan-card');
        if (card) card.classList.add('selected');
    }
}

function selectPayment(method) {
    selectedPayment = method;
    document.querySelectorAll('.payment-method').forEach(m => m.classList.remove('active'));
    if (event && event.target) {
        const method = event.target.closest('.payment-method');
        if (method) method.classList.add('active');
    }
}

function confirmPayment() {
    if (!selectedPlan) {
        alert('Pilih paket premium terlebih dahulu');
        return;
    }
    
    if (!currentUser) {
        alert('Silakan login terlebih dahulu');
        closePremiumModal();
        showLoginModal();
        return;
    }
    
    let amount = 0;
    switch(selectedPlan) {
        case 'Mingguan': amount = 15000; break;
        case 'Bulanan': amount = 45000; break;
        case '3 Bulan': amount = 120000; break;
        case 'Tahunan': amount = 350000; break;
    }
    
    const message = `Saya mau bayar premium TeNIME paket ${selectedPlan} - Username: ${currentUser.username}`;
    
    const sociabuzzLink = `https://sociabuzz.com/dtest/support?amount=${amount}&message=${encodeURIComponent(message)}`;
    
    if (confirm(`Anda akan membayar Rp ${amount.toLocaleString()} untuk paket ${selectedPlan}\n\nLanjutkan ke halaman pembayaran SociaBuzz?`)) {
        window.open(sociabuzzLink, '_blank');
        closePremiumModal();
        
        alert(`✅ Terima kasih!\n\nSetelah pembayaran selesai, Anda akan otomatis diarahkan kembali ke aplikasi dan premium langsung aktif.`);
    }
}

function checkPremiumActivation() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('premium') === 'success') {
        const username = urlParams.get('username');
        const plan = urlParams.get('plan');
        
        if (currentUser && currentUser.username === username) {
            activatePremium(username, plan);
        } else {
            localStorage.setItem('pendingPremiumActivation', JSON.stringify({
                username: username,
                plan: plan,
                timestamp: Date.now()
            }));
            alert(`Pembayaran sukses! Silakan login dengan username "${username}" untuk mengaktifkan premium.`);
        }
    }
    
    const pending = JSON.parse(localStorage.getItem('pendingPremiumActivation'));
    if (pending && currentUser && currentUser.username === pending.username) {
        activatePremium(pending.username, pending.plan);
        localStorage.removeItem('pendingPremiumActivation');
    }
}

function activatePremium(username, plan) {
    if (currentUser && currentUser.username === username) {
        const expiryDate = new Date();
        if (plan === "Mingguan") expiryDate.setDate(expiryDate.getDate() + 7);
        else if (plan === "Bulanan") expiryDate.setMonth(expiryDate.getMonth() + 1);
        else if (plan === "3 Bulan") expiryDate.setMonth(expiryDate.getMonth() + 3);
        else if (plan === "Tahunan") expiryDate.setFullYear(expiryDate.getFullYear() + 1);
        
        currentUser.premium = true;
        currentUser.premiumPlan = plan;
        currentUser.premiumExpiry = expiryDate.toISOString();
        
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        updateUserUI();
        
        alert(`🎉 Selamat! Akun ${username} sekarang PREMIUM ${plan}!\nAktif hingga: ${expiryDate.toLocaleDateString('id-ID')}`);
        
        window.history.replaceState({}, document.title, '/');
        location.reload();
    }
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
    const title = anime.title || 'Unknown';
    const poster = anime.poster || 'https://via.placeholder.com/200x300';
    const animeId = anime.animeId || anime.id || '';
    const status = anime.status || '';
    const score = anime.score || '';
    const episodes = anime.episodes || '';
    
    let statusClass = '';
    if (status.toLowerCase() === 'ongoing') statusClass = 'ongoing';
    else if (status.toLowerCase() === 'completed') statusClass = 'completed';
    
    return `
        <div class="anime-card" onclick="showAnimeDetail('${animeId}')">
            <img src="${poster}" alt="${title}" loading="lazy" onerror="this.src='https://via.placeholder.com/200x300'">
            <div class="title">${title}</div>
            ${score ? `<span class="score">⭐ ${score}</span>` : ''}
            ${episodes ? `<span class="episodes">${episodes} eps</span>` : ''}
            ${status ? `<span class="status ${statusClass}">${status}</span>` : ''}
        </div>
    `;
}

function updateBadges() {
    if (historyBadge) historyBadge.textContent = watchHistory.length;
    if (continueBadge) continueBadge.textContent = watchHistory.filter(h => h.progress < 95).length;
    if (downloadBadge) downloadBadge.textContent = downloads.length;
}

function toggleSearch() {
    if (searchBar) {
        searchBar.style.display = searchBar.style.display === 'none' ? 'flex' : 'none';
        if (searchBar.style.display === 'flex' && searchInput) {
            searchInput.focus();
        } else if (searchInput) {
            searchInput.value = '';
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
            offlineNotification.innerHTML = `
                <i class="fas fa-wifi-slash"></i>
                <span>Kamu sedang offline. Menampilkan data tersimpan.</span>
            `;
        } else {
            offlineNotification.style.display = 'none';
        }
    }
}

function toggleDarkMode() {
    const darkModeCheckbox = document.getElementById('darkMode');
    if (!darkModeCheckbox) return;
    
    const isDark = darkModeCheckbox.checked;
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

function toggleNotifications() {
    const notificationsCheckbox = document.getElementById('notifications');
    if (!notificationsCheckbox) return;
    
    const isEnabled = notificationsCheckbox.checked;
    localStorage.setItem('notifications', isEnabled);
    
    if (isEnabled && Notification.permission !== 'granted') {
        Notification.requestPermission();
    }
}

function clearCache() {
    if (confirm('Hapus semua cache? Favorit dan riwayat akan tetap tersimpan.')) {
        localStorage.removeItem('darkMode');
        localStorage.removeItem('notifications');
        localStorage.removeItem('offlineData');
        localStorage.removeItem('currentDay');
        localStorage.removeItem('pendingPremiumActivation');
        offlineData = {};
        alert('Cache berhasil dihapus. Halaman akan dimuat ulang.');
        location.reload();
    }
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
window.toggleNotifications = toggleNotifications;
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

setInterval(() => {
    if (currentPage === 'schedule') {
        loadSchedule();
    }
}, 60000);
