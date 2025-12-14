<script lang="ts">
  import { onMount } from "svelte";
  import { slide } from "svelte/transition";
  import { quintOut } from "svelte/easing";
  const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(
    /\/$/,
    ""
  );

  let contentHeights: Record<number, number> = {};
  interface LogEntry {
    action: string;
    timestamp: string;
    detail?: string;
    type: "success" | "warning" | "error" | "info";
  }

  interface EventData {
    id: number;
    title: string;
    date: string;
    image: string;
    logs: LogEntry[];
    statsLoaded: boolean;
  }

  let events: EventData[] = [];
  let isLoadingAll = true;
  let expandedEventId: number | null = null;
  let isLoadingStats = false;
  onMount(async () => {
    try {
      const token = localStorage.getItem("access_token");
      await fetchEventList(token);
    } catch (error) {
      console.error("Failed to load events:", error);
    } finally {
      isLoadingAll = false;
    }
  });

  async function fetchEventList(token: string | null) {
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE_URL}/api/events/`, { headers });
    if (!res.ok) throw new Error("Failed to fetch event list");
    const data = await res.json();
    const list = Array.isArray(data) ? data : data.data || [];

    events = list.map((evt: any) => ({
      id: evt.id,
      title: evt.title,
      date: formatDate(evt.event_date),
      image:
        evt.banner_image_url ||
        "https://via.placeholder.com/400x200?text=No+Image",
      logs: [],
      statsLoaded: false,
    }));
  }

  async function fetchEventStats(eventId: number) {
    const index = events.findIndex((e) => e.id === eventId);
    if (index === -1) return;
    if (events[index].statsLoaded) return;

    isLoadingStats = true;
    const token = localStorage.getItem("access_token");
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
      const url = `${API_BASE_URL}/api/events/${eventId}/stats`;
      const res = await fetch(url, { headers });

      if (res.ok) {
        const statsData = await res.json();
        events[index].logs = convertStatsToLogs(statsData);
        events[index].statsLoaded = true;
      } else {
        events[index].logs = [
          {
            action: "Error",
            timestamp: "Now",
            detail: "Could not load statistics.",
            type: "error",
          },
        ];
      }
      events = [...events];
    } catch (err) {
      console.error("Stats fetch error:", err);
    } finally {
      isLoadingStats = false;
    }
  }

  function convertStatsToLogs(stats: any): LogEntry[] {
    const logs: LogEntry[] = [];
    logs.push({
      action: "Total Participants",
      timestamp: "Live Count",
      detail: `${stats.total || 0} people in total`,
      type: "info",
    });

    if (stats.by_status) {
      Object.entries(stats.by_status).forEach(([statusName, count]) => {
        let type: "success" | "warning" | "info" = "info";
        if (statusName === "joined" || statusName === "completed")
          type = "success";
        if (statusName === "pending" || statusName === "proof_needed")
          type = "warning";

        logs.push({
          action: `Status: ${capitalize(statusName)}`,
          timestamp: "-",
          detail: `${count} user(s)`,
          type: type,
        });
      });
    }

    // 3. Breakdown by Role
    if (stats.by_role) {
      Object.entries(stats.by_role).forEach(([roleName, count]) => {
        logs.push({
          action: `Role: ${capitalize(roleName)}`,
          timestamp: "-",
          detail: `${count} user(s)`,
          type: "warning",
        });
      });
    }

    if (logs.length === 0) {
      logs.push({
        action: "No Data",
        timestamp: "-",
        detail: "No participants yet.",
        type: "info",
      });
    }

    return logs;
  }

  function formatDate(dateStr: string) {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
  function capitalize(s: string) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
  }

  function toggleExpand(id: number) {
    if (expandedEventId === id) {
      expandedEventId = null;
    } else {
      expandedEventId = id;
      fetchEventStats(id);
    }
  }
</script>

<div class="app-screen">
  <div class="glass-header">
    <a href="/organizer/create-event" class="back-btn" aria-label="Back">
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <line x1="19" y1="12" x2="5" y2="12"></line>
        <polyline points="12 19 5 12 12 5"></polyline>
      </svg>
    </a>
    <h1 class="page-title">EVENT LOG</h1>
  </div>

  <div class="scroll-container">
    {#if isLoadingAll}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Loading events...</p>
      </div>
    {:else}
      <div class="content-wrapper">
        {#each events as event (event.id)}
          <div
            class="log-card {expandedEventId === event.id ? 'expanded' : ''}"
            on:click={() => toggleExpand(event.id)}
            on:keydown={(e) => e.key === "Enter" && toggleExpand(event.id)}
            role="button"
            tabindex="0"
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
                  <div class="activity-indicator info"></div>
                  <div class="activity-text">
                    {#if event.statsLoaded}
                      <span class="action-name">
                        Total: {(event.logs[0]?.detail || "").split(" ")[0] ||
                          "-"}
                      </span>
                    {:else}
                      <span class="action-name">Tap to view stats</span>
                    {/if}
                  </div>
                  <div class="expand-arrow">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      ><polyline points="6 9 12 15 18 9"></polyline></svg
                    >
                  </div>
                </div>
              </div>
            </div>

            {#if expandedEventId === event.id}
              <div
                class="timeline-wrapper"
                style="height: {contentHeights[event.id] || 0}px"
              >
                <div
                  class="inner-measurer"
                  bind:clientHeight={contentHeights[event.id]}
                >
                  {#if !event.statsLoaded}
                    <div class="inline-loader">
                      <div class="spinner small"></div>
                      <span>Fetching stats...</span>
                    </div>
                  {:else}
                    <div class="timeline-track">
                      {#each event.logs as log, i}
                        <div class="timeline-item">
                          <div class="timeline-line-col">
                            <div class="dot {log.type}"></div>
                            {#if i !== event.logs.length - 1}
                              <div class="line"></div>
                            {/if}
                          </div>
                          <div class="timeline-content">
                            <div class="log-header">
                              <span class="log-action">{log.action}</span>
                              <span class="log-time">{log.timestamp}</span>
                            </div>
                            {#if log.detail}
                              <p class="log-detail">{log.detail}</p>
                            {/if}
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
          <div class="empty-state">No events found.</div>
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

  .back-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }
  .page-title {
    color: white;
    font-size: 28px;
    font-weight: 600;
    margin: 0;
    letter-spacing: 1px;
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
    overflow: hidden;
    color: #1f2937;
    transition: all 0.2s ease;
  }
  .log-card:active {
    transform: scale(0.99);
  }
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
  .activity-indicator.info {
    background: #3b82f6;
  }
  .activity-text {
    flex: 1;
    font-size: 12px;
    font-weight: 500;
    color: #374151;
  }
  .expand-arrow {
    color: #9ca3af;
    transition: transform 0.3s;
  }
  .log-card.expanded .expand-arrow {
    transform: rotate(180deg);
  }

  .timeline-wrapper {
    background: #f8fafc;
    box-shadow: inset 0 1px 0 #e2e8f0;
    padding: 0;
    overflow: hidden; 
    transition: height 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
  }

  .inner-measurer {
    padding: 16px 20px;
    width: 100%;
    box-sizing: border-box;
  }
  .timeline-track {
    position: relative;
    flex: 1;
  }
  .timeline-item {
    display: flex;
    gap: 12px;
    padding-bottom: 24px;
    position: relative;
  }
  .timeline-item:last-child {
    padding-bottom: 0;
  }

  .timeline-line-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 16px;
    flex-shrink: 0;
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 2px solid white;
    z-index: 2;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }
  .dot.success {
    background: #10b981;
  }
  .dot.info {
    background: #3b82f6;
  }
  .dot.warning {
    background: #f59e0b;
  }
  .dot.error {
    background: #ef4444;
  }
  .line {
    width: 2px;
    background: #e2e8f0;
    flex: 1;
    margin-top: -2px;
    margin-bottom: -14px;
  }

  .timeline-content {
    flex: 1;
    padding-top: -2px;
  }
  .log-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
  }
  .log-action {
    font-size: 13px;
    font-weight: 600;
    color: #1e293b;
  }
  .log-time {
    font-size: 11px;
    color: #94a3b8;
  }
  .log-detail {
    font-size: 12px;
    color: #64748b;
    margin: 0;
    line-height: 1.4;
    background: white;
    padding: 8px;
    border-radius: 6px;
    border: 1px solid #f1f5f9;
  }

  .loading-state,
  .inline-loader {
    text-align: center;
    color: #6b7280;
    padding: 10px;
    font-size: 13px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 40px; 
  }
  .spinner {
    width: 30px;
    height: 30px;
    border: 3px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    border-top-color: #3b82f6;
    animation: spin 1s infinite;
  }
  .spinner.small {
    width: 20px;
    height: 20px;
    border-color: #cbd5e1;
    border-top-color: #3b82f6;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .empty-state {
    text-align: center;
    color: #9ca3af;
    padding-top: 20px;
    font-size: 14px;
  }
</style>
