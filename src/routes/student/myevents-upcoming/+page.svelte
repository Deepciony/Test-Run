<script lang="ts">
  import { fade, slide, scale } from "svelte/transition";
  import { goto } from "$app/navigation";
  import { onMount, onDestroy } from "svelte";
  import Swal from "sweetalert2";

  // --- CONFIG ---
  const BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
    // const BASE_URL = "http://158.108.102.14:8005";
  import holidaysJson from '$lib/data/holidays.json';

  // --- STATE: LAYOUT ---
  let isMobileMenuOpen = false;
  let currentView = "my-event";

  // --- STATE: SESSION TIMER ---
  let timeLeftStr = "--:--:--"; 
  let timeLeftSeconds = 0;
  let timerInterval: ReturnType<typeof setInterval> | null = null;

  // --- STATE: SEARCH ---
  let searchQuery = "";

  // --- STATE: LANGUAGE ---
  let lang: 'th' | 'en' = 'th';

  const t = {
      th: {
          upcoming_header: "กิจกรรมเร็วๆ นี้",
          history_header: "ประวัติกิจกรรม",
          search_placeholder: "ค้นหา...",
          read_more: "ดูรายละเอียด",
          read_less: "ย่อลง",
          
          // สถานะ (Badges)
          status_register: "ลงทะเบียน", // [แก้ไข] เพิ่มคำแปล
          status_waiting: "รอตรวจสอบ",
          status_rejected: "แก้ไขรูปภาพ",
          status_sending: "ส่งผลวิ่ง",
          status_completed_badge: "✔ ผ่านแล้ว (รอกิจกรรมจบ)",
          status_ended: "จบกิจกรรม",
          
          // ปุ่ม (Buttons)
          btn_checkin: "เข้าร่วมกิจกรรม",
          btn_register: "ลงทะเบียน",
          btn_waiting: "⏳ กำลังตรวจสอบ",
          btn_send_proof: "ส่งผลวิ่ง",
          btn_send_image: "ส่งรูปภาพ",
          btn_completed: "🕒 รอกิจกรรมจบ",
          btn_checkout: "ออกจากกิจกรรม",
          btn_locked: "ยังไม่เปิด",
          btn_confirm_checkin: "ยืนยันการเช็คอิน",
          btn_next: "ถัดไป (อัปโหลดรูปภาพ) →",
          btn_submit: "ยืนยันการส่งข้อมูล",
          btn_resubmit: "ยืนยันการส่งซ้ำ",
          btn_back_strava: "← ย้อนกลับไปแก้ไข Strava",
          btn_verify_link: "🔍 ตรวจสอบ",
          status_daily_completed: "เจอกันพรุ่งนี้",
          btn_daily_wait: "รอวันถัดไป", // คำสั้นๆ

          // Modal
          modal_step1: "ขั้นตอนที่ 1: ข้อมูลการวิ่ง",
          modal_step1_sub: "กรอกข้อมูลจาก Strava ของคุณ",
          modal_link_label: "ลิงก์กิจกรรม Strava (จำเป็น)",
          modal_dist_label: "ระยะทาง (กิโลเมตร)",
          modal_dist_warn: "*ระบบจะล็อคการแก้ไข กรุณากดปุ่ม 'ตรวจสอบ' เพื่อดึงข้อมูลจริง",
          modal_step2: "ขั้นตอนที่ 2: หลักฐานรูปภาพ",
          modal_step2_sub: "อัปโหลดภาพแคปหน้าจอผลการวิ่ง",
          modal_upload_txt: "📸 แตะเพื่ออัปโหลดรูปภาพ",
          modal_rejected: "⚠️ รูปภาพถูกปฏิเสธ:",
          modal_verifying_title: "อยู่ระหว่างตรวจสอบ",
          modal_verifying_desc: "ระบบได้รับข้อมูลแล้ว กำลังรอเจ้าหน้าที่ตรวจสอบความถูกต้องครับ",
          modal_close: "ปิด",

          // More
          alert_success: "ทำรายการสำเร็จ",
          alert_not_checked_in: "ยังไม่ได้รับการเช็คอิน",
          alert_contact_staff: "กรุณาส่งรหัส PIN หรือ QR Code ให้เจ้าหน้าที่ทำการเช็คอิน",
          alert_checkin_success: "เช็คอินสำเร็จ!",
          alert_go_next: "เข้าสู่ขั้นตอนการส่งผลวิ่ง",
          btn_ok: "ตกลง",
          alert_warning: "แจ้งเตือน",
            alert_error: "ข้อผิดพลาด",
            alert_success_title: "สำเร็จ",
            alert_link_required: "กรุณากรอกลิงก์กิจกรรม Strava",
            alert_link_invalid: "ลิงก์ไม่ถูกต้อง (ต้องเป็น strava.app.link หรือ strava.com)",
            alert_checking: "กำลังตรวจสอบ...",
            alert_fetching_strava: "กำลังดึงข้อมูลจาก Strava...",
            alert_not_found: "ไม่พบข้อมูล",
            alert_connection_error: "เกิดข้อผิดพลาดในการเชื่อมต่อ",
            alert_verify_first: "กรุณากดปุ่ม 'ตรวจสอบ' เพื่อดึงระยะทางก่อน",
            alert_image_required: "กรุณาอัปโหลดรูปภาพหลักฐาน",
            alert_upload_failed: "อัปโหลดไม่สำเร็จ",
            alert_submit_success: "ส่งข้อมูลเรียบร้อยแล้ว",
            alert_session_expired: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่",
      },
      en: {
          upcoming_header: "Upcoming",
          history_header: "History",
          search_placeholder: "Search...",
          read_more: "Read more",
          read_less: "Read less",

          // Badges
          status_register: "REGISTER", // [แก้ไข] เพิ่มคำแปล
          status_waiting: "Verifying",
          status_rejected: "Action Required",
          status_sending: "Draft",
          status_completed_badge: "✔ Completed",
          status_ended: "ENDED",

          // Buttons
          btn_checkin: "CHECK-IN",
          btn_register: "REGISTER",
          btn_waiting: "⏳ VERIFYING",
          btn_send_proof: "SEND PROOF",
          btn_send_image: "SEND IMAGE",
          btn_completed: "🕒 COMPLETED",
          btn_checkout: "CHECK-OUT",
          btn_locked: "LOCKED",
          btn_confirm_checkin: "CONFIRM CHECK-IN",
          btn_next: "Next (Upload Image) →",
          btn_submit: "Submit Proof",
          btn_resubmit: "Resubmit Proof",
          btn_back_strava: "← Back to Strava Link",
          btn_verify_link: "🔍 Verify Link",
          status_daily_completed: "NEXT DAY",
          btn_daily_wait: "Wait Next Day",

          // Modal
          modal_step1: "Step 1: Activity Data",
          modal_step1_sub: "Enter your Strava activity link",
          modal_link_label: "Strava Activity Link (Required)",
          modal_dist_label: "Distance (KM)",
          modal_dist_warn: "*Input is locked. Please click 'Verify Link' to fetch data.",
          modal_step2: "Step 2: Proof Image",
          modal_step2_sub: "Upload a screenshot of your run result",
          modal_upload_txt: "📸 Tap to upload image",
          modal_rejected: "⚠️ Image Rejected:",
          modal_verifying_title: "Verification Pending",
          modal_verifying_desc: "We are verifying your submission. Please wait.",
          modal_close: "Close",

          // More
          alert_success: "Success",
          alert_not_checked_in: "Check-in Pending",
          alert_contact_staff: "Please present your PIN or QR Code to staff.",
          alert_checkin_success: "Check-in Successful!",
          alert_go_next: "Proceeding to proof submission.",
          btn_ok: "OK",
          alert_warning: "Warning",
            alert_error: "Error",
            alert_success_title: "Success",
            alert_link_required: "Strava activity link is required.",
            alert_link_invalid: "Invalid link (Must be strava.app.link or strava.com)",
            alert_checking: "Checking...",
            alert_fetching_strava: "Fetching Strava data...",
            alert_not_found: "Not Found",
            alert_connection_error: "Connection Error",
            alert_verify_first: "Please click 'Verify Link' first.",
            alert_image_required: "Proof image is required.",
            alert_upload_failed: "Upload failed",
            alert_submit_success: "Submitted successfully.",
            alert_session_expired: "Session expired. Please login again.",
      }
  };

  function setLang(l: 'th' | 'en') {
      lang = l;
      if (typeof localStorage !== 'undefined') {
          localStorage.setItem('app_lang', l);
      }
  }

  // --- STATE: DATA ---
  let loading = true;
  let rawParticipations: any[] = [];
  let eventsMap: Record<number, any> = {}; 
  let holidaysMap: Record<number, any> = {};
  
  let upcomingEvents: EventItem[] = [];
  let historyEvents: EventItem[] = [];

  // --- MODAL STATE ---
  let showModal = false;
  let selectedEvent: EventItem | null = null;
  let checkInMethod: 'PIN' | 'QR' = 'PIN';
  let proofImage: string | null = null; 
  let proofFile: File | null = null;
  let sendingLink = "";
  let currentParticipationId: number | null = null;
  let distanceInput = 0;

  // --- MENU ITEMS ---
  const menuItems = [
    { id: "event-list", label: "Event list", path: "/student/event-list", svg: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9 2 2 4-4" },
    { id: "monthly-reward", label: "Monthly reward", path: "/student/monthly-reward", svg: "M20 7h-3a4 4 0 1 0-8 0H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zm-7 0a2 2 0 1 1 4 0h-4zm0 13H6v-9h7v9zm2-9h7v9h-7v-9z" },
    { id: "my-event", label: "My event", path: "/student/myevents-upcoming", svg: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" },
    { id: "account-setting", label: "Account setting", path: "/student/setting-account", svg: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
  ];

  interface EventItem {
    id: number;
    participation_id: number;
    title: string;
    description: string;
    location: string;
    distance_km: number;
    actual_distance_km?: number;
    banner_image_url: string;
    status: "REGISTER" | "COMPLETED" | "SENDING" | "PROOF" | "CHECKOUT" | "WAITING" | "REJECTED" | "CANCELED"; 
    participant_count: number;
    max_participants: number;
    isJoined: boolean; 
    isExpanded: boolean;
    rejection_reason?: string;
    proof_image_url?: string;
    join_code?: string; //PIN Check-in
    completion_code?: string; //PIN Check-out

    raw_start_date?: string;
    raw_end_date?: string;
    raw_start_time?: string;
    raw_end_time?: string;

    completed_count: number;
    isLocked?: boolean;
  }

  // --- DATA FETCHING ---
  async function loadData() {
    loading = true;
    try {
        const token = getToken();
        const userId = getUserIdFromToken();
        
        if (!token || !userId) {
            console.warn("No credentials found");
            Swal.fire({
                icon: 'warning',
                title: t[lang].alert_session_expired || 'Session Expired',
                text: 'Please login again',
                confirmButtonText: 'OK'
            }).then(() => {
                goto("/auth/login");
            });
            return;
        }

        // 1. Process Holidays จากไฟล์ที่ Import มา
        holidaysMap = {};
        if (Array.isArray(holidaysJson)) {
              holidaysJson.forEach((h: any) => {
                  if (h && h.eventId) holidaysMap[h.eventId] = h;
              });
        }

        // 2. Fetch ข้อมูลจาก API พร้อมกัน
        const [resPart, resAllEvents] = await Promise.all([
             // 1. Get User Participations (ไม่มี slash ปิดท้าย ตาม spec)
             fetch(`${BASE_URL}/api/participations/user/${userId}`, {
                 method: 'GET', // ระบุ Method ให้ชัดเจน
                 headers: { 
                     'Authorization': `Bearer ${token}`,
                     'Content-Type': 'application/json'
                 }
             }).catch(err => {
                 console.error("Participations fetch error:", err);
                 throw new Error("Cannot connect to participations API");
             }),
        
             // 2. Get Events (เติม slash ปิดท้าย ตาม spec)
             fetch(`${BASE_URL}/api/events/`, {  // <--- เติม / ตรงนี้ครับ
                 method: 'GET', // ระบุ Method ให้ชัดเจน
                 headers: { 
                     'Authorization': `Bearer ${token}`,
                     'Content-Type': 'application/json'
                 }
             }).catch(err => {
                 console.error("Events fetch error:", err);
                 throw new Error("Cannot connect to events API");
             })
        ]);

        // Check response status with detailed error messages
        if (!resPart.ok) {
            const errText = await resPart.text().catch(() => "Unknown error");
            console.error(`Participations API Error (${resPart.status}):`, errText);
            throw new Error(`Failed to fetch participations (${resPart.status})`);
        }
        
        if (!resAllEvents.ok) {
            const errText = await resAllEvents.text().catch(() => "Unknown error");
            console.error(`Events API Error (${resAllEvents.status}):`, errText);
            throw new Error(`Failed to fetch events (${resAllEvents.status})`);
        }

        // Parse JSON responses
        rawParticipations = await resPart.json().catch(err => {
            console.error("Error parsing participations JSON:", err);
            throw new Error("Invalid participations data format");
        });
        
        const allEvents = await resAllEvents.json().catch(err => {
            console.error("Error parsing events JSON:", err);
            throw new Error("Invalid events data format");
        });

        // 3. Process Events Map
        eventsMap = {};
        if (Array.isArray(allEvents)) {
            allEvents.forEach((ev: any) => {
                if (ev && ev.id) eventsMap[ev.id] = ev;
            });
        }

        processData();

    } catch (e: any) {
        console.error("Error loading data:", e);
        
        // More specific error messages
        let errorMsg = "ไม่สามารถโหลดข้อมูลกิจกรรมได้";
        if (e.message?.includes("connect")) {
            errorMsg = "ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต";
        } else if (e.message?.includes("401") || e.message?.includes("403")) {
            errorMsg = "Session หมดอายุ กรุณาเข้าสู่ระบบใหม่";
            Swal.fire({
                icon: 'error',
                title: 'Authentication Error',
                text: errorMsg,
                confirmButtonText: 'OK'
            }).then(() => {
                goto("/auth/login");
            });
            return;
        } else if (e.message?.includes("format")) {
            errorMsg = "ข้อมูลจากเซิร์ฟเวอร์ไม่ถูกต้อง";
        }
        
        Swal.fire({
            icon: "error",
            title: "Error",
            text: errorMsg,
            footer: `<small>Technical: ${e.message || 'Unknown error'}</small>`
        });
    } finally {
        loading = false;
    }
  }

  function processData() {
      const upcoming: EventItem[] = [];
      const history: EventItem[] = [];
      const now = new Date();

      // 1. นับจำนวนครั้งที่ทำสำเร็จ (เหมือนเดิม)
      const completionCounts: Record<number, number> = {};
      rawParticipations.forEach(p => {
          if (p.status && p.status.toUpperCase() === 'COMPLETED') {
              completionCounts[p.event_id] = (completionCounts[p.event_id] || 0) + 1;
          }
      });

      // 2. หารายการล่าสุด (เหมือนเดิม)
      const latestParticipations: Record<number, any> = {};
      rawParticipations.forEach(p => {
          if (!latestParticipations[p.event_id] || p.id > latestParticipations[p.event_id].id) {
              latestParticipations[p.event_id] = p;
          }
      });

      // 3. Loop จาก Events ทั้งหมด
      Object.values(eventsMap).forEach((ev: any) => {
          const p = latestParticipations[ev.id]; 

          // -------------------------------------------------------------
          // [แก้ไขจุดที่ 1] กรองทิ้งทันทีถ้า User ไม่เคยสมัครกิจกรรมนี้
          // -------------------------------------------------------------
          if (!p) return; // ถ้าไม่มีประวัติการเข้าร่วมเลย -> ไม่โชว์หน้านี้

          // กำหนด Status
          let apiStatus = p.status; 
          let uiStatus = mapApiStatusToUi(apiStatus);
          const count = completionCounts[ev.id] || 0;

          // Logic Draft Key (เหมือนเดิม)
          if (uiStatus === 'SENDING' && typeof localStorage !== 'undefined') {
              const draftKey = `proof_draft_${p.id}`;
              const draftJson = localStorage.getItem(draftKey);
              if (draftJson) {
                  try {
                      const draft = JSON.parse(draftJson);
                      if (draft.step && draft.step >= 2) uiStatus = 'PROOF';
                  } catch (e) { }
              }
          }

          // Time & Date (เหมือนเดิม)
          const startIso = ev.event_date || ev.startDate || ev.event_start_date;
          const endIso = ev.event_end_date || ev.endDate;

          const extractTimeRaw = (isoStr: string) => {
              if (!isoStr) return "";
              if (isoStr.includes('T')) return isoStr.split('T')[1].substring(0, 5);
              return isoStr.substring(0, 5);
          };

          const startTimeStr = extractTimeRaw(startIso); 
          const endTimeStr = extractTimeRaw(endIso);
          const endDate = endIso ? new Date(endIso) : null;
          // นับเป็น Expired เมื่อจบวันสุดท้ายไปแล้ว
          const isExpired = endDate && endDate < now;

          let isJoined = true; // เพราะเรากรอง !p ออกไปแล้ว ตรงนี้จึงเป็น true เสมอ
          let isLocked = false;
          let isLastDayFinished = false; 

          const lastUpdate = p.updated_at ? new Date(p.updated_at) : new Date(p.created_at);
          const isDoneToday = lastUpdate.getDate() === now.getDate() &&
                              lastUpdate.getMonth() === now.getMonth() &&
                              lastUpdate.getFullYear() === now.getFullYear();

          // -------------------------------------------------------------
          // [แก้ไขจุดที่ 2] Logic การ Lock และ Reset วัน
          // -------------------------------------------------------------
          if (uiStatus === 'COMPLETED') {
              if (isExpired) {
                  isLastDayFinished = true; // จบโครงการแล้ว
              } else {
                  // ยังไม่จบโครงการ -> เตรียมเริ่มวันใหม่
                  
                  if (isDoneToday) {
                      // Case A: เพิ่งทำเสร็จวันนี้ -> ต้อง Lock รอพรุ่งนี้
                      uiStatus = 'REGISTER'; // สถานะเป็น Register (ของรอบหน้า)
                      isLocked = true;       // แต่ Lock ไว้ก่อน
                  } else {
                      // Case B: ทำเสร็จของเมื่อวานไปแล้ว -> วันนี้เปิดให้ทำต่อ
                      uiStatus = 'REGISTER'; 
                      isLocked = false;      // เปิดให้กดปุ่ม Checkin ได้
                  }
              }
          }

          // Check Time Window (เหมือนเดิม)
          if (!isLocked && !isLastDayFinished && startTimeStr && endTimeStr) {
               const [sh, sm] = startTimeStr.split(':').map(Number);
               const [eh, em] = endTimeStr.split(':').map(Number);
               const todayStart = new Date(); todayStart.setHours(sh, sm, 0, 0);
               const todayEnd = new Date(); todayEnd.setHours(eh, em, 59, 999);
               if (now < todayStart || now > todayEnd) isLocked = true;
          }

          // แยก History / Upcoming
          const shouldGoToHistory = isExpired || isLastDayFinished || uiStatus === 'CANCELED';

          if (shouldGoToHistory) {
              if (count >= 1 && uiStatus !== 'CANCELED') uiStatus = 'COMPLETED';
              else if (uiStatus !== 'COMPLETED') uiStatus = 'CANCELED';
          }

          const item: EventItem = {
              id: ev.id,
              participation_id: p.id,
              title: ev.title || "Unknown Event",
              description: ev.description || "",
              location: ev.location || "-",
              distance_km: ev.distance_km || 0,
              actual_distance_km: p.actual_distance_km || 0,
              banner_image_url: ev.banner_image_url || "https://via.placeholder.com/400",
              participant_count: ev.participant_count || 0,
              max_participants: ev.max_participants || 0,
              
              join_code: p.join_code || "",
              completion_code: p.completion_code || "",
              rejection_reason: p.rejection_reason,
              proof_image_url: p.proof_image_url,
              
              raw_start_date: startIso,
              raw_end_date: endIso,
              raw_start_time: startTimeStr, 
              raw_end_time: endTimeStr,
              
              status: uiStatus as any,
              isJoined: isJoined,
              isExpanded: false,
              
              completed_count: count,
              isLocked: isLocked
          };

          if (shouldGoToHistory) history.push(item);
          else upcoming.push(item);
      });

      upcomingEvents = upcoming;
      historyEvents = history;
  }

  function formatTime(start: string, end: string, currentLang: string) {
    if (!start) return "";

    // ฟังก์ชันย่อย: จัดรูปแบบเวลา HH:MM
    const extractTime = (val: string) => {
        if (!val) return "";
        // กรณีเป็น ISO Date String (มี T) เช่น 2025-01-01T09:00:00
        if (val.includes('T')) {
            const d = new Date(val);
            // ใช้ UTC ตามต้นฉบับ Event List เพื่อความชัวร์
            return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' });
        }
        // กรณีเป็น Time String ล้วน เช่น 09:00:00
        const parts = val.split(':');
        if (parts.length >= 2) return `${parts[0]}:${parts[1]}`;
        return val;
    };

    const timeStart = extractTime(start);
    const timeEnd = extractTime(end);

    // ถ้าไม่มีเวลาเริ่ม (เช่น format ผิด) ไม่ต้องโชว์
    if (!timeStart || timeStart === "Invalid Date") return "";

    if (currentLang === 'th') {
      return timeEnd ? `${timeStart} - ${timeEnd} น.` : `${timeStart} น.`;
    } else {
      return timeEnd ? `${timeStart} - ${timeEnd}` : `${timeStart}`;
    }
  }

    function mapApiStatusToUi(apiStatus: string): EventItem['status'] {
      switch (apiStatus) {
          case 'start_new': return 'REGISTER'; // [เพิ่ม] กรณีไม่มี Record
          case 'joined': return 'REGISTER';
          case 'checked_in': return 'SENDING';
          case 'proof_submitted': return 'WAITING';
          case 'approved': return 'CHECKOUT';
          case 'rejected': return 'REJECTED';
          case 'completed': return 'COMPLETED';
          case 'cancelled': return 'CANCELED';
          default: return 'REGISTER';
      }
  }

  $: filteredUpcoming = upcomingEvents.filter(event => 
      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.description.toLowerCase().includes(searchQuery.toLowerCase())
  );
  $: filteredHistory = historyEvents.filter(event => 
      (event.title.toLowerCase().includes(searchQuery.toLowerCase())) &&
      event.status !== 'CANCELED'
  );

  async function CheckInEvent(eventId: number) {
      const token = getToken();
      if (!token) return null;
      try {
          // -----------------------------------------------------------
          // [แก้ไข] เปลี่ยนเป็น /api/participations/join ตาม Spec ใหม่
          // เพื่อทำการ Join และรับค่า join_code / completion_code กลับมา
          // -----------------------------------------------------------
          const res = await fetch(`${BASE_URL}/api/participations/join`, { 
              method: 'POST',
              headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ event_id: eventId }) 
          });

          // --- Error Handling ---
          if (!res.ok) {
              try {
                  const errJson = await res.json();
                  console.warn("⚠️ Backend Error Detail:", errJson);

                  // กรณี: เคย Join ไปแล้ว Backend อาจจะส่ง object เดิมกลับมาให้ (ที่มี id/code)
                  if (errJson.join_code || errJson.id) return errJson;

                  if (errJson.detail || errJson.message) {
                      throw new Error(errJson.detail || errJson.message);
                  }
              } catch(e) {
                  if (e instanceof Error && !e.message.includes("Join")) throw e;
              }
              
              console.error("Join event failed status:", res.status);
              throw new Error(`Server Refused (${res.status}): Cannot Join Event`);
          }
          // -----------------------

          return await res.json(); // คืนค่า EventParticipation (ที่มี codes)
      } catch (e: any) {
          console.error("Join event error:", e);
          Swal.fire({
              icon: 'error',
              title: 'Join Failed',
              text: e.message || "ไม่สามารถเข้าร่วมกิจกรรมได้",
          });
          return null;
      }
  }

  // --- TOKEN UTILS ---
  function getLocalToken() {
    if (typeof localStorage === 'undefined') return "";
    let token = localStorage.getItem("token") || localStorage.getItem("access_token") || "";
    if (!token) {
        const userStr = localStorage.getItem("user") || localStorage.getItem("user_info");
        if (userStr) { 
            try { 
                const userObj = JSON.parse(userStr);
                token = userObj.token || userObj.accessToken || userObj.access_token || "";
            } catch (e) {} 
        }
    }
    return token;
  }
  function getToken() { return getLocalToken(); } 
  function getUserIdFromToken() {
      const token = getLocalToken();
      if (!token) return null;
      try {
          const base64Url = token.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
              return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          }).join(''));
          const payload = JSON.parse(jsonPayload);
          return payload.id || payload.user_id || payload.sub || payload.userId;
      } catch (e) {
          console.error("Token parsing error", e);
          return null;
      }
  }

  function startSessionTimer() {
    if (timerInterval) clearInterval(timerInterval);
    const token = getToken();
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
              if (timerInterval) clearInterval(timerInterval);
              timeLeftStr = "00:00:00";
              timeLeftSeconds = 0;
              handleSessionExpired(); 
            } else {
              const totalSeconds = Math.floor(diff / 1000);
              timeLeftSeconds = totalSeconds;
              const h = Math.floor(totalSeconds / 3600);
              const m = Math.floor((totalSeconds % 3600) / 60);
              const s = totalSeconds % 60;
              timeLeftStr = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
            }
          }, 1000);
      }
    } catch (e) { console.error("Error parsing token expiration:", e); }
  }

  async function handleCheckInConfirm() {
      if (!selectedEvent) return;

      // --- CASE: CHECKOUT (จบงาน) ---
      if (selectedEvent.status === 'CHECKOUT') {
          Swal.fire({ title: 'Processing...', didOpen: () => Swal.showLoading() });
          try {
              const endStr = selectedEvent.raw_end_date || selectedEvent.raw_end_time;
              if (!endStr) return;
              
              const endDate = new Date(endStr);
              endDate.setHours(23, 59, 59, 999); 

              const today = new Date();
              const nextWorkingDay = getNextWorkingDay(today, selectedEvent.id);
              nextWorkingDay.setHours(0, 0, 0, 0);

              // ---------------------------------------------------------
              // [แก้ไขจุดที่ 2] Workflow: จบงาน -> Auto Register -> Lock
              // ---------------------------------------------------------
              if (nextWorkingDay <= endDate) {
                  
                  // 1. Auto Register ทันที (เพื่อ Reset PIN สำหรับวันพรุ่งนี้)
                  await CheckInEvent(selectedEvent.id);

                  // 2. แจ้งเตือน User
                  const nextDateStr = nextWorkingDay.toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-GB', { day: 'numeric', month: 'short' });
                  Swal.fire({
                      icon: 'success',
                      title: 'สำเร็จ!',
                      text: `บันทึกผลเรียบร้อย! เจอกันใหม่รอบถัดไปวันที่ (${nextDateStr}) ครับ ✌️`, 
                      timer: 3000,
                      showConfirmButton: false
                  });

                  // 3. ปิด Modal
                  closeModal();

                  // 4. Force Update UI ให้เป็นสถานะ "รอวันพรุ่งนี้" ทันที (ไม่ต้องรอ LoadData)
                  // เพื่อป้องกันไม่ให้ User กดซ้ำ หรือเห็นปุ่ม Register
                  const targetEvent = upcomingEvents.find(e => e.id === selectedEvent!.id);
                  if (targetEvent) {
                      targetEvent.status = 'REGISTER'; // เปลี่ยนสถานะเป็นเริ่มรอบใหม่
                      targetEvent.isLocked = true;     // แต่ Lock ไว้ (เพราะเพิ่งทำเสร็จวันนี้)
                      targetEvent.completed_count += 1; // เพิ่มจำนวนครั้งที่สำเร็จ
                      
                      // อัปเดต Array เพื่อให้ Svelte Render ใหม่
                      upcomingEvents = [...upcomingEvents];
                  }

                  // 5. โหลดข้อมูลจริงตามมาทีหลัง (Background Update)
                  loadData(); 

              } else {
                  // จบโครงการแล้ว (Last Day)
                  Swal.fire('ยินดีด้วย!', 'คุณพิชิตกิจกรรมนี้สำเร็จแล้ว! (สิ้นสุดโครงการ) 🎉', 'success');
                  closeModal();
                  loadData(); // ข้อมูลจะย้ายไป History เองใน processData
              }

          } catch (error) {
              console.error(error);
              Swal.fire('Error', 'เกิดข้อผิดพลาดในการบันทึก', 'error');
          }
          return;
      }

      // --- CASE: CHECKIN (เหมือนเดิม) ---
      await loadData();
      const updatedEvent = upcomingEvents.find(e => e.participation_id === currentParticipationId);
      if (!updatedEvent) return;

      if (updatedEvent.status === 'REGISTER') {
          Swal.fire({
              icon: 'warning',
              title: t[lang].alert_not_checked_in,
              text: t[lang].alert_contact_staff,
              confirmButtonText: t[lang].btn_ok
          });
      } else {
          Swal.fire({
              icon: 'success',
              title: t[lang].alert_checkin_success,
              text: t[lang].alert_go_next,
              timer: 1500,
              showConfirmButton: false
          });
          closeModal();
      }
  }

  function handleSessionExpired() {
    localStorage.removeItem("token");
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_info");
    Swal.fire({
      icon: 'error',
      title: 'Session Expired',
      text: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่',
      allowOutsideClick: false,
      confirmButtonText: 'OK'
    }).then(() => {
      goto("/auth/login");
    });
  }

  function handleLogout() { 
    isMobileMenuOpen = false; 
    localStorage.clear();
    goto("/auth/login", { replaceState: true });
  }

  // --- HELPER FUNCTIONS ---
  function getDraftKey(participationId: number) { return `proof_draft_${participationId}`; }
  function saveDraft(step: number) {
      if (!selectedEvent) return;
      const data = { step: step, link: sendingLink, dist: distanceInput };
      localStorage.setItem(getDraftKey(selectedEvent.participation_id), JSON.stringify(data));
  }
  function clearDraft(participationId: number) { localStorage.removeItem(getDraftKey(participationId)); }
  function selectView(id: string, path: string) { currentView = id; isMobileMenuOpen = false; goto(path); }
  
  function toggleDetails(listType: 'upcoming' | 'history', index: number) {
    if (listType === 'upcoming') {
        const item = filteredUpcoming[index];
        item.isExpanded = !item.isExpanded;
        upcomingEvents = [...upcomingEvents]; 
    } else {
        const item = filteredHistory[index];
        item.isExpanded = !item.isExpanded;
        historyEvents = [...historyEvents];
    }
  }

  function scrollToHistory() { document.getElementById('history-section')?.scrollIntoView({ behavior: 'smooth' }); }
  function scrollToUpcoming() { document.getElementById('upcoming-section')?.scrollIntoView({ behavior: 'smooth' }); }
  
  function getStepFromStatus(status: string) {
    switch (status) {
        case 'REGISTER': return 1;
        case 'SENDING': return 2;
        case 'PROOF': case 'REJECTED': return 3;
        case 'CHECKOUT': return 4;
        default: return 0;
    }
  }

  function getDisplayDate(start?: string, end?: string, l: string = 'th') {
      if (!start) return "-";
      const locale = l === 'th' ? 'th-TH' : 'en-GB';
      const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
      
      // Helper: แปลง String YYYY-MM-DD เป็น Date แบบ Local 00:00:00 เสมอ
      const parseLocal = (s: string) => {
          if (!s) return null;
          const part = s.split('T')[0]; // ตัดเวลาทิ้งเอาแต่วันที่
          const [y, m, d] = part.split('-').map(Number);
          return new Date(y, m - 1, d);
      };

      const sDate = parseLocal(start);
      if (!sDate) return "-";
      const sText = sDate.toLocaleDateString(locale, opts);
      
      if (end) {
          const eDate = parseLocal(end);
          // ถ้ามีวันจบ และไม่ใช่วันเดียวกับวันเริ่ม ให้แสดงช่วง
          if (eDate && sDate.getTime() !== eDate.getTime()) {
              const eText = eDate.toLocaleDateString(locale, opts);
              return `${sText} - ${eText}`; 
          }
      }
      return sText;
  }

  function checkIsHoliday(date: Date, eventId: number): boolean {
      const config = holidaysMap[eventId];
      if (!config) return false; // ถ้าไม่มี config ใน JSON ถือว่าไม่มีวันหยุด

      // A. เช็ควันเสาร์-อาทิตย์ (ถ้า JSON สั่ง excludeWeekends: true)
      if (config.excludeWeekends) {
          const day = date.getDay();
          if (day === 0 || day === 6) return true; // 0=อาทิตย์, 6=เสาร์
      }

      // B. เช็ควันหยุดเจาะจง (Specific Dates) จาก JSON
      // ต้องแปลง Date เป็น string "YYYY-MM-DD" เพื่อเทียบกับข้อมูลใน JSON
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;

      if (config.holidays && config.holidays.includes(dateStr)) {
          return true;
      }

      return false;
  }

  // 2. หาวันทำการถัดไป (Next Working Day) โดยกระโดดข้ามวันหยุด
  function getNextWorkingDay(startDate: Date, eventId: number): Date {
      let nextDate = new Date(startDate);
      
      // วนลูปบวกไปทีละ 1 วัน แล้วเช็คว่า "หยุดไหม?"
      // ถ้าหยุด -> บวกต่อ, ถ้าไม่หยุด -> จบลูป (ได้วันทำการ)
      do {
          nextDate.setDate(nextDate.getDate() + 1);
      } while (checkIsHoliday(nextDate, eventId));
      
      return nextDate;
  }

  // --- MODAL & API ACTIONS ---
  async function openActionModal(event: EventItem) {
    
    // CASE 1: สถานะ REGISTER (จะเริ่มวัน หรือ รอ Check-in)
    if (event.status === 'REGISTER') {
        
        // --- [แก้ไข] เพิ่มการเช็ค event.isJoined ---
        // ถ้ายังไม่เคย Join วันนี้ -> ให้ยิง API เพื่อขอ Join Code
        if (!event.isJoined) {
            Swal.fire({
                title: t[lang].alert_checking || 'Generating Code...',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            // เรียก API เพื่อ Join และรับ PIN
            const pData = await CheckInEvent(event.id);
            Swal.close();

            if (pData) {
                event.participation_id = pData.id;
                event.join_code = pData.join_code; 
                event.isJoined = true; // Mark ว่า Join แล้ว
                
                // อัปเดตสถานะ UI (ถ้า Backend ส่ง status มา)
                if (pData.status) event.status = mapApiStatusToUi(pData.status);
            } else {
                // ถ้ายิง API ไม่ผ่าน ไม่ต้องเปิด Modal
                return; 
            }
        } 
        // else { 
        //    ถ้า isJoined เป็น true อยู่แล้ว (คือสมัครแล้วแต่ยังไม่ Checkin)
        //    ไม่ต้องทำอะไร ข้ามไปเปิด Modal เพื่อโชว์ PIN เดิมที่มีอยู่ได้เลย
        // }
    }
    // CASE 2: สถานะ CHECKOUT (จบวัน) -> ไม่ต้องยิง Join ใหม่ ใช้ Code ที่มีอยู่เลย
    else if (event.status === 'CHECKOUT') {
        // เช็คว่ามี code ไหม (ปกติควรมีมาจาก Backend ตอน Approve)
        if (!event.completion_code) {
             // Fallback: ถ้าไม่มีอาจจะลองยิง API Load Data ใหม่เงียบๆ หรือ Alert เตือน
             console.warn("No completion code found");
        }
    }

    selectedEvent = event;
    currentParticipationId = event.participation_id;
    checkInMethod = 'PIN'; 
    proofImage = null; 
    
    // Logic เดิมของ Draft/Image
    if (event.status === 'REJECTED') {
        selectedEvent.status = 'SENDING';
    } else if (event.proof_image_url) { 
        proofImage = event.proof_image_url;
    }
    
    const draftJson = localStorage.getItem(getDraftKey(event.participation_id));
    if (draftJson && (event.status === 'SENDING' || event.status === 'PROOF')) {
        try {
            const draft = JSON.parse(draftJson);
            sendingLink = draft.link || "";
            distanceInput = draft.dist || 0;
            if (draft.step === 3 || draft.step === 2) selectedEvent.status = 'PROOF';
        } catch (e) { }
    }

    showModal = true;
  }

  function closeModal() {
    showModal = false;
    setTimeout(() => { selectedEvent = null; }, 300);
  }

  function handleImageUpload(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files[0]) {
        proofFile = target.files[0];
        const reader = new FileReader();
        reader.onload = (e) => { proofImage = e.target?.result as string; };
        reader.readAsDataURL(target.files[0]);
    }
  }

  async function checkStravaLink() {
      // เช็คว่ากรอกลิงก์ไหม
      if (!sendingLink || sendingLink.trim() === "") {
        Swal.fire(t[lang].alert_warning, t[lang].alert_link_required, "warning");
        return;
      }
      
      // เช็ค Format ลิงก์
      const isStrava = /strava\.app\.link|strava\.com/.test(sendingLink);
      if (!isStrava) {
          Swal.fire(t[lang].alert_error, t[lang].alert_link_invalid, "error");
          return;
      }

      // ขึ้น Loading เป็นภาษาตามที่เลือก
      Swal.fire({
          title: t[lang].alert_checking,
          text: t[lang].alert_fetching_strava,
          allowOutsideClick: false,
          didOpen: () => Swal.showLoading()
      });

      try {
          const res = await fetch('/service/strava-check', { 
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: sendingLink })
          });
          const result = await res.json();
          Swal.close();

          if (res.ok && result.success) {
              distanceInput = result.data.distance_km;
              Swal.fire({
                  icon: 'success',
                  title: 'OK',
                  text: `Distance: ${distanceInput} km`,
                  timer: 1500, showConfirmButton: false
              });
          } else {
              // กรณีไม่เจอข้อมูล ให้แสดง Message จาก Backend หรือ Default Text
              Swal.fire(t[lang].alert_not_found, result.message || t[lang].alert_not_found, "warning");
          }
      } catch (error) {
          console.error(error);
          Swal.close();
          Swal.fire(t[lang].alert_error, t[lang].alert_connection_error, "error");
      }
  }

  function goToStep3_Proof() {
      // เช็คว่ากรอกลิงก์หรือยัง
      if (!sendingLink || sendingLink.trim() === "") {
          Swal.fire(t[lang].alert_warning, t[lang].alert_link_required, "warning");
          return;
      }
      // เช็คว่ากด Verify หรือยัง
      if (distanceInput <= 0) { 
          Swal.fire(t[lang].alert_warning, t[lang].alert_verify_first, "warning");
          return;
      }

      if (selectedEvent) {
          // --- [FIX Logic: REJECTED Workflow] ---
          // ก่อนจะไป Step 2 เช็คก่อนว่า เคสนี้เคยมีประวัติถูก REJECTED ไหม (ดูจาก rejection_reason)
          // ถ้ามี -> ให้ตั้งสถานะเป็น 'REJECTED' เพื่อให้หน้าถัดไปแสดง "กรอบแดงแจ้งเตือน"
          // ถ้าไม่มี -> ให้ตั้งเป็น 'PROOF' ตามปกติ
          if (selectedEvent.rejection_reason) {
              selectedEvent.status = 'REJECTED';
          } else {
              selectedEvent.status = 'PROOF';
          }
          
          upcomingEvents = [...upcomingEvents]; 
          saveDraft(3);
      }
  }

  async function submitProofAction() {
      if (!selectedEvent) return;
      const token = getToken();
      
      // เช็ค Token หมดอายุ
      if (!token) { 
          Swal.fire(t[lang].alert_error, t[lang].alert_session_expired, "error"); 
          return;
      }

      // เช็คว่ามีรูปไหม (ทั้งไฟล์ใหม่ หรือรูปเดิมกรณีแก้ลิงก์)
      if (!proofFile && !selectedEvent.proof_image_url) {
          Swal.fire(t[lang].alert_warning, t[lang].alert_image_required, "warning");
          return;
      }

      try {
          Swal.showLoading();
          let finalImageUrl = selectedEvent.proof_image_url || "";

          // ถ้ามีการเลือกไฟล์ใหม่ ให้อัปโหลดก่อน
          if (proofFile) {
              const formData = new FormData();
              formData.append('file', proofFile);
              formData.append('subfolder', 'proofs'); // Folder ปลายทาง
              
              const upRes = await fetch(`${BASE_URL}/api/images/upload`, {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${token}` },
                  body: formData
              });
              
              if (!upRes.ok) throw new Error(`${t[lang].alert_upload_failed} (${upRes.status})`);
              const upData = await upRes.json();
              finalImageUrl = upData.url;
          }

          // เตรียม Payload ส่งเข้า API
          const payload = {
              proof_image_url: finalImageUrl,
              strava_link: sendingLink,
              actual_distance_km: Number(distanceInput)
          };

          // เช็คว่าเป็นเคส "ส่งงานใหม่" หรือ "ส่งงานแก้ (Resubmit)"
          const isResubmit = rawParticipations.find(p => p.id === selectedEvent?.participation_id)?.status === 'rejected';
          
          const endpoint = isResubmit
            ? `${BASE_URL}/api/participations/${selectedEvent.participation_id}/resubmit-proof`
            : `${BASE_URL}/api/participations/${selectedEvent.participation_id}/submit-proof`;
          
          const method = isResubmit ? 'PUT' : 'POST';

          const res = await fetch(endpoint, {
              method: method,
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify(payload)
          });

          if(res.ok) {
              Swal.fire(t[lang].alert_success_title, t[lang].alert_submit_success, "success");
              if (currentParticipationId) clearDraft(currentParticipationId);
              closeModal();
              loadData(); // โหลดข้อมูลใหม่ทันที
          } else {
              // กรณีส่งไม่ผ่าน อ่าน error จาก backend
              const errData = await res.json();
              throw new Error(errData.message || "Submit Failed");
          }
      } catch (err: any) {
          console.error(err);
          Swal.fire(t[lang].alert_error, err.message, "error");
      }
  }

  function handleBackToStrava() {
      if (selectedEvent) {
          selectedEvent.status = 'SENDING';
          saveDraft(2);
      }
  }

  onMount(async () => {
    const savedLang = localStorage.getItem('app_lang');
    if (savedLang === 'th' || savedLang === 'en') {
        lang = savedLang;
    }
    startSessionTimer();
    loadData(); 
  });

  onDestroy(() => { if (timerInterval) clearInterval(timerInterval); });

</script>

<div class="app-container">
  <header class="header-bar">
    <div class="header-inner">
      <div class="left-group">
        <div class="brand"><span class="brand-name">STUDENT</span></div>
        <nav class="nav-menu desktop-only">
          {#each menuItems as item}
            <button class="menu-btn" class:active={currentView === item.id} on:click={() => selectView(item.id, item.path)}>
              <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d={item.svg}></path></svg>
              <span class="btn-label">{item.label}</span>
            </button>
          {/each}
        </nav>
      </div>

      <div class="search-bar-container desktop-only">
        <div class="search-input-wrapper">
            <svg class="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
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
        <button class="mobile-toggle mobile-only" on:click={() => (isMobileMenuOpen = !isMobileMenuOpen)}><svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 9h16M4 15h16"></path></svg></button>
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

        <div id="upcoming-section" class="section-header-wrapper header-row">
          <div class="header-left">
              <h1 class="section-title">{t[lang].upcoming_header}</h1>
              <div class="title-underline"></div>
          </div>
          <button class="jump-btn" on:click={scrollToHistory}>
             {t[lang].history_header} 
             <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
          </button>
        </div>

        {#if loading}
           <div style="text-align: center; color: #94a3b8; padding: 40px;">Loading...</div>
        {:else if filteredUpcoming.length === 0}
            <div style="text-align: center; color: #94a3b8; padding: 40px; border: 1px dashed rgba(255,255,255,0.1); border-radius: 12px;">No Active Events</div>
        {:else}
            <div class="events-grid">
            {#each filteredUpcoming as event, i}
                <div class="event-card" class:locked-card={event.isLocked}>
                <div class="card-image" style="background-image: url('{event.banner_image_url}');">
                    {#if event.isLocked}
                        <div class="lock-overlay">
                            <svg width="40" height="40" fill="none" stroke="white" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                        </div>
                    {/if}
                </div>
                <div class="card-content">
                    <div class="card-header-row">
                    <h3 class="card-title">{event.title}</h3>
                    <div class="badges-col">
                        {#if event.status === 'WAITING'}
                            <span class="status-badge running">{t[lang].status_waiting}</span>
                        {:else if event.status === 'REJECTED'}
                            <span class="status-badge resubmit-badge">{t[lang].status_rejected}</span>
                        {:else if event.status === 'PROOF' || event.status === 'SENDING'}
                            <span class="status-badge proof-badge">{t[lang].status_sending}</span>
                        {:else if event.status === 'COMPLETED'}
                            <span class="status-badge completed-btn" style="font-size:0.7rem;">{t[lang].status_completed_badge}</span>
                        {:else if event.status === 'REGISTER'}
                            <span class="status-badge running">{t[lang].status_register}</span>
                        {:else}
                            <span class="status-badge running">{event.status}</span>
                        {/if}

                        <div class="count-badge">
                            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin-right:4px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                            {event.participant_count}/{event.max_participants}
                        </div>
                        <div class="count-badge" style="margin-top: 4px; background-color: #10b981;">
                            🏃 {event.completed_count} {lang === 'th' ? 'ครั้ง' : 'times'}
                        </div>
                    </div>
                    </div>

                    <p class="card-desc" class:expanded={event.isExpanded}>
                        {event.description}
                    </p>

                        {#if event.isExpanded}
                        <div class="info-grid" transition:slide|local={{ duration: 300 }}>
                            <div class="info-pill">
                                <svg class="pill-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                <span>{event.location}</span>
                            </div>
                            
                            <div class="info-pill">
                                <svg class="pill-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                <span>{getDisplayDate(event.raw_start_date, event.raw_end_date, lang)}</span>
                            </div>

                            <div class="info-pill">
                                <svg class="pill-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                <span>{formatTime(event.raw_start_time || "", event.raw_end_time || "", lang)}</span>
                            </div>

                            <div class="info-pill highlight-pill">
                                <svg class="pill-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                                <span>{event.distance_km} KM</span>
                            </div>

                            {#if holidaysMap[event.id]}
                                {@const hConfig = holidaysMap[event.id]}
                                
                                {#if hConfig.excludeWeekends || (hConfig.holidays && hConfig.holidays.length > 0)}
                                    <div class="holiday-info-box">
                                        <div class="holiday-title">📅 วันหยุดกิจกรรม (Free Days):</div>
                                        <ul class="holiday-list">
                                            {#if hConfig.excludeWeekends}
                                                <li>ทุกวันเสาร์ - อาทิตย์</li>
                                            {/if}
                                            
                                            {#if hConfig.holidays}
                                                {#each hConfig.holidays as hDate}
                                                    <li>{getDisplayDate(hDate, undefined, lang)}</li>
                                                {/each}
                                            {/if}
                                        </ul>
                                    </div>
                                {/if}
                            {/if}
                        </div>
                    {/if}

                        <div class="card-footer-actions">
                            <button class="read-more-btn" on:click={() => toggleDetails('upcoming', i)}>
                                {event.isExpanded ? t[lang].read_less : t[lang].read_more}
                            </button>
                            
                            {#if event.isLocked}
                                <button class="status-btn" style="background: #334155; cursor: not-allowed; gap: 6px;" disabled>
                                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></svg>
                                    {#if event.status === 'REGISTER' && event.isJoined}
                                        {t[lang].btn_daily_wait || "รอเวลาเริ่มวันถัดไป"}
                                    {:else if event.status === 'REGISTER' && event.completed_count > 0}
                                        {t[lang].status_daily_completed || "เจอกันพรุ่งนี้"}
                                    {:else}
                                        {t[lang].btn_locked} {/if}
                                </button>

                            <!-- {#if event.isLocked}
                                <button class="status-btn" style="background: #334155; cursor: not-allowed; display: flex; align-items: center; gap: 6px;" disabled>
                                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></svg>
                                    
                                    {#if event.status === 'REGISTER' && event.completed_count > 0}
                                        {t[lang].status_daily_completed || "เจอกันพรุ่งนี้"}
                                    {:else}
                                        {t[lang].btn_locked}
                                    {/if}
                                </button> -->

                            {:else if event.status === 'COMPLETED'}
                                <button class="status-btn" style="background: #64748b; cursor: default; opacity: 0.9; width: auto; font-size: 0.9rem; display: flex; align-items: center; gap: 6px;">
                                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                    {t[lang].btn_daily_wait}
                                </button>

                            {:else if event.status === 'WAITING'}
                                <button class="status-btn waiting-btn" style="cursor: default;">
                                    {t[lang].btn_waiting}
                                </button>

                            {:else if event.status === 'SENDING'}
                                <button class="status-btn sending-btn" on:click={() => openActionModal(event)}>
                                    {t[lang].btn_send_proof}
                                </button>

                            {:else if event.status === 'PROOF' || event.status === 'REJECTED'}
                                <button class="status-btn proof-btn" on:click={() => openActionModal(event)}>
                                    {t[lang].btn_send_image}
                                </button>

                            {:else if event.status === 'CHECKOUT'}
                                <button class="status-btn checkout-btn" on:click={() => openActionModal(event)}>{t[lang].btn_checkout}</button>
                                    
                            {:else} 
                                <button class="status-btn register-btn" on:click={() => openActionModal(event)}>
                                    {t[lang].btn_checkin}
                                </button>
                            {/if}
                        </div>
                    </div>
                </div>
            {/each}
            </div>
        {/if}

        <div id="history-section" class="section-header-wrapper header-row" style="margin-top: 60px;">
          <div class="header-left">
              <h1 class="section-title">{t[lang].history_header}</h1>
              <div class="title-underline"></div>
          </div>
          <button class="jump-btn" on:click={scrollToUpcoming}>
             {t[lang].upcoming_header}
             <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="transform: rotate(180deg);"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
          </button>
        </div>

        <div class="events-grid">
          {#each filteredHistory as event, i}
            <div class="event-card">
              <div class="card-image" style="background-image: url('{event.banner_image_url}');"></div>
              <div class="card-content">
                <div class="card-header-row">
                  <h3 class="card-title">{event.title}</h3>
                  <div class="badges-col">
                    {#if event.isJoined}
                        <span class="status-badge ended-normal">{t[lang].status_ended}</span> 
                    {:else}
                        <span class="status-badge ended-canceled">CANCELED</span>
                    {/if}
                  </div>
                </div>
                 <p class="card-desc" class:expanded={event.isExpanded}>{event.description}</p>
                 {#if event.isExpanded}
                    <div class="info-grid" transition:slide|local>
                        <div class="info-pill">
                            <span>{event.location}</span>
                        </div>
                        <div class="info-pill">
                            <span>{getDisplayDate(event.raw_start_date, event.raw_end_date, lang)}</span>
                        </div>
                        <div class="info-pill">
                            <span>Dist: {event.actual_distance_km} km</span>
                        </div>
                    </div>
                 {/if}

                 <div class="card-footer-actions">
                   <button class="read-more-btn" on:click={() => toggleDetails('history', i)}>
                       {event.isExpanded ? t[lang].read_less : t[lang].read_more}
                   </button>
                    {#if event.isJoined}
                     <button class="status-btn completed-btn" style="cursor: default; box-shadow: none;">COMPLETED</button>
                   {:else}
                     <button class="status-btn canceled-btn" style="cursor: default; box-shadow: none;">CANCELED</button>
                   {/if}
                 </div>
              </div>
            </div>
          {/each}
        </div>

        <footer class="app-footer">
        <div class="footer-separator"></div>
        <div class="footer-content">
          <p class="copyright">&copy; 2025 Cyber Geek. All rights reserved.</p>
          <p class="credits">Designed & Developed by <span class="highlight">Cyber Geek Development</span></p>
          <p class="contact">Contact: <a href="mailto:cybergeek.dev@proton.me">cybergeek.dev@proton.me</a></p>
        </div>
      </footer>
    </div>
  </div>

  {#if showModal && selectedEvent}
    <div class="modal-overlay" transition:fade={{ duration: 200 }}>
        <div class="modal-box" transition:scale={{ duration: 250, start: 0.9 }}>
            <button class="modal-close" on:click={closeModal}>&times;</button>

            {#if selectedEvent.status === 'WAITING'}
                <div class="waiting-view">
                    <div class="hourglass-icon">⏳</div>
                    <h2>{t[lang].modal_verifying_title}</h2>
                    <p style="font-size: 1.1rem; line-height: 1.6;">{t[lang].modal_verifying_desc}</p>
                </div>
            {:else}
                {@const currentStep = getStepFromStatus(selectedEvent.status)}
                <div class="stepper">
                    {#each [1, 2, 3, 4] as step}
                        <div class="step-wrapper">
                            <div class="step-circle" class:active={step === currentStep} class:completed={step < currentStep}>
                                {step < currentStep ? '✓' : step}
                            </div>
                            {#if step < 4}
                                <div class="step-line" class:line-active={step < currentStep}></div>
                            {/if}
                        </div>
                    {/each}
                </div>

                <div class="modal-body">
                    {#if selectedEvent.status === 'REGISTER' || selectedEvent.status === 'CHECKOUT'}
                        {@const currentCode = selectedEvent.status === 'CHECKOUT' ? selectedEvent.completion_code : selectedEvent.join_code}
                        <h3 class="modal-title">
                            {selectedEvent.status === 'CHECKOUT' ? 'Check Out (จบกิจกรรม)' : 'Check In Event'}
                        </h3>
                    <div class="toggle-switch">
                        <button class="toggle-btn" class:active={checkInMethod === 'PIN'} on:click={() => checkInMethod = 'PIN'}>PIN CODE</button>
                        <button class="toggle-btn" class:active={checkInMethod === 'QR'} on:click={() => checkInMethod = 'QR'}>QR SCAN</button>
                    </div>
                    <div class="checkin-display">
                    {#if checkInMethod === 'PIN'}
                        <div class="pin-box">
                            {#if currentCode}
                                {#each currentCode.split('') as char}<span>{char}</span>{/each}
                            {:else}
                                <span>-</span><span>-</span><span>-</span><span>-</span>
                            {/if}
                        </div>
                        {#if selectedEvent.status === 'CHECKOUT' && !currentCode}
                            <small style="color:#ef4444; margin-top:10px;">รอเจ้าหน้าที่อนุมัติเพื่อรับรหัส</small>
                        {/if}
                    {:else}
                        <div class="qr-box">
                            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${currentCode || 'WAITING'}`} alt="QR" />
                        </div>
                    {/if}
                </div>
                    <button class="action-submit-btn" on:click={handleCheckInConfirm}>
                        {selectedEvent.status === 'CHECKOUT' ? 'เสร็จสิ้น (Done)' : t[lang].btn_confirm_checkin}
                    </button>

                {:else if selectedEvent.status === 'SENDING'}
                    <h3 class="modal-title">{t[lang].modal_step1}</h3>
                    <p class="modal-subtitle">{t[lang].modal_step1_sub}</p>
                    
                    <div class="input-group">
                        <label for="link">{t[lang].modal_link_label}</label>
                        <div style="display: flex; gap: 8px;">
                            <input type="text" id="link" bind:value={sendingLink} placeholder="https://strava.app.link/..." style="flex: 1;" />
                            <button type="button" class="status-btn" style="background: #3b82f6; padding: 0 15px; font-size: 0.9rem; white-space: nowrap;" on:click={checkStravaLink}>
                                {t[lang].btn_verify_link}
                            </button>
                        </div>
                    </div>
                    
                    <div class="input-group">
                        <label for="dist">{t[lang].modal_dist_label}</label>
                        <input type="number" id="dist" bind:value={distanceInput} placeholder="0.00" step="0.01" readonly style="background-color: #1e293b; color: #94a3b8; cursor: not-allowed; border-color: rgba(255,255,255,0.05);" />
                        <small style="color:#ef4444; display:block; margin-top:5px; font-size:0.8rem;">{t[lang].modal_dist_warn}</small>
                    </div>
                    
                    <button class="action-submit-btn blue-theme" on:click={goToStep3_Proof}>
                        {t[lang].btn_next}
                    </button>

                {:else if selectedEvent.status === 'PROOF' || selectedEvent.status === 'REJECTED'}
                    <h3 class="modal-title">{t[lang].modal_step2}</h3>
                    {#if selectedEvent.status === 'REJECTED'}
                        <div class="rejected-alert">{t[lang].modal_rejected} {selectedEvent.rejection_reason}</div>
                    {/if}
                    <p class="modal-subtitle">{t[lang].modal_step2_sub}</p>

                    <div class="upload-area">
                        {#if !proofImage}
                            <label class="upload-label">
                                <input type="file" accept="image/*" on:change={handleImageUpload} hidden />
                                <div class="upload-placeholder">
                                    <span style="font-size: 1.1rem;">{t[lang].modal_upload_txt}</span>
                                </div>
                            </label>
                        {:else}
                            <div class="image-preview">
                                <img src={proofImage} alt="Preview" />
                                <button class="remove-img-btn" on:click={() => { proofImage = null; proofFile = null; }}>&times;</button>
                            </div>
                        {/if}
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 20px;">
                        <button class="action-submit-btn purple-theme" style="width: 100%; padding: 14px; font-size: 1.1rem;" on:click={submitProofAction}>
                            {selectedEvent.status === 'REJECTED' ? t[lang].btn_resubmit : t[lang].btn_submit}
                        </button>
                        <button class="action-submit-btn" style="background: transparent; border: 2px solid #475569; color: #cbd5e1; width: 100%; display: flex; align-items: center; justify-content: center;" on:click={handleBackToStrava}> <span>{t[lang].btn_back_strava}</span></button>
                    </div>
                {/if}
            </div>
            {/if}
        </div>
    </div>
  {/if}
</div>

<style>
  @import url("https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap");
  :root { --bg-body: #0f172a; --bg-nav: #1e293b; --bg-card: #1e293b; --primary: #10b981; --text-main: #f8fafc; --text-muted: #94a3b8; --nav-height: 72px; }
  :global(.swal2-container) { z-index: 10000 !important; }
  :global(.swal2-toast) { z-index: 10001 !important; }
  :global(body) { margin: 0; padding: 0; background-color: var(--bg-body); font-family: "Inter", sans-serif; overflow-y: auto; }
  
  .app-container { min-height: 100vh; background-color: var(--bg-body); color: var(--text-main); display: flex; flex-direction: column; }
  .scroll-container { margin-top: calc(var(--nav-height) + 40px); padding-bottom: 20px; flex: 1; }
  .content-wrapper { max-width: 1400px; margin: 0 auto; padding: 0 24px; }

  /* HEADER & NAVBAR */
  .header-bar { width: 100%; height: var(--nav-height); background-color: var(--bg-nav); position: fixed; top: 0; left: 0; z-index: 1000; border-bottom: 1px solid rgba(255, 255, 255, 0.05); box-shadow: 0 4px 20px rgba(0,0,0,0.2); }
  .header-inner { width: 100%; height: 100%; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; box-sizing: border-box; }
  .left-group { display: flex; align-items: center; gap: 40px; flex: 1; overflow: hidden; }
  .brand-name { font-size: 2rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; background: linear-gradient(135deg, #6ee7b7 0%, #10b981 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; cursor: default; white-space: nowrap; margin-right: 10px; text-shadow: 0 0 10px rgba(16, 185, 129, 0.4), 0 0 20px rgba(16, 185, 129, 0.2); }
  
  .nav-menu { display: flex; gap: 8px; white-space: nowrap; }
  .menu-btn { background: transparent; border: none; padding: 10px 14px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-family: 'Inter', sans-serif; font-size: 0.9rem; font-weight: 600; color: var(--text-muted); transition: all 0.2s ease; }
  .nav-icon { width: 18px; height: 18px; opacity: 0.7; transition: 0.2s; }
  .menu-btn:hover { color: var(--text-main); background-color: rgba(255, 255, 255, 0.03); } .menu-btn:hover .nav-icon { opacity: 1; }
  .menu-btn.active { background-color: #0f172a; color: #10b981; box-shadow: 0 0 0 1px rgba(16, 185, 129, 0.1); } .menu-btn.active .nav-icon { opacity: 1; stroke: #10b981; }
  
  .user-zone { display: flex; align-items: center; gap: 12px; margin-left: auto; flex-shrink: 0; }
  .timer-pill { background-color: #0f172a; color: #10b981; font-weight: 700; font-size: 0.95rem; padding: 8px 14px; border-radius: 6px; border: 1px solid rgba(16, 185, 129, 0.2); letter-spacing: 1px; white-space: nowrap; }
  .logout-btn { background: transparent; border: none; color: var(--text-muted); cursor: pointer; padding: 8px; transition: 0.2s; display: flex; align-items: center; }
  .logout-btn:hover { color: #ef4444; transform: translateX(2px); }

  .search-bar-container { flex: 1; display: flex; justify-content: center; max-width: 250px; margin: 0 20px; }
  .search-input-wrapper { position: relative; width: 100%; display: flex; align-items: center; }
  .search-input { width: 100%; background: #0f172a; border: 1px solid rgba(255,255,255,0.1); color: var(--text-main); padding: 8px 16px 8px 36px; border-radius: 8px; font-size: 0.85rem; outline: none; transition: all 0.2s; }
  .search-input:focus { border-color: var(--primary); box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2); }
  .search-icon { position: absolute; left: 10px; width: 16px; height: 16px; color: var(--text-muted); }

  .mobile-toggle { display: none; background: transparent; border: none; color: white; padding: 6px; border-radius: 6px; cursor: pointer; }
  @media (min-width: 1025px) { .left-group { gap: 15px; } }
  @media (max-width: 1024px) { 
    .desktop-only { display: none !important; } 
    .mobile-toggle { display: block !important; } 
    .header-inner { padding: 0 12px; } 
    .left-group { gap: 10px; } 
    .brand-name { font-size: 1.5rem; } 
    .search-bar-container { display: none; } 
  }
  
  .mobile-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.7); z-index: 2000; backdrop-filter: blur(2px); }
  .mobile-drawer { position: fixed; top: 0; right: 0; bottom: 0; width: 70vw; max-width: 280px; background: var(--bg-nav); z-index: 2001; padding: 20px; display: flex; flex-direction: column; box-shadow: -5px 0 20px rgba(0, 0, 0, 0.5); }
  .drawer-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); }
  .close-btn { background: none; border: none; color: white; font-size: 1.5rem; cursor: pointer; }
  .drawer-search { margin-bottom: 15px; }
  .drawer-search-input { width: 100%; background: #0f172a; border: 1px solid rgba(255,255,255,0.1); color: var(--text-main); padding: 10px; border-radius: 8px; font-size: 0.9rem; outline: none; box-sizing: border-box; }
  .drawer-content { flex: 1; display: flex; flex-direction: column; gap: 10px; }
  .drawer-item { background: transparent; border: none; color: var(--text-muted); text-align: left; padding: 12px 16px; font-size: 1rem; font-weight: 600; display: flex; align-items: center; gap: 12px; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; }
  .drawer-item.active { background-color: #0f172a; color: #10b981; border: 1px solid rgba(255, 255, 255, 0.05); } 
  .drawer-item.active .nav-icon { opacity: 1; stroke: #10b981; }
  .logout-special { color: #ef4444; margin-top: auto; border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 20px; }

  /* LANG SWITCHER STYLES */
  .lang-switch { margin-left: 16px; display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.05); padding: 4px 10px; border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.1); margin-right: 12px; }
  .lang-switch button { background: none; border: none; color: #64748b; font-size: 0.8rem; font-weight: 700; cursor: pointer; padding: 4px; transition: 0.2s; }
  .lang-switch button.active { color: #10b981; text-shadow: 0 0 10px rgba(16, 185, 129, 0.3); }
  .lang-switch .sep { color: #334155; font-size: 0.8rem; margin: 0 4px; }

  .drawer-lang-item { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; margin-top: 10px; border-top: 1px solid rgba(255, 255, 255, 0.05); padding-top: 20px; }
  .lang-label-group { display: flex; align-items: center; color: #94a3b8; font-weight: 600; font-size: 1rem; gap: 12px; }
  .lang-toggle-pill { display: flex; background: #0f172a; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 20px; padding: 2px; }
  .lang-toggle-pill button { background: transparent; border: none; color: #64748b; padding: 6px 14px; font-size: 0.85rem; font-weight: 700; border-radius: 18px; cursor: pointer; transition: 0.2s; }
  .lang-toggle-pill button.active { background: #10b981; color: white; }

  /* SECTION HEADERS */
  .section-header-wrapper { margin-bottom: 24px; }
  .header-row { display: flex; justify-content: space-between; align-items: flex-end; }
  .section-title { font-size: 2.2rem; font-weight: 800; color: white; margin: 0 0 10px 0; letter-spacing: 0.5px; }
  .title-underline { width: 60px; height: 5px; background-color: #10b981; border-radius: 4px; }

  .jump-btn { background: transparent; border: 1px solid var(--text-muted); color: var(--text-muted); padding: 6px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: 0.2s; }
  .jump-btn:hover { border-color: var(--primary); color: var(--primary); background: rgba(16, 185, 129, 0.1); }

  /* GRID & CARDS */
  .events-grid { display: grid; gap: 24px; grid-template-columns: 1fr; align-items: start; }
  @media (min-width: 768px) { .events-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (min-width: 1024px) { .events-grid { grid-template-columns: repeat(3, 1fr); } }
  @media (min-width: 1280px) { .events-grid { grid-template-columns: repeat(4, 1fr); } }

  .event-card { background-color: #1e293b; border-radius: 16px; overflow: hidden; display: flex; flex-direction: column; border: 1px solid rgba(255, 255, 255, 0.05); box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3); transition: transform 0.2s ease; }
  .event-card:hover { transform: translateY(-4px); }
  .card-image { height: 180px; background-size: cover; background-position: center; width: 100%; position: relative; }
  .card-content { padding: 20px; flex: 1; display: flex; flex-direction: column; }
  .card-header-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; gap: 10px; }
  .card-title { font-size: 1.25rem; font-weight: 700; color: white; margin: 0; line-height: 1.4; flex: 1; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: 2.8em; }
  .badges-col { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; }
  
  .status-badge { font-size: 0.7rem; font-weight: 700; padding: 2px 10px; border-radius: 12px; letter-spacing: 0.5px; text-transform: uppercase; }
  .status-badge.running { color: #f59e0b; border: 1px solid #f59e0b; }
  .status-badge.ended-normal { color: #94a3b8; border: 1px solid #94a3b8; }
  .status-badge.ended-canceled { color: #9f1239; border: 1px solid #881337; background-color: rgba(136, 19, 55, 0.1); } 
  .status-badge.resubmit-badge { color: #ef4444; border: 1px solid #ef4444; background: rgba(239, 68, 68, 0.1); }
  .status-badge.proof-badge { color: #d8b4fe; border: 1px solid #d8b4fe; background: rgba(168, 85, 247, 0.1); }

  .count-badge { background-color: #3b82f6; color: white; font-size: 0.75rem; font-weight: 600; padding: 4px 12px; border-radius: 12px; display: flex; align-items: center; white-space: nowrap; }
  .card-desc { font-size: 0.9rem; color: #94a3b8; margin: 0 0 20px 0; line-height: 1.6; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: 3.2em; }
  .card-desc.expanded { -webkit-line-clamp: unset; overflow: visible; min-height: auto; }

  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
  .info-pill { background-color: #0f172a; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 12px; display: flex; align-items: center; gap: 10px; font-size: 0.8rem; color: #cbd5e1; min-height: 20px; }
  .highlight-pill { color: #fbbf24; border-color: rgba(251, 191, 36, 0.3); }
  .highlight-pill .pill-icon { stroke: #fbbf24; }
  .pill-icon { width: 18px; height: 18px; opacity: 0.8; flex-shrink: 0; }

  .card-footer-actions { display: flex; justify-content: space-between; align-items: center; margin-top: auto; padding-top: 10px; }
  .read-more-btn { background: transparent; border: 1px solid #cbd5e1; color: #cbd5e1; padding: 8px 16px; border-radius: 8px; font-size: 0.9rem; font-weight: 500; cursor: pointer; display: flex; align-items: center; transition: 0.2s; }
  .read-more-btn:hover { border-color: white; color: white; background: rgba(255,255,255,0.05); }

  .status-btn { color: white; border: none; padding: 9px 24px; border-radius: 8px; font-size: 0.9rem; font-weight: 700; text-transform: uppercase; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.2); transition: 0.2s; }
  .status-btn:hover { filter: brightness(1.1); transform: translateY(-1px); }
  
  .register-btn { background: #86efac; color: #064e3b; }
  .sending-btn { background: #3b82f6; }
  .proof-btn { background: #d8b4fe; color: #4c1d95; }
  .checkout-btn { background: #22c55e; }
  .completed-btn { background: #10b981; }
  .canceled-btn { background: #ef4444; }
  .waiting-btn { background: #facc15; color: #854d0e; }
  .resubmit-btn { background: #ef4444; color: white; }

  .locked-card .card-image { filter: grayscale(100%); opacity: 0.8; }
  .locked-card .card-content { opacity: 0.7; }
  .lock-overlay { width: 100%; height: 100%; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(2px); display: flex; align-items: center; justify-content: center; opacity: 0.8; }

  /* FOOTER */
  .app-footer { margin-top: 60px; text-align: center; padding-bottom: 40px; }
  .footer-separator { height: 1px; background: rgba(255,255,255,0.1); width: 100px; margin: 0 auto 20px auto; }
  .footer-content p { font-size: 0.8rem; color: #64748b; margin: 4px 0; }
  .highlight { color: #10b981; }
  .contact a { color: #64748b; text-decoration: none; }

  /* MODAL */
  .modal-overlay { position: fixed; inset: 0; z-index: 3000; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; padding: 20px; }
  .modal-box { width: 100%; max-width: 500px; background: #1e293b; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; position: relative; display: flex; flex-direction: column; box-shadow: 0 20px 40px rgba(0,0,0,0.5); overflow: hidden; }
  .modal-close { position: absolute; top: 15px; right: 20px; background: none; border: none; color: #94a3b8; font-size: 2rem; line-height: 1; cursor: pointer; z-index: 10; }
  .modal-body { padding: 20px 30px 40px; text-align: center; }
  .modal-title { font-size: 1.5rem; color: white; margin: 10px 0 5px; }
  .modal-subtitle { color: #94a3b8; font-size: 0.9rem; margin-bottom: 25px; }

  .stepper { display: flex; align-items: center; justify-content: space-between; background: #0f172a; padding: 20px 30px; border-bottom: 1px solid rgba(255,255,255,0.05); }
  .step-wrapper { display: flex; align-items: center; flex: 1; position: relative; }
  .step-circle { width: 32px; height: 32px; border-radius: 50%; background: #334155; color: #94a3b8; display: flex; align-items: center; justify-content: center; font-weight: 700; z-index: 2; transition: all 0.3s; }
  .step-circle.active { background: var(--primary); color: #0f172a; box-shadow: 0 0 10px rgba(16,185,129,0.5); }
  .step-circle.completed { background: #064e3b; color: #10b981; border: 1px solid #10b981; }
  .step-line { height: 3px; background: #334155; flex: 1; margin: 0 5px; border-radius: 2px; }
  .line-active { background: var(--primary); }

  .toggle-switch { display: flex; background: #0f172a; padding: 4px; border-radius: 12px; margin: 0 auto 20px; max-width: 250px; }
  .toggle-btn { flex: 1; border: none; background: transparent; color: #64748b; padding: 8px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: 0.2s; }
  .toggle-btn.active { background: #1e293b; color: var(--primary); box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
  .checkin-display { min-height: 180px; display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .pin-box { display: flex; gap: 10px; margin-bottom: 10px; }
  .pin-box span { width: 45px; height: 60px; background: #0f172a; border: 2px solid var(--primary); color: var(--primary); font-size: 2rem; font-weight: 800; display: flex; align-items: center; justify-content: center; border-radius: 8px; }
  .qr-box img { width: 160px; height: 160px; border-radius: 12px; border: 4px solid white; }
  .input-group { text-align: left; margin-bottom: 20px; }
  .input-group label { display: block; color: #cbd5e1; font-size: 0.9rem; margin-bottom: 8px; }
  .input-group input { width: 100%; background: #0f172a; border: 1px solid rgba(255,255,255,0.1); color: white; padding: 12px; border-radius: 8px; font-size: 1rem; outline: none; box-sizing: border-box; }
  .input-group input:focus { border-color: #3b82f6; }

  .upload-area { margin-bottom: 25px; }
  .upload-label { cursor: pointer; display: block; }
  .upload-placeholder { border: 2px dashed rgba(255,255,255,0.2); border-radius: 12px; padding: 40px 20px; color: #64748b; display: flex; flex-direction: column; align-items: center; gap: 10px; transition: 0.2s; background: rgba(0,0,0,0.2); }
  .upload-placeholder:hover { border-color: #d8b4fe; color: #d8b4fe; background: rgba(216, 180, 254, 0.05); }
  .image-preview { position: relative; display: inline-block; }
  .image-preview img { max-width: 100%; max-height: 250px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.2); }
  .remove-img-btn { position: absolute; top: -10px; right: -10px; background: #ef4444; color: white; border: none; width: 30px; height: 30px; border-radius: 50%; font-size: 1.2rem; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.3); }

  .action-submit-btn { width: 100%; padding: 14px; background: var(--primary); color: #064e3b; border: none; border-radius: 10px; font-weight: 800; font-size: 1rem; cursor: pointer; transition: 0.2s; }
  .action-submit-btn:hover { filter: brightness(1.1); transform: translateY(-2px); }
  .action-submit-btn.blue-theme { background: #3b82f6; color: white; }
  .action-submit-btn.purple-theme { background: #d8b4fe; color: #4c1d95; }
  .action-submit-btn:disabled { background: #334155; color: #64748b; cursor: not-allowed; transform: none; }

  .waiting-view { background: #fef08a; color: #854d0e; padding: 40px; text-align: center; height: 100%; }
  .waiting-view h2 { color: #854d0e; font-size: 2rem; margin: 10px 0; }
  .waiting-view p { color: #a16207; margin-bottom: 20px; }
  .hourglass-icon { font-size: 4rem; margin-bottom: 20px; animation: pulse 2s infinite; }
  @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }

  .rejected-alert { background-color: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444; font-weight: 700; padding: 12px; border-radius: 8px; margin-bottom: 20px; text-align: center; }

  .holiday-info-box {
    grid-column: 1 / -1; /* ให้กินพื้นที่เต็มความกว้าง 2 คอลัมน์ */
    background: rgba(239, 68, 68, 0.1); /* สีแดงจางๆ */
    border: 1px dashed #ef4444;
    padding: 12px;
    border-radius: 8px;
    margin-top: 10px;
}
.holiday-title {
    color: #f87171;
    font-weight: 700;
    font-size: 0.9rem;
    margin-bottom: 6px;
}
.holiday-list {
    margin: 0;
    padding-left: 20px;
    color: #fca5a5;
    font-size: 0.85rem;
}
.holiday-list li {
    margin-bottom: 2px;
}
</style>