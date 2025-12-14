<script lang="ts">
  import { onMount } from "svelte";
  import { slide } from "svelte/transition";
  import { quintOut } from "svelte/easing";
  import Swal from "sweetalert2";

  const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

  // --- Interfaces ---
  interface Submission {
    id: number;
    runnerName: string;
    submitTime: string;
    proofImage: string | null;
    distance: number;
    duration: string;
  }

  interface EventItem {
    id: number;
    title: string;
    date: string;
    image: string;
    pendingCount: number;
    submissions: Submission[];
    isLoadingSubmissions: boolean;
    hasLoaded: boolean;
  }

  // --- State ---
  let events: EventItem[] = [];
  let isLoadingAll = true;
  let expandedEventId: number | null = null;

  // --- Actions ---
  onMount(async () => {
    await fetchEventList();
  });

  async function fetchEventList() {
    try {
      const token = localStorage.getItem("access_token");
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE_URL}/api/events/`, { headers });
      if (!res.ok) throw new Error("Failed to fetch events");
      
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.data || [];

      events = list.map((evt: any) => ({
        id: evt.id,
        title: evt.title,
        date: formatDate(evt.event_date),
        image: evt.banner_image_url || "https://via.placeholder.com/400x200?text=No+Image",
        pendingCount: evt.pending_count || 0, 
        submissions: [],
        isLoadingSubmissions: false,
        hasLoaded: false
      }));

    } catch (error) {
      console.error("Error loading events:", error);
      Swal.fire("Error", "Could not load event list", "error");
    } finally {
      isLoadingAll = false;
    }
  }

  async function fetchPendingSubmissions(eventId: number) {
    const index = events.findIndex(e => e.id === eventId);
    if (index === -1) return;

    events[index].isLoadingSubmissions = true;
    events = [...events];
    
    try {
      const token = localStorage.getItem("access_token");
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const url = `${API_BASE_URL}/api/events/${eventId}/participations?status=proof_needed`;
      
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error("Failed to fetch submissions");

      const data = await res.json();
      const subs = Array.isArray(data) ? data : data.data || [];

      events[index].submissions = subs.map((s: any) => ({
        id: s.id,
        runnerName: s.user ? `${s.user.first_name} ${s.user.last_name}` : "Unknown Runner",
        submitTime: new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' }),
        proofImage: s.proof_image_url || null,
        distance: parseFloat(s.distance_km || 0),
        duration: s.duration || "-",
      }));

      events[index].pendingCount = events[index].submissions.length;

    } catch (error) {
      console.error("Error fetching submissions:", error);
      events[index].submissions = [];
    } finally {
      events[index].isLoadingSubmissions = false;
      events[index].hasLoaded = true;
      events = [...events];
    }
  }

  // --- API: Verify Participation (เชื่อมต่อตาม Spec) ---
  async function verifyParticipationAPI(participationId: number, approved: boolean, reason: string = "") {
    const token = localStorage.getItem("access_token");
    const headers: HeadersInit = { 
        "Content-Type": "application/json" 
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    // เตรียม Payload
    const payload: any = {
        participation_id: participationId,
        approved: approved
    };
    
    // ถ้า Reject ต้องส่ง reason ไปด้วย
    if (!approved) {
        payload.rejection_reason = reason;
    }

    const res = await fetch(`${API_BASE_URL}/api/participations/verify`, {
        method: "POST", 
        headers, 
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Verification failed");
    }
    
    // คืนค่า Response (เผื่อ Backend ส่ง completion_code กลับมา)
    return await res.json();
  }

  // --- Helpers ---
  function toggleExpand(event: EventItem) {
    if (expandedEventId === event.id) {
      expandedEventId = null;
    } else {
      expandedEventId = event.id;
      if (!event.hasLoaded) {
        fetchPendingSubmissions(event.id);
      }
    }
  }

  function formatDate(dateStr: string) {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: "numeric"
    });
  }

  function removeSubmissionFromUI(eventId: number, submissionId: number) {
    const evtIndex = events.findIndex((e) => e.id === eventId);
    if (evtIndex === -1) return;
    
    events[evtIndex].submissions = events[evtIndex].submissions.filter(s => s.id !== submissionId);
    events[evtIndex].pendingCount = Math.max(0, events[evtIndex].pendingCount - 1);
    events = [...events];
  }

  // --- UI Handlers ---
  
  // 1. กด Approve
  function onApprove(eventId: number, sub: Submission) {
    Swal.fire({
      title: `Approve ${sub.runnerName}?`,
      text: "Verify completion and generate code.", // อัพเดทข้อความให้ตรงบริบท
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#10b981",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, Approve",
      customClass: { popup: 'my-swal-font' },
      showLoaderOnConfirm: true,
      preConfirm: async () => {
        try {
            // เรียก API: approved = true
            const response = await verifyParticipationAPI(sub.id, true);
            return response;
        } catch (error: any) {
            Swal.showValidationMessage(`Request failed: ${error.message}`);
        }
      }
    }).then((result) => {
      if (result.isConfirmed) {
        // ลบออกจากรายการ UI
        removeSubmissionFromUI(eventId, sub.id);
        
        // แสดง Success (ถ้า backend ส่ง completion_code มาใน result.value สามารถเอามาโชว์ได้)
        Swal.fire({
            title: "Verified!",
            text: "Status updated to COMPLETED.",
            icon: "success",
            timer: 2000,
            showConfirmButton: false,
            customClass: { popup: 'my-swal-font' }
        });
      }
    });
  }

  // 2. กด Reject
  async function onReject(eventId: number, sub: Submission) {
    const htmlContent = `
      <div class="swal-reject-form">
        <label><input type="radio" name="reason" value="Blurry/Unclear Image" checked> 📸 Blurry / Unclear</label>
        <label><input type="radio" name="reason" value="Incorrect Distance"> 📏 Incorrect Distance</label>
        <label><input type="radio" name="reason" value="Duplicate Entry"> ⚠️ Duplicate Entry</label>
        <label><input type="radio" name="reason" value="other"> 📝 Other</label>
        <textarea id="other-reason" placeholder="Type reason here..." style="display:none;"></textarea>
      </div>
    `;

    const { value: reason } = await Swal.fire({
      title: "Reject Submission",
      html: htmlContent,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      confirmButtonText: "Reject",
      customClass: { popup: 'my-swal-font' },
      didOpen: () => {
        const popup = Swal.getPopup();
        const radios = popup?.querySelectorAll('input[name="reason"]');
        const textArea = popup?.querySelector('#other-reason') as HTMLElement;
        radios?.forEach((r) => {
            r.addEventListener('change', (e: any) => {
                textArea.style.display = e.target.value === 'other' ? 'block' : 'none';
            });
        });
      },
      preConfirm: () => {
        const popup = Swal.getPopup();
        const selected = popup?.querySelector('input[name="reason"]:checked') as HTMLInputElement;
        const textArea = popup?.querySelector('#other-reason') as HTMLInputElement;
        
        if (!selected) return Swal.showValidationMessage("Please select a reason");
        let val = selected.value;
        if (val === 'other') {
            val = textArea.value;
            if(!val) return Swal.showValidationMessage("Please specify the reason");
        }
        return val;
      }
    });

    if (reason) {
        Swal.fire({
            title: 'Rejecting...',
            didOpen: () => Swal.showLoading(),
            allowOutsideClick: false
        });

        try {
            // เรียก API: approved = false, ส่ง reason ไปด้วย
            await verifyParticipationAPI(sub.id, false, reason);
            
            // ลบออกจาก UI
            removeSubmissionFromUI(eventId, sub.id);
            
            Swal.fire({
                title: "Rejected",
                text: `Submission rejected. Status updated to REJECTED.`,
                icon: "error",
                timer: 2000,
                showConfirmButton: false,
                customClass: { popup: 'my-swal-font' }
            });
        } catch (error: any) {
            Swal.fire("Error", error.message, "error");
        }
    }
  }
</script>

<div class="app-screen">
  <div class="glass-header">
    <a href="/organizer/create-event" class="back-btn" aria-label="Back">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="19" y1="12" x2="5" y2="12"></line>
        <polyline points="12 19 5 12 12 5"></polyline>
      </svg>
    </a>
    <h1 class="page-title">VERIFY PROOF</h1>
  </div>

  <div class="scroll-container">
    {#if isLoadingAll}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Loading tasks...</p>
      </div>
    {:else}
      <div class="content-wrapper">
        {#each events as event (event.id)}
          <div 
            class="log-card {expandedEventId === event.id ? 'expanded' : ''}"
            on:click={() => toggleExpand(event)}
            role="button"
            tabindex="0"
            on:keydown={(e) => e.key === "Enter" && toggleExpand(event)}
          >
            <div class="card-summary">
              <div class="img-box">
                <img src={event.image} alt={event.title} />
              </div>
              <div class="info-box">
                <div class="row-top">
                  <h2 class="title">{event.title}</h2>
                  <span class="date">{event.date}</span>
                </div>
                <div class="latest-activity-row">
                  <div class="activity-indicator {event.pendingCount > 0 ? 'warning' : 'success'}"></div>
                  <div class="activity-text">
                    {#if event.pendingCount > 0}
                        <span class="highlight-warning">{event.pendingCount} Pending</span> Check now
                    {:else}
                        <span class="highlight-success">All Clear</span> No pending items
                    {/if}
                  </div>
                  <div class="expand-arrow">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                  </div>
                </div>
              </div>
            </div>

            {#if expandedEventId === event.id}
              <div class="slide-wrapper" transition:slide|local={{ duration: 400, easing: quintOut }}>
                <div class="details-wrapper">
                  {#if event.isLoadingSubmissions}
                    <div class="inline-loader">
                      <div class="spinner small"></div>
                      <span>Loading proofs...</span>
                    </div>
                  {:else if event.submissions.length === 0}
                    <div class="empty-sub">
                        No pending submissions here.
                    </div>
                  {:else}
                    <div class="submission-list">
                      {#each event.submissions as sub (sub.id)}
                        <div class="sub-item">
                          <div class="sub-header">
                              <span class="runner-name">{sub.runnerName}</span>
                              <span class="sub-time">{sub.submitTime}</span>
                          </div>
                          <div class="sub-stats">
                              <div class="stat-pill">Run: <strong>{sub.distance} km</strong></div>
                              <div class="stat-pill">Time: <strong>{sub.duration}</strong></div>
                          </div>
                          <div class="proof-img-container">
                              {#if sub.proofImage}
                                  <img src={sub.proofImage} alt="Proof" />
                              {:else}
                                  <div class="no-img">No Image Uploaded</div>
                              {/if}
                          </div>
                          <div class="action-buttons">
                              <button 
                                  class="btn reject" 
                                  on:click|stopPropagation={() => onReject(event.id, sub)}
                              >Reject</button>
                              <button 
                                  class="btn approve" 
                                  on:click|stopPropagation={() => onApprove(event.id, sub)}
                              >Approve</button>
                          </div>
                        </div>
                      {/each}
                    </div>
                  {/if}
                </div>
              </div>
            {/if}
          </div>
        {/each}

        {#if events.length === 0}
            <div class="empty-state">No events to verify.</div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  @import url("https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap");

  :global(body) {
    margin: 0;
    background-color: #111827;
    color: white;
    font-family: "Inter", sans-serif;
  }
  
  :global(.my-swal-font) {
    font-family: "Inter", sans-serif;
  }

  .app-screen {
    height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .glass-header {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 80px;
    z-index: 50;
    background: rgba(17, 24, 39, 0.95);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(17, 24, 39, 0.95);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .back-btn {
    position: absolute;
    left: 20px;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    cursor: pointer;
    transition: 0.2s;
  }
  .back-btn:hover { background: rgba(255, 255, 255, 0.2); }
  .page-title {
    color: white;
    font-size: 28px;
    font-weight: 600;
    margin: 0;
    letter-spacing: 1px;
    text-transform: uppercase;
  }

  .scroll-container {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    padding-top: 110px; 
    -ms-overflow-style: none; 
    scrollbar-width: none; 
  }
  .scroll-container::-webkit-scrollbar {
    display: none;
  }

  .content-wrapper {
    max-width: 500px;
    margin: 0 auto;
  }

  .log-card {
    background: white;
    border-radius: 12px;
    margin-bottom: 16px;
    color: #1f2937;
    transition: all 0.2s ease;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }
  .log-card:active { transform: none; }
  
  .card-summary {
    display: flex;
    padding: 12px;
    gap: 12px;
    cursor: pointer;
  }
  .img-box {
    width: 67px;
    height: 67px;
    border-radius: 8px;
    overflow: hidden;
    flex-shrink: 0;
    background: #f3f4f6;
  }
  .img-box img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .info-box {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    overflow: hidden;
  }
  .row-top {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 6px;
  }
  .title {
    font-size: 14px;
    font-weight: 700;
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 70%;
  }
  .date {
    font-size: 11px;
    color: #6b7280;
  }

  .latest-activity-row {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #f9fafb;
    padding: 6px 8px;
    border-radius: 6px;
    border: 1px solid #e5e7eb;
  }
  .activity-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .activity-indicator.warning { background: #f59e0b; box-shadow: 0 0 5px rgba(245, 158, 11, 0.4); }
  .activity-indicator.success { background: #10b981; }
  
  .activity-text {
    flex: 1;
    font-size: 12px;
    font-weight: 500;
    color: #6b7280;
  }
  .highlight-warning { color: #d97706; font-weight: 700; }
  .highlight-success { color: #059669; font-weight: 700; }

  .expand-arrow {
    color: #9ca3af;
    transition: transform 0.3s;
  }
  .log-card.expanded .expand-arrow { transform: rotate(180deg); }

  .slide-wrapper {
    overflow: hidden;
    border-bottom-left-radius: 12px;
    border-bottom-right-radius: 12px;
  }

  .details-wrapper {
    background: #f8fafc;
    box-shadow: inset 0 1px 0 #e2e8f0;
    padding: 0;
    cursor: default;
    
    max-height: 450px; 
    overflow-y: auto;
    
    border-bottom-left-radius: 12px;
    border-bottom-right-radius: 12px;

    scrollbar-width: thin; 
    scrollbar-color: #cbd5e1 transparent;
    
    will-change: height;
    box-sizing: border-box;
  }

  .details-wrapper::-webkit-scrollbar {
    width: 6px;
  }
  .details-wrapper::-webkit-scrollbar-track {
    background: transparent;
    border-bottom-right-radius: 12px;
  }
  .details-wrapper::-webkit-scrollbar-thumb {
    background-color: #cbd5e1;
    border-radius: 20px;
    border: 2px solid transparent;
    background-clip: content-box;
  }
  
  .submission-list {
    display: flex;
    flex-direction: column;
  }

  .sub-item {
    padding: 16px;
    border-bottom: 1px solid #e2e8f0;
    background: #fff;
  }
  .sub-item:last-child { border-bottom: none; }

  .sub-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
  }
  .runner-name { font-weight: 700; font-size: 14px; color: #111827; }
  .sub-time { font-size: 11px; color: #9ca3af; }

  .sub-stats {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }
  .stat-pill {
    background: #eff6ff;
    color: #059669;
    font-size: 12px;
    padding: 4px 8px;
    border-radius: 4px;
    font-weight: 500;
  }

  .proof-img-container {
    width: 100%;
    height: 160px;
    border-radius: 8px;
    overflow: hidden;
    background: #f3f4f6;
    border: 1px solid #e5e7eb;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .proof-img-container img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .no-img { color: #9ca3af; font-size: 12px; }

  .action-buttons {
    display: flex;
    gap: 10px;
  }
  .btn {
    flex: 1;
    padding: 10px;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: 0.2s;
  }
  .btn.reject {
    background: #fee2e2;
    color: #b91c1c;
  }
  .btn.reject:hover { background: #fecaca; }
  
  .btn.approve {
    background: #10b981;
    color: white;
  }
  .btn.approve:hover { background: #059669; }

  .loading-state, .inline-loader, .empty-sub {
    text-align: center;
    color: #9ca3af;
    min-height: 70px; 
    font-size: 15px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
  }
  .spinner {
    width: 30px;
    height: 30px;
    border: 3px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    border-top-color: #059669;
    animation: spin 1s infinite;
  }
  .spinner.small {
    width: 20px;
    height: 20px;
    border-color: #cbd5e1;
    border-top-color: #059669;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  
  .empty-state {
    text-align: center;
    color: #9ca3af;
    padding: 20px;
    font-size: 14px;
    min-height: 160px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  :global(.swal-reject-form) {
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 14px;
  }
  :global(.swal-reject-form label) {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    padding: 6px;
    border-radius: 4px;
  }
  :global(.swal-reject-form label:hover) {
    background: #f3f4f6;
  }
  :global(#other-reason) {
    width: 100%;
    margin-top: 5px;
    padding: 8px;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    box-sizing: border-box;
  }
</style>