<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { fade, slide, scale } from "svelte/transition";
  import { goto } from "$app/navigation";
  import Swal from "sweetalert2";

  // --- CONFIG ---
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

  // --- NAVBAR & LAYOUT STATE ---
  let isMobileMenuOpen = false;
  let currentView = "monthly-reward"; 
  
  // --- STATE: SEARCH & FILTER ---
  let searchQuery = ""; // ตัวแปรสำหรับค้นหา
  
  // --- REAL SESSION TIMER STATE ---
  let timeLeftStr = "--:--:--"; 
  let timerInterval: any = null;

  // --- LANGUAGE STATE ---
  let lang: 'th' | 'en' = 'th';

  // --- DICTIONARY (รวมคำศัพท์ของ Navbar และ Content) ---
  const t = {
    th: {
        // Navbar & General
        search_placeholder: "ค้นหา...",
        
        // Content Translation
        my_activities_title: "กิจกรรมของฉัน",
        my_activities_subtitle: "ติดตามความคืบหน้าและตรวจสอบระดับของคุณ",
        loading: "กำลังโหลดข้อมูล...",
        no_activities: "ไม่พบกิจกรรม",
        no_activities_desc: "เข้าร่วมกิจกรรมเพื่อเริ่มติดตามสถิติของคุณ!",
        view_stats: "ดูสถิติ",
        
        // Dashboard Modal
        current_rank: "ระดับปัจจุบัน",
        your_distance: "ระยะทางของคุณ",
        your_freq: "จำนวนครั้งที่ทำสำเร็จ",
        tier_progression: "ความคืบหน้าลำดับขั้น",
        keep_participating: "เข้าร่วมกิจกรรมต่อไปเพื่อเลื่อนระดับ!",
        
        // Meta info
        location_label: "สถานที่",
        date_label: "วันที่",
        time_label: "เวลา",

        // Tiers Description
        tier_desc_1: "เริ่มต้นการเดินทางของคุณ",
        tier_desc_2: "วิ่งสะสมครบ 10 กม. หรือ สำเร็จกิจกรรม 3 ครั้ง",
        tier_desc_3: "วิ่งสะสมครบ 50 กม. หรือ สำเร็จกิจกรรม 10 ครั้ง",
        tier_desc_4: "วิ่งสะสมครบ 100 กม. หรือ สำเร็จกิจกรรม 20 ครั้ง"
    },
    en: {
        // Navbar & General
        search_placeholder: "Search...",

        // Content Translation
        my_activities_title: "My Activities",
        my_activities_subtitle: "Track your progress and check your tiers.",
        loading: "Loading your activities...",
        no_activities: "No Activities Found",
        no_activities_desc: "Join an event to start tracking your stats!",
        view_stats: "VIEW STATS",

        // Dashboard Modal
        current_rank: "Current Rank",
        your_distance: "Your Distance",
        your_freq: "Your Frequency",
        tier_progression: "Tier Progression",
        keep_participating: "Keep participating to level up your tier!",

        // Meta info
        location_label: "Location",
        date_label: "Date",
        time_label: "Time",

        // Tiers Description
        tier_desc_1: "Start your running journey",
        tier_desc_2: "Run 10km total OR Complete 3 times",
        tier_desc_3: "Run 50km total OR Complete 10 times",
        tier_desc_4: "Run 100km total OR Complete 20 times"
    }
  };

  // --- MENU ITEMS ---
  const menuItems = [
    { id: "event-list", label: "Event list", path: "/officer/event-list", svg: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9 2 2 4-4" },
    { id: "monthly-reward", label: "Monthly reward", path: "/officer/monthly-reward", svg: "M20 7h-3a4 4 0 1 0-8 0H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zm-7 0a2 2 0 1 1 4 0h-4zm0 13H6v-9h7v9zm2-9h7v9h-7v-9z" },
    { id: "my-event", label: "My event", path: "/officer/myevents-upcoming", svg: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" },
    { id: "account-setting", label: "Account setting", path: "/officer/setting-account", svg: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
  ];

  // --- HELPERS ---
  function getLocalToken() {
    if (typeof localStorage === 'undefined') return "";
    let token = localStorage.getItem("access_token") || localStorage.getItem("token") || "";
    if (!token) {
        const userStr = localStorage.getItem("user_info");
        if (userStr) { 
            try { 
                const userObj = JSON.parse(userStr);
                token = userObj.token || userObj.accessToken || "";
            } catch (e) {} 
        }
    }
    return token;
  }

  // Language Switcher
  function setLang(l: 'th' | 'en') {
      lang = l;
      if (typeof localStorage !== 'undefined') {
          localStorage.setItem('app_lang', l);
      }
  }

  // --- DATE/TIME FORMATTERS ---
  function getDisplayDate(start?: string, end?: string) {
      if (!start) return "-";
      const locale = lang === 'th' ? 'th-TH' : 'en-GB'; 
      const opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
      const s = new Date(start).toLocaleDateString(locale, opts);
      if (end && end !== start) {
          const e = new Date(end).toLocaleDateString(locale, opts);
          return `${s} - ${e}`;
      }
      return s;
  }

  function getDisplayTime(start?: string, end?: string) {
      if (!start) return "-";
      const s = start.substring(0, 5);
      const e = end ? end.substring(0, 5) : "";
      const suffix = lang === 'th' ? " น." : "";
      return e ? `${s} - ${e}${suffix}` : `${s}${suffix}`;
  }

  // --- TIMER LOGIC ---
  function startSessionTimer() {
    if (timerInterval) clearInterval(timerInterval);
    const token = getLocalToken();
    if (!token) { timeLeftStr = "00:00:00"; return; }
    
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(decodeURIComponent(window.atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')));
      
      if (payload.exp) {
          const expTime = payload.exp * 1000;
          timerInterval = setInterval(() => {
            const now = Date.now();
            const diff = expTime - now;
            if (diff <= 0) {
              clearInterval(timerInterval);
              timeLeftStr = "00:00:00";
              handleSessionExpired(); 
            } else {
              const totalSeconds = Math.floor(diff / 1000);
              const h = Math.floor(totalSeconds / 3600);
              const m = Math.floor((totalSeconds % 3600) / 60);
              const s = totalSeconds % 60;
              timeLeftStr = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
            }
          }, 1000);
      }
    } catch (e) { console.error("Error parsing token expiration:", e); }
  }

  function handleSessionExpired() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_info");
    Swal.fire({
      icon: 'error',
      title: 'Session Expired',
      text: lang === 'th' ? 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' : 'Session expired, please login again.',
      allowOutsideClick: false,
      confirmButtonText: 'OK'
    }).then(() => {
      goto("/auth/login");
    });
  }

  function handleLogout() {
    isMobileMenuOpen = false;
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_info");
    goto("/auth/login", { replaceState: true });
  }

  function selectView(id: string, path: string) {
    currentView = id;
    isMobileMenuOpen = false;
    goto(path);
  }

  // --- ACTIVITY LOGIC ---
  let loading = true;
  let myActivities: any[] = [];
  let showDashboard = false;
  let selectedActivity: any = null;

  // Reactive Tier Rules
  $: tierRules = [
    { tier: 1, label: "Beginner", min_km: 0, min_freq: 0, desc: t[lang].tier_desc_1 },
    { tier: 2, label: "Advanced", min_km: 10, min_freq: 3, desc: t[lang].tier_desc_2 },
    { tier: 3, label: "Pro Athlete", min_km: 50, min_freq: 10, desc: t[lang].tier_desc_3 },
    { tier: 4, label: "Legend", min_km: 100, min_freq: 20, desc: t[lang].tier_desc_4 }
  ];

  function getStatusStyle(status: string) {
    switch (status?.toLowerCase()) {
        case 'completed': return { text: 'COMPLETED', class: 'bg-green-500' };
        case 'rejected': return { text: 'REJECTED', class: 'bg-red-500' };
        case 'joined': return { text: 'IN PROGRESS', class: 'bg-yellow-500' };
        default: return { text: status?.toUpperCase() || 'UNKNOWN', class: 'bg-gray-500' };
    }
  }

  function calculateTierInfo(totalDistance: number, frequency: number) {
    let currentTier = tierRules[0];
    for (let i = 0; i < tierRules.length; i++) {
        const rule = tierRules[i];
        if (totalDistance >= rule.min_km || frequency >= rule.min_freq) {
            currentTier = rule;
        } else {
            break; 
        }
    }
    return { current: currentTier };
  }

  function openActivityDashboard(activity: any) {
    const tierInfo = calculateTierInfo(activity.total_distance, activity.frequency);
    selectedActivity = { ...activity, tierInfo };
    showDashboard = true;
  }

  function closeDashboard() {
    showDashboard = false;
    setTimeout(() => { selectedActivity = null; }, 300);
  }

  onMount(async () => {
    const savedLang = localStorage.getItem('app_lang');
    if (savedLang === 'th' || savedLang === 'en') {
        lang = savedLang;
    }

    startSessionTimer(); 

    try {
      const token = getLocalToken();
      const userInfoStr = localStorage.getItem("user_info");
      
      if (!token || !userInfoStr) {
        goto("/auth/login");
        return;
      }
      
      const userInfo = JSON.parse(userInfoStr);
      const userId = userInfo.nisit_id || userInfo.id;

      // Fetch Events
      const resEvents = await fetch(`${API_BASE_URL}/api/events/`, {
         headers: { Authorization: `Bearer ${token}` }
      });
      const allEvents: any[] = resEvents.ok ? await resEvents.json() : [];
      const eventsMap = new Map(allEvents.map((e) => [e.id, e]));

      // Fetch User Participations
      const resPart = await fetch(`${API_BASE_URL}/api/participations/user/${userId}`, {
          headers: { Authorization: `Bearer ${token}` }
      });
      
      if (resPart.ok) {
        const rawParticipations = await resPart.json();
        const activityMap = new Map();

        rawParticipations.forEach((p: any) => {
            if (p.status === 'cancelled') return;

            const eventDetail = eventsMap.get(p.event_id);
            if (!eventDetail) return;

            if (!activityMap.has(p.event_id)) {
                activityMap.set(p.event_id, {
                    event_id: p.event_id,
                    title: eventDetail?.title || "Unknown Event",
                    description: eventDetail?.description || "",
                    image: eventDetail?.banner_image_url || null,
                    target_distance: eventDetail?.distance_km || 0,
                    
                    start_date: eventDetail?.start_date || eventDetail?.event_date,
                    end_date: eventDetail?.end_date || eventDetail?.event_end_date,
                    start_time: eventDetail?.start_time,
                    end_time: eventDetail?.end_time,
                    location: eventDetail?.location || "-",

                    status: p.status, 
                    total_distance: 0,
                    frequency: 0,
                    history: []
                });
            }

            const act = activityMap.get(p.event_id);
            const dist = parseFloat(p.actual_distance_km) || 0;
            act.total_distance += dist;

            if (p.status === 'completed') {
                act.frequency += 1;
                act.status = 'completed'; 
            }

            act.history.push({
                date: p.created_at,
                dist: dist,
                status: p.status
            });
        });

        myActivities = Array.from(activityMap.values()).map((act: any) => {
            const tierInfo = calculateTierInfo(act.total_distance, act.frequency);
            return { ...act, tierInfo };
        });
      }

    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      loading = false;
    }
  });

  onDestroy(() => {
    if (timerInterval) clearInterval(timerInterval);
  });

  // --- FILTERED ACTIVITIES (SEARCH LOGIC) ---
  $: filteredActivities = myActivities.filter(activity => 
      activity.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      activity.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

</script>

<div class="app-container">
  
  <header class="header-bar">
    <div class="header-inner">
      <div class="left-group">
        <div class="brand"><span class="brand-name">OFFICER</span></div>
        <nav class="nav-menu desktop-only">
          {#each menuItems as item}
            <button class="menu-btn" class:active={currentView === item.id} on:click={() => selectView(item.id, item.path)}>
              <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path 
              stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d={item.svg}></path></svg>
              <span class="btn-label">{item.label}</span>
            </button>
          {/each}
        </nav>
      </div>

      <div class="search-bar-container desktop-only">
        <div class="search-input-wrapper">
            <svg class="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 
            7 7 0 0114 0z"></path></svg>
            <input type="text" placeholder={t[lang].search_placeholder} class="search-input" bind:value={searchQuery} />
        </div>
      </div>

      <div class="user-zone">
        <div class="timer-pill">
            {timeLeftStr}
        </div>

        <div class="lang-switch desktop-only">
            <button class:active={lang === 'th'} on:click={() => setLang('th')}>TH</button>
            <span class="sep">|</span>
            <button class:active={lang === 'en'} on:click={() => setLang('en')}>EN</button>
        </div>

        <button class="logout-btn desktop-only" on:click={handleLogout}><svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg></button>
        <button class="mobile-toggle mobile-only" on:click={() => (isMobileMenuOpen = !isMobileMenuOpen)}><svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 
        0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 9h16M4 15h16"></path></svg></button>
      </div>
    </div>
  </header>

  {#if isMobileMenuOpen}
    <div class="mobile-overlay" on:click={() => (isMobileMenuOpen = false)} transition:fade={{ duration: 200 }}></div>
    <div class="mobile-drawer" transition:slide={{ axis: 'x', duration: 300 }}>
       <div class="drawer-header"><span class="brand-name" style="font-size: 1.4rem;">MENU</span><button class="close-btn" on:click={() => (isMobileMenuOpen = false)}>&times;</button></div>
       <div class="drawer-search">
            <input type="text" placeholder={t[lang].search_placeholder} class="drawer-search-input" bind:value={searchQuery} />
       </div>
   
        <div class="drawer-content">
        {#each menuItems as item}
          <button class="drawer-item" class:active={currentView === item.id} on:click={() => selectView(item.id, item.path)}>
            <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin-right: 10px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={item.svg}></path></svg>
            {item.label}
          </button>
        {/each}

        <div class="drawer-lang-item">
            <div class="lang-label-group">
                <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin-right: 10px;">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"></path>
                </svg>
                 Language
            </div>
           <div class="lang-toggle-pill">
               <button class:active={lang === 'th'} on:click={() => setLang('th')}>TH</button>
               <button class:active={lang === 'en'} on:click={() => setLang('en')}>EN</button>
           </div>
        </div>
       </div>
       <button class="drawer-item logout-special" on:click={handleLogout}>Logout</button>
    </div>
  {/if}

  <div class="scroll-container">
    <div class="content-wrapper">
        
        <div class="page-header">
            <h2 class="section-title">{t[lang].my_activities_title}</h2>
            <div class="title-underline"></div>
            <p style="color: #94a3b8; margin-top: 8px;">{t[lang].my_activities_subtitle}</p>
        </div>

        {#if loading}
            <div class="loading-state">{t[lang].loading}</div>
        {:else if filteredActivities.length === 0}
            <div class="no-reward-state">
                <div class="empty-icon">🏃‍♂️</div>
                <h3>{t[lang].no_activities}</h3>
                <p>{t[lang].no_activities_desc}</p>
            </div>
        {:else}
            <div class="activity-grid">
                {#each filteredActivities as activity}
                    <div class="activity-card" on:click={() => openActivityDashboard(activity)}>
                        <div class="status-pill {getStatusStyle(activity.status).class}">
                            {getStatusStyle(activity.status).text}
                        </div>

                        <div class="card-image">
                            {#if activity.image}
                                <img src={activity.image} alt={activity.title} />
                            {:else}
                                <div class="img-placeholder">{activity.title.charAt(0)}</div>
                            {/if}
                        </div>

                        <div class="card-content">
                            <h3 class="card-title">{activity.title}</h3>
                            <p class="card-desc">{activity.description || "No description available."}</p>
                            
                            <div class="card-action">
                                <span class="view-btn">{t[lang].view_stats} &rarr;</span>
                            </div>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}

    </div>

    <footer class="app-footer">
        <div class="footer-separator"></div>
        <div class="footer-content">
            <p class="copyright">&copy; 2025 Cyber Geek. All rights reserved.</p>
            <p class="credits">Designed & Developed by <span class="highlight">Cyber Geek Development</span></p>
        </div>
    </footer>
  </div>
</div>

{#if showDashboard && selectedActivity}
    <div class="modal-backdrop" transition:fade on:click={closeDashboard}></div>
    
    <div class="modal-container" transition:scale={{ start: 0.9, duration: 200 }}>
        <button class="close-btn-modal" on:click={closeDashboard}>&times;</button>
        
        <div class="dashboard-header">
            <h2 class="modal-title">{selectedActivity.title}</h2>
            <div class="tier-current-badge">
                🏆 {t[lang].current_rank}: {selectedActivity.tierInfo.current.label}
            </div>
            
            <div class="event-meta-info">
                <div class="meta-item">
                    <svg class="meta-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                    <span>{getDisplayDate(selectedActivity.start_date, selectedActivity.end_date)}</span>
                </div>
                <div class="meta-item">
                     <svg class="meta-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    <span>{getDisplayTime(selectedActivity.start_time, selectedActivity.end_time)}</span>
                </div>
                <div class="meta-item">
                    <svg class="meta-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                    <span>{selectedActivity.location}</span>
                </div>
            </div>
        </div>

        <div class="dashboard-stats">
            <div class="stat-box">
                <span class="stat-label">{t[lang].your_distance}</span>
                <span class="stat-value">{selectedActivity.total_distance.toFixed(2)} <small>km</small></span>
            </div>
            <div class="stat-box goal-box">
                <span class="stat-label">{t[lang].your_freq}</span>
                <span class="stat-value">{selectedActivity.frequency} <small>times</small></span>
            </div>
        </div>

        <div class="tier-list-container">
            <h4>{t[lang].tier_progression}</h4>
            <div class="tier-list">
                {#each tierRules as rule}
                    <div class="tier-item" class:is-active={selectedActivity.tierInfo.current.tier === rule.tier} class:is-passed={selectedActivity.tierInfo.current.tier > rule.tier}>
                        <div class="tier-icon">
                            {rule.tier}
                        </div>
                        <div class="tier-content">
                            <div class="tier-head">
                                <span class="tier-name">Tier {rule.tier}: {rule.label}</span>
                                {#if selectedActivity.tierInfo.current.tier === rule.tier}
                                    <span class="current-tag">CURRENT</span>
                                {/if}
                            </div>
                            <div class="tier-desc">
                                <svg class="check-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                {rule.desc}
                            </div>
                        </div>
                    </div>
                {/each}
            </div>
            <p class="footer-hint">{t[lang].keep_participating}</p>
        </div>
        
    </div>
{/if}

<style>
  @import url("https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap");

  /* --- VARIABLES --- */
  :root { 
      --bg-body: #0f172a; 
      --bg-nav: #1e293b;
      --bg-card: #1e293b; 
      --primary: #10b981; 
      --text-main: #f8fafc; 
      --text-muted: #94a3b8;
      --nav-height: 72px; 
  }

  :global(body) { 
    margin: 0; padding: 0; 
    background-color: var(--bg-body); 
    font-family: "Inter", sans-serif;
    color: var(--text-main);
    overflow: hidden;
  }

  /* --- LAYOUT --- */
  .app-container { display: flex; flex-direction: column; height: 100vh; background-color: var(--bg-body); }
  
  .scroll-container { 
    margin-top: calc(var(--nav-height));
    padding-bottom: 40px; 
    overflow-y: auto;
    display: flex; flex-direction: column; flex: 1;
  }

  .content-wrapper { 
    max-width: 1400px; margin: 0 auto; 
    padding: 40px 24px; width: 100%; box-sizing: border-box; flex: 1; 
  }

  /* --- HEADER & NAVBAR (Matched to Source File) --- */
  .header-bar { width: 100%; height: var(--nav-height); background-color: var(--bg-nav); position: fixed; top: 0;
  left: 0; z-index: 1000; border-bottom: 1px solid rgba(255, 255, 255, 0.05); box-shadow: 0 4px 20px rgba(0,0,0,0.2);
  }
  .header-inner { width: 100%; height: 100%; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; box-sizing: border-box;
  }
  .left-group { display: flex; align-items: center; gap: 40px; flex: 1; overflow: hidden; }
  .brand-name { font-size: 2rem;
  font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; background: linear-gradient(135deg, #6ee7b7 0%, #10b981 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; cursor: default;
  white-space: nowrap; margin-right: 10px; text-shadow: 0 0 10px rgba(16, 185, 129, 0.4), 0 0 20px rgba(16, 185, 129, 0.2);
  }
  
  .nav-menu { display: flex; gap: 8px; white-space: nowrap; }
  .menu-btn { background: transparent; border: none;
  padding: 10px 14px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-family: 'Inter', sans-serif; font-size: 0.9rem; font-weight: 600;
  color: var(--text-muted); transition: all 0.2s ease; }
  .nav-icon { width: 18px; height: 18px; opacity: 0.7; transition: 0.2s;
  }
  .menu-btn:hover { color: var(--text-main); background-color: rgba(255, 255, 255, 0.03); }
  .menu-btn:hover .nav-icon { opacity: 1;
  }
  .menu-btn.active { background-color: #0f172a; color: #10b981; box-shadow: 0 0 0 1px rgba(16, 185, 129, 0.1);
  }
  .menu-btn.active .nav-icon { opacity: 1; stroke: #10b981; }
  
  .user-zone { display: flex; align-items: center;
  gap: 12px; margin-left: auto; flex-shrink: 0; }
  .timer-pill { background-color: #0f172a; color: #10b981; font-weight: 700; font-size: 0.95rem;
  padding: 8px 14px; border-radius: 6px; border: 1px solid rgba(16, 185, 129, 0.2); letter-spacing: 1px; white-space: nowrap;
  }
  .logout-btn { background: transparent; border: none; color: var(--text-muted); cursor: pointer; padding: 8px; transition: 0.2s; display: flex; align-items: center;
  }
  .logout-btn:hover { color: #ef4444; transform: translateX(2px); }

  .search-bar-container { flex: 1; display: flex; justify-content: center; max-width: 250px;
  margin: 0 20px; }
  .search-input-wrapper { position: relative; width: 100%; display: flex; align-items: center;
  }
  .search-input { width: 100%; background: #0f172a; border: 1px solid rgba(255,255,255,0.1); color: var(--text-main); padding: 8px 16px 8px 36px;
  border-radius: 8px; font-size: 0.85rem; outline: none; transition: all 0.2s; }
  .search-input:focus { border-color: var(--primary);
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2); }
  .search-icon { position: absolute; left: 10px; width: 16px;
  height: 16px; color: var(--text-muted); }

  .mobile-toggle { display: none; background: transparent; border: none; color: white; padding: 6px; border-radius: 6px;
  cursor: pointer; }
  @media (min-width: 1025px) { .left-group { gap: 15px;
  } }
  @media (max-width: 1024px) { 
    .desktop-only { display: none !important;
    } 
    .mobile-toggle { display: block !important; } 
    .header-inner { padding: 0 12px;
    } 
    .left-group { gap: 10px; } 
    .brand-name { font-size: 1.5rem;
    } 
    .search-bar-container { display: none; } 
  }
  
  .mobile-overlay { position: fixed;
  inset: 0; background: rgba(0, 0, 0, 0.7); z-index: 2000; backdrop-filter: blur(2px); }
  .mobile-drawer { position: fixed; top: 0;
  right: 0; bottom: 0; width: 70vw; max-width: 280px; background: var(--bg-nav); z-index: 2001; padding: 20px; display: flex; flex-direction: column;
  box-shadow: -5px 0 20px rgba(0, 0, 0, 0.5); }
  .drawer-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;
  padding-bottom: 10px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); }
  .close-btn { background: none; border: none; color: white;
  font-size: 1.5rem; cursor: pointer; }
  .drawer-search { margin-bottom: 15px; }
  .drawer-search-input { width: 100%; background: #0f172a;
  border: 1px solid rgba(255,255,255,0.1); color: var(--text-main); padding: 10px; border-radius: 8px; font-size: 0.9rem; outline: none; box-sizing: border-box;
  }
  .drawer-content { flex: 1; display: flex; flex-direction: column; gap: 10px; }
  .drawer-item { background: transparent; border: none;
  color: var(--text-muted); text-align: left; padding: 12px 16px; font-size: 1rem; font-weight: 600; display: flex; align-items: center; gap: 12px; border-radius: 8px;
  cursor: pointer; transition: all 0.2s ease; }
  .drawer-item.active { background-color: #0f172a; color: #10b981;
  border: 1px solid rgba(255, 255, 255, 0.05); }
  .drawer-item.active .nav-icon { opacity: 1; stroke: #10b981;
  }
  .logout-special { color: #ef4444; margin-top: auto; border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 20px;
  }

  /* LANG SWITCHER STYLES */
  .lang-switch { display: flex; align-items: center; background: rgba(255, 255, 255, 0.05);
  padding: 4px 10px; border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.1); margin-right: 12px;
  }
  .lang-switch button { background: none; border: none; color: #64748b; font-size: 0.8rem; font-weight: 700; cursor: pointer; padding: 4px;
  transition: 0.2s; }
  .lang-switch button.active { color: #10b981; text-shadow: 0 0 10px rgba(16, 185, 129, 0.3);
  }
  .lang-switch .sep { color: #334155; font-size: 0.8rem; margin: 0 4px; }

  .drawer-lang-item { display: flex; justify-content: space-between;
  align-items: center; padding: 12px 16px; margin-top: 10px; border-top: 1px solid rgba(255, 255, 255, 0.05); padding-top: 20px;
  }
  .lang-label-group { display: flex; align-items: center; color: #94a3b8; font-weight: 600; font-size: 1rem; gap: 12px;
  }
  .lang-toggle-pill { display: flex; background: #0f172a; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 20px; padding: 2px;
  }
  .lang-toggle-pill button { background: transparent; border: none; color: #64748b; padding: 6px 14px; font-size: 0.85rem; font-weight: 700; border-radius: 18px;
  cursor: pointer; transition: 0.2s; }
  .lang-toggle-pill button.active { background: #10b981; color: white;
  }

  /* --- PAGE CONTENT --- */
  .page-header { margin-bottom: 30px; }
  .section-title { font-size: 2rem; font-weight: 700; color: var(--text-main); margin: 0 0 8px 0; }
  .title-underline { width: 40px; height: 4px; background: var(--primary); border-radius: 2px; }

  /* ACTIVITY CARD */
  .activity-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 24px; }
  .activity-card {
      background-color: var(--bg-card); border-radius: 16px; overflow: hidden; cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s; border: 1px solid rgba(255, 255, 255, 0.05);
      position: relative; display: flex; flex-direction: column;
  }
  .activity-card:hover { transform: translateY(-4px); box-shadow: 0 10px 20px rgba(0, 0, 0, 0.4); border-color: rgba(16, 185, 129, 0.3); }
  .activity-card:hover .view-btn { color: var(--primary); border-color: var(--primary); background: rgba(16, 185, 129, 0.1); }

  .card-image { width: 100%; height: 180px; background-color: #0f172a; display: flex; align-items: center; justify-content: center; }
  .card-image img { width: 100%; height: 100%; object-fit: cover; }
  .img-placeholder { font-size: 3rem; font-weight: 800; color: #334155; }
  
  .status-pill { position: absolute; top: 12px; right: 12px; padding: 4px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: 700; color: white; text-transform: uppercase; z-index: 10; box-shadow: 0 2px 4px rgba(0,0,0,0.3); }
  .bg-green-500 { background-color: #10b981; } 
  .bg-yellow-500 { background-color: #f59e0b; color: #000; } 
  .bg-red-500 { background-color: #ef4444; } 
  .bg-gray-500 { background-color: #64748b; } 

  .card-content { padding: 20px; flex: 1; display: flex; flex-direction: column; }
  .card-title { margin: 0 0 8px 0; font-size: 1.25rem; font-weight: 700; color: white; line-height: 1.3; }
  .card-desc { color: var(--text-muted); font-size: 0.9rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 16px; }
  .card-action { margin-top: auto; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 12px; }
  .view-btn { 
      font-size: 0.85rem; font-weight: 700; color: var(--text-muted); 
      border: 1px solid rgba(255,255,255,0.1); padding: 8px 16px; border-radius: 8px;
      transition: all 0.2s; display: inline-block;
  }
  
  .loading-state, .no-reward-state { text-align: center; padding: 60px 0; color: #64748b; }
  .empty-icon { font-size: 4rem; margin-bottom: 20px; opacity: 0.5; }

  /* DASHBOARD MODAL */
  .modal-backdrop { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(4px); z-index: 2000; }
  .modal-container {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      width: 90%; max-width: 600px; background: #1e293b; border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px; padding: 30px; z-index: 2001; box-shadow: 0 20px 50px rgba(0,0,0,0.6);
      max-height: 90vh; overflow-y: auto;
  }
  .close-btn-modal { position: absolute; top: 15px; right: 20px; background: none; border: none; color: var(--text-muted); font-size: 2rem; cursor: pointer; }
  .close-btn-modal:hover { color: white; }

  .dashboard-header { text-align: center; margin-bottom: 24px; }
  .modal-title { margin: 0 0 10px 0; font-size: 1.8rem; color: white; }
  .tier-current-badge { 
      display: inline-block; background: rgba(16, 185, 129, 0.15); 
      color: var(--primary); padding: 6px 16px; border-radius: 30px; 
      font-weight: 700; border: 1px solid rgba(16, 185, 129, 0.3);
      margin-bottom: 16px;
  }

  .event-meta-info { display: flex; justify-content: center; gap: 16px; flex-wrap: wrap; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 16px; }
  .meta-item { display: flex; align-items: center; gap: 6px; font-size: 0.9rem; color: #cbd5e1; }
  .meta-icon { width: 16px; height: 16px; color: var(--text-muted); }

  .dashboard-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 30px; }
  .stat-box { background: #0f172a; padding: 20px; border-radius: 12px; text-align: center; border: 1px solid rgba(255,255,255,0.05); }
  .stat-label { display: block; color: var(--text-muted); font-size: 0.85rem; margin-bottom: 4px; }
  .stat-value { font-size: 1.5rem; font-weight: 800; color: white; }
  .stat-value small { font-size: 0.9rem; font-weight: 400; color: var(--text-muted); }
  .goal-box { border-color: rgba(59, 130, 246, 0.3); background: rgba(59, 130, 246, 0.05); }

  .tier-list-container h4 { color: white; margin: 0 0 12px 0; font-size: 1.1rem; }
  .tier-list { display: flex; flex-direction: column; gap: 12px; }
  .tier-item { 
      display: flex; align-items: flex-start; gap: 16px;
      background: rgba(255,255,255,0.03); padding: 16px; border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.05); transition: 0.2s;
  }
  .tier-item.is-active { border-color: var(--primary); background: rgba(16, 185, 129, 0.05); box-shadow: 0 0 15px rgba(16, 185, 129, 0.1); }
  .tier-item.is-passed { opacity: 0.6; }
  .tier-icon { 
      width: 40px; height: 40px; background: #334155; color: white;
      border-radius: 50%; display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 1.2rem; flex-shrink: 0;
  }
  .is-active .tier-icon { background: var(--primary); color: #064e3b; }
  .tier-content { flex: 1; }
  .tier-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
  .tier-name { font-weight: 700; color: white; font-size: 1rem; }
  .current-tag { font-size: 0.7rem; background: var(--primary); color: #064e3b; padding: 2px 8px; border-radius: 4px; font-weight: 700; }
  .tier-desc { font-size: 0.85rem; color: var(--text-muted); display: flex; align-items: start; gap: 6px; }
  .check-icon { width: 16px; height: 16px; color: var(--primary); flex-shrink: 0; margin-top: 2px; }
  .footer-hint { font-size: 0.85rem; color: #64748b; text-align: center; margin-top: 20px; }

  /* FOOTER */
  .app-footer { margin-top: 40px; text-align: center; padding-bottom: 20px; }
  .footer-separator { height: 1px; background: rgba(255,255,255,0.1); width: 100px; margin: 0 auto 20px auto; }
  .footer-content p { font-size: 0.8rem; color: #64748b; margin: 4px 0; }
  .highlight { color: var(--primary); }
  
  @media (max-width: 768px) { .dashboard-stats { grid-template-columns: 1fr; } }
</style>