<script lang="ts">
  import { onMount, onDestroy, tick } from "svelte";
  import Swal from "sweetalert2";
  import jsQR from "jsqr";
  import { page } from "$app/stores";
  import { goto, invalidateAll } from "$app/navigation";
  import { base } from '$app/paths';
  import axios, { type AxiosError, type AxiosRequestConfig } from "axios";

  const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(
    /\/$/,
    ""
  );
  const HOLIDAY_FILE = "/internal/holidays.json";

  // ==========================================
  // 🔧 AXIOS INSTANCE CONFIGURATION
  // ==========================================
  const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
      "Content-Type": "application/json",
    },
  });

  // Request interceptor - เพิ่ม token อัตโนมัติ
  api.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem("access_token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Response interceptor - จัดการ error และ 401
  api.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      if (error.response?.status === 401) {
        console.error("Token expired or invalid, redirecting to login");
        localStorage.removeItem("access_token");
        goto(`/ku-run/auth/login`);
      }
      return Promise.reject(error);
    }
  );

  // ===== PERFORMANCE OPTIMIZATION =====
  // Disable excessive console.log in production
  const isDev = import.meta.env.DEV;

  // Filter cache for memoization
  const filterCache = new Map<string, { result: any; timestamp: number }>();
  const CACHE_TTL = 3000; // 3 seconds

  function getCachedOrCompute<T>(cacheKey: string, computeFn: () => T): T {
    const cached = filterCache.get(cacheKey);
    const now = Date.now();

    if (cached && now - cached.timestamp < CACHE_TTL) {
      return cached.result as T;
    }

    const result = computeFn();
    filterCache.set(cacheKey, { result, timestamp: now });

    // Cleanup old entries (keep max 30)
    if (filterCache.size > 30) {
      const iterator = filterCache.keys();
      const oldest = iterator.next().value;
      if (oldest) filterCache.delete(oldest);
    }

    return result;
  }

  // Optimized filter function
  function filterEventsOptimized(
    events: AppEvent[],
    query: string,
    month: string,
    year: string
  ): AppEvent[] {
    if (!events || events.length === 0) return [];

    const lowerQuery = query.toLowerCase().trim();

    return events.filter((event) => {
      // Early returns for better performance
      if (year !== "All" && event.year !== year) return false;
      if (month !== "All" && event.month !== month) return false;
      if (!lowerQuery) return true;

      return (
        event.title.toLowerCase().includes(lowerQuery) ||
        event.location.toLowerCase().includes(lowerQuery)
      );
    });
  }

  // Pre-computed tier order cache
  let cachedTierOrder = new Map<string, number>();

  // Tab visibility tracking for performance monitor
  let isTabVisible = true;

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      isTabVisible = !document.hidden;
    });
  }
  // ===== END PERFORMANCE OPTIMIZATION =====

  if (isDev) console.log("🔍 API_BASE_URL:", API_BASE_URL);

  // ==========================================
  // 🌐 INTERNATIONALIZATION (i18n) SYSTEM
  // ==========================================
  type Language = "th" | "en";
  let currentLang: Language = "th";

  // Load saved language preference - default to 'th' if not set
  if (typeof localStorage !== "undefined") {
    const savedLang = localStorage.getItem("app_language");
    if (savedLang === "th" || savedLang === "en") {
      currentLang = savedLang;
    } else {
      // Set default to Thai if no preference saved
      localStorage.setItem("app_language", "th");
    }
  }

  function toggleLanguage() {
    currentLang = currentLang === "th" ? "en" : "th";
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("app_language", currentLang);
    }
  }

  // Translation object
  const translations = {
    th: {
      // Navigation & Header
      organizer: "ผู้จัดงาน",
      events: "กิจกรรม",
      createEvent: "สร้างกิจกรรม",
      verifyProof: "ตรวจสอบหลักฐาน",
      activityLogs: "ประวัติกิจกรรม",
      rewards: "รางวัล",
      settings: "ตั้งค่า",
      logout: "ออกจากระบบ",
      navigation: "เมนู",

      // Event List
      eventList: "รายการกิจกรรม",
      searchEvents: "ค้นหากิจกรรม...",
      allMonths: "ทุกเดือน",
      allYears: "ทุกปี",
      noEventsFound: "ไม่พบกิจกรรม",
      participants: "ผู้เข้าร่วม",
      slots: "ที่นั่ง",
      active: "เปิดใช้งาน",
      inactive: "ปิดใช้งาน",
      published: "เผยแพร่แล้ว",
      draft: "ฉบับร่าง",
      closed: "ปิดแล้ว",
      edit: "แก้ไข",
      delete: "ลบ",
      view: "ดู",
      noDescription: "ไม่มีรายละเอียด",
      holidaysOff: "วันหยุด",
      noResults: "ไม่พบผลลัพธ์",
      viewDetails: "ดูรายละเอียด",

      // Create/Edit Event
      createNewEvent: "สร้างกิจกรรมใหม่",
      editEvent: "แก้ไขกิจกรรม",
      eventName: "ชื่อกิจกรรม",
      description: "รายละเอียด",
      location: "สถานที่",
      startDate: "วันที่เริ่ม",
      endDate: "วันที่สิ้นสุด",
      startTime: "เวลาเริ่ม",
      endTime: "เวลาสิ้นสุด",
      capacity: "จำนวนที่นั่ง",
      distance: "ระยะทาง",
      day: "วัน",
      month: "เดือน",
      year: "ปี",
      holidays: "วันหยุด",
      excludeWeekends: "ไม่รวมวันเสาร์-อาทิตย์",
      specificDates: "เลือกวันที่เฉพาะ",
      noHolidays: "ไม่มีวันหยุด",
      save: "บันทึก",
      cancel: "ยกเลิก",
      update: "อัพเดท",
      create: "สร้าง",
      uploadImage: "อัพโหลดรูปภาพ",
      removeImage: "ลบรูปภาพ",
      isPublic: "เผยแพร่",
      isActive: "เปิดใช้งาน",
      required: "จำเป็น",
      publish: "เผยแพร่",

      // Rewards
      rewardTiers: "ระดับรางวัล",
      addTier: "เพิ่มระดับ",
      tierName: "ชื่อระดับ",
      quota: "โควต้า",
      requirement: "เงื่อนไข",
      rounds: "รอบ",

      // Verify Proof
      proofSubmissions: "หลักฐานที่ส่งมา",
      approve: "อนุมัติ",
      reject: "ปฏิเสธ",
      pending: "รอตรวจสอบ",
      approved: "อนุมัติแล้ว",
      rejected: "ปฏิเสธแล้ว",
      verifyCode: "ตรวจรหัส",
      unlock: "ปลดล็อค",
      enterCode: "กรอกรหัส",
      scanQR: "สแกน QR",
      verifyBtn: "ตรวจสอบ",
      clearBtn: "ล้าง",
      autoCheckIn: "เช็คอินอัตโนมัติ",
      cameraAccess: "เข้าถึงกล้อง",
      startCamera: "เปิดกล้อง",
      stopCamera: "ปิดกล้อง",
      scanning: "กำลังสแกน...",

      // Logs
      logs: "ประวัติ",
      action: "การกระทำ",
      status: "สถานะ",
      timestamp: "เวลา",
      user: "ผู้ใช้",
      viewLogs: "ดูประวัติ",
      activityHistory: "ประวัติกิจกรรม",
      noLogs: "ไม่มีประวัติ",
      exportLogs: "ส่งออกประวัติ",
      filterByAction: "กรองตามการกระทำ",
      filterByStatus: "กรองตามสถานะ",

      // Rewards
      viewRewards: "ดูรางวัล",
      rewardManagement: "จัดการรางวัล",
      noRewards: "ไม่มีรางวัล",
      rewardStatus: "สถานะรางวัล",
      claimed: "รับแล้ว",
      unclaimed: "ยังไม่รับ",
      totalRewards: "รางวัลทั้งหมด",
      sendNotification: "ส่งการแจ้งเตือน",
      notificationSent: "ส่งการแจ้งเตือนสำเร็จ",

      // Verify Code Page
      participantCheckIn: "เช็คอินผู้เข้าร่วม",
      verifyParticipantCode: "ตรวจสอบรหัสผู้เข้าร่วมเพื่อเช็คอิน",
      pinCode: "รหัส PIN",
      checkIn: "เช็คอิน",
      enterDigitCode: "กรอกรหัส 5 หลัก",
      autoCheckInEnabled: "เปิดเช็คอินอัตโนมัติ",
      pressCheckIn: "กด เช็คอิน เพื่อยืนยัน",

      // Unlock Page
      unlockAccount: "ปลดล็อคบัญชี",
      enterEmailToRestore: "กรอกอีเมลของผู้ใช้เพื่อกู้คืนการเข้าถึง",
      userEmailAddress: "อีเมลผู้ใช้",
      enterEmailPlaceholder: "กรอกอีเมล",

      // Verify Proof Page
      verifyProofTitle: "ตรวจสอบหลักฐาน",
      apply: "ใช้งาน",
      reset: "รีเซ็ต",
      completed: "เสร็จสิ้น",
      inProgress: "กำลังดำเนินการ",
      notStarted: "ยังไม่เริ่ม",
      progress: "ความคืบหน้า",

      // Common
      loading: "กำลังโหลด...",
      error: "เกิดข้อผิดพลาด",
      success: "สำเร็จ",
      confirm: "ยืนยัน",
      close: "ปิด",
      search: "ค้นหา",
      filter: "กรอง",
      export: "ส่งออก",
      refresh: "รีเฟรช",
      back: "กลับ",
      next: "ถัดไป",
      previous: "ก่อนหน้า",
      total: "ทั้งหมด",
      select: "เลือก",
      all: "ทั้งหมด",
      backToEvents: "กลับไปหน้ากิจกรรม",
      selectEvent: "เลือกกิจกรรม",
      searchByName: "ค้นหาด้วยชื่อ อีเมล หรือรหัสนิสิต...",
      batch: "รุ่น",
      stdId: "รหัส",
      fromDate: "จากวันที่",
      toDate: "ถึงวันที่",
      dateTime: "วันที่และเวลา",
      basicInfo: "ข้อมูลพื้นฐาน",
      schedule: "กำหนดการ",
      eventSettings: "ตั้งค่ากิจกรรม",

      // Messages
      eventCreated: "สร้างกิจกรรมสำเร็จ!",
      eventUpdated: "อัพเดทกิจกรรมสำเร็จ!",
      eventDeleted: "ลบกิจกรรมสำเร็จ!",
      fillAllFields: "กรุณากรอกข้อมูลให้ครบถ้วน",
      invalidDateRange: "ช่วงวันที่ไม่ถูกต้อง",
      confirmDelete: "ยืนยันการลบ?",
      cannotUndo: "การกระทำนี้ไม่สามารถย้อนกลับได้",
      deleteEventTitle: "ลบกิจกรรม?",
      deleteEventText: "คุณแน่ใจหรือไม่ว่าต้องการลบกิจกรรมนี้?",
      yesDelete: "ใช่, ลบเลย",
      deleted: "ลบแล้ว!",
      eventDeletedSuccess: "กิจกรรมถูกลบเรียบร้อยแล้ว",

      // Profile/Settings
      profile: "โปรไฟล์",
      accountSettings: "ตั้งค่าบัญชี",
      manageProfile: "จัดการข้อมูลโปรไฟล์และการตั้งค่า",
      personalInfo: "ข้อมูลส่วนตัว",
      academicInfo: "ข้อมูลการศึกษา",
      departmentInfo: "ข้อมูลแผนก",
      title: "คำนำหน้า",
      firstName: "ชื่อ",
      lastName: "นามสกุล",
      email: "อีเมล",
      emailAddress: "ที่อยู่อีเมล",
      studentId: "รหัสนิสิต",
      faculty: "คณะ",
      major: "สาขา",
      department: "แผนก",
      saveChanges: "บันทึกการเปลี่ยนแปลง",
      selectTitle: "เลือกคำนำหน้า",
      selectFaculty: "เลือกคณะ",
      selectMajor: "เลือกสาขา",
      selectDepartment: "เลือกแผนก",
      enterFirstName: "กรอกชื่อ",
      enterLastName: "กรอกนามสกุล",
      enterEmail: "กรอกอีเมล",
      settingsUpdated: "อัปเดตการตั้งค่าสำเร็จ!",

      // Language
      language: "ภาษา",
      thai: "ไทย",
      english: "English",
      switchToEnglish: "เปลี่ยนเป็น English",
      switchToThai: "Switch to ภาษาไทย",

      // Security
      security: "ความปลอดภัย",
      password: "รหัสผ่าน",
      changePassword: "เปลี่ยนรหัสผ่าน",
    },
    en: {
      // Navigation & Header
      organizer: "ORGANIZER",
      events: "Events",
      createEvent: "Create Event",
      verifyProof: "Verify Proof",
      activityLogs: "Activity Logs",
      rewards: "Rewards",
      settings: "Settings",
      logout: "Logout",
      navigation: "NAVIGATION",

      // Event List
      eventList: "Event List",
      searchEvents: "Search events...",
      allMonths: "All Months",
      allYears: "All Years",
      noEventsFound: "No events found",
      participants: "Participants",
      slots: "Slots",
      active: "Active",
      inactive: "Inactive",
      published: "Published",
      draft: "Draft",
      closed: "Closed",
      edit: "Edit",
      delete: "Delete",
      view: "View",
      noDescription: "No description",
      holidaysOff: "Days off",
      noResults: "No results found",
      viewDetails: "View Details",

      // Create/Edit Event
      createNewEvent: "Create New Event",
      editEvent: "Edit Event",
      eventName: "Event Name",
      description: "Description",
      location: "Location",
      startDate: "Start Date",
      endDate: "End Date",
      startTime: "Start Time",
      endTime: "End Time",
      capacity: "Capacity",
      distance: "Distance",
      day: "Day",
      month: "Month",
      year: "Year",
      holidays: "Holidays",
      excludeWeekends: "Exclude Weekends",
      specificDates: "Specific Dates",
      noHolidays: "No Holidays",
      save: "Save",
      cancel: "Cancel",
      update: "Update",
      create: "Create",
      uploadImage: "Upload Image",
      removeImage: "Remove Image",
      isPublic: "Published",
      isActive: "Active",
      required: "Required",
      publish: "Publish",

      // Rewards
      rewardTiers: "Reward Tiers",
      addTier: "Add Tier",
      tierName: "Tier Name",
      quota: "Quota",
      requirement: "Requirement",
      rounds: "rounds",

      // Verify Proof
      proofSubmissions: "Proof Submissions",
      approve: "Approve",
      reject: "Reject",
      pending: "Pending",
      approved: "Approved",
      rejected: "Rejected",
      verifyCode: "Verify Code",
      unlock: "Unlock",
      enterCode: "Enter Code",
      scanQR: "Scan QR",
      verifyBtn: "Verify",
      clearBtn: "Clear",
      autoCheckIn: "Auto Check-in",
      cameraAccess: "Camera Access",
      startCamera: "Start Camera",
      stopCamera: "Stop Camera",
      scanning: "Scanning...",

      // Logs
      logs: "Logs",
      action: "Action",
      status: "Status",
      timestamp: "Timestamp",
      user: "User",
      viewLogs: "View Logs",
      activityHistory: "Activity History",
      noLogs: "No logs",
      exportLogs: "Export Logs",
      filterByAction: "Filter by Action",
      filterByStatus: "Filter by Status",

      // Rewards
      viewRewards: "View Rewards",
      rewardManagement: "Reward Management",
      noRewards: "No rewards",
      rewardStatus: "Reward Status",
      claimed: "Claimed",
      unclaimed: "Unclaimed",
      totalRewards: "Total Rewards",
      sendNotification: "Send Notification",
      notificationSent: "Notification sent successfully",

      // Verify Code Page
      participantCheckIn: "Participant Check-in",
      verifyParticipantCode: "Verify participant's code to complete check-in",
      pinCode: "PIN Code",
      checkIn: "CHECK IN",
      enterDigitCode: "Enter 5-digit code",
      autoCheckInEnabled: "Auto check-in enabled",
      pressCheckIn: "Press CHECK IN to verify",

      // Unlock Page
      unlockAccount: "Unlock Account",
      enterEmailToRestore:
        "Enter the user's email address to restore their access",
      userEmailAddress: "User Email Address",
      enterEmailPlaceholder: "Enter email address",

      // Verify Proof Page
      verifyProofTitle: "Verify Proof",
      apply: "Apply",
      reset: "Reset",
      completed: "Completed",
      inProgress: "In Progress",
      notStarted: "Not Started",
      progress: "Progress",

      // Common
      loading: "Loading...",
      error: "Error",
      success: "Success",
      confirm: "Confirm",
      close: "Close",
      search: "Search",
      filter: "Filter",
      export: "Export",
      refresh: "Refresh",
      back: "Back",
      next: "Next",
      previous: "Previous",
      total: "Total",
      select: "Select",
      all: "All",
      backToEvents: "Back to Events",
      selectEvent: "Select Event",
      searchByName: "Search by name, email, or Nisit ID...",
      batch: "Batch",
      stdId: "Std ID",
      fromDate: "From Date",
      toDate: "To Date",
      dateTime: "Date & Time",
      basicInfo: "Basic Information",
      schedule: "Schedule",
      eventSettings: "Event Settings",

      // Messages
      eventCreated: "Event created successfully!",
      eventUpdated: "Event updated successfully!",
      eventDeleted: "Event deleted successfully!",
      fillAllFields: "Please fill in all required fields",
      invalidDateRange: "Invalid date range",
      confirmDelete: "Confirm delete?",
      cannotUndo: "This action cannot be undone",
      deleteEventTitle: "Delete Event?",
      deleteEventText: "Are you sure you want to delete this event?",
      yesDelete: "Yes, Delete",
      deleted: "Deleted!",
      eventDeletedSuccess: "Event has been deleted successfully",

      // Profile/Settings
      profile: "Profile",
      accountSettings: "Account Settings",
      manageProfile: "Manage your profile information and preferences",
      personalInfo: "Personal Information",
      academicInfo: "Academic Information",
      departmentInfo: "Department Information",
      title: "Title",
      firstName: "First Name",
      lastName: "Last Name",
      email: "Email",
      emailAddress: "Email Address",
      studentId: "Student ID",
      faculty: "Faculty",
      major: "Major",
      department: "Department",
      saveChanges: "Save Changes",
      selectTitle: "Select Title",
      selectFaculty: "Select Faculty",
      selectMajor: "Select Major",
      selectDepartment: "Select Department",
      enterFirstName: "Enter first name",
      enterLastName: "Enter last name",
      enterEmail: "Enter email",
      settingsUpdated: "Settings updated successfully!",

      // Language
      language: "Language",
      thai: "ไทย",
      english: "English",
      switchToEnglish: "Switch to English",
      switchToThai: "เปลี่ยนเป็นภาษาไทย",

      // Security
      security: "Security",
      password: "Password",
      changePassword: "Change Password",
    },
  };

  // Helper function to get translation
  $: t = (key: keyof typeof translations.th) => {
    return translations[currentLang][key] || translations.en[key] || key;
  };

  // Helper function to translate event status
  function translateStatus(status: string): string {
    switch (status) {
      case "Active":
        return lang.active;
      case "Draft":
        return lang.draft;
      case "Closed":
        return lang.closed;
      default:
        return status;
    }
  }

  // Reactive translation helper
  $: lang = translations[currentLang];
  // ===== END i18n SYSTEM =====

  let currentUserId: string = "";
  let authToken: string = "";
  let userRole: string = "";

  let userTitle: string = "";
  let userFirstName: string = "";
  let userLastName: string = "";
  let userEmail: string = "";

  let studentIdNumber: string = "";
  let userFaculty: string = "";
  let userMajor: string = "";
  let userDepartment: string = "";

  let showTitleDropdown = false;
  let showFacultyDropdown = false;
  let showMajorDropdown = false;
  let showDepartmentDropdown = false;

  let dataIsLoading: boolean = true;
  let savingChanges: boolean = false;

  let initialProfileData: any = {};
  let hasUnsavedChanges: boolean = false;

  let feedbackMessage: string = "";
  let feedbackType: "error" | "success" = "error";
  let messageTimer: any;
  let errorAnimationTimer: any;

  let fieldValidationErrors = {
    title: false,
    firstName: false,
    lastName: false,
    faculty: false,
    major: false,
    department: false,
  };
  type ErrorKey = keyof typeof fieldValidationErrors;

  const nameTitles = ["Mr.", "Ms.", "Mrs.", "Dr.", "Prof."];
  const staffDepartments = [
    { id: "Academic Affairs", name: "Academic Affairs" },
    { id: "Student Affairs", name: "Student Affairs" },
    { id: "Registrar Office", name: "Registrar Office" },
    { id: "Finance Department", name: "Finance Department" },
    { id: "IT Support Center", name: "IT Support Center" },
    { id: "Human Resources", name: "Human Resources" },
  ];
  const universityFaculties = [
    { id: "management", name: "Management Sciences" },
    { id: "engineering", name: "Engineering at Sriracha" },
    { id: "science", name: "Science at Sriracha" },
    { id: "economics", name: "Economics at Sriracha" },
    { id: "maritime", name: "International Maritime Studies" },
  ];

  type Major = { id: string; name: string };
  const facultyMajors: Record<string, Major[]> = {
    management: [
      { id: "mgt", name: "Management" },
      { id: "fin", name: "Finance and Investment" },
      { id: "ib", name: "International Business" },
      { id: "lm", name: "Logistics Management" },
      { id: "hh", name: "Hospitality - Hotel" },
      { id: "ht", name: "Hospitality - Tourism" },
      { id: "acc", name: "Accounting" },
      { id: "amb", name: "Digital Marketing" },
    ],
    engineering: [
      { id: "med", name: "Mechanical Engineering" },
      { id: "mme", name: "Mechanical & Mfg Systems" },
      { id: "eee", name: "Electrical & Electronics" },
      { id: "ise", name: "Industrial Systems" },
      { id: "cie", name: "Computer Engineering" },
      { id: "ce", name: "Civil Engineering" },
      { id: "ee", name: "Electrical Engineering" },
      { id: "rae", name: "Robotics Engineering" },
      { id: "die", name: "Digital Electronics" },
      { id: "dms", name: "Digital Mfg Systems" },
      { id: "ae", name: "Automotive Engineering" },
    ],
    science: [
      { id: "cs", name: "Computer Science" },
      { id: "it", name: "Information Technology" },
      { id: "ps", name: "Physics" },
      { id: "est", name: "Environmental Science" },
      { id: "dst", name: "Digital Science" },
      { id: "daa", name: "Data Analytics" },
      { id: "act", name: "Applied Chemistry" },
    ],
    economics: [{ id: "econ", name: "Economics" }],
    maritime: [
      { id: "nao", name: "Naval Architecture" },
      { id: "ns", name: "Nautical Science" },
      { id: "mt", name: "Maritime Transportation" },
      { id: "me", name: "Marine Engineering" },
    ],
  };

  let availableMajorsForFaculty: Major[] = [];
  $: {
    if (userFaculty && facultyMajors[userFaculty]) {
      availableMajorsForFaculty = facultyMajors[userFaculty];
    } else {
      availableMajorsForFaculty = [];
    }
  }

  function retrieveFacultyName(id: string) {
    const f = universityFaculties.find((x) => x.id === id);
    return f ? f.name : "Select Faculty";
  }
  function retrieveMajorName(id: string) {
    const m = availableMajorsForFaculty.find((x) => x.id === id);
    return m ? m.name : "Select Major";
  }
  function retrieveDepartmentName(id: string) {
    const d = staffDepartments.find((x) => x.id === id || x.name === id);
    return d ? d.name : id || "Select Department";
  }

  function hideAllDropdowns() {
    showTitleDropdown = false;
    showFacultyDropdown = false;
    showMajorDropdown = false;
    showDepartmentDropdown = false;
  }

  function toggleDropdownVisibility(
    type: "title" | "faculty" | "major" | "dept",
    e: Event
  ) {
    e.stopPropagation();
    const wasOpen =
      (type === "title" && showTitleDropdown) ||
      (type === "faculty" && showFacultyDropdown) ||
      (type === "major" && showMajorDropdown) ||
      (type === "dept" && showDepartmentDropdown);
    hideAllDropdowns();
    if (!wasOpen) {
      if (type === "title") showTitleDropdown = true;
      if (type === "faculty") showFacultyDropdown = true;
      if (type === "major") showMajorDropdown = true;
      if (type === "dept") showDepartmentDropdown = true;
    }
  }

  function chooseTitle(t: string) {
    userTitle = t;
    showTitleDropdown = false;
    dismissAlert();
  }
  function chooseFaculty(id: string) {
    userFaculty = id;
    userMajor = "";
    showFacultyDropdown = false;
    dismissAlert();
  }
  function chooseMajor(id: string) {
    userMajor = id;
    showMajorDropdown = false;
    dismissAlert();
  }
  function chooseDepartment(id: string) {
    userDepartment = id;
    showDepartmentDropdown = false;
    dismissAlert();
  }

  // Debounce function for search inputs
  function debounce<T extends (...args: any[]) => any>(fn: T, delay: number) {
    let timeoutId: ReturnType<typeof setTimeout>;
    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    };
  }

  let debouncedRewardSearch = "";
  const debouncedUpdateRewardSearch = debounce((q: string) => {
    debouncedRewardSearch = q;
  }, 250);

  let debouncedSearchQuery = "";
  const debouncedUpdateSearch = debounce((q: string) => {
    debouncedSearchQuery = q;
  }, 250);

  function displayFeedback(msg: string, type: "error" | "success" = "error") {
    if (messageTimer) clearTimeout(messageTimer);
    feedbackMessage = msg;
    feedbackType = type;
    messageTimer = setTimeout(() => {
      feedbackMessage = "";
    }, 5000);
  }

  function dismissAlert() {
    if (feedbackMessage) {
      feedbackMessage = "";
      if (messageTimer) clearTimeout(messageTimer);
    }
  }

  function animateErrorFields() {
    if (errorAnimationTimer) clearTimeout(errorAnimationTimer);
    errorAnimationTimer = setTimeout(() => {
      Object.keys(fieldValidationErrors).forEach(
        (k) => (fieldValidationErrors[k as ErrorKey] = false)
      );
    }, 3000);
  }

  onMount(async () => {
    dataIsLoading = true;
    try {
      authToken = localStorage.getItem("access_token") || "";
      const userInfoStr = localStorage.getItem("user_info");

      if (userInfoStr) {
        try {
          const userInfo = JSON.parse(userInfoStr);
          currentUserId = userInfo.nisit_id || userInfo.id;
        } catch (e) {
          console.error("Error parsing user_info", e);
        }
      }

      if (!authToken || !currentUserId)
        throw new Error("User not authenticated");

      try {
        const response = await api.get(`/api/users/${currentUserId}`);
        const data = response.data;

        if (data.role) userRole = data.role.toLowerCase();
        else userRole = data.nisit_id || data.nisitId ? "student" : "officer";

        userTitle = data.title || "";
        userFirstName = data.first_name || data.firstName || "";
        userLastName = data.last_name || data.lastName || "";
        userEmail = data.email || "";

        if (userRole === "student") {
          studentIdNumber = data.nisit_id || data.nisitId || "";
          userFaculty = (data.faculty || "").toLowerCase();
          userMajor = (data.major || "").toLowerCase();
        } else {
          userDepartment = data.department || "";
        }

        initialProfileData = {
          userTitle,
          userFirstName,
          userLastName,
          userFaculty,
          userMajor,
          userDepartment,
        };
      } catch (err: any) {
        if (err.response?.status === 401) return goto(`/ku-run/auth/login`);
        throw new Error("Failed to fetch user data");
      }
    } catch (error) {
      console.error(error);
      displayFeedback("Could not load profile info.", "error");
    } finally {
      dataIsLoading = false;
    }
  });

  $: {
    const basicChanged =
      userTitle !== initialProfileData.userTitle ||
      userFirstName !== initialProfileData.userFirstName ||
      userLastName !== initialProfileData.userLastName;

    let roleChanged = false;
    if (userRole === "student") {
      roleChanged =
        userFaculty !== initialProfileData.userFaculty ||
        userMajor !== initialProfileData.userMajor;
    } else {
      roleChanged = userDepartment !== initialProfileData.userDepartment;
    }

    hasUnsavedChanges = basicChanged || roleChanged;
  }

  async function submitProfileUpdate() {
    dismissAlert();
    let isValid = true;

    // --- 1. ตรวจสอบข้อมูล (Validation) ---
    Object.keys(fieldValidationErrors).forEach(
      (k) => (fieldValidationErrors[k as ErrorKey] = false)
    );

    if (!userTitle) {
      fieldValidationErrors.title = true;
      isValid = false;
    }
    if (!userFirstName.trim()) {
      fieldValidationErrors.firstName = true;
      isValid = false;
    }
    if (!userLastName.trim()) {
      fieldValidationErrors.lastName = true;
      isValid = false;
    }

    if (userRole === "student") {
      if (!userFaculty) {
        fieldValidationErrors.faculty = true;
        isValid = false;
      }
      if (!userMajor) {
        fieldValidationErrors.major = true;
        isValid = false;
      }
    } else {
      if (!userDepartment) {
        fieldValidationErrors.department = true;
        isValid = false;
      }
    }

    if (!isValid) {
      animateErrorFields();
      if (!feedbackMessage)
        displayFeedback("Please fill in all required fields.");
      return;
    }

    // --- 2. เริ่มขั้นตอนบันทึก ---
    savingChanges = true;

    try {
      const updateData = {
        title: userTitle,
        first_name: userFirstName,
        last_name: userLastName,
        major: userMajor,
        faculty: userFaculty,
        department: userDepartment,
      };

      // ✅ 2.1 ส่งข้อมูลและ "รอ" รับข้อมูลล่าสุดจาก Server
      const response = await api.put(`/api/users/${currentUserId}`, updateData);

      // 2.2 แจ้งเตือนสำเร็จ
      displayFeedback(lang.settingsUpdated, "success");

      // ✅ 2.3 อัปเดต localStorage ด้วยข้อมูลจริงจาก Server (Response)
      // วิธีนี้ชัวร์กว่าการเอาตัวแปร userTitle มาใส่เอง เพราะจะได้ข้อมูลที่ Database บันทึกจริง ๆ
      try {
        const oldUserInfo = JSON.parse(
          localStorage.getItem("user_info") || "{}"
        );

        // ใช้ข้อมูลจาก server (response.data) ถ้ามี หรือใช้ updateData ถ้าไม่มี
        const serverData = response.data || {};

        const newUserInfo = {
          ...oldUserInfo,
          // อัปเดตทับด้วยข้อมูลใหม่
          title: serverData.title || userTitle,
          first_name:
            serverData.first_name || serverData.firstName || userFirstName,
          last_name:
            serverData.last_name || serverData.lastName || userLastName,
          faculty: serverData.faculty || userFaculty,
          major: serverData.major || userMajor,
          department: serverData.department || userDepartment,
        };

        localStorage.setItem("user_info", JSON.stringify(newUserInfo));
      } catch (e) {
        console.error("Local storage update failed", e);
      }

      // ✅ 2.4 บังคับรีเฟรชหน้าจอ (Auto Reload)
      // ใช้ setTimeout เพื่อให้มั่นใจว่า localStorage เขียนเสร็จแล้วจริงๆ
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error: any) {
      console.error(error);
      const errMsg =
        error.response?.data?.message || error.message || "Failed to update";
      displayFeedback(errMsg, "error");
    } finally {
      savingChanges = false;
    }
  }

  export let apiBaseUrl: string;
  export let token: string;
  export let organizerId: number | null;

  // State
  let email = "";
  let isLoading = false;
  let notificationMessage = "";
  let notificationType: "error" | "success" = "error";
  let notificationTimeout: any = null;
  let errorField: string | null = null;

  function validateEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function clearNotification() {
    errorField = null;
    if (notificationMessage) {
      notificationMessage = "";
      if (notificationTimeout) clearTimeout(notificationTimeout);
    }
  }

  function showNotification(
    message: string,
    type: "error" | "success" = "error",
    field: string | null = null
  ) {
    if (notificationTimeout) clearTimeout(notificationTimeout);
    notificationMessage = message;
    notificationType = type;
    errorField = field;

    notificationTimeout = setTimeout(() => {
      notificationMessage = "";
      errorField = null;
    }, 3000);
  }

  async function findUserIdByEmail(
    targetEmail: string
  ): Promise<string | null> {
    try {
      const res = await fetch(`${apiBaseUrl}/api/users/`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) return null;
      const data = await res.json();
      let usersList: any[] = [];
      if (Array.isArray(data)) {
        usersList = data;
      } else if (data.data && Array.isArray(data.data)) {
        usersList = data.data;
      } else if (data.users && Array.isArray(data.users)) {
        usersList = data.users;
      }
      const foundUser = usersList.find(
        (u: any) =>
          u.email && u.email.toLowerCase() === targetEmail.toLowerCase()
      );
      return foundUser ? foundUser.id : null;
    } catch (error) {
      console.error("Error finding user:", error);
      return null;
    }
  }

  async function unlockUserApi(userId: string) {
    if (!organizerId) {
      throw new Error("Organizer ID missing. Please login again.");
    }
    const url = `${apiBaseUrl}/api/users/${userId}/unlock?organizer_id=${organizerId}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || "Failed to unlock user.");
    }
    return await res.json();
  }

  async function handleUnlock() {
    clearNotification();

    if (!token) {
      showNotification("Authentication failed. Please login again.", "error");
      return;
    }
    if (!organizerId) {
      showNotification("Organizer info missing. Please login again.", "error");
      return;
    }
    if (!email || !validateEmail(email)) {
      showNotification("Please enter a valid email address.", "error", "email");
      return;
    }

    isLoading = true;

    try {
      const targetUserId = await findUserIdByEmail(email);

      if (!targetUserId) {
        showNotification("User with this email not found.", "error", "email");
        isLoading = false;
        return;
      }

      isLoading = false;
      Swal.fire({
        title: "Unlock Account?",
        text: `Confirm unlock for ${email}?`,
        icon: "question",
        showCancelButton: true,
        confirmButtonColor: "#10B981",
        iconColor: "#10B981",
        cancelButtonColor: "#6B7280",
        confirmButtonText: "Yes, Unlock",
        width: "320px",
        background: "#1f2937",
        color: "#ffffff",
        customClass: { popup: "my-swal-popup" },
      }).then(async (result) => {
        if (result.isConfirmed) {
          isLoading = true;
          try {
            await unlockUserApi(targetUserId);
            Swal.fire({
              title: "Unlocked!",
              text: "User account has been successfully unlocked.",
              icon: "success",
              iconColor: "#10B981",
              showConfirmButton: false,
              timer: 1500,
              width: "320px",
              background: "#1f2937",
              color: "#ffffff",
              customClass: { popup: "swal-dark-popup" },
            });

            email = "";
          } catch (err: any) {
            Swal.fire({
              title: "Error",
              text: err.message || "Something went wrong.",
              icon: "error",
              iconColor: "#EF4444",
              showConfirmButton: false,
              timer: 2000,
              width: "320px",
              background: "#1f2937",
              color: "#ffffff",
              customClass: { popup: "swal-dark-popup" },
            });
          } finally {
            isLoading = false;
          }
        }
      });
    } catch (error) {
      console.error(error);
      showNotification("System error occurred.", "error");
      isLoading = false;
    }
  }

  // ===== VERIFY PROOF DATA =====
  interface ProofSubmission {
    id: number;
    odySd: string;
    runnerName: string;
    email: string;
    runnerImage: string | null;
    submitTime: string;
    proofImage: string | null;
    rank?: number;
    stravaLink?: string | null;
    actualDistance?: number | null;
  }

  interface VerifyProofData {
    selectedEvent: AppEvent | null;
    submissions: ProofSubmission[];
    loading: boolean;
    error: string;
  }

  // MOCK DATA - ลบออกหลังทดสอบเสร็จ
  const MOCK_SUBMISSIONS: ProofSubmission[] = [
    {
      id: 1,
      rank: 1,
      odySd: "6610501001",
      runnerName: "Somchai Jaidee",
      email: "somchai@email.com",
      runnerImage: null,
      submitTime: "2024-12-28T10:15:00",
      proofImage:
        "https://placehold.co/400x600/1e293b/f59e0b?text=Running+Proof+1",
    },
    {
      id: 2,
      rank: 2,
      odySd: "6610501002",
      runnerName: "Somying Rakwing",
      email: "somying@email.com",
      runnerImage: "https://i.pravatar.cc/150?img=5",
      submitTime: "2024-12-28T11:30:00",
      proofImage:
        "https://placehold.co/400x600/1e293b/10b981?text=Running+Proof+2",
    },
    {
      id: 3,
      rank: 3,
      odySd: "6710502003",
      runnerName: "Wingrew Tanjai",
      email: "wingrew@email.com",
      runnerImage: "https://i.pravatar.cc/150?img=12",
      submitTime: "2024-12-28T12:45:00",
      proofImage:
        "https://placehold.co/400x600/1e293b/3b82f6?text=Running+Proof+3",
    },
    {
      id: 4,
      rank: 4,
      odySd: "6710502004",
      runnerName: "Nakwing Saifa",
      email: "nakwing@email.com",
      runnerImage: null,
      submitTime: "2024-12-28T13:20:00",
      proofImage: null,
    },
    {
      id: 5,
      rank: 5,
      odySd: "6610503005",
      runnerName: "Marathon Champ",
      email: "marathon@email.com",
      runnerImage: "https://i.pravatar.cc/150?img=8",
      submitTime: "2024-12-28T14:00:00",
      proofImage:
        "https://placehold.co/400x600/1e293b/ef4444?text=Running+Proof+5",
    },
    {
      id: 6,
      rank: 5,
      odySd: "6610503005",
      runnerName: "Marathon Champ",
      email: "marathon@email.com",
      runnerImage: "https://i.pravatar.cc/150?img=8",
      submitTime: "2024-12-28T14:00:00",
      proofImage:
        "https://placehold.co/400x600/1e293b/ef4444?text=Running+Proof+5",
    },
    {
      id: 7,
      rank: 5,
      odySd: "6610503005",
      runnerName: "Marathon Champ",
      email: "marathon@email.com",
      runnerImage: "https://i.pravatar.cc/150?img=8",
      submitTime: "2024-12-28T14:00:00",
      proofImage:
        "https://placehold.co/400x600/1e293b/ef4444?text=Running+Proof+5",
    },
    {
      id: 8,
      rank: 5,
      odySd: "6610503005",
      runnerName: "Marathon Champ",
      email: "marathon@email.com",
      runnerImage: "https://i.pravatar.cc/150?img=8",
      submitTime: "2024-12-28T14:00:00",
      proofImage:
        "https://placehold.co/400x600/1e293b/ef4444?text=Running+Proof+5",
    },
    {
      id: 9,
      rank: 5,
      odySd: "6610503005",
      runnerName: "Marathon Champ",
      email: "marathon@email.com",
      runnerImage: "https://i.pravatar.cc/150?img=8",
      submitTime: "2024-12-28T14:00:00",
      proofImage:
        "https://placehold.co/400x600/1e293b/ef4444?text=Running+Proof+5",
    },
    {
      id: 10,
      rank: 5,
      odySd: "6610503005",
      runnerName: "Marathon Champ",
      email: "marathon@email.com",
      runnerImage: "https://i.pravatar.cc/150?img=8",
      submitTime: "2024-12-28T14:00:00",
      proofImage:
        "https://placehold.co/400x600/1e293b/ef4444?text=Running+Proof+5",
    },
    {
      id: 11,
      rank: 5,
      odySd: "6610503005",
      runnerName: "Marathon Champ",
      email: "marathon@email.com",
      runnerImage: "https://i.pravatar.cc/150?img=8",
      submitTime: "2024-12-28T14:00:00",
      proofImage:
        "https://placehold.co/400x600/1e293b/ef4444?text=Running+Proof+5",
    },
  ];

  let verifyProofData: VerifyProofData = {
    selectedEvent: null,
    submissions: [],
    loading: false,
    error: "",
  };

  let verifyProofEventsPage = 1;
  let verifyProofEventsPerPage = 8;
  let showVerifyProofEventsPageDropdown = false;
  let showDateFilterDropdown = false;
  let verifyProofSearchQuery = "";
  let verifyProofBatchFilter = "";
  let verifyProofStdIdFilter = "";
  let verifyProofAutoRefreshEnabled = true;
  let verifyProofIsConnected = true;
  let newVerifyProofCount = 0;

  let verifyProofStatusFilter = "All";
  let verifyProofFromDate = "";
  let verifyProofToDate = "";
  let showVerifyStatusDropdown = false;
  let showVerifyFromDateDropdown = false;
  let showVerifyToDateDropdown = false;

  let filteredVerifyProofSubmissions: ProofSubmission[] = [];
  let sortedVerifyProofSubmissions: ProofSubmission[] = [];

  let verifyProofSubmissionsPage = 1;
  let verifyProofSubmissionsPerPage = 8;
  let showVerifyProofSubmissionsPageDropdown = false;

  interface RewardUser {
    id: string;
    odySd: string;
    nisitId: string;
    name: string;
    email: string;
    avatar: string;
    globalRank: number; // ลำดับทั้งหมด
    tierRank: number; // ลำดับใน Tier (0 ถ้ายังไม่มี tier)
    tier: string; // ชื่อ Tier หรือ "No Tier" ถ้ายังไม่ถึง
    tierColor: string;
    completedCount: number; // จำนวนที่ทำได้
    requiredCount: number; // เป้าหมายของ Tier ปัจจุบัน (หรือ Tier ต่ำสุดถ้ายังไม่มี)
    nextTierCount: number; // จำนวนที่ต้องทำเพื่อขึ้น Tier ถัดไป
    completedAt: string; // เวลาที่ทำสำเร็จ (ISO string, ละเอียดถึง millisecond)
    joinCode: string;
    status: "completed" | "in_progress" | "no_tier";
  }

  interface RewardData {
    selectedEvent: AppEvent | null;
    users: RewardUser[];

    loading: boolean;
    error: string;
    searchQuery: string;
    selectedTier: string;
    currentPage: number;
    itemsPerPage: number;
  }

  let rewardData: RewardData = {
    selectedEvent: null,
    users: [],
    loading: false,
    error: "",
    searchQuery: "",
    selectedTier: "All",
    currentPage: 1,
    itemsPerPage: 8,
  };

  let showRewardExportMenu = false;
  let isRewardExporting = false;
  $: availableYears = [...new Set(events.map((e: any) => e.year))].sort();
  // Auto refresh for rewards
  let newRewardUsersCount = 0;
  let rewardAutoRefreshEnabled = true;
  let rewardIsConnected = true;
  let timeLeft = 0;

  let verifyMode: "pin" | "qr" = "pin";
  let pins = ["", "", "", "", ""];
  let pinInputRefs: HTMLInputElement[] = [];
  let verifyErrorMessage = "";
  let isVerifying = false;
  let verifyErrorTimeout: any;
  let verifyErrorIndex: number | null = null;
  let autoCheckIn = false;
  let lastVerifySuccess = false;
  let lastParticipantName = "";

  // QR Mode
  let videoRef: HTMLVideoElement;
  let canvasRef: HTMLCanvasElement;
  let cameraStream: MediaStream | null = null;
  let scanning = false;
  let scanInterval: any;
  let cameraError = "";
  let lastScannedCode = "";

  // ===== VERIFY PROOF DATA =====
  interface ProofSubmission {
    id: number;
    odySd: string; // Nisit ID เช่น "6830200073"
    runnerName: string;
    email: string; // เพิ่ม email
    runnerImage: string | null;
    submitTime: string;
    proofImage: string | null;
    rank?: number; // ลำดับ
  }
  interface VerifyProofData {
    selectedEvent: AppEvent | null;
    submissions: ProofSubmission[];
    loading: boolean;
    error: string;
  }

  // let verifyProofData: VerifyProofData = {
  //   selectedEvent: null,
  //   submissions: [],
  //   loading: false,
  //   error: "",
  // };

  let verifyProofDateFilter = "";

  let totalVerifyProofSubmissions = 0;

  // Paginated submissions
  $: totalVerifyProofSubmissions = filteredVerifyProofSubmissions.length;
  $: totalVerifyProofSubmissionsPages = Math.ceil(
    totalVerifyProofSubmissions / itemsPerPage
  );

  // สร้างข้อมูลแบ่งหน้า (paginated)
  $: paginatedVerifyProofSubmissions = filteredVerifyProofSubmissions.slice(
    (verifyProofSubmissionsPage - 1) * itemsPerPage,
    verifyProofSubmissionsPage * itemsPerPage
  );

  // ฟังก์ชันเปลี่ยนหน้า
  function prevVerifyProofSubmissionsPage() {
    if (verifyProofSubmissionsPage > 1) verifyProofSubmissionsPage--;
  }

  function nextVerifyProofSubmissionsPage() {
    if (verifyProofSubmissionsPage < totalVerifyProofSubmissionsPages)
      verifyProofSubmissionsPage++;
  }

  let cachedVerifyProofDates: { value: string; display: string }[] = [];
  let lastVerifyProofEventId: number | null = null;

  $: {
    const eventId = verifyProofData.selectedEvent?.id ?? null;
    if (eventId !== lastVerifyProofEventId) {
      lastVerifyProofEventId = eventId;

      if (!verifyProofData.selectedEvent) {
        cachedVerifyProofDates = [];
      } else {
        const event = verifyProofData.selectedEvent;
        const startDate = new Date(
          parseInt(event.year),
          getMonthIdx(event.month),
          1
        );
        const endDate = new Date(
          parseInt(event.year),
          getMonthIdx(event.month) + 1,
          0
        );

        const dates: { value: string; display: string }[] = [];
        const current = new Date(startDate);
        const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

        while (current <= endDate) {
          dates.push({
            value: current.toISOString().split("T")[0],
            display: `${dayNames[current.getDay()]}, ${current.getDate()} ${event.month} ${event.year}`,
          });
          current.setDate(current.getDate() + 1);
        }

        cachedVerifyProofDates = dates;
      }
    }
  }

  $: availableVerifyProofDates = cachedVerifyProofDates;

  $: paginatedEventsForVerifyProof = filteredEvents.slice(
    (verifyProofEventsPage - 1) * verifyProofEventsPerPage,
    verifyProofEventsPage * verifyProofEventsPerPage
  );

  $: totalVerifyProofEventsPages = Math.ceil(
    filteredEvents.length / verifyProofEventsPerPage
  );

  let debouncedVerifyProofSearch = "";
  const debouncedUpdateVerifyProofSearch = debounce((q: string) => {
    debouncedVerifyProofSearch = q;
  }, 250);

  $: debouncedUpdateVerifyProofSearch(verifyProofSearchQuery);

  // OPTIMIZED: filteredVerifyProofSubmissions with memoization
  function getFilteredVerifyProofSubmissions(): ProofSubmission[] {
    const subs = verifyProofData.submissions;
    if (!subs || subs.length === 0) return [];

    const query = debouncedVerifyProofSearch.toLowerCase().trim();
    const batchFilter = verifyProofBatchFilter.trim();
    const stdIdFilter = verifyProofStdIdFilter.trim();

    return subs.filter((sub) => {
      // Search filter
      if (query) {
        const matchName = sub.runnerName.toLowerCase().includes(query);
        const matchEmail = sub.email?.toLowerCase().includes(query);
        const matchId = sub.odySd?.includes(query);
        if (!matchName && !matchEmail && !matchId) return false;
      }

      // Batch filter
      if (batchFilter && !sub.odySd?.startsWith(batchFilter)) return false;

      // Std ID filter
      if (stdIdFilter) {
        const stdPart = sub.odySd?.substring(2) || "";
        if (!stdPart.includes(stdIdFilter)) return false;
      }

      return true;
    });
  }

  let lastVerifyProofKey = "";
  let cachedFilteredVerifyProofSubmissions: ProofSubmission[] = [];

  $: {
    const cacheKey = `vProof_${verifyProofData.submissions.length}_${debouncedVerifyProofSearch}_${verifyProofBatchFilter}_${verifyProofStdIdFilter}`;
    if (cacheKey !== lastVerifyProofKey) {
      lastVerifyProofKey = cacheKey;
      cachedFilteredVerifyProofSubmissions =
        getFilteredVerifyProofSubmissions();
    }
  }

  $: filteredVerifyProofSubmissions = cachedFilteredVerifyProofSubmissions;

  $: sortedVerifyProofSubmissions = [...filteredVerifyProofSubmissions].sort(
    (a, b) => {
      return (
        new Date(a.submitTime).getTime() - new Date(b.submitTime).getTime()
      );
    }
  );

  function selectEventForVerifyProof(event: AppEvent) {
    verifyProofData.selectedEvent = event;
    verifyProofData.loading = true;
    verifyProofData.error = "";
    fetchPendingSubmissions(event.id);
  }

  function backToVerifyProofEventsList() {
    verifyProofData.selectedEvent = null;
    verifyProofData.submissions = [];
    verifyProofSearchQuery = "";
    // Force rebuild cache
    lastFilteredEventsKey = "";
  }

  function toggleVerifyProofAutoRefresh() {
    verifyProofAutoRefreshEnabled = !verifyProofAutoRefreshEnabled;
  }

  function refreshVerifyProofSubmissions() {
    if (verifyProofData.selectedEvent) {
      fetchPendingSubmissions(verifyProofData.selectedEvent.id);
    }
    newVerifyProofCount = 0;
  }

  async function fetchPendingSubmissions(eventId: number) {
  try {
    console.log('=== START fetchPendingSubmissions ===');
    console.log('Event ID:', eventId);
    console.log('API_BASE_URL:', API_BASE_URL);
    
    const token = localStorage.getItem("access_token");
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    let allParticipations: any[] = [];

    // ========================================
    // วิธีที่ 1: ลอง Export CSV
    // ========================================
    console.log('\n🔍 Method 1: Export CSV');
    try {
      const csvUrl = `${API_BASE_URL}/api/participations/event/${eventId}/export-csv`;
      console.log('Fetching CSV from:', csvUrl);
      
      const csvRes = await fetch(csvUrl, { headers });
      
      if (csvRes.ok) {
        const csvText = await csvRes.text();
        console.log('✓ CSV fetched, length:', csvText.length);

        if (csvText.length > 0) {
          const lines = csvText.trim().split('\n');
          
          if (lines.length > 1) {
            const csvHeaders = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
            console.log('CSV Headers:', csvHeaders);

            const idIndex = csvHeaders.findIndex(h => h.toLowerCase() === 'id' || h.toLowerCase() === 'participation_id');
            
            if (idIndex !== -1) {
              console.log('Found ID column at index:', idIndex);
              
              // ดึงทุก ID
              for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                const cols = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g)?.map(col => 
                  col.trim().replace(/^"|"$/g, '')
                ) || [];

                const id = parseInt(cols[idIndex]);
                if (id) {
                  console.log(`Found participation ID from CSV: ${id}`);
                  
                  // ดึงข้อมูลเต็ม
                  try {
                    const pUrl = `${API_BASE_URL}/api/participations/${id}`;
                    const pRes = await fetch(pUrl, { headers });
                    
                    if (pRes.ok) {
                      const pData = await pRes.json();
                      const p = pData.data || pData;
                      allParticipations.push(p);
                      console.log(`✓ Fetched participation ${id}:`, {
                        status: p.status,
                        hasProof: !!p.proof_image_url,
                        proofUrl: p.proof_image_url
                      });
                    }
                  } catch (e) {
                    console.warn(`Failed to fetch participation ${id}:`, e);
                  }
                }
              }
            }
          }
        }
      } else {
        console.log('✗ CSV failed:', csvRes.status);
      }
    } catch (e) {
      console.log('✗ CSV method failed:', e);
    }

    console.log('\n📊 Total participations found:', allParticipations.length);

    if (allParticipations.length === 0) {
      console.error('❌ No participations found');
      verifyProofData.submissions = [];
      return;
    }

    // ========================================
    // กรองเฉพาะที่มี proof_image_url และ status = proof_submitted
    // ========================================
    console.log('\n🔍 Filtering for pending submissions...');
    
    const pendingSubs = allParticipations.filter((p: any) => {
      const status = p.status || '';
      const hasProof = !!p.proof_image_url;
      
      console.log(`Participation ${p.id}:`, {
        status,
        hasProof,
        proof_url: p.proof_image_url
      });
      
      return status === 'proof_submitted' && hasProof;
    });

    console.log('Pending submissions found:', pendingSubs.length);

    if (pendingSubs.length === 0) {
      console.warn('⚠ No pending submissions with proofs');
      console.log('All statuses:', [...new Set(allParticipations.map(p => p.status))]);
      console.log('With proof_image_url:', allParticipations.filter(p => !!p.proof_image_url).length);
      verifyProofData.submissions = [];
      return;
    }

    // ========================================
    // Map ข้อมูลพร้อมดึงข้อมูล User
    // ========================================
    console.log('\n🔍 Mapping submissions with user data...');
    
    const mappedSubs = await Promise.all(
      pendingSubs.map(async (s: any) => {
        console.log('--- Processing participation:', s.id, '---');

        // ========================================
        // แปลง URL รูปภาพหลักฐาน
        // ========================================
        let proofUrl = s.proof_image_url;
        console.log('Original proof_image_url:', proofUrl);
        
        if (proofUrl && typeof proofUrl === "string") {
          // ถ้าเป็น full URL แล้ว
          if (proofUrl.startsWith('http://') || proofUrl.startsWith('https://')) {
            console.log('✓ Already full URL');
          }
          // ถ้าขึ้นต้นด้วย /api/uploads/ (มาจาก backend แล้ว)
          else if (proofUrl.startsWith('/api/uploads/')) {
            proofUrl = `${API_BASE_URL}${proofUrl}`;
            console.log('✓ Converted /api/uploads/ to:', proofUrl);
          }
          // ถ้าขึ้นต้นด้วย /uploads/
          else if (proofUrl.startsWith('/uploads/')) {
            proofUrl = `${API_BASE_URL}/api${proofUrl}`;
            console.log('✓ Converted /uploads/ to:', proofUrl);
          }
          // ถ้าขึ้นต้นด้วย / อื่นๆ
          else if (proofUrl.startsWith('/')) {
            proofUrl = `${API_BASE_URL}${proofUrl}`;
            console.log('✓ Converted / to:', proofUrl);
          }
          // ถ้าเป็น relative path ธรรมดา
          else {
            proofUrl = `${API_BASE_URL}/api/uploads/${proofUrl}`;
            console.log('✓ Added full path:', proofUrl);
          }
        } else {
          console.warn('⚠ No proof URL');
        }

        // ========================================
        // ดึงข้อมูล User
        // ========================================
        const userId = s.user_id;
        console.log('User ID:', userId);

        let fullName = `User ${userId}`;
        let userEmail = "";
        let userNisitId = "";
        let userProfileUrl = null;

        if (userId) {
          try {
            // ✅ แก้ไข: ใช้ /api/users/{userId} ไม่ใช่ /ku-run/api/users/
            const userUrl = `${API_BASE_URL}/api/users/${userId}`;
            console.log('Fetching user from:', userUrl);
            
            const userRes = await fetch(userUrl, { headers });
            
            if (userRes.ok) {
              const userData = await userRes.json();
              console.log('User response:', userData);
              
              // userData อาจเป็น array หรือ object
              const user = Array.isArray(userData) ? userData[0] : (userData.data || userData);
              console.log('User object:', user);
              
              // ดึงชื่อ
              const fname = user.first_name || "";
              const lname = user.last_name || "";
              
              if (fname || lname) {
                fullName = `${fname} ${lname}`.trim();
              } else if (user.username) {
                fullName = user.username;
              }

              // ดึง email และ nisit_id
              userEmail = user.email || "";
              userNisitId = user.nisit_id || "";

              console.log('✓ User info extracted:', {
                fullName,
                userEmail,
                userNisitId
              });

              // แปลง URL รูปโปรไฟล์
              if (user.profile_image_url) {
                userProfileUrl = user.profile_image_url;
                console.log('Original profile_image_url:', userProfileUrl);

                if (userProfileUrl.startsWith('http://') || userProfileUrl.startsWith('https://')) {
                  console.log('✓ Profile already full URL');
                } else if (userProfileUrl.startsWith('/api/uploads/')) {
                  userProfileUrl = `${API_BASE_URL}${userProfileUrl}`;
                  console.log('✓ Converted profile to:', userProfileUrl);
                } else if (userProfileUrl.startsWith('/uploads/')) {
                  userProfileUrl = `${API_BASE_URL}/api${userProfileUrl}`;
                  console.log('✓ Converted profile to:', userProfileUrl);
                } else if (userProfileUrl.startsWith('/')) {
                  userProfileUrl = `${API_BASE_URL}${userProfileUrl}`;
                  console.log('✓ Converted profile to:', userProfileUrl);
                } else {
                  userProfileUrl = `${API_BASE_URL}/api/uploads/${userProfileUrl}`;
                  console.log('✓ Added full path to profile:', userProfileUrl);
                }
              }
            } else {
              console.warn(`✗ Failed to fetch user: ${userRes.status}`);
            }
          } catch (e) {
            console.warn('✗ Error fetching user:', e);
          }
        }

        const mapped = {
          id: s.id,
          participationId: s.id,
          odySd: userNisitId, // ✅ ตอนนี้จะแสดง nisit_id แทน User ID
          runnerName: fullName, // ✅ ตอนนี้จะแสดงชื่อจริง
          email: userEmail,
          runnerImage: userProfileUrl,
          submitTime: s.proof_submitted_at || s.created_at,
          proofImage: proofUrl, // ✅ URL ที่แก้ไขแล้ว
          stravaLink: s.strava_link || null,
          actualDistance: s.actual_distance_km || null,
        };

        console.log('✓ Mapped submission:', mapped);
        return mapped;
      })
    );

    console.log('\n=== FINAL RESULT ===');
    console.log('✅ Total submissions:', mappedSubs.length);
    console.log('Data:', mappedSubs);

    verifyProofData.submissions = mappedSubs;

  } catch (error) {
    console.error('❌ Error:', error);
    verifyProofData.error = "Failed to load submissions";
    verifyProofData.submissions = [];
  } finally {
    verifyProofData.loading = false;
    console.log('=== END ===');
  }
}



  function onProofImageClick(proofImage: string | null) {
    if (proofImage) {
      Swal.fire({
        imageUrl: proofImage,
        imageAlt: "Proof",
        showConfirmButton: false,
        showCloseButton: false,
        allowOutsideClick: true,
        backdrop: `rgba(0,0,0,0.9)`,
        background: "transparent",
        padding: 0,
        customClass: {
          popup: "swal-clean-popup",
          image: "swal-full-image",
        },
      });
    }
  }

  function onApproveSubmission(sub: ProofSubmission) {
    const stravaInfo = sub.stravaLink
      ? `<div class="info-row"><svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="flex-shrink: 0;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg><span>Strava: <a href="${sub.stravaLink}" target="_blank" style="color: #f97316;">${sub.stravaLink}</a></span></div>`
      : "";
    const distanceInfo = sub.actualDistance
      ? `<div class="info-row"><svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="flex-shrink: 0;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path></svg><span>Distance: <b style="color: #10b981;">${sub.actualDistance} km</b></span></div>`
      : "";

    const htmlContent = `<div class="reject-container"><p class="helper-text">Are you sure you want to verify this proof?</p><div class="approve-card"><div class="ac-avatar"><span class="ac-placeholder">${sub.runnerName.charAt(0).toUpperCase()}</span></div><div class="card-content"><span class="rj-title">${sub.runnerName}</span><span class="rj-desc">Submitted: ${new Date(sub.submitTime).toLocaleString("th-TH")}</span></div></div><div class="approve-info"><div class="info-row"><svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="flex-shrink: 0;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg><span>Status changes to <b>COMPLETED</b></span></div>${stravaInfo}${distanceInfo}<div class="info-row"><svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="flex-shrink: 0;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg><span>System auto-assigns rewards</span></div></div></div>`;

    const styleContent =
      "<style>.reject-container { padding: 10px 0; text-align: left; }.helper-text { color: #94a3b8; font-size: 14px; margin-bottom: 20px; text-align: center; }.approve-card { display: flex; align-items: center; gap: 16px; background: rgba(16, 185, 129, 0.08); border: 2px solid rgba(16, 185, 129, 0.3); border-radius: 12px; padding: 16px; margin-bottom: 20px; }.ac-avatar { width: 56px; height: 56px; border-radius: 50%; overflow: hidden; flex-shrink: 0; background: linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.3)); display: flex; align-items: center; justify-content: center; border: 2px solid rgba(16, 185, 129, 0.4); }.ac-placeholder { color: #10b981; font-size: 24px; font-weight: 700; text-transform: uppercase; }.card-content { flex: 1; display: flex; flex-direction: column; gap: 6px; }.rj-title { font-size: 16px; font-weight: 600; color: #f8fafc; }.rj-desc { font-size: 13px; color: #94a3b8; }.approve-info { background: rgba(30, 41, 59, 0.6); border: 2px solid rgba(71, 85, 105, 0.3); border-radius: 12px; padding: 16px; }.info-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; color: #cbd5e1; font-size: 14px; }.info-row svg { color: #10b981; }.info-row:not(:last-child) { border-bottom: 1px solid rgba(71, 85, 105, 0.2); }.info-row b { color: #10b981; font-weight: 600; }.swal-clean-popup-reject { background: #1e293b !important; border: 1px solid rgba(71, 85, 105, 0.3) !important; border-radius: 16px !important; padding: 24px !important; }.swal2-html-container { margin: 0 !important; }.swal2-validation-message { background: rgba(239, 68, 68, 0.1) !important; border: 2px solid rgba(239, 68, 68, 0.4) !important; border-radius: 12px !important; color: #fca5a5 !important; font-size: 14px !important; font-weight: 500 !important; padding: 12px 16px !important; margin: 16px 0 0 0 !important; display: none !important; align-items: center !important; gap: 8px !important; }@keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }@keyframes fadeOut { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(-10px); } }.swal2-validation-message.show { display: flex !important; animation: slideDown 0.3s ease !important; }.swal2-validation-message.hide { animation: fadeOut 0.3s ease !important; }.swal2-validation-message::before { content: \"\"; display: inline-block; width: 20px; height: 20px; background: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23fca5a5'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'/%3E%3C/svg%3E\") no-repeat center; background-size: contain; flex-shrink: 0; }</style>";

    Swal.fire({
      title:
        '<span style="color: #10b981; font-size: 22px; font-weight: 600;">Approve Submission</span>',
      html: htmlContent + styleContent,
      showCancelButton: true,
      confirmButtonColor: "#10b981",
      cancelButtonColor: "#475569",
      confirmButtonText: '<span style="font-weight: 600;">Yes, Approve</span>',
      cancelButtonText: "Cancel",
      customClass: {
        popup: "swal-clean-popup-reject",
        confirmButton: "swal-btn-approve",
        cancelButton: "swal-btn-cancel",
      },
      width: "540px",
      preConfirm: async () => {
        try {
          const result = await verifyParticipationAPI(sub.id, true);
          return result;
        } catch (e: any) {
          const errorMessage = e.message || "Verification failed";
          Swal.showValidationMessage(errorMessage);

          const validationMsg = document.querySelector(
            ".swal2-validation-message"
          ) as HTMLElement;
          if (validationMsg) {
            validationMsg.classList.add("show");

            setTimeout(() => {
              validationMsg.classList.remove("show");
              validationMsg.classList.add("hide");
              setTimeout(() => {
                validationMsg.style.display = "none";
                validationMsg.classList.remove("hide");
              }, 300);
            }, 3000);
          }

          return false;
        }
      },
    }).then((res) => {
      if (res.isConfirmed) {
        verifyProofData.submissions = verifyProofData.submissions.filter(
          (s) => s.id !== sub.id
        );
        Swal.fire({
          title:
            '<span style="color: #10b981; font-weight: 600;">Verified!</span>',
          html: '<p style="color: #94a3b8; font-size: 14px;">Participation has been approved successfully.</p>',
          icon: "success",
          timer: 2000,
          showConfirmButton: false,
          customClass: { popup: "swal-clean-popup-reject" },
          background: "#1e293b",
          iconColor: "#10b981",
        });
      }
    });
  }
  // test.ts
  async function onRejectSubmission(sub: ProofSubmission) {
    const htmlContent =
      '<div class="reject-container"><p class="helper-text">Please select a reason for rejection:</p><label class="reject-card"><input type="radio" name="rj_reason" value="Unclear image / Unreadable" checked><div class="card-content"><div class="icon-wrapper unclear"><svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg></div><div class="text-wrapper"><span class="rj-title">Unclear Image</span><span class="rj-desc">Photo is blurry, dark, or data is unreadable.</span></div></div></label><label class="reject-card"><input type="radio" name="rj_reason" value="Incorrect distance or duration"><div class="card-content"><div class="icon-wrapper incorrect"><svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div><div class="text-wrapper"><span class="rj-title">Incorrect Data</span><span class="rj-desc">Distance or time does not match requirements.</span></div></div></label><label class="reject-card"><input type="radio" name="rj_reason" value="Duplicate submission"><div class="card-content"><div class="icon-wrapper duplicate"><svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg></div><div class="text-wrapper"><span class="rj-title">Duplicate</span><span class="rj-desc">This proof has already been submitted.</span></div></div></label><label class="reject-card"><input type="radio" name="rj_reason" value="other"><div class="card-content"><div class="icon-wrapper other"><svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg></div><div class="text-wrapper"><span class="rj-title">Other Reason</span><span class="rj-desc">Specify a custom reason below.</span></div></div></label><div id="other-input-container" class="other-box"><textarea id="other-reason-text" class="custom-textarea" placeholder="Please type the reason here..." rows="4"></textarea></div></div>';

    const styleContent =
      '<style>.reject-container { padding: 10px 0; text-align: left; }.helper-text { color: #94a3b8; font-size: 14px; margin-bottom: 16px; text-align: center; }.reject-card { display: block; background: rgba(30, 41, 59, 0.6); border: 2px solid rgba(71, 85, 105, 0.3); border-radius: 12px; padding: 14px 16px; margin-bottom: 10px; cursor: pointer; transition: all 0.2s ease; position: relative; }.reject-card:hover { background: rgba(30, 41, 59, 0.8); border-color: rgba(239, 68, 68, 0.4); transform: translateX(4px); }.reject-card input[type="radio"] { position: absolute; opacity: 0; width: 0; height: 0; }.reject-card input[type="radio"]:checked ~ .card-content { opacity: 1; }.reject-card input[type="radio"]:checked ~ .card-content .icon-wrapper { background: rgba(239, 68, 68, 0.15); border-color: #ef4444; }.reject-card input[type="radio"]:checked ~ .card-content .rj-title { color: #f87171; }.reject-card:has(input[type="radio"]:checked) { background: rgba(239, 68, 68, 0.08); border-color: #ef4444; }.card-content { display: flex; align-items: center; gap: 14px; opacity: 0.7; transition: opacity 0.2s; }.icon-wrapper { width: 42px; height: 42px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 2px solid transparent; transition: all 0.2s; }.icon-wrapper.unclear { background: rgba(251, 191, 36, 0.1); color: #fbbf24; }.icon-wrapper.incorrect { background: rgba(239, 68, 68, 0.1); color: #ef4444; }.icon-wrapper.duplicate { background: rgba(168, 85, 247, 0.1); color: #a855f7; }.icon-wrapper.other { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }.text-wrapper { flex: 1; display: flex; flex-direction: column; gap: 4px; }.rj-title { font-size: 15px; font-weight: 600; color: #f8fafc; transition: color 0.2s; }.rj-desc { font-size: 13px; color: #94a3b8; line-height: 1.4; }.other-box { max-height: 0; overflow: hidden; opacity: 0; transition: all 0.3s ease; margin-top: 0; width: 100%; box-sizing: border-box; }.other-box.visible { max-height: 200px; opacity: 1; margin-top: 12px; }.custom-textarea { width: 100%; box-sizing: border-box; background: rgba(15, 23, 42, 0.8); border: 2px solid rgba(71, 85, 105, 0.4); border-radius: 12px; padding: 12px 14px; color: #f8fafc; font-size: 14px; font-family: inherit; resize: vertical; min-height: 100px; transition: all 0.2s; }.custom-textarea:focus { outline: none; border-color: #ef4444; background: rgba(15, 23, 42, 0.95); }.custom-textarea::placeholder { color: #64748b; }.swal-clean-popup-reject { background: #1e293b !important; border: 1px solid rgba(71, 85, 105, 0.3) !important; border-radius: 16px !important; padding: 24px !important; }.swal2-html-container { margin: 0 !important; }</style>';

    const result = await Swal.fire({
      title:
        '<span style="color: #f87171; font-size: 22px; font-weight: 600;">Reject Submission</span>',
      html: htmlContent + styleContent,
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#475569",
      confirmButtonText:
        '<span style="font-weight: 600;">Confirm Reject</span>',
      cancelButtonText: "Cancel",
      customClass: {
        popup: "swal-clean-popup-reject",
        confirmButton: "swal-btn-reject",
        cancelButton: "swal-btn-cancel",
      },
      width: "540px",
      didOpen: () => {
        const radios = document.querySelectorAll('input[name="rj_reason"]');
        const otherContainer = document.getElementById("other-input-container");
        const textArea = document.getElementById(
          "other-reason-text"
        ) as HTMLTextAreaElement;

        radios.forEach((radio) => {
          radio.addEventListener("change", (e: any) => {
            if (e.target.value === "other") {
              otherContainer!.classList.add("visible");
              setTimeout(() => textArea?.focus(), 100);
            } else {
              otherContainer!.classList.remove("visible");
              textArea.value = "";
            }
          });
        });
      },
      preConfirm: () => {
        const selected = document.querySelector(
          'input[name="rj_reason"]:checked'
        ) as HTMLInputElement;
        if (!selected)
          return Swal.showValidationMessage("Please select a reason");

        let finalReason = selected.value;
        if (finalReason === "other") {
          const textVal = (
            document.getElementById("other-reason-text") as HTMLTextAreaElement
          ).value.trim();
          if (!textVal)
            return Swal.showValidationMessage("Please specify the reason.");
          finalReason = textVal;
        }

        return verifyParticipationAPI(sub.id, false, finalReason).catch(
          (error) => {
            Swal.showValidationMessage(`Error: ${error.message}`);
          }
        );
      },
    });

    if (result.value) {
      verifyProofData.submissions = verifyProofData.submissions.filter(
        (s) => s.id !== sub.id
      );
      Swal.fire({
        title:
          '<span style="color: #f87171; font-weight: 600;">Rejected!</span>',
        html: '<p style="color: #94a3b8; font-size: 14px;">The submission has been rejected successfully.</p>',
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
        customClass: { popup: "swal-clean-popup-reject" },
        background: "#1e293b",
        iconColor: "#ef4444",
      });
    }
  }

  async function verifyParticipationAPI(
    pid: number,
    approved: boolean,
    reason: string = ""
  ) {
    const payload: any = { participation_id: pid, approved };
    if (!approved) payload.rejection_reason = reason;

    try {
      console.log("🚀 Sending Payload:", payload); // เช็คว่า id ถูกไหม
      const res = await api.post("/api/participations/verify", payload);
      return res.data;
    } catch (err: any) {
      throw new Error(err.response?.data?.message || "Verification failed");
    }
  }

  function prevVerifyProofEventsPage() {
    if (verifyProofEventsPage > 1) verifyProofEventsPage--;
  }

  function nextVerifyProofEventsPage() {
    if (verifyProofEventsPage < totalVerifyProofEventsPages)
      verifyProofEventsPage++;
  }

  // Sort & Filter
  // ===== PERFORMANCE MONITOR =====
  interface PerfDataPoint {
    time: number;
    latency: number;
    status: "good" | "warning" | "bad";
  }

  let perfHistory: PerfDataPoint[] = [];
  let currentLatency = 0;
  let avgLatency = 0;
  let connectionStatus: "connected" | "slow" | "disconnected" = "connected";
  let perfInterval: any;
  let showPerfTooltip = false;
  const MAX_PERF_POINTS = 30;

  // ฟังก์ชันล้างค่า (Reset Value)
  function clearPins() {
    // 1. ล้างค่า PIN ทั้ง 5 หลัก ให้ว่างเปล่า
    pins = ["", "", "", "", ""];

    // 2. ล้างข้อความ Error (ใช้ชื่อตัวแปรตามที่คุณประกาศไว้)
    if (typeof verifyErrorMessage !== "undefined") {
      verifyErrorMessage = "";
    }

    // 3. ล้าง Index ที่ Error (กรอบสีแดง)
    if (typeof verifyErrorIndex !== "undefined") {
      verifyErrorIndex = null;
    }

    // 4. ล้างสถานะ Success (ถ้ามี)
    if (typeof lastVerifySuccess !== "undefined") {
      lastVerifySuccess = false;
    }

    // 5. สั่งให้เด้งไป Focus ช่องแรก (เฉพาะถ้าอยู่ในโหมด PIN)
    if (verifyMode === "pin" && pinInputRefs && pinInputRefs[0]) {
      setTimeout(() => {
        pinInputRefs[0]?.focus();
      }, 50);
    }
  }
  // ===== VERIFY CODE FUNCTIONS =====
  function handlePinFocus(index: number) {
    const firstEmptyIndex = pins.findIndex((p) => p === "");
    if (firstEmptyIndex !== -1 && index > firstEmptyIndex) {
      pinInputRefs[firstEmptyIndex]?.focus();
    }
  }

  function handlePinInput(index: number, event: Event) {
    if (verifyErrorMessage) verifyErrorMessage = "";
    lastVerifySuccess = false;

    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, "");
    pins[index] = value;
    input.value = value;

    if (value !== "" && verifyErrorIndex === index) {
      verifyErrorIndex = null;
    }

    if (value.length === 1) {
      const nextEmptyIndex = pins.findIndex((p, i) => i > index && p === "");
      if (nextEmptyIndex !== -1) {
        pinInputRefs[nextEmptyIndex]?.focus();
      } else if (index < 4) {
        pinInputRefs[index + 1]?.focus();
      }
    }

    if (pins.every((p) => p !== "")) {
      verifyErrorIndex = null;
      if (autoCheckIn) {
        handleVerifyPin();
      }
    }
  }

  function handlePinKeydown(index: number, event: KeyboardEvent) {
    if (verifyErrorMessage) verifyErrorMessage = "";
    if (event.key === "Backspace") {
      if (pins[index]) {
        pins[index] = "";
        verifyErrorIndex = index;
      } else if (index > 0) {
        verifyErrorIndex = index - 1;
        pinInputRefs[index - 1]?.focus();
      }
    }
    if (event.key === "Enter" && pins.every((p) => p !== "")) {
      handleVerifyPin();
    }
  }

  function triggerVerifyErrorTimeout() {
    if (verifyErrorTimeout) clearTimeout(verifyErrorTimeout);
    verifyErrorTimeout = setTimeout(() => {
      verifyErrorMessage = "";
      verifyErrorIndex = null;
    }, 3000);
  }

  async function verifyCode(code: string) {
    if (code.length !== 5) {
      verifyErrorMessage = "Please enter full 5-digit code";
      if (verifyMode === "pin") {
        const firstEmpty = pins.findIndex((p) => p === "");
        verifyErrorIndex = firstEmpty !== -1 ? firstEmpty : 4;
        pinInputRefs[verifyErrorIndex]?.focus();
      }
      triggerVerifyErrorTimeout();
      return;
    }

    isVerifying = true;
    verifyErrorMessage = "";
    verifyErrorIndex = null;
    lastVerifySuccess = false;

    try {
      const token = localStorage.getItem("access_token");
      if (!token) throw new Error("Please login again");

      const res = await api.post("/api/participations/check-in", {
        join_code: code,
      });
      const data = res.data;

      lastParticipantName =
        data.participant?.user?.first_name ||
        data.participant_name ||
        "Participants";
      lastVerifySuccess = true;

      pins = ["", "", "", "", ""];
      setTimeout(() => {
        pinInputRefs[0]?.focus();
        lastVerifySuccess = false;
      }, 2000);

      lastScannedCode = "";
    } catch (err: any) {
      verifyErrorMessage =
        err.response?.data?.message ||
        err.response?.data?.detail ||
        err.message ||
        "Invalid code or check-in failed";
      if (verifyMode === "pin") {
        verifyErrorIndex = 0;
        pins = ["", "", "", "", ""];
        pinInputRefs[0]?.focus();
      }
      triggerVerifyErrorTimeout();
    } finally {
      isVerifying = false;
    }
  }

  async function handleVerifyPin() {
    await verifyCode(pins.join(""));
  }

  async function startCamera() {
    cameraError = "";
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });

      if (videoRef) {
        videoRef.srcObject = cameraStream;
        await videoRef.play();
        scanning = true;
        startQRScanning();
      }
    } catch (err: any) {
      cameraError = "Unable to access camera. Please check permissions.";
    }
  }

  function stopCamera() {
    scanning = false;
    if (scanInterval) {
      clearInterval(scanInterval);
      scanInterval = null;
    }
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      cameraStream = null;
    }
  }

  function startQRScanning() {
    if (!canvasRef || !videoRef) return;

    const canvas = canvasRef;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    scanInterval = setInterval(async () => {
      if (!scanning || isVerifying) return;

      canvas.width = videoRef.videoWidth;
      canvas.height = videoRef.videoHeight;
      ctx.drawImage(videoRef, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // @ts-ignore

      // @ts-ignore
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code && code.data && code.data !== lastScannedCode) {
        lastScannedCode = code.data;
        const cleanCode = code.data.replace(/\D/g, "").slice(0, 5);
        if (cleanCode.length === 5) {
          await verifyCode(cleanCode);
        }
      }
    }, 300);
  }

  function switchVerifyMode(newMode: "pin" | "qr") {
    if (verifyMode === newMode) return;

    if (verifyMode === "qr") {
      stopCamera();
    }

    verifyMode = newMode;

    if (newMode === "qr") {
      setTimeout(() => startCamera(), 100);
    } else {
      setTimeout(() => pinInputRefs[0]?.focus(), 100);
    }
    // เปลี่ยนโหมด
    clearPins();
  }

  async function measureLatency(): Promise<number> {
    const start = performance.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const token = localStorage.getItem("access_token");

      await fetch(`${API_BASE_URL}/api/users/me`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return Math.round(performance.now() - start);
    } catch (e) {
      return -1;
    }
  }

  function getLatencyStatus(latency: number): "good" | "warning" | "bad" {
    if (latency < 0) return "bad";
    if (latency < 100) return "good";
    if (latency < 300) return "warning";
    return "bad";
  }

  function updateConnectionStatus() {
    const recentPoints = perfHistory.slice(-5);
    const badCount = recentPoints.filter((p) => p.status === "bad").length;
    const warningCount = recentPoints.filter(
      (p) => p.status === "warning"
    ).length;

    if (badCount >= 3) {
      connectionStatus = "disconnected";
    } else if (warningCount >= 3 || badCount >= 1) {
      connectionStatus = "slow";
    } else {
      connectionStatus = "connected";
    }
  }

  async function collectPerfData() {
    // OPTIMIZED: Skip if tab not visible
    if (!isTabVisible) return;

    const latency = await measureLatency();
    const status = getLatencyStatus(latency);

    currentLatency = latency;

    perfHistory = [
      ...perfHistory.slice(-(MAX_PERF_POINTS - 1)),
      { time: Date.now(), latency, status },
    ];

    const validPoints = perfHistory.filter((p) => p.latency >= 0);
    avgLatency =
      validPoints.length > 0
        ? Math.round(
            validPoints.reduce((sum, p) => sum + p.latency, 0) /
              validPoints.length
          )
        : 0;

    updateConnectionStatus();
  }

  function startPerfMonitor() {
    collectPerfData();
    // OPTIMIZED: Increased interval from 2s to 3s
    perfInterval = setInterval(collectPerfData, 3000);
  }

  function stopPerfMonitor() {
    if (perfInterval) {
      clearInterval(perfInterval);
    }
  }
  // ===== END PERFORMANCE MONITOR =====

  // OPTIMIZED: filteredEventsForReward with memoization
  let lastRewardEventsKey = "";
  let cachedFilteredEventsForReward: AppEvent[] = [];

  $: {
    // Only rebuild cache when in reward view and no event is selected
    if (currentView === "reward" && !rewardData.selectedEvent) {
      const cacheKey = `reward_${events.length}_${searchQueryReward}_${selectedMonthReward}_${selectedYearReward}`;
      if (cacheKey !== lastRewardEventsKey) {
        lastRewardEventsKey = cacheKey;
        cachedFilteredEventsForReward = filterEventsOptimized(
          events,
          searchQueryReward,
          selectedMonthReward,
          selectedYearReward
        );
      }
    }
  }

  $: filteredEventsForReward = cachedFilteredEventsForReward;

  $: totalRewardEventsPages = Math.ceil(
    filteredEventsForReward.length / rewardEventsPerPage
  );

  $: paginatedEventsForReward = filteredEventsForReward.slice(
    (rewardEventsPage - 1) * rewardEventsPerPage,
    rewardEventsPage * rewardEventsPerPage
  );

  $: debouncedUpdateRewardSearch(rewardData.searchQuery);

  // OPTIMIZED: Pre-compute tier order when event changes
  $: if (rewardData.selectedEvent) {
    cachedTierOrder.clear();
    cachedTierOrder.set("No Tier", 999);
    const tiers = rewardData.selectedEvent?.rewards || [];
    tiers.forEach((t, i) => cachedTierOrder.set(t.name, i));
  }

  // OPTIMIZED: filteredRewardUsers with memoization
  function getFilteredRewardUsersOptimized(): RewardUser[] {
    const users = rewardData.users;
    if (!users || users.length === 0) return [];

    const query = debouncedRewardSearch.toLowerCase().trim();

    // Filter step with early returns
    const filtered = users.filter((user) => {
      // Search filter
      if (query) {
        const matchBasic =
          user.name.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query) ||
          user.nisitId.includes(query);

        const matchYearPrefix =
          query.length === 2 &&
          /^\d{2}$/.test(query) &&
          user.nisitId.startsWith(query);

        const matchPersonalId =
          query.length >= 4 &&
          /^\d+$/.test(query) &&
          user.nisitId.slice(-6).includes(query);

        if (!matchBasic && !matchYearPrefix && !matchPersonalId) return false;
      }

      // Nisit filters
      if (nisitYearFilter && !user.nisitId.startsWith(nisitYearFilter))
        return false;
      if (nisitIdFilter && !user.nisitId.slice(-6).includes(nisitIdFilter))
        return false;

      // Tier filter
      if (rewardData.selectedTier !== "All") {
        if (rewardData.selectedTier === "No Tier" && user.tier !== "No Tier")
          return false;
        if (
          rewardData.selectedTier === "In Progress" &&
          user.status !== "in_progress"
        )
          return false;
        if (
          rewardData.selectedTier !== "No Tier" &&
          rewardData.selectedTier !== "In Progress" &&
          user.tier !== rewardData.selectedTier
        )
          return false;
      }

      // Tier rank filter
      if (
        (rewardSortBy === "tier_best" || rewardSortBy === "tier_lowest") &&
        rewardTierFilter !== "all"
      ) {
        if (rewardTierFilter === "No Tier" && user.tier !== "No Tier")
          return false;
        if (rewardTierFilter !== "No Tier" && user.tier !== rewardTierFilter)
          return false;
      }

      return true;
    });

    // Sort step - skip if not needed
    if (rewardSortBy === "all") return filtered;

    return filtered.sort((a, b) => {
      switch (rewardSortBy) {
        case "global_best":
          return a.globalRank - b.globalRank;
        case "global_lowest":
          return b.globalRank - a.globalRank;
        case "tier_best": {
          const diff =
            (cachedTierOrder.get(a.tier) ?? 998) -
            (cachedTierOrder.get(b.tier) ?? 998);
          return diff !== 0 ? diff : a.tierRank - b.tierRank;
        }
        case "tier_lowest": {
          const diff =
            (cachedTierOrder.get(b.tier) ?? 998) -
            (cachedTierOrder.get(a.tier) ?? 998);
          return diff !== 0 ? diff : b.tierRank - a.tierRank;
        }
        default:
          return 0;
      }
    });
  }

  let lastRewardUsersKey = "";
  let cachedFilteredRewardUsers: RewardUser[] = [];

  $: {
    const cacheKey = `rUsers_${rewardData.users.length}_${debouncedRewardSearch}_${rewardData.selectedTier}_${rewardSortBy}_${rewardTierFilter}_${nisitYearFilter}_${nisitIdFilter}`;
    if (cacheKey !== lastRewardUsersKey) {
      lastRewardUsersKey = cacheKey;
      cachedFilteredRewardUsers = getFilteredRewardUsersOptimized();
    }
  }

  $: filteredRewardUsers = cachedFilteredRewardUsers;

  $: totalRewardUsersPages = Math.ceil(
    filteredRewardUsers.length / rewardUsersPerPage
  );

  $: paginatedRewardUsers = filteredRewardUsers.slice(
    (rewardUsersPage - 1) * rewardUsersPerPage,
    rewardUsersPage * rewardUsersPerPage
  );

  function selectEventForReward(event: AppEvent) {
    rewardData.selectedEvent = event;
    rewardData.loading = true;
    rewardData.error = "";
    rewardData.searchQuery = "";
    rewardData.selectedTier = "All";
    rewardUsersPage = 1;

    // เริ่ม auto refresh ทันที
    rewardAutoRefreshEnabled = true;
    rewardIsConnected = true;
    newRewardUsersCount = 0;

    fetchRewardUsers(event.id);
  }

  async function fetchRewardUsers(eventId: number) {
    try {
      const token = localStorage.getItem("access_token");
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      // ✅ เพิ่ม /ku-run prefix
      const res = await fetch(
        `${API_BASE_URL}/api/participations/event/${eventId}/report`,
        { headers }
      );
      
      // ✅ เพิ่มการจัดการ 404
      if (res.status === 404) {
        console.warn("API returned 404: No participations found. (Handled as empty)");
        rewardData.users = [];
        return;
      }
      
      if (!res.ok) throw new Error("Failed to fetch participations");

      const participations = await res.json();
      const subs = Array.isArray(participations)
        ? participations
        : participations.data || [];

      // Get all participations (not just completed) for showing progress
      const allSubs = subs;

      // Get tiers from event - sort by requirement ascending (lowest first)
      const tiers = rewardData.selectedEvent?.rewards || [];
      const tiersSortedByReqAsc = [...tiers].sort((a, b) => {
        const reqA = a.requirement || a.rangeEnd || 0;
        const reqB = b.requirement || b.rangeEnd || 0;
        return reqA - reqB;
      });

      const tierColorsList = [
        "#FFD700",
        "#C0C0C0",
        "#CD7F32",
        "#8B5CF6",
        "#3B82F6",
        "#10B981",
        "#F59E0B",
        "#EC4899",
        "#06B6D4",
        "#84CC16",
      ];

      // Fetch user details and statistics for each participation
      const users: RewardUser[] = await Promise.all(
        allSubs.map(async (p: any, index: number) => {
          let userName = `User ${p.user_id}`;
          let userEmail = "";
          let userNisitId = "";
          let userAvatar = "";
          let userCompletedCount = 0;

          try {
            // ✅ เพิ่ม /ku-run prefix
            const userRes = await fetch(
              `${API_BASE_URL}/ku-run/api/users/${p.user_id}`,
              { headers }
            );
            if (userRes.ok) {
              const userData = await userRes.json();
              const user = userData.data || userData;
              userName =
                `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
                user.username ||
                userName;
              userEmail = user.email || "";
              userNisitId = user.nisit_id || user.nisitId || "";
              userAvatar = user.profile_image_url || "";
              if (userAvatar && userAvatar.startsWith("/")) {
                userAvatar = API_BASE_URL + "/ku-run/api" + userAvatar;
              } else if (
                userAvatar &&
                userAvatar.includes("/uploads/") &&
                !userAvatar.includes("/ku-run/api/uploads/")
              ) {
                userAvatar = userAvatar.replace("/uploads/", "/ku-run/api/uploads/");
              }
            }

            // ✅ เพิ่ม /ku-run prefix
            // Fetch user statistics to get total completed count
            const statsRes = await fetch(
              `${API_BASE_URL}/ku-run/api/participations/user/${p.user_id}/statistics`,
              { headers }
            );
            if (statsRes.ok) {
              const stats = await statsRes.json();
              userCompletedCount = stats.total_events_completed || 0;
            }
          } catch (e) {
            console.warn("Failed to fetch user", e);
          }

          // Determine tier based on completed count (requirement)
          const globalRank = p.completion_rank || index + 1;
          let assignedTier = "No Tier";
          let tierColor = "#64748b";
          let tierRank = 0;
          let requiredCount =
            tiersSortedByReqAsc[0]?.requirement ||
            tiersSortedByReqAsc[0]?.rangeEnd ||
            1;
          let nextTierCount = requiredCount;
          let status: "completed" | "in_progress" | "no_tier" = "no_tier";

          // Check if user meets tier requirements
          for (let i = tiersSortedByReqAsc.length - 1; i >= 0; i--) {
            const tier = tiersSortedByReqAsc[i];
            const tierReq = tier.requirement || tier.rangeEnd || 1;

            if (userCompletedCount >= tierReq) {
              assignedTier = tier.name;
              tierColor = tierColorsList[i % tierColorsList.length];
              requiredCount = tierReq;
              status = "completed";

              // Calculate tier rank (among users who got this tier)
              tierRank = globalRank;

              // Next tier requirement
              if (i < tiersSortedByReqAsc.length - 1) {
                nextTierCount =
                  tiersSortedByReqAsc[i + 1].requirement ||
                  tiersSortedByReqAsc[i + 1].rangeEnd ||
                  tierReq;
              } else {
                nextTierCount = tierReq;
              }
              break;
            }
          }

          // If no tier assigned but has completions, mark as in_progress
          if (assignedTier === "No Tier" && userCompletedCount > 0) {
            status = "in_progress";
            nextTierCount =
              tiersSortedByReqAsc[0]?.requirement ||
              tiersSortedByReqAsc[0]?.rangeEnd ||
              1;
          }

          return {
            id: `participation_${p.id}`,
            odySd: p.join_code || "",
            visitId: userNisitId,
            name: userName,
            email: userEmail,
            avatar:
              userAvatar ||
              `https://api.dicebear.com/7.x/avataaars/svg?seed=${userName}`,
            globalRank,
            tierRank,
            tier: assignedTier,
            tierColor,
            completedCount: userCompletedCount,
            requiredCount,
            nextTierCount,
            completedAt: p.completed_at || "",
            joinCode: p.join_code || "",
            status,
          };
        })
      );

      // Sort by completedCount descending, then by completedAt
      users.sort((a, b) => {
        if (b.completedCount !== a.completedCount) {
          return b.completedCount - a.completedCount;
        }
        if (a.completedAt && b.completedAt) {
          return (
            new Date(a.completedAt).getTime() -
            new Date(b.completedAt).getTime()
          );
        }
        return 0;
      });

      // Reassign globalRank based on sorted order
      users.forEach((u, i) => {
        u.globalRank = i + 1;
      });

      rewardData.users = users;
    } catch (error) {
      console.error("Error fetching reward users:", error);
      rewardData.error = "Failed to load participants";
    } finally {
      rewardData.loading = false;
    }
  }

  function decodeJWT(token: string): { exp?: number; iat?: number } | null {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return null;

      // Decode payload (ส่วนที่ 2 ของ JWT)
      const payload = parts[1];
      // แปลง base64url เป็น base64 ปกติ
      const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
      return JSON.parse(jsonPayload);
    } catch (e) {
      console.error("Failed to decode JWT:", e);
      return null;
    }
  }

  // ✅ ฟังก์ชันคำนวณเวลาที่เหลือจาก token
  function getTokenTimeLeft(): number {
    const token = localStorage.getItem("access_token");
    if (!token) return 0;

    const decoded = decodeJWT(token);
    if (!decoded || !decoded.exp) {
      console.warn("Token does not have exp claim, using default 1 hour");
      return 3600; // fallback 1 ชั่วโมง
    }

    const now = Math.floor(Date.now() / 1000); // เวลาปัจจุบันเป็น seconds
    const timeRemaining = decoded.exp - now;

    console.log(
      "🕐 Token expiry:",
      new Date(decoded.exp * 1000).toLocaleString()
    );
    console.log("🕐 Time remaining:", timeRemaining, "seconds");

    return Math.max(0, timeRemaining);
  }

  // ✅ ฟังก์ชัน initialize timer จาก token จริง
  function initializeTokenTimer() {
    const remaining = getTokenTimeLeft();
    if (remaining <= 0) {
      // Token หมดอายุแล้ว - redirect ไป login
      handleAutoLogout();
      return;
    }
    timeLeft = remaining;
    startTimer();
  }
  function generateMockRewardUsers(event: AppEvent): RewardUser[] {
    const tiers = event?.rewards || [];
    if (tiers.length === 0) return [];

    // Sort tiers by requirement DESC (Tier สูงสุดก่อน)
    const tiersSortedByReqDesc = [...tiers].sort((a, b) => {
      const reqA = a.requirement || a.rangeEnd || 0;
      const reqB = b.requirement || b.rangeEnd || 0;
      return reqB - reqA;
    });

    // สร้าง tierColors ตาม index
    const tierColorsList = [
      "#FFD700",
      "#C0C0C0",
      "#CD7F32",
      "#8B5CF6",
      "#3B82F6",
      "#10B981",
      "#F59E0B",
      "#EC4899",
      "#06B6D4",
      "#84CC16",
      "#EF4444",
      "#A855F7",
      "#14B8A6",
      "#F97316",
      "#6366F1",
      "#22D3EE",
      "#FB7185",
      "#A3E635",
      "#FBBF24",
      "#818CF8",
    ];

    const mockNames = [
      { name: "Somchai Jaidee", email: "somchai@email.com" },
      { name: "Somsri Rakdee", email: "somsri@email.com" },
      { name: "Wichai Suksant", email: "wichai@email.com" },
      { name: "Malee Ruenrom", email: "malee@email.com" },
      { name: "Prasit Deejai", email: "prasit@email.com" },
      { name: "Napat Tongdee", email: "napat@email.com" },
      { name: "Kanya Srisuk", email: "kanya@email.com" },
      { name: "Thanawat Chaiyasit", email: "thanawat@email.com" },
      { name: "Pornpan Yodkwan", email: "pornpan@email.com" },
      { name: "Surapong Raksa", email: "surapong@email.com" },
      { name: "Jintana Meesuk", email: "jintana@email.com" },
      { name: "Anong Saengthong", email: "anong@email.com" },
      { name: "Somying Sombat", email: "somying@email.com" },
      { name: "Preecha Pongpan", email: "preecha@email.com" },
      { name: "Duangjai Duangdee", email: "duangjai@email.com" },
      { name: "Narong Nakorn", email: "narong@email.com" },
      { name: "Wandee Wongsa", email: "wandee@email.com" },
      { name: "Kittichai Kittikul", email: "kittichai@email.com" },
      { name: "Orathai Ongard", email: "orathai@email.com" },
      { name: "Prayoon Pradit", email: "prayoon@email.com" },
    ];

    const lowestTierReq =
      tiersSortedByReqDesc[tiersSortedByReqDesc.length - 1]?.requirement ||
      tiersSortedByReqDesc[tiersSortedByReqDesc.length - 1]?.rangeEnd ||
      10;
    const highestTierReq =
      tiersSortedByReqDesc[0]?.requirement ||
      tiersSortedByReqDesc[0]?.rangeEnd ||
      50;

    const totalUsers = 20;
    let tempUsers: {
      name: string;
      email: string;
      completedCount: number;
      completedAt: string;
    }[] = [];

    for (let i = 0; i < totalUsers; i++) {
      const mockUser = mockNames[i % mockNames.length];
      const maxCount = highestTierReq + 20;
      const completedCount = Math.floor(Math.random() * maxCount);

      const completedAt =
        completedCount >= lowestTierReq
          ? new Date(
              Date.now() -
                Math.random() * 14 * 24 * 60 * 60 * 1000 +
                Math.random() * 1000
            ).toISOString()
          : "";

      tempUsers.push({
        name: mockUser.name,
        email: mockUser.email,
        completedCount,
        completedAt,
      });
    }

    // Sort: completedCount มากสุดก่อน
    tempUsers.sort((a, b) => {
      if (b.completedCount !== a.completedCount) {
        return b.completedCount - a.completedCount;
      }
      if (a.completedAt && b.completedAt) {
        return (
          new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()
        );
      }
      if (a.completedAt) return -1;
      if (b.completedAt) return 1;
      return 0;
    });

    // จัด Tier slots
    const tierSlots: { [tierName: string]: number } = {};
    const tierRanks: { [tierName: string]: number } = {};

    tiersSortedByReqDesc.forEach((tier) => {
      tierSlots[tier.name] = tier.quota || 10;
      tierRanks[tier.name] = 0;
    });

    const users: RewardUser[] = tempUsers.map((tempUser, index) => {
      const globalRank = index + 1;
      let assignedTier = "No Tier";
      let tierColor = "#64748b";
      let tierRank = 0;
      let requiredCount = lowestTierReq;
      let nextTierCount = lowestTierReq;
      let status: "completed" | "in_progress" | "no_tier" = "no_tier";

      // หา Tier (เริ่มจาก Tier สูงสุด)
      for (let i = 0; i < tiersSortedByReqDesc.length; i++) {
        const tier = tiersSortedByReqDesc[i];
        const tierReq = tier.requirement || tier.rangeEnd || 10;

        if (tempUser.completedCount >= tierReq && tierSlots[tier.name] > 0) {
          assignedTier = tier.name;
          // ใช้สีตาม index (รองรับหลาย Tier)
          tierColor = tierColorsList[i % tierColorsList.length];
          tierSlots[tier.name]--;
          tierRanks[tier.name]++;
          tierRank = tierRanks[tier.name];
          requiredCount = tierReq;
          status = "completed";

          if (i > 0) {
            nextTierCount =
              tiersSortedByReqDesc[i - 1].requirement ||
              tiersSortedByReqDesc[i - 1].rangeEnd ||
              tierReq;
          } else {
            nextTierCount = tierReq;
          }
          break;
        }
      }

      if (assignedTier === "No Tier" && tempUser.completedCount > 0) {
        status = "in_progress";
      }

      const yearPrefix = 67 + (globalRank % 4); // 67, 68, 69, 70
      const facultyCode = "30"; // คณะวิศวกรรมศาสตร์
      const personalId = String(
        200000 + globalRank * 17 + Math.floor(Math.random() * 100)
      )
        .padStart(6, "0")
        .slice(0, 6);
      const nisitId = `${yearPrefix}${facultyCode}${personalId}`;

      return {
        id: `user_${globalRank}`,
        odySd: `OD${String(globalRank).padStart(4, "0")}`,
        nisitId,
        name: tempUser.name,
        email: tempUser.email,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${tempUser.name}${globalRank}`,
        globalRank,
        tierRank,
        tier: assignedTier,
        tierColor,
        completedCount: tempUser.completedCount,
        requiredCount,
        nextTierCount,
        completedAt: tempUser.completedAt,
        joinCode: `EVT-${String(globalRank).padStart(3, "0")}`,
        status,
      };
    });

    return users;
  }

  function nextRewardEventsPage() {
    if (rewardEventsPage < totalRewardEventsPages) {
      rewardEventsPage += 1;
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function prevRewardEventsPage() {
    if (rewardEventsPage > 1) {
      rewardEventsPage -= 1;
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function jumpToRewardEventsPage(page: number) {
    rewardEventsPage = page;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function nextRewardUsersPage() {
    if (rewardUsersPage < totalRewardUsersPages) {
      rewardUsersPage += 1;
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function prevRewardUsersPage() {
    if (rewardUsersPage > 1) {
      rewardUsersPage -= 1;
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function jumpToRewardUsersPage(page: number) {
    rewardUsersPage = page;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openMessageModal(user: RewardUser) {
    selectedUserForMessage = user;
    messageText = "";
    showMessageModal = true;
  }

  function closeMessageModal() {
    showMessageModal = false;
    selectedUserForMessage = null;
    messageText = "";
  }

  async function sendMessage() {
    if (!messageText.trim() || !selectedUserForMessage) return;

    try {
      // ส่ง notification ไปยัง user ผ่าน API
      // ใช้ send-pending endpoint ตาม API spec
      await api.post("/api/notifications/send-pending", null, {
        params: { limit: 50 },
      });

      Swal.fire({
        title: lang.notificationSent,
        text:
          currentLang === "th"
            ? `ส่งการแจ้งเตือนถึง ${selectedUserForMessage.name} สำเร็จ`
            : `Notification sent to ${selectedUserForMessage.name}`,
        icon: "success",
        background: "#1e293b",
        color: "#fff",
        confirmButtonColor: "#10b981",
        timer: 2000,
        showConfirmButton: false,
      });

      closeMessageModal();
    } catch (error: any) {
      console.error("Error sending notification:", error);
      Swal.fire({
        title: lang.error,
        text:
          error.response?.data?.detail ||
          error.message ||
          (currentLang === "th"
            ? "ไม่สามารถส่งการแจ้งเตือนได้"
            : "Failed to send notification"),
        icon: "error",
        background: "#1e293b",
        color: "#fff",
        confirmButtonColor: "#ef4444",
      });
    }
  }

  function resetRewardState() {
    rewardData.selectedEvent = null;
    rewardData.users = [];
    rewardData.loading = false;
    rewardData.error = "";
    rewardData.searchQuery = "";
    rewardData.selectedTier = "All";
    rewardEventsPage = 1;
    rewardUsersPage = 1;
    rewardSortBy = "all";
    rewardTierFilter = "all";
    rewardSortDropdownOpen = false;
    rewardTierFilterDropdownOpen = false;
    newRewardUsersCount = 0;
    rewardAutoRefreshEnabled = false;
    rewardIsConnected = false;
    searchQueryReward = "";
    selectedMonthReward = "All";
    selectedYearReward = "All";
  }

  function applyRewardFilters() {
    // Reset status card selection เมื่อใช้ filter
    rewardData.selectedTier = "All";
    rewardUsersPage = 1;
  }

  function resetRewardFilters() {
    rewardData.searchQuery = "";
    rewardData.selectedTier = "All";
    rewardTierDropdownOpen = false;
    rewardSortBy = "all";
    rewardSortDropdownOpen = false;
    rewardTierFilter = "all";
    rewardTierFilterDropdownOpen = false;
    nisitYearFilter = "";
    nisitIdFilter = "";
    rewardUsersPage = 1;
  }

  $: if (currentView === "reward") {
    // Reset filters เมื่อเข้าหน้า reward
    if (rewardData.selectedEvent === null) {
      searchQueryReward = "";
      selectedMonthReward = "All";
      selectedYearReward = "All";
      rewardEventsPage = 1;
    }
  }

  // Reset reward events page when filters change
  $: if (searchQueryReward || selectedMonthReward || selectedYearReward) {
    rewardEventsPage = 1;
  }

  let rewardEventsPage = 1;
  const rewardEventsPerPage = 8;
  let showRewardEventsPageDropdown = false;
  let showRewardUsersPageDropdown = false;
  let rewardUsersPage = 1;
  const rewardUsersPerPage = 8;
  let rewardTierDropdownOpen = false;
  let showMessageModal = false;
  let selectedUserForMessage: RewardUser | null = null;
  let messageText = "";
  // Send to All Modal
  let showSendAllModal = false;
  let sendAllTargetTier: string = "All";
  let sendAllMessageTemplate = "";
  let sendAllUseTemplate = false;

  // Sort & Filter
  let rewardSortBy:
    | "all"
    | "global_best"
    | "global_lowest"
    | "tier_best"
    | "tier_lowest" = "all";
  let rewardSortDropdownOpen = false;
  let rewardTierFilter: string = "all";
  let rewardTierFilterDropdownOpen = false;

  // Nisit ID Filter
  let nisitYearFilter: string = ""; // เลขหน้า (ปี) เช่น 67, 68
  let nisitIdFilter: string = "";

  function refreshRewardUsers() {
    newRewardUsersCount = 0;
    if (rewardData.selectedEvent) {
      rewardData.loading = true;
      fetchRewardUsers(rewardData.selectedEvent.id);
    }
  }

  function openSendAllModal() {
    showSendAllModal = true;
    sendAllTargetTier = "All";
    sendAllMessageTemplate = "";
    sendAllUseTemplate = false;
  }

  function closeSendAllModal() {
    showSendAllModal = false;
    sendAllTargetTier = "All";
    sendAllMessageTemplate = "";
    sendAllUseTemplate = false;
  }

  function getTargetUsers(): RewardUser[] {
    if (sendAllTargetTier === "All") {
      return rewardData.users;
    } else if (sendAllTargetTier === "In Progress") {
      return rewardData.users.filter((u) => u.status === "in_progress");
    } else if (sendAllTargetTier === "No Tier") {
      return rewardData.users.filter((u) => u.tier === "No Tier");
    } else {
      return rewardData.users.filter((u) => u.tier === sendAllTargetTier);
    }
  }

  function generateMessageForUser(user: RewardUser, template: string): string {
    const sortedTiers = [...(rewardData.selectedEvent?.rewards || [])].sort(
      (a, b) => {
        const reqA = a.requirement || a.rangeEnd || 0;
        const reqB = b.requirement || b.rangeEnd || 0;
        return reqB - reqA;
      }
    );
    const tierIdx = sortedTiers.findIndex((t) => t.name === user.tier);
    const tierInfo = getTierDisplayName(
      user.tier,
      tierIdx >= 0 ? tierIdx : 999
    );

    return template
      .replace(/\{name\}/g, user.name)
      .replace(/\{email\}/g, user.email)
      .replace(/\{globalRank\}/g, String(user.globalRank))
      .replace(/\{tierRank\}/g, String(user.tierRank))
      .replace(/\{tier\}/g, tierInfo.name)
      .replace(/\{event\}/g, rewardData.selectedEvent?.title || "");
  }

  async function sendAllMessages() {
    const targetUsers = getTargetUsers();
    if (targetUsers.length === 0 || !sendAllMessageTemplate.trim()) return;

    try {
      const token = localStorage.getItem("access_token");
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      let successCount = 0;
      let failCount = 0;

      // ส่งข้อความทีละคน
      for (const user of targetUsers) {
        const message = sendAllUseTemplate
          ? generateMessageForUser(user, sendAllMessageTemplate)
          : sendAllMessageTemplate;

        try {
          // ✅ เพิ่ม /ku-run prefix
          const res = await fetch(`${API_BASE_URL}/ku-run/api/notifications/`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              user_id: parseInt(
                user.id.replace("participation_", "").replace("user_", "")
              ),
              title: `รางวัลจากกิจกรรม ${rewardData.selectedEvent?.title || ""}`,
              message: message,
              type: "reward",
              event_id: rewardData.selectedEvent?.id,
            }),
          });

          if (res.ok) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (e) {
          failCount++;
        }
      }

      Swal.fire({
        title: "Messages Sent!",
        html: `<p style="color: #94a3b8;">Sent: <span style="color: #10b981;">${successCount}</span> / Failed: <span style="color: #ef4444;">${failCount}</span></p>`,
        icon: successCount > 0 ? "success" : "error",
        background: "#1e293b",
        color: "#fff",
        confirmButtonColor: "#10b981",
      });

      closeSendAllModal();
    } catch (error: any) {
      console.error("Error sending messages:", error);
      Swal.fire({
        title: "Error",
        text: error.message || "Failed to send messages",
        icon: "error",
        background: "#1e293b",
        color: "#fff",
        confirmButtonColor: "#ef4444",
      });
    }
  }

  function getTierDisplayName(
    tierName: string,
    index: number
  ): { name: string; color: string } {
    // รองรับ 20 Tier - เรียงจากสูงสุดไปต่ำสุด
    const tierStyles = [
      { name: "Champion", color: "#FFD700" }, // 1. ทอง
      { name: "Elite", color: "#C0C0C0" }, // 2. เงิน
      { name: "Challenger", color: "#CD7F32" }, // 3. ทองแดง
      { name: "Rising Star", color: "#8B5CF6" }, // 4. ม่วง
      { name: "Adventurer", color: "#3B82F6" }, // 5. น้ำเงิน
      { name: "Explorer", color: "#10B981" }, // 6. เขียว
      { name: "Pioneer", color: "#F59E0B" }, // 7. ส้ม
      { name: "Voyager", color: "#EC4899" }, // 8. ชมพู
      { name: "Seeker", color: "#06B6D4" }, // 9. ฟ้า
      { name: "Pathfinder", color: "#84CC16" }, // 10. เขียวอ่อน
      { name: "Trailblazer", color: "#EF4444" }, // 11. แดง
      { name: "Wanderer", color: "#A855F7" }, // 12. ม่วงอ่อน
      { name: "Nomad", color: "#14B8A6" }, // 13. เขียวเข้ม
      { name: "Ranger", color: "#F97316" }, // 14. ส้มเข้ม
      { name: "Scout", color: "#6366F1" }, // 15. indigo
      { name: "Recruit", color: "#22D3EE" }, // 16. cyan
      { name: "Apprentice", color: "#FB7185" }, // 17. rose
      { name: "Initiate", color: "#A3E635" }, // 18. lime
      { name: "Beginner", color: "#FBBF24" }, // 19. amber
      { name: "Starter", color: "#818CF8" }, // 20. violet
    ];

    if (tierName === "No Tier") {
      return { name: "Newcomer", color: "#64748b" };
    }

    if (index >= 0 && index < tierStyles.length) {
      return tierStyles[index];
    }

    // ถ้าเกิน 20 Tier ให้วนสีใหม่
    const loopIndex = index % tierStyles.length;
    return {
      name: `Tier ${index + 1}`,
      color: tierStyles[loopIndex].color,
    };
  }

  function getTierIcon(icon: string): string {
    const icons: { [key: string]: string } = {
      crown: `<path stroke-linecap="round" stroke-linejoin="round" d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"></path>`,
      star: `<path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path>`,
      medal: `<path stroke-linecap="round" stroke-linejoin="round" d="M12 15a7 7 0 100-14 7 7 0 000 14zm0 0v6m-4-3h8"></path>`,
      bolt: `<path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"></path>`,
      clock: `<path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>`,
      flag: `<path stroke-linecap="round" stroke-linejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"></path>`,
      compass: `<path stroke-linecap="round" stroke-linejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>`,
      award: `<path stroke-linecap="round" stroke-linejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V6a2 2 0 10-2 2h2zm0 0h4l-4 4-4-4h4z"></path>`,
    };
    return icons[icon] || icons.award;
  }

  // Reset เมื่อออกจากหน้า reward detail
  function backToRewardEventsList() {
    rewardData.selectedEvent = null;
    rewardData.users = [];
    rewardData.searchQuery = "";
    rewardData.selectedTier = "All";
    rewardEventsPage = 1;
    rewardSortBy = "all";
    // Reset auto refresh
    newRewardUsersCount = 0;
    rewardAutoRefreshEnabled = false;
    rewardIsConnected = false;
    // Force rebuild cache
    lastRewardEventsKey = "";
  }
  function toggleRewardExportMenu() {
    showRewardExportMenu = !showRewardExportMenu;
  }
  function closeAllLogsDropdowns() {
    logsData.actionDropdownOpen = false;
    logsData.dateFromDropdownOpen = false;
    logsData.dateToDropdownOpen = false;
  }

  /**
   * toggleRewardAutoRefresh - สลับสถานะ auto refresh สำหรับ rewards
   */
  function toggleRewardAutoRefresh() {
    rewardAutoRefreshEnabled = !rewardAutoRefreshEnabled;
    rewardIsConnected = rewardAutoRefreshEnabled;
  }

  /**
   * processImageUrl - แปลง URL รูปภาพให้ถูกต้อง
   * @param raw - URL รูปภาพดิบจาก API
   * @param title - ชื่อ event (สำหรับ debug log)
   * @returns string - URL รูปภาพที่พร้อมใช้งาน
   *
   * รองรับ formats:
   * - Base64 data URL
   * - Full HTTP URL
   * - Relative path (/uploads/, /api/uploads/)
   */
  function processImageUrl(
    raw: string | null | undefined,
    title?: string
  ): string {
    if (!raw || raw === "string" || raw === "null") {
      return "";
    }

    let imgUrl = "";

    if (raw.startsWith("data:")) {
      // Base64 - ใช้เลย
      return raw;
    }

    if (raw.startsWith("http")) {
      // Full URL
      if (raw.includes("/api/uploads/")) {
        imgUrl = raw;
      } else if (raw.includes("/uploads/")) {
        imgUrl = raw.replace("/uploads/", "/api/uploads/");
      } else {
        imgUrl = raw;
      }
    } else if (raw.startsWith("/uploads/")) {
      imgUrl = `${API_BASE_URL}/api${raw}`;
    } else if (raw.startsWith("/api/uploads/")) {
      imgUrl = `${API_BASE_URL}${raw}`;
    } else {
      imgUrl = `${API_BASE_URL}${raw}`;
    }

    if (title) {
      console.log(`📷 Image for "${title}":`, { raw, final: imgUrl });
    }
    return imgUrl;
  }

  /**
   * fetchEvents - ดึงข้อมูล events ทั้งหมดจาก API
   *
   * การทำงาน:
   * 1. ตรวจสอบ token
   * 2. เรียก API /api/events/
   * 3. ดึง holidays data
   * 4. Map response เป็น AppEvent interface
   * 5. ดึง pending counts สำหรับแต่ละ event
   */
  async function fetchEvents() {
    const token = localStorage.getItem("access_token");

    if (!token) {
      console.error("No token found, redirecting to login");
      window.location.href = `/ku-run/auth/login`;
      return;
    }
    try {
      const res = await api.get("/api/events/");
      const data = res.data;

      console.log("📥 Fetched events from API:", data);
      console.log(
        "📷 Raw banner URLs:",
        data.map((item: any) => item.banner_image_url)
      );

      // ✅ ใช้ allHolidaysData ที่โหลดไว้แล้วจาก onMount แทน
      const holidaysData = allHolidaysData || [];
      
      // แปลงข้อมูลจาก API ให้ตรงกับ AppEvent interface
      events = data.map((item: any) => {
        // หา holidays ของ event นี้
        const eventHolidays = holidaysData.find(
          (h: any) => h.eventId === item.id
        );

        // ... rest of your mapping code (เหมือนเดิม)
        const startDate = new Date(item.event_date);
        const endDate = new Date(item.event_end_date);
        const isPublished = item.is_published === true;
        const isActive = item.is_active === true;
        const imageUrl = processImageUrl(item.banner_image_url, item.title);

        return {
          id: item.id,
          title: item.title,
          description: item.description,
          location: item.location,
          day: startDate.getUTCDate().toString(),
          month: ce_months[startDate.getUTCMonth()],
          year: startDate.getUTCFullYear().toString(),
          endDay: endDate.getUTCDate().toString(),
          endMonth: ce_months[endDate.getUTCMonth()],
          endYear: endDate.getUTCFullYear().toString(),
          startTime: startDate.toISOString().split("T")[1].slice(0, 5),
          endTime: endDate.toISOString().split("T")[1].slice(0, 5),
          startDate: {
            day: startDate.getUTCDate().toString(),
            month: ce_months[startDate.getUTCMonth()],
            year: startDate.getUTCFullYear().toString(),
          },
          endDate: {
            day: endDate.getUTCDate().toString(),
            month: ce_months[endDate.getUTCMonth()],
            year: endDate.getUTCFullYear().toString(),
          },
          image: imageUrl,
          slots: item.max_participants,
          totalSlots: item.max_participants,
          usedSlots: item.participant_count || 0,
          registered: item.participant_count || 0,
          distanceKm: item.distance_km || 0,
          is_published: isPublished,
          is_active: isActive,
          isPublic: isPublished,
          isActive: isActive,
          status: isActive ? "Active" : "Inactive",
          rewards: eventHolidays?.rewards || [],
          holidays: eventHolidays?.holidays || [],
          excludeWeekends: eventHolidays?.excludeWeekends || false,
        };
      });

      console.log("✅ Events loaded:", events.length);
      console.log(
        "📊 Events with status:",
        events.map((e) => ({
          title: e.title,
          isPublic: e.isPublic,
          isActive: e.isActive,
        }))
      );
      console.log(
        "Event images:",
        events.map((e) => ({ title: e.title, image: e.image }))
      );

      events = [...events];
      fetchPendingCountsForEvents();
    } catch (err: any) {
      console.error("Error fetching events:", err?.message || err);
    }
  }

  // ฟังก์ชันดึงจำนวน pending submissions สำหรับแต่ละ event
  async function fetchPendingCountsForEvents() {
    const token = localStorage.getItem("access_token");
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    for (const event of events) {
      try {
        // ✅ เพิ่ม /ku-run prefix
        const res = await fetch(
          `${API_BASE_URL}/api/participations/event/${event.id}/report`,
          { headers }
        );
        
        if (res.status === 404) {
          // ถ้าไม่มีข้อมูล ให้ set pending count = 0
          const eventIndex = events.findIndex((e) => e.id === event.id);
          if (eventIndex !== -1) {
            events[eventIndex].pendingCount = 0;
          }
          continue;
        }
        
        if (res.ok) {
          const data = await res.json();
          const subs = Array.isArray(data) ? data : data.data || [];
          const pendingCount = subs.filter(
            (s: any) => s.status === "proof_submitted"
          ).length;

          // Update event with pending count
          const eventIndex = events.findIndex((e) => e.id === event.id);
          if (eventIndex !== -1) {
            events[eventIndex].pendingCount = pendingCount;
          }
        }
      } catch (err) {
        console.warn(
          `Failed to fetch pending count for event ${event.id}:`,
          err
        );
      }
    }

    // Force reactivity update
    events = [...events];
  }

  // ฟังก์ชันแปลงวันที่ (รับค่า lang มาด้วย เพื่อให้รู้ว่าต้องเปลี่ยนภาษา)
  const formatDate = (dateString: string, lang: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString(lang === "th" ? "th-TH" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

 

  // ฟังก์ชันแปลงสถานะ (แก้ไขจาก translateStatus เดิมที่มีอยู่ หรือสร้างใหม่)
  const getStatusLabel = (status: string, langData: any) => {
     // ใช้ข้อมูลจากตัวแปร lang ที่ส่งเข้ามา
     if (status === 'Active') return langData.active || 'Active';
     if (status === 'Draft') return langData.draft || 'Draft';
     if (status === 'Closed') return langData.closed || 'Closed';
     return status;
  };

  // ฟังก์ชันช่วยแปลงวันที่จาก ISO เป็น Object
  function parseDate(isoString: string) {
    const d = new Date(isoString);
    return {
      day: d.getDate().toString(),
      month: (d.getMonth() + 1).toString(),
      year: d.getFullYear().toString(),
    };
  }

  // ฟังก์ชันดึงวันหยุดจากไฟล์ JSON มาเก็บไว้
  // ฟังก์ชันดึงวันหยุดจากไฟล์ JSON มาเก็บไว้
async function fetchHolidaysFromFile() {
  try {
    const res = await fetch("/ku-run/internal/holidays");
    
    // ถ้าไม่เจอไฟล์ (404) ให้ใช้ array ว่าง
    if (res.status === 404) {
      console.log('📝 Holidays file not found, using empty array');
      allHolidaysData = [];
      return;
    }
    
    // ถ้า server error (500) ให้ใช้ array ว่าง
    if (!res.ok) {
      console.warn('⚠️ Server error loading holidays, using empty array');
      allHolidaysData = [];
      return;
    }

    const text = await res.text();
    if (!text) {
      allHolidaysData = [];
      return;
    }

    allHolidaysData = JSON.parse(text);
    console.log(`✅ Loaded ${allHolidaysData.length} holidays`);
    
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    console.log('⚠️ Could not load holidays:', errorMessage);
    allHolidaysData = [];
  }
}

  onMount(() => {
  // ✅ ส่วน async ใส่ใน IIFE (Immediately Invoked Function Expression)
  (async () => {
    try {
      // โหลด holidays ก่อน
      await fetchHolidaysFromFile();
      console.log(`✅ Loaded ${allHolidaysData?.length || 0} holidays`);
      
      // แล้วค่อยโหลด events
      await fetchEvents();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ OnMount error:', errorMessage);
    }
  })();

  // ✅ Event listener cleanup อยู่นอก async
  const handleClickOutside = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (
      !target.closest(".filter-dropdown-logs") &&
      !target.closest(".custom-date-dropdown-logs")
    ) {
      closeAllLogsDropdowns();
    }
  };

  document.addEventListener("click", handleClickOutside);

  // ✅ Return cleanup function ตามปกติ
  return () => {
    document.removeEventListener("click", handleClickOutside);
  };
});

  async function exportRewards(format: string) {
    isRewardExporting = true;
    showRewardExportMenu = false;

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const allRewardUsers = filteredRewardUsers;

      if (format === "csv") {
        exportRewardsToCSV(allRewardUsers);
      } else if (format === "json") {
        exportRewardsToJSON(allRewardUsers);
      } else if (format === "pdf") {
        exportRewardsToPDF(allRewardUsers);
      } else if (format === "excel") {
        await exportRewardsToExcel(allRewardUsers);
      } else if (format === "report-png") {
        await exportRewardsReportDirect("png");
      } else if (format === "report-pdf") {
        await exportRewardsReportDirect("pdf");
      }

      Swal.fire({
        title: "Export Successful!",
        text: `Rewards exported as ${format.toUpperCase()}`,
        icon: "success",
        background: "#1e293b",
        color: "#fff",
        confirmButtonColor: "#10b981",
        timer: 2000,
      });
    } catch (error) {
      Swal.fire({
        title: "Export Failed",
        text: "Failed to export rewards. Please try again.",
        icon: "error",
        background: "#1e293b",
        color: "#fff",
        confirmButtonColor: "#ef4444",
      });
    } finally {
      isRewardExporting = false;
    }
  }

  async function exportRewardsReportDirect(format: string) {
    if (!rewardData.selectedEvent) return;

    const event = rewardData.selectedEvent;
    const users = rewardData.users;

    const sortedTiers = [...(event.rewards || [])].sort((a, b) => {
      const reqA = a.requirement || a.rangeEnd || 0;
      const reqB = b.requirement || b.rangeEnd || 0;
      return reqB - reqA;
    });

    const totalUsers = users.length;
    const completedUsers = users.filter((u) => u.status === "completed").length;
    const inProgressUsers = users.filter(
      (u) => u.status === "in_progress"
    ).length;
    const noTierUsers = users.filter((u) => u.tier === "No Tier").length;
    const completionRate =
      totalUsers > 0 ? ((completedUsers / totalUsers) * 100).toFixed(1) : "0";
    const totalQuota = sortedTiers.reduce((sum, t) => sum + (t.quota || 0), 0);
    const fillRate =
      totalQuota > 0
        ? (((totalUsers - noTierUsers) / totalQuota) * 100).toFixed(1)
        : "0";

    const tierStats = sortedTiers.map((tier, index) => {
      const tierInfo = getTierDisplayName(tier.name, index);
      const usersInTier = users.filter((u) => u.tier === tier.name);
      const totalPoints = usersInTier.reduce(
        (sum, u) => sum + u.completedCount,
        0
      );
      return {
        name: tierInfo.name,
        color: tierInfo.color,
        count: usersInTier.length,
        quota: tier.quota || 0,
        fillRate:
          (tier.quota || 0) > 0
            ? ((usersInTier.length / (tier.quota || 1)) * 100).toFixed(1)
            : "0",
        avgPoints:
          usersInTier.length > 0
            ? Math.round(totalPoints / usersInTier.length)
            : 0,
        minPoints:
          usersInTier.length > 0
            ? Math.min(...usersInTier.map((u) => u.completedCount))
            : 0,
        maxPoints:
          usersInTier.length > 0
            ? Math.max(...usersInTier.map((u) => u.completedCount))
            : 0,
      };
    });

    const topPerformers = [...users]
      .sort((a, b) => a.globalRank - b.globalRank)
      .slice(0, 10)
      .map((user) => {
        const tierIdx = sortedTiers.findIndex((t) => t.name === user.tier);
        const tierInfo = getTierDisplayName(
          user.tier,
          tierIdx >= 0 ? tierIdx : 999
        );
        return {
          ...user,
          tierDisplayName: tierInfo.name,
          tierColor: tierInfo.color,
        };
      });

    // Status Data for Pie Chart
    const statusData = [
      { label: "Completed", value: completedUsers, color: "#10b981" },
      { label: "In Progress", value: inProgressUsers, color: "#f59e0b" },
      { label: "No Tier", value: noTierUsers, color: "#64748b" },
    ];

    // Quota Fill Rate Data for Doughnut
    const quotaFillData = [
      { label: "Filled", value: totalUsers - noTierUsers, color: "#10b981" },
      {
        label: "Remaining",
        value: Math.max(0, totalQuota - (totalUsers - noTierUsers)),
        color: "#e2e8f0",
      },
    ];

    // Points Distribution Data
    const pointsRanges = [
      { label: "0-25%", min: 0, max: 25, color: "#ef4444" },
      { label: "26-50%", min: 26, max: 50, color: "#f59e0b" },
      { label: "51-75%", min: 51, max: 75, color: "#3b82f6" },
      { label: "76-100%", min: 76, max: 100, color: "#10b981" },
    ];
    const maxPoints = Math.max(...users.map((u) => u.completedCount), 1);
    const pointsDistribution = pointsRanges.map((range) => {
      const count = users.filter((u) => {
        const percent = (u.completedCount / maxPoints) * 100;
        return percent >= range.min && percent <= range.max;
      }).length;
      return { label: range.label, value: count, color: range.color };
    });

    // LINE CHART DATA - Top 10 Performance Trend
    const top10ForLine = [...users]
      .sort((a, b) => a.globalRank - b.globalRank)
      .slice(0, 10);
    const performanceTrendData = {
      labels: top10ForLine.map((u, i) => `#${i + 1}`),
      points: top10ForLine.map((u) => u.completedCount),
      required: top10ForLine.map((u) => u.requiredCount),
    };

    // LINE CHART DATA - Tier Progress (Cumulative)
    const tierProgressData = {
      labels: [...tierStats].reverse().map((t) => t.name),
      cumulative: [...tierStats].reverse().reduce((acc: number[], t, i) => {
        acc.push((acc[i - 1] || 0) + t.count);
        return acc;
      }, []),
      quota: [...tierStats].reverse().reduce((acc: number[], t, i) => {
        acc.push((acc[i - 1] || 0) + t.quota);
        return acc;
      }, []),
    };

    // LINE CHART DATA - Points Range Analysis
    const sortedByPoints = [...users].sort(
      (a, b) => b.completedCount - a.completedCount
    );
    const pointsLineData = {
      labels: sortedByPoints.slice(0, 15).map((_, i) => `${i + 1}`),
      points: sortedByPoints.slice(0, 15).map((u) => u.completedCount),
    };

    let tierRowsHTML = "";
    tierStats.forEach((tier, idx) => {
      tierRowsHTML +=
        "<tr><td>" +
        (idx + 1) +
        '</td><td><span style="border-left:4px solid ' +
        tier.color +
        ';padding-left:8px">' +
        tier.name +
        "</span></td>";
      tierRowsHTML +=
        '<td class="text-right">' +
        tier.count +
        '</td><td class="text-right">' +
        tier.quota +
        '</td><td class="text-right">' +
        tier.fillRate +
        "%</td>";
      tierRowsHTML +=
        '<td class="text-right">' +
        tier.avgPoints +
        '</td><td class="text-right">' +
        tier.minPoints +
        " - " +
        tier.maxPoints +
        "</td></tr>";
    });

    let topRowsHTML = "";
    topPerformers.forEach((user) => {
      topRowsHTML +=
        '<tr><td class="text-center">' +
        user.globalRank +
        "</td><td>" +
        user.name +
        "</td><td>" +
        user.email +
        "</td>";
      topRowsHTML +=
        '<td><span style="border-left:4px solid ' +
        user.tierColor +
        ';padding-left:8px">' +
        user.tierDisplayName +
        "</span></td>";
      topRowsHTML +=
        '<td class="text-center">' +
        user.tierRank +
        '</td><td class="text-right">' +
        user.completedCount +
        "</td></tr>";
    });

    const eventDateRange = formatDateRange(event);
    const generatedDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const generatedTime = new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const fileName =
      "reward-report-" +
      event.title.replace(/\s+/g, "-").toLowerCase() +
      "-" +
      new Date().toISOString().split("T")[0];

    const css =
      "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');:root{--primary:#0f766e;--primary-light:#14b8a6;--secondary:#1e293b;--bg:#fff;--bg-alt:#f8fafc;--border:#e2e8f0;--text:#1e293b;--text-muted:#64748b}*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--text);line-height:1.6;font-size:14px}.container{max-width:1100px;margin:0 auto;padding:40px}.report-header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:24px;border-bottom:2px solid var(--primary);margin-bottom:32px}.brand{display:flex;align-items:center;gap:12px}.brand-logo{width:48px;height:48px;background:linear-gradient(135deg,var(--primary),var(--primary-light));border-radius:10px;display:flex;align-items:center;justify-content:center}.brand-logo svg{width:28px;height:28px;color:white}.brand-text h1{font-size:20px;font-weight:700;color:var(--primary)}.brand-text p{font-size:12px;color:var(--text-muted)}.report-meta{text-align:right}.report-meta h2{font-size:14px;font-weight:600}.report-meta p{font-size:12px;color:var(--text-muted)}.event-title{background:var(--bg-alt);border:1px solid var(--border);border-radius:12px;padding:24px;margin-bottom:32px}.event-title h3{font-size:24px;font-weight:700;color:var(--secondary);margin-bottom:8px}.event-info{display:flex;flex-wrap:wrap;gap:24px;color:var(--text-muted);font-size:13px}.section{margin-bottom:32px}.section-title{font-size:16px;font-weight:600;color:var(--secondary);margin-bottom:16px}.stats-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:16px}.stat-card{background:var(--bg-alt);border:1px solid var(--border);border-radius:12px;padding:20px;text-align:center}.stat-card.highlight{background:linear-gradient(135deg,var(--primary),var(--primary-light));border:none;color:white}.stat-card.highlight .stat-label{color:rgba(255,255,255,0.8)}.stat-value{font-size:28px;font-weight:700;margin-bottom:4px}.stat-label{font-size:12px;color:var(--text-muted);text-transform:uppercase}.charts-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}.charts-grid-2{display:grid;grid-template-columns:repeat(2,1fr);gap:24px;margin-top:24px}.chart-card{background:var(--bg-alt);border:1px solid var(--border);border-radius:12px;padding:20px}.chart-card.full-width{grid-column:span 2}.chart-title{font-size:14px;font-weight:600;color:var(--secondary);margin-bottom:16px}.chart-container{height:220px;position:relative}.chart-container.tall{height:280px}.table-wrapper{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:12px;text-align:left;border-bottom:1px solid var(--border)}th{background:var(--bg-alt);font-weight:600;color:var(--secondary)}.text-center{text-align:center}.text-right{text-align:right}.report-footer{margin-top:40px;padding-top:20px;border-top:1px solid var(--border);display:flex;justify-content:space-between;font-size:12px;color:var(--text-muted)}";

    const chartJs = `
      const tierData=${JSON.stringify(tierStats)};
      const statusData=${JSON.stringify(statusData)};
      const quotaFillData=${JSON.stringify(quotaFillData)};
      const pointsDistribution=${JSON.stringify(pointsDistribution)};
      const topData=${JSON.stringify(topPerformers.slice(0, 5).map((u) => ({ name: u.name, points: u.completedCount, color: u.tierColor })))};
      const performanceTrendData=${JSON.stringify(performanceTrendData)};
      const tierProgressData=${JSON.stringify(tierProgressData)};
      const pointsLineData=${JSON.stringify(pointsLineData)};
      
      Chart.defaults.font.family="'Inter',sans-serif";
      
      // 1. Tier Distribution - Doughnut
      new Chart(document.getElementById('tierPieChart'),{
        type:'doughnut',
        data:{
          labels:tierData.map(t=>t.name),
          datasets:[{data:tierData.map(t=>t.count),backgroundColor:tierData.map(t=>t.color),borderWidth:0}]
        },
        options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{boxWidth:12,padding:8,font:{size:11}}}}}
      });
      
      // 2. Completion Status - Pie
      new Chart(document.getElementById('statusChart'),{
        type:'pie',
        data:{
          labels:statusData.map(s=>s.label),
          datasets:[{data:statusData.map(s=>s.value),backgroundColor:statusData.map(s=>s.color),borderWidth:0}]
        },
        options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{boxWidth:12,padding:8,font:{size:11}}}}}
      });
      
      // 3. Quota Fill Rate - Doughnut
      new Chart(document.getElementById('quotaFillChart'),{
        type:'doughnut',
        data:{
          labels:quotaFillData.map(q=>q.label),
          datasets:[{data:quotaFillData.map(q=>q.value),backgroundColor:quotaFillData.map(q=>q.color),borderWidth:0}]
        },
        options:{responsive:true,maintainAspectRatio:false,cutout:'70%',plugins:{legend:{position:'right',labels:{boxWidth:12,padding:8,font:{size:11}}}}}
      });
      
      // 4. Tier Capacity - Bar
      new Chart(document.getElementById('tierBarChart'),{
        type:'bar',
        data:{
          labels:tierData.map(t=>t.name),
          datasets:[
            {label:'Participants',data:tierData.map(t=>t.count),backgroundColor:tierData.map(t=>t.color),borderRadius:4},
            {label:'Quota',data:tierData.map(t=>t.quota),backgroundColor:'#e2e8f0',borderRadius:4}
          ]
        },
        options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}},scales:{y:{beginAtZero:true}}}
      });
      
      // 5. Points Distribution - Pie
      new Chart(document.getElementById('pointsDistChart'),{
        type:'pie',
        data:{
          labels:pointsDistribution.map(p=>p.label),
          datasets:[{data:pointsDistribution.map(p=>p.value),backgroundColor:pointsDistribution.map(p=>p.color),borderWidth:0}]
        },
        options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{boxWidth:12,padding:8,font:{size:11}}}}}
      });
      
      // 6. Top Performers - Horizontal Bar
      new Chart(document.getElementById('topPerformersChart'),{
        type:'bar',
        data:{
          labels:topData.map(t=>t.name.split(' ')[0]),
          datasets:[{label:'Points',data:topData.map(t=>t.points),backgroundColor:topData.map(t=>t.color),borderRadius:4}]
        },
        options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}}}
      });
      
      // 7. TOP 10 Performance Trend - LINE CHART
      new Chart(document.getElementById('performanceLineChart'),{
        type:'line',
        data:{
          labels:performanceTrendData.labels,
          datasets:[
            {
              label:'Points Achieved',
              data:performanceTrendData.points,
              borderColor:'#10b981',
              backgroundColor:'rgba(16,185,129,0.1)',
              fill:true,
              tension:0.4,
              pointBackgroundColor:'#10b981',
              pointBorderColor:'#fff',
              pointBorderWidth:2,
              pointRadius:5
            },
            {
              label:'Required Points',
              data:performanceTrendData.required,
              borderColor:'#f59e0b',
              backgroundColor:'transparent',
              borderDash:[5,5],
              tension:0.4,
              pointBackgroundColor:'#f59e0b',
              pointRadius:3
            }
          ]
        },
        options:{
          responsive:true,
          maintainAspectRatio:false,
          plugins:{legend:{position:'bottom'}},
          scales:{
            y:{beginAtZero:true,grid:{color:'#f1f5f9'}},
            x:{grid:{display:false}}
          }
        }
      });
      
      // 8. Tier Progress Cumulative - LINE CHART
      new Chart(document.getElementById('tierProgressLineChart'),{
        type:'line',
        data:{
          labels:tierProgressData.labels,
          datasets:[
            {
              label:'Cumulative Participants',
              data:tierProgressData.cumulative,
              borderColor:'#3b82f6',
              backgroundColor:'rgba(59,130,246,0.1)',
              fill:true,
              tension:0.4,
              pointBackgroundColor:'#3b82f6',
              pointBorderColor:'#fff',
              pointBorderWidth:2,
              pointRadius:5
            },
            {
              label:'Cumulative Quota',
              data:tierProgressData.quota,
              borderColor:'#64748b',
              backgroundColor:'transparent',
              borderDash:[5,5],
              tension:0.4,
              pointBackgroundColor:'#64748b',
              pointRadius:3
            }
          ]
        },
        options:{
          responsive:true,
          maintainAspectRatio:false,
          plugins:{legend:{position:'bottom'}},
          scales:{
            y:{beginAtZero:true,grid:{color:'#f1f5f9'}},
            x:{grid:{display:false}}
          }
        }
      });
      
      // 9. Points Ranking Curve - LINE CHART
      new Chart(document.getElementById('pointsRankingLineChart'),{
        type:'line',
        data:{
          labels:pointsLineData.labels,
          datasets:[{
            label:'Points by Rank',
            data:pointsLineData.points,
            borderColor:'#8b5cf6',
            backgroundColor:'rgba(139,92,246,0.1)',
            fill:true,
            tension:0.3,
            pointBackgroundColor:'#8b5cf6',
            pointBorderColor:'#fff',
            pointBorderWidth:2,
            pointRadius:4
          }]
        },
        options:{
          responsive:true,
          maintainAspectRatio:false,
          plugins:{legend:{display:false}},
          scales:{
            y:{beginAtZero:true,grid:{color:'#f1f5f9'},title:{display:true,text:'Points'}},
            x:{grid:{display:false},title:{display:true,text:'Rank'}}
          }
        }
      });
    `;

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Reward Report - ${event.title}</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"><\/script>
    <style>${css}</style></head><body><div class="container">
    <header class="report-header">
      <div class="brand">
        <div class="brand-logo"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"></path></svg></div>
        <div class="brand-text"><h1>Reward Management</h1><p>Event Analytics Report</p></div>
      </div>
      <div class="report-meta"><h2>Analysis Report</h2><p>Generated: ${generatedDate}</p><p>Time: ${generatedTime}</p></div>
    </header>
    
    <div class="event-title"><h3>${event.title}</h3><div class="event-info"><span><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16" style="vertical-align:middle;margin-right:4px"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>${event.location}</span><span><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16" style="vertical-align:middle;margin-right:4px"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>${eventDateRange}</span></div></div>
    
    <section class="section">
      <h4 class="section-title"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20" style="vertical-align:middle;margin-right:6px;color:#0f766e"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>Executive Summary</h4>
      <div class="stats-grid">
        <div class="stat-card highlight"><div class="stat-value">${totalUsers}</div><div class="stat-label">Total Participants</div></div>
        <div class="stat-card"><div class="stat-value">${completedUsers}</div><div class="stat-label">Completed</div></div>
        <div class="stat-card"><div class="stat-value">${inProgressUsers}</div><div class="stat-label">In Progress</div></div>
        <div class="stat-card"><div class="stat-value">${completionRate}%</div><div class="stat-label">Completion Rate</div></div>
        <div class="stat-card"><div class="stat-value">${fillRate}%</div><div class="stat-label">Quota Fill Rate</div></div>
      </div>
    </section>
    
    <section class="section">
      <h4 class="section-title"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20" style="vertical-align:middle;margin-right:6px;color:#0f766e"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"></path></svg>Distribution Charts</h4>
      <div class="charts-grid">
        <div class="chart-card"><div class="chart-title"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16" style="vertical-align:middle;margin-right:4px;color:#3b82f6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>Tier Distribution</div><div class="chart-container"><canvas id="tierPieChart"></canvas></div></div>
        <div class="chart-card"><div class="chart-title"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16" style="vertical-align:middle;margin-right:4px;color:#10b981"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>Completion Status</div><div class="chart-container"><canvas id="statusChart"></canvas></div></div>
        <div class="chart-card"><div class="chart-title"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16" style="vertical-align:middle;margin-right:4px;color:#8b5cf6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"></path></svg>Quota Fill Rate</div><div class="chart-container"><canvas id="quotaFillChart"></canvas></div></div>
      </div>
    </section>
    
    <section class="section">
      <h4 class="section-title"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20" style="vertical-align:middle;margin-right:6px;color:#0f766e"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"></path></svg>Trend Analysis (Line Charts)</h4>
      <div class="charts-grid-2">
        <div class="chart-card"><div class="chart-title"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16" style="vertical-align:middle;margin-right:4px;color:#f59e0b"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"></path></svg>Top 10 Performance vs Required</div><div class="chart-container tall"><canvas id="performanceLineChart"></canvas></div></div>
        <div class="chart-card"><div class="chart-title"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16" style="vertical-align:middle;margin-right:4px;color:#3b82f6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>Cumulative Tier Progress</div><div class="chart-container tall"><canvas id="tierProgressLineChart"></canvas></div></div>
      </div>
      <div class="charts-grid-2">
        <div class="chart-card full-width"><div class="chart-title"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16" style="vertical-align:middle;margin-right:4px;color:#ef4444"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"></path></svg>Points Ranking Curve (Top 15)</div><div class="chart-container tall"><canvas id="pointsRankingLineChart"></canvas></div></div>
      </div>
    </section>
    
    <section class="section">
      <h4 class="section-title"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20" style="vertical-align:middle;margin-right:6px;color:#0f766e"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>Comparison Charts</h4>
      <div class="charts-grid-2">
        <div class="chart-card"><div class="chart-title"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16" style="vertical-align:middle;margin-right:4px;color:#06b6d4"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>Tier Capacity Analysis</div><div class="chart-container"><canvas id="tierBarChart"></canvas></div></div>
        <div class="chart-card"><div class="chart-title"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16" style="vertical-align:middle;margin-right:4px;color:#8b5cf6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"></path></svg>Points Distribution</div><div class="chart-container"><canvas id="pointsDistChart"></canvas></div></div>
      </div>
      <div class="charts-grid-2">
        <div class="chart-card"><div class="chart-title"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16" style="vertical-align:middle;margin-right:4px;color:#f59e0b"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"></path></svg>Top 5 Performers</div><div class="chart-container"><canvas id="topPerformersChart"></canvas></div></div>
      </div>
    </section>
    
    <section class="section">
      <h4 class="section-title"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20" style="vertical-align:middle;margin-right:6px;color:#0f766e"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>Tier Analysis Table</h4>
      <div class="table-wrapper"><table><thead><tr><th>#</th><th>Tier</th><th class="text-right">Participants</th><th class="text-right">Quota</th><th class="text-right">Fill Rate</th><th class="text-right">Avg Points</th><th class="text-right">Range</th></tr></thead><tbody>${tierRowsHTML}</tbody></table></div>
    </section>
    
    <section class="section">
      <h4 class="section-title"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20" style="vertical-align:middle;margin-right:6px;color:#0f766e"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"></path></svg>Top 10 Performers</h4>
      <div class="table-wrapper"><table><thead><tr><th class="text-center">Rank</th><th>Name</th><th>Email</th><th>Tier</th><th class="text-center">Tier Rank</th><th class="text-right">Points</th></tr></thead><tbody>${topRowsHTML}</tbody></table></div>
    </section>
    
    <footer class="report-footer"><span>Reward Management System - Confidential</span><span>Page 1 of 1</span></footer>
    </div><script>${chartJs}<\/script></body></html>`;

    const iframe = document.createElement("iframe");
    iframe.style.cssText =
      "position:fixed;left:-9999px;width:1200px;height:4000px";
    document.body.appendChild(iframe);
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      document.body.removeChild(iframe);
      return;
    }
    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();

    await new Promise((r) => setTimeout(r, 3500));

    try {
      // โหลด html2canvas
      // @ts-ignore
      if (typeof window.html2canvas === "undefined") {
        await new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src =
            "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
          s.onload = resolve;
          s.onerror = reject;
          document.head.appendChild(s);
        });
      }

      // โหลด jspdf
      // @ts-ignore
      if (typeof window.jspdf === "undefined") {
        await new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src =
            "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
          s.onload = resolve;
          s.onerror = reject;
          document.head.appendChild(s);
        });
      }

      await new Promise((r) => setTimeout(r, 500));

      const container = iframeDoc.querySelector(".container");
      if (!container) throw new Error("Container not found");
      // @ts-ignore
      const canvas = await window.html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      if (format === "png") {
        const link = document.createElement("a");
        link.download = fileName + ".png";
        link.href = canvas.toDataURL("image/png");
        link.click();
      } else {
        // @ts-ignore
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF("p", "mm", "a4");
        const w = 210,
          h = (canvas.height * w) / canvas.width;
        let position = 0;
        const pageHeight = 297;

        if (h > pageHeight) {
          while (position < h) {
            if (position > 0) pdf.addPage();
            pdf.addImage(
              canvas.toDataURL("image/png"),
              "PNG",
              0,
              -position,
              w,
              h
            );
            position += pageHeight;
          }
        } else {
          pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, w, h);
        }
        pdf.save(fileName + ".pdf");
      }
      Swal.fire({
        title: "Downloaded!",
        text: format.toUpperCase() + " saved.",
        icon: "success",
        background: "#1e293b",
        color: "#fff",
        confirmButtonColor: "#10b981",
      });
    } catch (e) {
      console.error(e);
      window.open(
        URL.createObjectURL(new Blob([html], { type: "text/html" })),
        "_blank"
      );
      Swal.fire({
        title: "Report Generated!",
        text: "Use browser save.",
        icon: "info",
        background: "#1e293b",
        color: "#fff",
        confirmButtonColor: "#10b981",
      });
    } finally {
      document.body.removeChild(iframe);
    }
    showRewardExportMenu = false;
  }

  function exportRewardsToCSV(users: RewardUser[]) {
    const headers = [
      "Global Rank",
      "Tier Rank",
      "Nisit ID",
      "OdySd",
      "Name",
      "Email",
      "Tier",
      "Progress",
      "Required",
      "Status",
      "Completed At",
      "Join Code",
    ];
    const rows = users.map((user) => [
      user.globalRank,
      user.tierRank || "—",
      user.nisitId,
      user.odySd,
      user.name,
      user.email,
      user.tier,
      user.completedCount,
      user.requiredCount,
      user.status,
      user.completedAt || "N/A",
      user.joinCode,
    ]);

    let csvContent = headers.join(",") + "\n";
    rows.forEach((row) => {
      csvContent += row.map((cell) => `"${cell}"`).join(",") + "\n";
    });

    downloadFile(csvContent, "rewards-export.csv", "text/csv");
  }

  function exportRewardsToJSON(users: RewardUser[]) {
    const jsonContent = JSON.stringify(users, null, 2);
    downloadFile(jsonContent, "rewards-export.json", "application/json");
  }

  function exportRewardsToPDF(users: RewardUser[]) {
    let pdfContent = `Rewards Report - ${rewardData.selectedEvent?.title || "Event"}\n\n`;
    users.forEach((user) => {
      pdfContent += `Rank: ${user.globalRank}\n`;
      pdfContent += `Name: ${user.name} (${user.email})\n`;
      pdfContent += `Tier: ${user.tier}\n`;
      pdfContent += `Progress: ${user.completedCount}/${user.requiredCount}\n`;
      pdfContent += `Status: ${user.status}\n`;
      pdfContent += `---\n\n`;
    });
    downloadFile(pdfContent, "rewards-export.txt", "text/plain");
  }

  let allSavedHolidays = [];

  async function loadHolidays() {
    try {
      const res = await fetch("/ku-run/internal/holidays");
      allSavedHolidays = await res.json();
    } catch (e) {
      console.error("Load holidays failed", e);
    }
  }

  interface RewardForm {
    quota: number | null;
    rangeStart: number;
    rangeEnd: number | null;
    name: string;
    requirement: number | null; // ระบุว่ามี property นี้ และเป็น number หรือ null ได้
  }

  interface CreateEventForm {
    title: string;
    description: string;
    location: string;
    sDay: string;
    sMonth: string;
    sYear: string;
    eDay: string;
    eMonth: string;
    eYear: string;
    startTime: string;
    endTime: string;
    totalSlots: number | null;
    distanceKm: number | null;
    holidays: string[];
    excludeWeekends: boolean;
    tempHoliday: string;
    rewards: RewardForm[];
    isPublic: boolean;
    isActive: boolean;
    imagePreview: string | null;
  }

  interface AppEvent {
    id: number;
    title: string;
    description?: string;
    image: string;
    location: string;

    // วันที่
    startDate?: {
      day: string;
      month: string;
      year: string;
    };
    endDate?: {
      day: string;
      month: string;
      year: string;
    };

    // เวลา
    startTime?: string;
    endTime?: string;

    // ความจุและรางวัล
    totalSlots?: number;
    usedSlots?: number;
    distanceKm?: number;
    rewards?: Array<{
      quota: number | null;
      rangeStart: number;
      rangeEnd: number | null;
      name: string;
      requirement?: number | null;
    }>;

    // Holidays
    holidays?: string[];
    excludeWeekends?: boolean;

    // สถานะ
    isPublic?: boolean;
    isActive?: boolean;
    status: string;

    pendingCount?: number;
    // เก็บไว้สำหรับข้อมูลเก่า
    month: string;
    year: string;
  }

  interface Log {
    id: string;
    eventId: string;
    eventTitle: string;
    userId: string;
    userName: string;
    userEmail: string;
    userAvatar: string;
    userNisitId?: string;
    action: string;
    timestamp: string;
    status: string;
    details?: any;
    metadata?: any;
    proofImage?: string | null;
  }

  interface LogsData {
    selectedEvent: AppEvent | null; // เปลี่ยน Event เป็น AppEvent (ดูข้อ 2 ด้านล่าง)
    logs: Log[];
    loading: boolean;
    error: string;
    searchQuery: string;
    selectedAction: string;
    selectedStatus: string;
    dateFrom: string;
    dateTo: string;
    currentPage: number;
    itemsPerPage: number;
    totalItems: number;
    totalPages: number;

    // เพิ่มส่วนที่ขาดหายไป
    actionDropdownOpen: boolean;
    statusDropdownOpen: boolean;
    dateFromDropdownOpen: boolean;
    dateToDropdownOpen: boolean;
    showDetailModal: boolean;
    selectedLog: Log | null;
    statistics: LogStatistics;
    eventStats?: {
      total: number;
      by_status: Record<string, number>;
      by_role: Record<string, number>;
    };
  }

  interface LogStatistics {
    totalLogs: number;
    uniqueUsers: number;
    successRate: number;
    topAction: string;
    // เพิ่ม properties ที่ขาดหายไป
    totalRegistrations?: number;
    totalCheckIns?: number;
    totalRewards?: number;
    totalCancelled?: number;
  }

  interface TimelineItem {
    timestamp: string;
    action: string;
    userName: string;
    status: string;
    details: string;
  }
  // --- Configuration ---
  const searchEnabledViews = ["list", "verify-proof", "log", "reward"];

  let currentView = "list";
  let isMobileMenuOpen = false;

  let showPageDropdown = false;
  let showExportMenu = false;
  let showTimelineModal = false;
  let exportFormat = "csv";
  let isExporting = false;
  let showLogsPageDropdown = false;
  let showLogsExportMenu = false;
  let showEventsForLogsPageDropdown = false;

  // WebSocket States
  let ws: WebSocket | null = null;
  let isConnected = false;
  let newLogsCount = 0;
  let autoRefreshEnabled = true;
  let isEventListView = false;
  let logsNisitYearFilter: string = "";
  let logsNisitIdFilter: string = "";

  // Mock Data
  let events: AppEvent[] = [];

  let allHolidaysData: any[] = [];
  let nextEventId = 9;

  let timerInterval: any;

  let showSearchSection = false;
  // Search & Filter States
  let searchQuery = "";
  let selectedYear = "All";
  let selectedMonth = "All";
  let monthOpen = false;
  let yearOpen = false;

  // Search & Filter States - แยกแต่ละหน้า
  let searchQueryEventList = "";
  let searchQueryVerifyProof = "";
  let searchQueryLogs = "";
  let searchQueryReward = "";

  // Filter States - แยกแต่ละหน้า
  let selectedYearEventList = "All";
  let selectedMonthEventList = "All";

  let selectedYearVerifyProof = "All";
  let selectedMonthVerifyProof = "All";

  let selectedYearLogs = "All";
  let selectedMonthLogs = "All";

  let selectedYearReward = "All";
  let selectedMonthReward = "All";

  // Dropdown States - แยกแต่ละหน้า
  let monthOpenEventList = false;
  let yearOpenEventList = false;

  let monthOpenVerifyProof = false;
  let yearOpenVerifyProof = false;

  let monthOpenLogs = false;
  let yearOpenLogs = false;

  let monthOpenReward = false;
  let yearOpenReward = false;

  // Pagination States
  let currentPage = 1;
  const itemsPerPage = 8;

  const years = [
    "All",
    "2023",
    "2024",
    "2025",
    "2026",
    "2027",
    "2028",
    "2029",
    "2030",
  ];
  const months = [
    "All",
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  $: menuItems = [
    {
      id: "list",
      label: lang.events,
      svg: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01",
    },
    { id: "create", label: lang.createEvent, svg: "M12 4v16m8-8H4" },
    {
      id: "verify-code",
      label: lang.verifyCode,
      svg: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
    },
    {
      id: "verify-proof",
      label: lang.verifyProof,
      svg: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    },
    {
      id: "unlock",
      label: lang.unlock,
      svg: "M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z",
    },
    {
      id: "log",
      label: lang.logs,
      svg: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
    },
    {
      id: "reward",
      label: lang.rewards,
      svg: "M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V6a2 2 0 10-2 2h2zm0 0h4l-4 4-4-4h4z",
    },
    {
      id: "settings",
      label: lang.settings,
      svg: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z",
    },
  ];

  $: currentSearchQuery =
    currentView === "list"
      ? searchQueryEventList
      : currentView === "verify-proof"
        ? searchQueryVerifyProof
        : currentView === "log"
          ? searchQueryLogs
          : currentView === "reward"
            ? searchQueryReward
            : "";

  $: currentSelectedMonth =
    currentView === "list"
      ? selectedMonthEventList
      : currentView === "verify-proof"
        ? selectedMonthVerifyProof
        : currentView === "log"
          ? selectedMonthLogs
          : currentView === "reward"
            ? selectedMonthReward
            : "All";

  $: currentSelectedYear =
    currentView === "list"
      ? selectedYearEventList
      : currentView === "verify-proof"
        ? selectedYearVerifyProof
        : currentView === "log"
          ? selectedYearLogs
          : currentView === "reward"
            ? selectedYearReward
            : "All";

  $: currentMonthOpen =
    currentView === "list"
      ? monthOpenEventList
      : currentView === "verify-proof"
        ? monthOpenVerifyProof
        : currentView === "log"
          ? monthOpenLogs
          : currentView === "reward"
            ? monthOpenReward
            : false;

  $: currentYearOpen =
    currentView === "list"
      ? yearOpenEventList
      : currentView === "verify-proof"
        ? yearOpenVerifyProof
        : currentView === "log"
          ? yearOpenLogs
          : currentView === "reward"
            ? yearOpenReward
            : false;

  function toggleCurrentMonthDropdown() {
    if (currentView === "list") {
      monthOpenEventList = !monthOpenEventList;
      yearOpenEventList = false;
    } else if (currentView === "verify-proof") {
      monthOpenVerifyProof = !monthOpenVerifyProof;
      yearOpenVerifyProof = false;
    } else if (currentView === "log") {
      monthOpenLogs = !monthOpenLogs;
      yearOpenLogs = false;
    } else if (currentView === "reward") {
      monthOpenReward = !monthOpenReward;
      yearOpenReward = false;
    }
  }

  function parseAPIDate(dateStr: string) {
    const d = new Date(dateStr);
    return {
      day: d.getDate().toString(),
      month: (d.getMonth() + 1).toString(),
      year: d.getFullYear().toString(),
    };
  }

  async function refreshData() {
    const token = localStorage.getItem("access_token");

    if (!token) {
      console.error("No token found");
      return;
    }

    try {
      // ✅ เพิ่ม /ku-run prefix
      const res = await fetch(`${API_BASE_URL}/ku-run/api/events/`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 401) {
        console.error("Token expired or invalid");
        localStorage.removeItem("access_token");
        // ✅ แก้ redirect URL
        window.location.href = "/ku-run/auth/login";
        return;
      }

      if (!res.ok) {
        console.error("Failed to fetch events:", res.status);
        return;
      }

      const data: any = await res.json();
      
      
      // ขึ้นอยู่กับว่า holidays API อยู่ที่ไหน
      const resHolidays = await fetch("/ku-run/internal/holidays");
      if (resHolidays.ok) {
        allHolidaysData = await resHolidays.json();
      }

      console.log("📥 Refreshed events from API:", data);

      // แปลงข้อมูลจาก API ให้ตรงกับ AppEvent interface
      events = data.map((item: any) => {
        const startDate = new Date(item.event_date);
        const endDate = new Date(item.event_end_date);
        const isPublished = item.is_published === true;
        const isActive = item.is_active === true;
        const imageUrl = processImageUrl(item.banner_image_url);

        return {
          id: item.id,
          title: item.title,
          description: item.description,
          location: item.location,

          // Date fields
          day: startDate.getUTCDate().toString(),
          month: ce_months[startDate.getUTCMonth()],
          year: startDate.getUTCFullYear().toString(),
          endDay: endDate.getUTCDate().toString(),
          endMonth: ce_months[endDate.getUTCMonth()],
          endYear: endDate.getUTCFullYear().toString(),

          // Time fields
          startTime: startDate.toISOString().split("T")[1].slice(0, 5),
          endTime: endDate.toISOString().split("T")[1].slice(0, 5),

          // Capacity
          slots: item.max_participants,
          totalSlots: item.max_participants,
          usedSlots: item.participant_count || 0,
          registered: item.participant_count || 0,
          distanceKm: item.distance_km || 0,

          // Status
          status: isActive ? "Active" : "Inactive",
          is_published: isPublished,
          is_active: isActive,
          isPublic: isPublished,
          isActive: isActive,

          // Other
          image: imageUrl,
          rewards: item.rewards || [],
          holidays: item.holidays || [],
          excludeWeekends: item.exclude_weekends || false,
        };
      });

      console.log("✅ Events refreshed:", events.length);
    } catch (err) {
      console.error("Error fetching data:", err);
    }
  }

  function toggleSearchSection() {
    showSearchSection = !showSearchSection;
    if (!showSearchSection) {
      // Reset filters when closing
      if (currentView === "list") {
        searchQueryEventList = "";
        selectedYearEventList = "All";
        selectedMonthEventList = "All";
      } else if (currentView === "log" && !logsData.selectedEvent) {
        searchQueryLogs = "";
        selectedYearLogs = "All";
        selectedMonthLogs = "All";
      } else if (currentView === "reward" && !rewardData.selectedEvent) {
        searchQueryReward = "";
        selectedYearReward = "All";
        selectedMonthReward = "All";
      }
    }
  }

  function toggleCurrentYearDropdown() {
    if (currentView === "list") {
      yearOpenEventList = !yearOpenEventList;
      monthOpenEventList = false;
    } else if (currentView === "verify-proof") {
      yearOpenVerifyProof = !yearOpenVerifyProof;
      monthOpenVerifyProof = false;
    } else if (currentView === "log") {
      yearOpenLogs = !yearOpenLogs;
      monthOpenLogs = false;
    } else if (currentView === "reward") {
      yearOpenReward = !yearOpenReward;
      monthOpenReward = false;
    }
  }

  function selectCurrentMonth(month: string) {
    if (currentView === "list") {
      selectedMonthEventList = month;
      monthOpenEventList = false;
    } else if (currentView === "verify-proof") {
      selectedMonthVerifyProof = month;
      monthOpenVerifyProof = false;
    } else if (currentView === "log") {
      selectedMonthLogs = month;
      monthOpenLogs = false;
    } else if (currentView === "reward") {
      selectedMonthReward = month;
      monthOpenReward = false;
    }
  }

  function selectCurrentYear(year: string) {
    if (currentView === "list") {
      selectedYearEventList = year;
      yearOpenEventList = false;
    } else if (currentView === "verify-proof") {
      selectedYearVerifyProof = year;
      yearOpenVerifyProof = false;
    } else if (currentView === "log") {
      selectedYearLogs = year;
      yearOpenLogs = false;
    } else if (currentView === "reward") {
      selectedYearReward = year;
      yearOpenReward = false;
    }
  }

  function handleSearch() {
    // Search จะทำงานตาม currentView
    if (currentView === "list") {
      currentPage = 1;
    } else if (currentView === "log" && !logsData.selectedEvent) {
      eventsForLogsPage = 1;
    } else if (currentView === "reward" && !rewardData.selectedEvent) {
      rewardEventsPage = 1;
    }
  }

  // Logic Checks
  // Logic Checks
  $: isSearchableView = searchEnabledViews.includes(currentView);

  $: searchPlaceholder =
    currentView === "list"
      ? "Search events..."
      : currentView === "log" && !logsData.selectedEvent
        ? "Search events..."
        : currentView === "log" && logsData.selectedEvent
          ? "Search by name or email..."
          : currentView === "reward" && !rewardData.selectedEvent
            ? "Search events..."
            : "Search name...";

  $: canSearch =
    currentView === "list" ||
    (currentView === "log" && !logsData.selectedEvent) ||
    (currentView === "reward" && !rewardData.selectedEvent);



    function formatDateRange(event: AppEvent): string {
    if (event.startDate && event.endDate) {
      const { day: sDay, month: sMonth, year: sYear } = event.startDate;
      const { day: eDay, month: eMonth, year: eYear } = event.endDate;

      const sMonthT = translateMonth(sMonth);
      const eMonthT = translateMonth(eMonth);

      // ถ้าวันเดียวกัน
      if (sDay === eDay && sMonth === eMonth && sYear === eYear) {
        return `${sDay} ${sMonthT} ${sYear}`;
      }

      // ถ้าเดือนปีเดียวกัน
      if (sMonth === eMonth && sYear === eYear) {
        return `${sDay}-${eDay} ${sMonthT} ${sYear}`;
      }

      // ถ้าปีเดียวกัน แต่ต่างเดือน
      if (sYear === eYear) {
        return `${sDay} ${sMonthT} - ${eDay} ${eMonthT} ${sYear}`;
      }

      // ถ้าต่างปี
      return `${sDay} ${sMonthT} ${sYear} - ${eDay} ${eMonthT} ${eYear}`;
    }

    // Fallback: ใช้ข้อมูลเก่า
    return `${translateMonth(event.month)} ${event.year}`;
  }

  function getNextHoliday(
    event: AppEvent
  ): { date: string; display: string } | null {
    if (!event.holidays || event.holidays.length === 0) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // หาวันหยุดที่ยังไม่ผ่านไป
    const upcomingHolidays = event.holidays
      .map((h) => new Date(h))
      .filter((d) => d >= today)
      .sort((a, b) => a.getTime() - b.getTime());

    if (upcomingHolidays.length === 0) return null;

    const nextHoliday = upcomingHolidays[0];

    // Format: "15 Jan 2026"
    const day = nextHoliday.getDate();
    const month = ce_months[nextHoliday.getMonth()];
    const year = nextHoliday.getFullYear();

    return {
      date: nextHoliday.toISOString().split("T")[0],
      display: `${day} ${month} ${year}`,
    };
  }

  // 🔵 Helper: นับจำนวนวันหยุดทั้งหมด
  function getHolidayCount(event: AppEvent): number {
    return event.holidays?.length || 0;
  }

  // 🔵 Helper: เช็คว่า event มี custom holidays (ไม่ใช่แค่ weekends)
  function hasCustomHolidays(event: AppEvent): boolean {
    if (!event.holidays || event.holidays.length === 0) return false;
    if (!event.excludeWeekends) return true;

    return event.holidays.some((h) => {
      const d = new Date(h);
      const day = d.getDay();
      return day !== 0 && day !== 6;
    });
  }

  // 🔵 Helper: ดึงข้อความแสดงวันหยุด
  function getHolidayDisplay(event: AppEvent): string | null {
    if (!event.holidays || event.holidays.length === 0) {
      if (!event.excludeWeekends) return null;
      return "Off: Sat-Sun";
    }

    if (event.excludeWeekends && !hasCustomHolidays(event)) {
      return "Off: Sat-Sun";
    }

    const next = getNextHoliday(event);
    if (next) {
      return `Off: ${next.display}`;
    }

    return null;
  }

  // 🔵 Helper: เช็คว่ามีข้อมูลครบหรือไม่
  function hasFullDetails(event: AppEvent): boolean {
    return !!(
      event.startDate &&
      event.endDate &&
      event.startTime &&
      event.endTime &&
      event.totalSlots !== undefined
    );
  }

  // 🔵 Helper: คำนวณเปอร์เซ็นต์ความจุ
  function getCapacityPercentage(event: AppEvent): number {
    if (!event.totalSlots || event.totalSlots === 0) return 0;
    const used = event.usedSlots || 0;
    return Math.min((used / event.totalSlots) * 100, 100);
  }

  // 🔵 Helper: คำนวณเปอร์เซ็นต์ pending submissions
  function getPendingPercentage(event: AppEvent): number {
    if (!event.totalSlots || event.totalSlots === 0) return 0;
    const pending = event.pendingCount || 0;
    return Math.min((pending / event.totalSlots) * 100, 100);
  }

  // 🔵 Helper: กำหนดสถานะจาก flags
  function getEventStatus(isPublic?: boolean, isActive?: boolean): string {
    if (isPublic === undefined || isActive === undefined) return "Active"; // Default

    if (!isPublic && !isActive) return "Draft";
    if (isPublic && !isActive) return "Closed";
    if (!isPublic && isActive) return "Private";
    return "Active";
  }
  // Functions

  function toggleDropdown(type: "month" | "year") {
    if (type === "month") {
      monthOpen = !monthOpen;
      yearOpen = false;
    } else {
      yearOpen = !yearOpen;
      monthOpen = false;
    }
  }

  function selectOption(type: "month" | "year", value: string) {
    if (type === "month") selectedMonth = value;
    else selectedYear = value;
    monthOpen = false;
    yearOpen = false;
    currentPage = 1;
  }

  // --- Beautiful Toast ---

  function selectView(id: string) {
    const previousView = currentView;

    // Don't reset view state when switching - preserve data
    // Only close dropdowns
    closeAllDropdowns();

    currentView = id;
    isMobileMenuOpen = false;
    showSearchSection = false;
    showPageDropdown = false;

    // Fetch fresh data for the new view only if needed
    if (id === "list") {
      fetchEvents();
    }
  }

  function closeAllDropdowns() {
    showPageDropdown = false;
    showExportMenu = false;
    yearOpenEventList = false;
    monthOpenEventList = false;
    yearOpenLogs = false;
    monthOpenLogs = false;
    yearOpenReward = false;
    monthOpenReward = false;
    yearOpenVerifyProof = false;
    monthOpenVerifyProof = false;
    rewardSortDropdownOpen = false;
    rewardTierDropdownOpen = false;
    rewardTierFilterDropdownOpen = false;
  }

  function resetViewState(viewId: string) {
    // Close all dropdowns first
    closeAllDropdowns();

    // Reset specific view state - only filters, not data
    switch (viewId) {
      case "verify-proof":
        // Keep selectedEvent and submissions
        verifyProofSearchQuery = "";
        verifyProofBatchFilter = "";
        verifyProofStdIdFilter = "";
        verifyProofEventsPage = 1;
        verifyProofStatusFilter = "All";
        verifyProofFromDate = "";
        verifyProofToDate = "";
        break;

      case "log":
        // Keep selectedEvent and logs
        logsData.searchQuery = "";
        logsData.selectedAction = "All";
        logsData.selectedStatus = "All";
        logsData.dateFrom = "";
        logsData.dateTo = "";
        eventsForLogsPage = 1;
        logsListPage = 1;
        searchQueryLogs = "";
        selectedYearLogs = "All";
        selectedMonthLogs = "All";
        logsNisitYearFilter = "";
        logsNisitIdFilter = "";
        break;

      case "reward":
        // Keep selectedEvent and users
        rewardData.searchQuery = "";
        rewardData.selectedTier = "All";
        rewardEventsPage = 1;
        rewardUsersPage = 1;
        searchQueryReward = "";
        selectedYearReward = "All";
        selectedMonthReward = "All";
        rewardSortBy = "all";
        rewardTierFilter = "all";
        nisitYearFilter = "";
        nisitIdFilter = "";
        break;

      case "list":
        // Don't reset events array - just reset filters
        searchQueryEventList = "";
        selectedYearEventList = "All";
        selectedMonthEventList = "All";
        currentPage = 1;
        break;
    }
  }

  function resetAllViewStates() {
    // Reset List View
    searchQueryEventList = "";
    selectedYearEventList = "All";
    selectedMonthEventList = "All";
    currentPage = 1;

    // Reset Verify Proof View
    verifyProofData.selectedEvent = null;
    verifyProofData.submissions = [];
    verifyProofData.loading = false;
    verifyProofData.error = "";
    verifyProofSearchQuery = "";
    verifyProofBatchFilter = "";
    verifyProofStdIdFilter = "";
    verifyProofEventsPage = 1;
    newVerifyProofCount = 0;
    verifyProofStatusFilter = "All";
    verifyProofFromDate = "";
    verifyProofToDate = "";

    // Reset Logs View
    logsData.selectedEvent = null;
    logsData.logs = [];
    logsData.loading = false;
    logsData.error = "";
    logsData.searchQuery = "";
    logsData.selectedAction = "All";
    logsData.selectedStatus = "All";
    logsData.dateFrom = "";
    logsData.dateTo = "";
    logsData.eventStats = undefined;
    filteredLogs = [];
    eventsForLogsPage = 1;
    logsListPage = 1;
    searchQueryLogs = "";
    selectedYearLogs = "All";
    selectedMonthLogs = "All";
    logsNisitYearFilter = "";
    logsNisitIdFilter = "";

    // Reset Reward View
    rewardData.selectedEvent = null;
    rewardData.users = [];
    rewardData.loading = false;
    rewardData.error = "";
    rewardData.searchQuery = "";
    rewardData.selectedTier = "All";
    rewardEventsPage = 1;
    rewardUsersPage = 1;
    newRewardUsersCount = 0;
    rewardAutoRefreshEnabled = true;
    rewardIsConnected = true;
    searchQueryReward = "";
    selectedYearReward = "All";
    selectedMonthReward = "All";
    rewardSortBy = "all";
    rewardTierFilter = "all";
    nisitYearFilter = "";
    nisitIdFilter = "";

    // Reset Unlock User View
    // (variables are local to the view)

    // Close all dropdowns
    showPageDropdown = false;
    showExportMenu = false;
    yearOpenEventList = false;
    monthOpenEventList = false;
    yearOpenLogs = false;
    monthOpenLogs = false;
    yearOpenReward = false;
    monthOpenReward = false;
    yearOpenVerifyProof = false;
    monthOpenVerifyProof = false;
    rewardSortDropdownOpen = false;
    rewardTierDropdownOpen = false;
    rewardTierFilterDropdownOpen = false;
  }

  // ฟังก์ชันลบ Event (แบบสมบูรณ์)
  async function handleDelete(id: number | string) {
    // 1. แสดง Popup ถามยืนยัน (SweetAlert2)
    const result = await Swal.fire({
      title: "Delete Event?",
      text: "You won't be able to revert this!",
      icon: "warning",
      iconColor: "#ef4444",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Yes, delete it!",
      background: "#1e293b",
      color: "#fff",
      customClass: { popup: "swal-rounded-popup" },
    });

    // 2. ถ้าผู้ใช้กดตกลง (Yes)
    if (result.isConfirmed) {
      try {
        const token = localStorage.getItem("access_token");

        // กันเหนียว: ถ้าไม่มี Token ให้แจ้งเตือนและหยุดทำงาน
        if (!token) {
          Swal.fire({
            title: "Error",
            text: "Authentication token not found. Please login again.",
            icon: "error",
            background: "#1e293b",
            color: "#fff",
          });
          return;
        }

        console.log(`🗑️ Deleting Event ID: ${id}`);

        // -----------------------------------------------------------
        // 🚀 STEP 1: ลบจาก Database หลัก (ผ่าน API 8003)
        // -----------------------------------------------------------
        try {
          await api.delete(`/api/events/${id}`);
          console.log('✅ Event deleted from server');
        } catch (err: any) {
          if (err.response?.status === 401) {
            throw new Error("Unauthorized: Token expired");
          }
          if (err.response?.status === 404) {
            // ถ้า event ไม่มีอยู่แล้ว ก็ลบจาก UI ได้เลย
            console.log('⚠️ Event not found on server, removing from UI');
            events = events.filter((e) => e.id !== id);
            
            Swal.fire({
              title: "Already Deleted",
              text: "This event was already deleted.",
              icon: "info",
              background: "#1e293b",
              color: "#fff",
              confirmButtonColor: "#3b82f6",
              timer: 1500,
            });
            return;
          }
          throw new Error(
            `Failed to delete event (Status: ${err.response?.status})`
          );
        }

        // -----------------------------------------------------------
        // 🚀 STEP 2: ลบข้อมูล Holiday/Reward จากไฟล์ JSON
        // -----------------------------------------------------------
        try {
          const deleteHolidayRes = await fetch("/ku-run/internal/holidays", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eventId: id })
          });

          if (!deleteHolidayRes.ok) {
            console.warn('⚠️ Failed to delete holiday config, but continuing...');
          } else {
            const deleteResult = await deleteHolidayRes.json();
            console.log('✅ Holiday config deleted:', deleteResult);
          }
        } catch (holidayErr) {
          console.warn('⚠️ Holiday deletion error:', holidayErr);
          // ไม่ throw error เพราะ event ลบแล้ว ไม่อยากให้ user เห็น error
        }

        // -----------------------------------------------------------
        // 🚀 STEP 3: อัปเดตหน้าจอทันที (ไม่ต้องรอ Refresh)
        // -----------------------------------------------------------
        events = events.filter((e) => e.id !== id);

        // ✅ Clear caches (เหมือนตอน Create/Edit)
        lastFilteredEventsKey = "";
        cachedFilteredEvents = [];
        filterCache.clear();
        cachedFilteredEventsForReward = [];

        // แสดงข้อความสำเร็จ
        Swal.fire({
          title: "Deleted!",
          text: "Your event has been deleted.",
          icon: "success",
          background: "#1e293b",
          color: "#fff",
          confirmButtonColor: "#10b981",
          timer: 1500,
          showConfirmButton: false,
        });
        
      } catch (error: any) {
        console.error("❌ Delete error:", error);

        Swal.fire({
          title: "Error",
          text: error.message || "Something went wrong while deleting.",
          icon: "error",
          background: "#1e293b",
          color: "#fff",
          confirmButtonColor: "#ef4444",
        });
      }
    }
  }

  function openEventModal(event: AppEvent) {
    const imgSrc =
      event.image || "https://placehold.co/600x300/1e293b/64748b?text=No+Image";
    const desc =
      event.description ||
      (currentLang === "th"
        ? "ไม่มีรายละเอียดเพิ่มเติม"
        : "No detailed description available.");

    // คำนวณเป้าหมาย
    const targetGoal = event.totalSlots || 0;
    const currentParticipants = event.usedSlots || 0;
    const progressPercent =
      targetGoal > 0
        ? ((currentParticipants / targetGoal) * 100).toFixed(1)
        : 0;

    const remainingSlots = Math.max(0, targetGoal - currentParticipants);
    const topReward =
      event.rewards && event.rewards.length > 0
        ? event.rewards.reduce((max, reward) => {
            // ตอนนี้ max และ reward จะรู้ type แล้ว
            const rEnd = reward.rangeEnd || 0;
            const mEnd = max.rangeEnd || 0;
            return rEnd > mEnd ? reward : max;
          }, event.rewards[0]!)
        : null;

    const topRank = topReward ? topReward.rangeEnd : 0;

    // คำนวณจำนวนวันในกิจกรรม
    let totalDays = 1;
    if (event.startDate && event.endDate) {
      const start = new Date(
        parseInt(event.startDate.year),
        getMonthIdx(event.startDate.month),
        parseInt(event.startDate.day)
      );
      const end = new Date(
        parseInt(event.endDate.year),
        getMonthIdx(event.endDate.month),
        parseInt(event.endDate.day)
      );
      totalDays =
        Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) +
        1;

      // หักวัน Holidays
      if (event.holidays && event.holidays.length > 0) {
        totalDays -= event.holidays.length;
      }

      // หัก Weekends (ถ้าเปิด excludeWeekends)
      if (event.excludeWeekends) {
        let weekendCount = 0;
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          if (d.getDay() === 0 || d.getDay() === 6) weekendCount++;
        }
        totalDays -= weekendCount;
      }
    }

    // i18n labels
    const i18nLabels = {
      participants: currentLang === "th" ? "ผู้เข้าร่วม" : "Participants",
      reached: currentLang === "th" ? "ถึงเป้าแล้ว" : "reached",
      slotsRemaining:
        currentLang === "th" ? "ที่นั่งคงเหลือ" : "slots remaining",
      location: currentLang === "th" ? "สถานที่" : "Location",
      dateRange: currentLang === "th" ? "ช่วงวันที่" : "Date Range",
      time: currentLang === "th" ? "เวลา" : "Time",
      distance: currentLang === "th" ? "ระยะทาง" : "Distance",
      description: currentLang === "th" ? "รายละเอียด" : "Description",
      competitionRoadmap:
        currentLang === "th" ? "เส้นทางการแข่งขัน" : "Competition Roadmap",
      howRankingWorks:
        currentLang === "th" ? "ระบบการจัดอันดับ" : "How Ranking Works",
      complete: currentLang === "th" ? "ทำให้ครบ" : "Complete",
      rounds: currentLang === "th" ? "รอบ" : "rounds",
      first: currentLang === "th" ? "คนแรก" : "First",
      finishers: currentLang === "th" ? "คนที่ทำเสร็จ" : "finishers",
      next: currentLang === "th" ? "ถัดไป" : "Next",
      tier: currentLang === "th" ? "ระดับ" : "Tier",
      slots: currentLang === "th" ? "ที่นั่ง" : "Slots",
      requirement: currentLang === "th" ? "เงื่อนไข" : "Requirement",
      ranking: currentLang === "th" ? "การจัดอันดับ" : "Ranking",
      finishFaster:
        currentLang === "th"
          ? "ทำให้เสร็จเร็วขึ้นเพื่อรับรางวัลที่ดีกว่า!"
          : "Finish faster to secure better rewards!",
      completeQuickly:
        currentLang === "th"
          ? "รอบให้เร็วเพื่อจัดอันดับสูงขึ้น"
          : "rounds quickly to rank higher",
    };

    Swal.fire({
      width: "550px",
      padding: "0",
      background: "transparent",
      showConfirmButton: false,
      showCloseButton: false,

      html: `
      <div style="background: #1e293b; border-radius: 20px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); font-family: 'Inter', sans-serif; position: relative;">
        
        <!-- รูปภาพ -->
        <div style="position: relative; width: 100%; height: 200px;">
          <img src="${imgSrc}" style="width: 100%; height: 100%; object-fit: cover; display: block;" />
          
          <!-- ปุ่มปิด -->
          <button id="custom-close-btn" style="position: absolute; top: 12px; right: 12px; width: 32px; height: 32px; background: rgba(0, 0, 0, 0.7); border: 1px solid rgba(255,255,255,0.3); border-radius: 50%; color: white; display: grid; place-items: center; padding: 0; cursor: pointer; z-index: 50; transition: 0.2s;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: block;">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>

          <!-- Status Badge -->
          <span style="position: absolute; top: 12px; left: 12px; padding: 5px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; color: white; background: ${event.status === "Active" ? "#10b981" : event.status === "Draft" ? "#f59e0b" : "#ef4444"}; box-shadow: 0 2px 6px rgba(0,0,0,0.3); text-transform: uppercase; letter-spacing: 0.5px;">
            ${event.status === "Active" ? (currentLang === "th" ? "เปิดใช้งาน" : "Active") : event.status === "Draft" ? (currentLang === "th" ? "ฉบับร่าง" : "Draft") : currentLang === "th" ? "ปิด" : "Closed"}
          </span>
        </div>

        <!-- Content -->
        <div style="padding: 28px; text-align: left; color: #f8fafc;">
          <!-- Title -->
          <h2 style="margin: 0 0 12px 0; font-size: 24px; color: #10b981; line-height: 1.3; font-weight: 700;">${event.title}</h2>
          
          <!-- ✅ Capacity & Goal Section -->
          ${
            targetGoal > 0
              ? `
            <div style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(6, 95, 70, 0.05)); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 12px; padding: 16px; margin-bottom: 20px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <svg width="18" height="18" fill="none" stroke="#10b981" viewBox="0 0 24 24" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                  </svg>
                  <span style="font-size: 14px; font-weight: 600; color: #cbd5e1;">${i18nLabels.participants}</span>
                </div>
                <span style="font-size: 20px; font-weight: 700; color: #10b981;">${currentParticipants} / ${targetGoal}</span>
              </div>
              
              <!-- Progress Bar -->
              <div style="background: rgba(51, 65, 85, 0.5); border-radius: 10px; height: 10px; overflow: hidden; margin-bottom: 12px;">
                <div style="background: linear-gradient(90deg, #10b981, #059669); height: 100%; width: ${progressPercent}%; transition: width 0.4s ease; border-radius: 10px;"></div>
              </div>
              
              <div style="display: flex; justify-content: space-between; font-size: 12px; color: #94a3b8;">
                <span>${progressPercent}% ${i18nLabels.reached}</span>
                <span>${remainingSlots} ${i18nLabels.slotsRemaining}</span>
              </div>
          
          `
              : ""
          }
          
          <!-- ✅ Meta Information Grid -->
          <div style="display: grid; gap: 12px; margin-top: 24px; margin-bottom: 18px;">
            <!-- Location -->
            <div style="display: flex; align-items: center; gap: 10px; padding: 12px 14px; background: rgba(100, 116, 139, 0.1); border-radius: 8px; border: 1px solid rgba(100, 116, 139, 0.2);">
              <svg width="16" height="16" fill="none" stroke="#94a3b8" viewBox="0 0 24 24" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
              </svg>
              <div style="flex: 1;">
                <div style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">${i18nLabels.location}</div>
                <div style="font-size: 14px; color: #e2e8f0; font-weight: 500;">${event.location}</div>
              </div>
            </div>
            
            <!-- Date Range -->
            <div style="display: flex; align-items: center; gap: 10px; padding: 12px 14px; background: rgba(100, 116, 139, 0.1); border-radius: 8px; border: 1px solid rgba(100, 116, 139, 0.2);">
              <svg width="16" height="16" fill="none" stroke="#94a3b8" viewBox="0 0 24 24" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
              </svg>
              <div style="flex: 1;">
                <div style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">${i18nLabels.dateRange}</div>
                <div style="font-size: 14px; color: #e2e8f0; font-weight: 500;">${event.startDate ? `${event.startDate.day} ${event.startDate.month} ${event.startDate.year}` : event.month} → ${event.endDate ? `${event.endDate.day} ${event.endDate.month} ${event.endDate.year}` : event.month}</div>
              </div>
            </div>
            
            ${
              event.startTime && event.endTime
                ? `
              <!-- Time -->
              <div style="display: flex; align-items: center; gap: 10px; padding: 12px 14px; background: rgba(100, 116, 139, 0.1); border-radius: 8px; border: 1px solid rgba(100, 116, 139, 0.2);">
                <svg width="16" height="16" fill="none" stroke="#94a3b8" viewBox="0 0 24 24" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <div style="flex: 1;">
                  <div style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">${i18nLabels.time}</div>
                  <div style="font-size: 14px; color: #e2e8f0; font-weight: 500;">${event.startTime} - ${event.endTime}</div>
                </div>
              </div>
            `
                : ""
            }
            
            ${
              event.distanceKm && event.distanceKm > 0
                ? `
              <!-- Distance -->
              <div style="display: flex; align-items: center; gap: 10px; padding: 12px 14px; background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(6, 182, 212, 0.1)); border-radius: 8px; border: 1px solid rgba(16, 185, 129, 0.2);">
                <svg width="16" height="16" fill="none" stroke="#10b981" viewBox="0 0 24 24" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
                </svg>
                <div style="flex: 1;">
                  <div style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">${i18nLabels.distance}</div>
                  <div style="font-size: 14px; color: #10b981; font-weight: 600;">${event.distanceKm} km</div>
                </div>
              </div>
            `
                : ""
            }
          </div>

          <div style="height: 1px; background: rgba(255,255,255,0.1); margin-bottom: 18px;"></div>

          <!-- Description -->
          <div style="margin-bottom: 18px;">
            <div style="font-size: 12px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16m-7 6h7"></path>
              </svg>
              ${i18nLabels.description}
            </div>
            <div style="max-height: 140px; overflow-y: auto; font-size: 14px; line-height: 1.7; color: #cbd5e1; padding: 12px; background: rgba(15, 23, 42, 0.5); border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.05);">
              ${desc}
            </div>
          </div>
          
          ${
            event.rewards && event.rewards.length > 0
              ? `
            <div style="height: 1px; background: rgba(255,255,255,0.1); margin-bottom: 20px;"></div>
            
            <!-- 🎯 Reward Tiers - แสดงเส้นทางการแข่งขัน -->
            <div>
              <div style="font-size: 13px; font-weight: 700; color: #f8fafc; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
                <svg width="18" height="18" fill="none" stroke="#f59e0b" viewBox="0 0 24 24" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path>
                </svg>
                ${i18nLabels.competitionRoadmap}
              </div>
              
              <!-- คำอธิบายหลักการ -->
             <div style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(37, 99, 235, 0.06)); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 12px; padding: 16px; margin-bottom: 16px;">
                <div style="display: flex; align-items: start; gap: 12px;">
                  <div style="width: 32px; height: 32px; background: rgba(59, 130, 246, 0.15); border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <svg width="18" height="18" fill="none" stroke="#3b82f6" viewBox="0 0 24 24" stroke-width="2.5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                  </div>
                  <div style="flex: 1;">
                    <div style="font-size: 13px; font-weight: 600; color: #60a5fa; margin-bottom: 6px;">${i18nLabels.howRankingWorks}</div>
                    <div style="font-size: 12px; color: #93c5fd; line-height: 1.6;">
                      ${i18nLabels.complete} <strong style="color: #3b82f6;">${event.rewards?.[0]?.requirement || event.rewards[0].rangeEnd || 0} ${i18nLabels.rounds}</strong>
                      <ul style="margin: 8px 0 0 20px; padding: 0;">
                        <li>${i18nLabels.first} <strong>${event.rewards?.[0]?.quota}</strong> ${i18nLabels.finishers} → <strong style="color: #f59e0b;">${i18nLabels.tier} 1</strong></li>
                        ${event.rewards?.[1] ? `<li>${i18nLabels.next} <strong>${event.rewards?.[1]?.quota}</strong> ${i18nLabels.finishers} → <strong style="color: #94a3b8;">${i18nLabels.tier} 2</strong></li>` : ""}
                        ${event.rewards?.[2] ? `<li>${i18nLabels.next} <strong>${event.rewards?.[2]?.quota}</strong> ${i18nLabels.finishers} → <strong style="color: #cd7f32;">${i18nLabels.tier} 3</strong></li>` : ""}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- แต่ละ Tier Card -->
              ${event.rewards
                .map((r, i) => {
                  const isFirst = i === 0;
                  const tierColor =
                    i === 0 ? "#f59e0b" : i === 1 ? "#94a3b8" : "#cd7f32";
                  const tierGradient =
                    i === 0
                      ? "linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(217, 119, 6, 0.08))"
                      : i === 1
                        ? "linear-gradient(135deg, rgba(148, 163, 184, 0.12), rgba(100, 116, 139, 0.08))"
                        : "linear-gradient(135deg, rgba(205, 127, 50, 0.12), rgba(180, 100, 30, 0.08))";

                  // ใช้ icon เส้นทางการแข่งขัน
                  const tierIcon = i === 0 ? "🏁" : i === 1 ? "🚩" : "🎯";

                  return `
                  <div style="background: ${tierGradient}; border: 2px solid ${tierColor}40; border-radius: 14px; padding: 16px; margin-bottom: 12px; position: relative; overflow: hidden;">
                    
                    <!-- Header: Icon + Tier Name + Available Slots Badge -->
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
                      <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 44px; height: 44px; background: ${tierColor}; border: 2px solid ${tierColor}; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px ${tierColor}40;">
                          <span style="font-size: 22px; font-weight: 900; color: #1e293b; line-height: 1;">${i + 1}</span>
                        </div>
                        <div>
                          <div style="font-size: 16px; font-weight: 700; color: ${tierColor}; margin-bottom: 2px;">${i18nLabels.tier} ${i + 1}</div>
                          <div style="font-size: 13px; font-weight: 600; color: #f8fafc;">${r.name}</div>
                        </div>
                      </div>
                      
                      <!-- Badge: Available Slots (จัดกลางเสมอ) -->
                      <div style="background: ${tierColor}15; border: 1px solid ${tierColor}40; padding: 8px 14px; border-radius: 12px; min-width: 70px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                        <div style="font-size: 18px; font-weight: 700; color: ${tierColor}; line-height: 1; text-align: center;">${r.quota}</div>
                        <div style="font-size: 10px; color: ${tierColor}80; text-transform: uppercase; text-align: center; margin-top: 3px; letter-spacing: 0.5px;">${i18nLabels.slots}</div>
                      </div>
                    </div>
                    
                    <!-- เส้นทาง: อธิบายการได้รับรางวัล -->
                    <div style="background: rgba(0, 0, 0, 0.25); border-radius: 10px; padding: 14px; border: 1px solid rgba(255, 255, 255, 0.05);">
                      
                      <!-- เงื่อนไขหลัก -->
                      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                        <svg width="18" height="18" fill="none" stroke="#10b981" viewBox="0 0 24 24" stroke-width="2.5">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <div style="flex: 1;">
                          <div style="font-size: 12px; color: #64748b; margin-bottom: 3px;">${i18nLabels.requirement}</div>
                          <div style="font-size: 14px; color: #e2e8f0; font-weight: 600;">
                            ${i18nLabels.complete} <span style="color: #10b981; font-weight: 700;">${r.requirement || r.rangeEnd || 0} ${i18nLabels.rounds}</span>
                          </div>
                        </div>
                      </div>
                      
                      <!-- การจัด Ranking -->
                      <div style="display: flex; align-items: start; gap: 10px;">
                        <svg width="18" height="18" fill="none" stroke="#3b82f6" viewBox="0 0 24 24" stroke-width="2.5" style="flex-shrink: 0; margin-top: 2px;">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a4 4 0 11-8 0 4 4 0 018 0z"></path>
                        </svg>
                        <div style="flex: 1;">
                          <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">${i18nLabels.ranking}</div>
                          <div style="font-size: 13px; color: #cbd5e1; line-height: 1.5;">
                            ${
                              isFirst
                                ? currentLang === "th"
                                  ? `<strong style="color: ${tierColor};">${r.quota} คนแรก</strong>ที่ทำครบ ${r.requirement || r.rangeEnd || 0} รอบจะได้อันดับ <strong style="color: ${tierColor};">#1-${r.quota}</strong> และได้รับรางวัลนี้`
                                  : `The <strong style="color: ${tierColor};">first ${r.quota} people</strong> who complete ${r.requirement || r.rangeEnd || 0} rounds will be ranked <strong style="color: ${tierColor};">#1-${r.quota}</strong> and receive this reward.`
                                : currentLang === "th"
                                  ? `ถ้าคุณทำครบ ${r.requirement || r.rangeEnd || 0} รอบแต่ได้อันดับ <strong style="color: ${tierColor};">#${(event.rewards?.slice(0, i).reduce((sum, tier) => sum + (tier.quota || 0), 0) || 0) + 1}-${event.rewards?.slice(0, i + 1).reduce((sum, tier) => sum + (tier.quota || 0), 0) || 0}</strong> คุณจะได้รับรางวัลระดับนี้`
                                  : `If you complete ${r.requirement || r.rangeEnd || 0} rounds but are ranked <strong style="color: ${tierColor};">#${(event.rewards?.slice(0, i).reduce((sum, tier) => sum + (tier.quota || 0), 0) || 0) + 1}-${event.rewards?.slice(0, i + 1).reduce((sum, tier) => sum + (tier.quota || 0), 0) || 0}</strong> (after the first ${event.rewards?.slice(0, i).reduce((sum, tier) => sum + (tier.quota || 0), 0) || 0} finishers), you'll receive this tier.`
                            }
                          </div>
                        </div>
                      </div>
                      
                    </div>
                    
                  </div>
                `;
                })
                .join("")}
              
              <!-- สรุปท้าย -->
              <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 10px; padding: 12px; display: flex; align-items: center; gap: 10px;">
                <svg width="18" height="18" fill="none" stroke="#10b981" viewBox="0 0 24 24" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                </svg>
                <div style="font-size: 12px; color: #6ee7b7; line-height: 1.5;">
                  <strong style="color: #10b981;">${i18nLabels.finishFaster}</strong> ${i18nLabels.complete} ${event.rewards?.[0]?.rangeEnd} ${i18nLabels.completeQuickly}.
                </div>
              </div>
              
            </div>
          `
              : ""
          }
        </div>
      </div>
    `,

      didOpen: () => {
        const btn = document.getElementById("custom-close-btn");
        if (btn) {
          btn.addEventListener("click", () => Swal.close());
          btn.onmouseenter = () => {
            btn.style.background = "#ef4444";
            btn.style.transform = "scale(1.1)";
          };
          btn.onmouseleave = () => {
            btn.style.background = "rgba(0, 0, 0, 0.7)";
            btn.style.transform = "scale(1)";
          };
        }
      },
    });
  }

  // Filter Logic - OPTIMIZED with memoization
  $: debouncedUpdateSearch(searchQueryEventList);

  // Cache key for filteredEvents
  let lastFilteredEventsKey = "";
  let cachedFilteredEvents: AppEvent[] = [];

  $: {
    const cacheKey = `events_${events.length}_${debouncedSearchQuery}_${selectedMonthEventList}_${selectedYearEventList}`;
    if (cacheKey !== lastFilteredEventsKey) {
      lastFilteredEventsKey = cacheKey;
      cachedFilteredEvents = filterEventsOptimized(
        events,
        debouncedSearchQuery,
        selectedMonthEventList,
        selectedYearEventList
      );
    }
  }

  $: filteredEvents = cachedFilteredEvents;

  // Pagination Logic
  $: totalPages = Math.ceil(filteredEvents.length / itemsPerPage);
  $: paginatedEvents = filteredEvents.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  function nextPage() {
    if (currentPage < totalPages) currentPage += 1;
    showPageDropdown = false;
  }
  function prevPage() {
    if (currentPage > 1) currentPage -= 1;
    showPageDropdown = false;
  }
  function jumpToPage(page: number) {
    currentPage = page;
    showPageDropdown = false;
  }
  $: if (searchQuery) currentPage = 1;

  let perfPointsStr = "";
  $: if (perfHistory.length > 1) {
    perfPointsStr = perfHistory
      .map((p, i) => {
        const x = (i / (MAX_PERF_POINTS - 1)) * 120;
        const y =
          p.latency < 0
            ? 30
            : Math.min(30, Math.max(2, (p.latency / 500) * 28));
        return `${x},${y}`;
      })
      .join(" ");
  }

  // Timer & Logout
  function formatTime(seconds: number) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  function startTimer() {
    timerInterval = setInterval(() => {
      if (timeLeft > 0) timeLeft -= 1;
      else handleAutoLogout();
    }, 1000);
  }

  function formatClockTime(dateInput: any): string {
    if (!dateInput || dateInput === "-") return "-";
    try {
      const date = new Date(dateInput);
      if (isNaN(date.getTime())) return "-";
      return date.toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return "-";
    }
  }

  async function handleAutoLogout() {
    clearInterval(timerInterval);
    // ✅ ลบ token ออกจาก localStorage
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user_info");
    sessionStorage.removeItem("authorized_ticket");
    await Swal.fire({
      title: "Session Expired",
      text: "Please login again to continue.",
      icon: "warning",
      background: "#1e293b",
      color: "#fff",
      confirmButtonColor: "#ef4444",
      confirmButtonText: "Login",
      allowOutsideClick: false,
    });
    window.location.href = "/ku-run/auth/login";
  }

  function handleLogout() {
    Swal.fire({
      title: "Logout?",
      text: "You will be returned to the login screen.",
      icon: "warning",
      iconColor: "#ef4444",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Yes, Logout",
      background: "#1e293b",
      color: "#fff",
      customClass: {
        popup: "swal-rounded-popup",
      },
    }).then((result) => {
      if (result.isConfirmed) {
        // ✅ ลบ token และ session ทั้งหมดก่อน redirect
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("user_info");
        sessionStorage.removeItem("authorized_ticket");
        clearInterval(timerInterval);
        goto(`/ku-run/auth/login`);
      }
    });
  }

  function shouldShowJoined(log: Log): boolean {
    const actionOrder = [
      "registration",
      "check_in",
      "reward_unlocked",
      "registration_cancelled",
    ];
    const currentIndex = actionOrder.indexOf(log.action);
    return currentIndex >= 0; // แสดงทุก action
  }

  // ✅ ฟังก์ชันเช็คว่าควรแสดง "Checked In" หรือไม่
  function shouldShowCheckedIn(log: Log): boolean {
    const actionOrder = ["check_in", "reward_unlocked"];
    return actionOrder.includes(log.action);
  }

  // ✅ ฟังก์ชันเช็คว่าควรแสดง "Completed" หรือไม่
  function shouldShowCompleted(log: Log): boolean {
    return log.action === "reward_unlocked";
  }

  // ✅ ฟังก์ชันเช็คว่าควรแสดง "Proof Submitted" หรือไม่
  function shouldShowProofSubmitted(log: Log): boolean {
    return log.action === "reward_unlocked";
  }

  // ✅ ฟังก์ชันดึง timestamp ของการ Join (ถ้ามี metadata)
  function getJoinedTimestamp(log: Log): string {
    // ในกรณีจริง คุณอาจต้องดึงจาก API หรือ metadata
    // ตอนนี้ return "-" ไปก่อน
    return log.details?.joinedAt || "-";
  }

  // ✅ ฟังก์ชันดึง timestamp ของการ Check In (ถ้ามี metadata)
  function getCheckedInTimestamp(log: Log): string {
    // ในกรณีจริง คุณอาจต้องดึงจาก API หรือ metadata
    return log.details?.checkedInAt || "-";
  }

  // Real-time polling intervals
  let rewardPollingInterval: ReturnType<typeof setInterval> | null = null;
  let logsPollingInterval: ReturnType<typeof setInterval> | null = null;
  let verifyProofPollingInterval: ReturnType<typeof setInterval> | null = null;
  const POLLING_INTERVAL = 10000; // 10 seconds

  // Real-time status tracking
  let lastSyncTime: string = "";
  $: realtimePollingActive = !!(
    rewardPollingInterval ||
    logsPollingInterval ||
    verifyProofPollingInterval
  );

  function updateLastSyncTime() {
    const now = new Date();
    lastSyncTime = now.toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  function startRewardPolling() {
    if (rewardPollingInterval) return;
    rewardPollingInterval = setInterval(async () => {
      if (
        rewardAutoRefreshEnabled &&
        rewardData.selectedEvent &&
        currentView === "reward"
      ) {
        try {
          const token = localStorage.getItem("access_token");
          const headers: HeadersInit = { "Content-Type": "application/json" };
          if (token) headers["Authorization"] = `Bearer ${token}`;

          // ✅ เพิ่ม /ku-run prefix
          const res = await fetch(
            `${API_BASE_URL}/api/participations/event/${rewardData.selectedEvent.id}/report`,
            { headers }
          );
          
          if (res.status === 404) {
            // ไม่มีข้อมูล ไม่ต้องทำอะไร
            updateLastSyncTime();
            return;
          }
          
          if (res.ok) {
            const data = await res.json();
            const newCount = (
              Array.isArray(data) ? data : data.data || []
            ).filter((s: any) => s.status === "completed").length;
            const currentCount = rewardData.users.length;
            if (newCount > currentCount) {
              newRewardUsersCount = newCount - currentCount;
            }
            updateLastSyncTime();
          }
        } catch (e) {
          console.warn("Polling error:", e);
        }
      }
    }, POLLING_INTERVAL);
  }

  function stopRewardPolling() {
    if (rewardPollingInterval) {
      clearInterval(rewardPollingInterval);
      rewardPollingInterval = null;
    }
  }

  function startLogsPolling() {
    // ป้องกันการสร้าง interval ซ้อนกัน
    if (logsPollingInterval) return;

    logsPollingInterval = setInterval(async () => {
        // เช็คว่า User อยู่หน้า Log และไม่ได้พับหน้าจออยู่ (เพื่อลดภาระ Server)
        if (logsData.selectedEvent && currentView === "log" && !document.hidden) {
            try {
                const token = localStorage.getItem("access_token");
                const headers: HeadersInit = { "Content-Type": "application/json" };
                if (token) headers["Authorization"] = `Bearer ${token}`;

                // ✅ แก้ไข 1: เปลี่ยน URL ให้ตรงกับ API ที่มีจริง (current-status)
                // ตัด /ku-run ออก (ถ้า Server นี้ใช้ /api ตรงๆ)
                const res = await fetch(
                    `${API_BASE_URL}/api/participations/event/${logsData.selectedEvent.id}/current-status`,
                    { headers }
                );

                if (res.ok) {
                    const statusData = await res.json();
                    
                    // ✅ แก้ไข 2: Logic การเช็คว่าต้องโหลดใหม่ไหม
                    // สมมติว่า API ส่งกลับมามี field 'total_participants' หรือ 'joined_count'
                    // เราจะเทียบค่านี้กับค่าเก่า ถ้าไม่เท่ากันค่อยสั่ง fetchLogs()
                    
                    const currentTotal = statusData.total_participants || statusData.total || statusData.count || 0;
                    const previousTotal = logsData.eventStats?.total || 0;

                    // ถ้าจำนวนเปลี่ยน หรือยังไม่มีค่าเก่า ให้โหลด Logs ใหม่
                    if (currentTotal !== previousTotal) {
                        console.log("🔄 Detected changes, refreshing logs...");
                        logsData.eventStats = { total: currentTotal, ...statusData };
                        await fetchLogs();
                    }
                    
                    updateLastSyncTime();
                }
            } catch (e) {
                // ไม่ต้อง log error แดง ให้ log เป็น warn พอจะได้ไม่รก console
                console.warn("⚠️ Logs polling skipped:", e);
            }
        }
    }, POLLING_INTERVAL);
}


  function stopLogsPolling() {
    if (logsPollingInterval) {
      clearInterval(logsPollingInterval);
      logsPollingInterval = null;
    }
  }

  function startVerifyProofPolling() {
    if (verifyProofPollingInterval) return;
    verifyProofPollingInterval = setInterval(async () => {
      if (
        verifyProofAutoRefreshEnabled &&
        verifyProofData.selectedEvent &&
        currentView === "verify-proof"
      ) {
        try {
          const token = localStorage.getItem("access_token");
          const headers: HeadersInit = { "Content-Type": "application/json" };
          if (token) headers["Authorization"] = `Bearer ${token}`;

          // ✅ เพิ่ม /ku-run prefix
          const res = await fetch(
            `${API_BASE_URL}/api/participations/event/${verifyProofData.selectedEvent.id}/report`,
            { headers }
          );
          
          if (res.status === 404) {
            // ไม่มีข้อมูล ไม่ต้องทำอะไร
            updateLastSyncTime();
            return;
          }
          
          if (res.ok) {
            const data = await res.json();
            const newPending = (
              Array.isArray(data) ? data : data.data || []
            ).filter((s: any) => s.status === "proof_submitted").length;
            const currentPending = verifyProofData.submissions.length;
            if (newPending > currentPending) {
              newVerifyProofCount = newPending - currentPending;
            }
            updateLastSyncTime();
          }
        } catch (e) {
          console.warn("Verify proof polling error:", e);
        }
      }
    }, POLLING_INTERVAL);
  }

  function stopVerifyProofPolling() {
    if (verifyProofPollingInterval) {
      clearInterval(verifyProofPollingInterval);
      verifyProofPollingInterval = null;
    }
  }

  onMount(() => {
    initializeTokenTimer();
    startPerfMonitor();
    startRewardPolling();
    startLogsPolling();
    startVerifyProofPolling();

    // โหลด jsQR library
  });
  onDestroy(() => {
    clearInterval(timerInterval);
    stopPerfMonitor();
    stopCamera();
    stopRewardPolling();
    stopLogsPolling();
    stopVerifyProofPolling();
    if (verifyErrorTimeout) clearTimeout(verifyErrorTimeout);
  });

  const ce_days = Array.from({ length: 31 }, (_, i) => i + 1);
  const ce_months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const ce_months_th = [
    "มกราคม",
    "กุมภาพันธ์",
    "มีนาคม",
    "เมษายน",
    "พฤษภาคม",
    "มิถุนายน",
    "กรกฎาคม",
    "สิงหาคม",
    "กันยายน",
    "ตุลาคม",
    "พฤศจิกายน",
    "ธันวาคม",
  ];

  // ฟังก์ชันแปลเดือน
  function translateMonth(monthEn: string): string {
    const idx = ce_months.indexOf(monthEn);
    if (idx === -1) return monthEn;
    return currentLang === "th" ? ce_months_th[idx] : monthEn;
  }

  const ce_currYear = new Date().getFullYear();
  const ce_years = Array.from({ length: 5 }, (_, i) => ce_currYear + i);

  // สร้าง List เวลา 00:00 - 23:30
  const ce_timeList: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      ce_timeList.push(
        `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`
      );
    }
  }

  // ==========================================
  // 🟢 STATE VARIABLES (Prefix: ce_)
  // ==========================================

  let ce_fileInput: HTMLInputElement;
  let ce_activeDropdown: string | null = null; // ตัวแปรคุม Dropdown เฉพาะหน้านี้

  // ข้อมูลฟอร์ม (ตั้งชื่อใหม่เป็น ce_formData)
  let ce_formData: CreateEventForm = {
    title: "",
    description: "",
    location: "",
    sDay: "",
    sMonth: "",
    sYear: "",
    eDay: "",
    eMonth: "",
    eYear: "",
    startTime: "",
    endTime: "",
    totalSlots: null,
    distanceKm: null,
    holidays: [],
    excludeWeekends: false,
    tempHoliday: "",
    rewards: [
      {
        quota: null,
        rangeStart: 1,
        rangeEnd: null,
        name: "",
        requirement: null,
      },
    ],
    isPublic: false,
    isActive: false,
    imagePreview: null,
  };

  let ce_selectedFile: File | null = null;
  let ce_tempSelectedDates: string[] = [];
  let ce_availableDatesList: {
    value: string;
    day: string;
    monthShort: string;
  }[] = [];

  // สถานะสำหรับควบคุม Holiday Options
  let ce_holidayMode: "none" | "weekends" | "specific" | null = null;
  let ce_validationErrors: Set<string> = new Set();

  // ==========================================
  // 🟢 COMPUTED & LIFECYCLE
  // ==========================================

  $: ce_hasDates =
    ce_formData.sDay &&
    ce_formData.sMonth &&
    ce_formData.sYear &&
    ce_formData.eDay &&
    ce_formData.eMonth &&
    ce_formData.eYear;
  $: ce_hasSlots = ce_formData.totalSlots && ce_formData.totalSlots > 0;

  // ปิด Dropdown เมื่อคลิกที่อื่น
  onMount(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as Element;
      // ✅ ไม่ปิด dropdown ถ้าคลิกที่ trigger หรือ options หรือ opt หรือ dd-wrap
      if (
        !target.closest(".ce-trigger") &&
        !target.closest(".ce-options") &&
        !target.closest(".ce-opt") &&
        !target.closest(".ce-dd-wrap")
      ) {
        ce_activeDropdown = null;
      }
    };

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;

      if (!target.closest(".filter-dropdown-logs")) {
        logsData.actionDropdownOpen = false;
        logsData.statusDropdownOpen = false;
      }

      if (!target.closest(".custom-date-dropdown-logs")) {
        logsData.dateFromDropdownOpen = false;
        logsData.dateToDropdownOpen = false;
      }
    }

    document.addEventListener("click", handleClickOutside);
    // ✅ ใช้ mousedown แทน click เพื่อให้ click event ใน dropdown ทำงานก่อน
    window.addEventListener("mousedown", handleGlobalClick);
    return () => {
      window.removeEventListener("mousedown", handleGlobalClick);
      document.removeEventListener("click", handleClickOutside);
    };
  });

  // ==========================================
  // 🟢 FUNCTIONS (Prefix: ce_)
  // ==========================================

  // ฟังก์ชันเริ่มสร้าง Event ใหม่ (Reset ค่า)
  // ** ใช้ฟังก์ชันนี้กับปุ่ม "+ Create" ในหน้า List **
  function ce_initCreate() {
    ce_formData = {
      title: "",
      description: "",
      location: "",
      sDay: "",
      sMonth: "",
      sYear: "",
      eDay: "",
      eMonth: "",
      eYear: "",
      startTime: "",
      endTime: "",
      totalSlots: null,
      distanceKm: null,
      holidays: [],
      excludeWeekends: false,
      tempHoliday: "",
      rewards: [
        {
          quota: null,
          rangeStart: 1,
          rangeEnd: null,
          name: "",
          requirement: null, // Add this line
        },
      ],
      isPublic: false,
      isActive: false,
      imagePreview: null,
    };
    ce_holidayMode = null; // เปลี่ยนเป็น null
    ce_validationErrors = new Set(); // เพิ่มบรรทัดนี้
    ce_activeDropdown = null;
    currentView = "create";
  }

  function ce_setHolidayMode(mode: "none" | "weekends" | "specific" | null) {
    ce_holidayMode = mode;

    if (mode === "none") {
      ce_formData.holidays = [];
      ce_formData.excludeWeekends = false;
    } else if (mode === "weekends") {
      ce_formData.holidays = [];
      ce_formData.excludeWeekends = true;
    } else if (mode === "specific") {
      ce_formData.excludeWeekends = false;
      // เก็บ holidays ไว้ตามเดิม
    }

    ce_formData = { ...ce_formData };
  }

  function ce_resetHolidays() {
    ce_formData.holidays = [];
    ce_formData = { ...ce_formData };
  }
  // เปิด/ปิด Dropdown
  function ce_toggleDD(id: string) {
    console.log("🔽 ce_toggleDD:", { id, current: ce_activeDropdown });
    if (ce_activeDropdown === id) {
      ce_activeDropdown = null;
    } else {
      ce_activeDropdown = id;
    }
  }

  // เลือกค่าทั่วไป (วัน/เดือน/ปี) -> บังคับอัปเดตหน้าจอ
  function ce_selectOpt(key: string, value: any) {
    console.log("🔄 ce_selectOpt called:", {
      key,
      value,
      before: (ce_formData as any)[key],
    });

    // ✅ แปลง day และ year เป็น string เพื่อให้ consistent
    if (
      key === "sDay" ||
      key === "eDay" ||
      key === "sYear" ||
      key === "eYear"
    ) {
      (ce_formData as any)[key] = String(value);
    } else {
      (ce_formData as any)[key] = value;
    }

    // Force Svelte reactivity update
    ce_formData = { ...ce_formData };
    ce_activeDropdown = null;

    console.log("🔄 ce_selectOpt after:", {
      key,
      newValue: (ce_formData as any)[key],
    });
  }

  // เลือกค่า Combobox (Time/Slots) -> คำนวณ Tier ใหม่
  function ce_selectCombo(key: string, value: any) {
    (ce_formData as any)[key] = value;
    ce_formData = { ...ce_formData }; // Force Svelte Update
    ce_activeDropdown = null;

    if (key === "totalSlots") ce_calcTiers();
  }

  // ห้ามค่าติดลบ
  function ce_noNegative(e: Event) {
    const target = e.target as HTMLInputElement;
    if (parseFloat(target.value) < 0) target.value = "";
  }

  // คำนวณโควต้า Reward
  function ce_calcTiers() {
    let currentCount = 0;

    // Helper หา Max Quota
    const getMax = (idx: number) => {
      if (!ce_formData.totalSlots) return 0;
      const used = ce_formData.rewards.reduce(
        (sum, r, i) => (i === idx ? sum : sum + (r.quota || 0)),
        0
      );
      return Math.max(0, ce_formData.totalSlots - used);
    };

    ce_formData.rewards = ce_formData.rewards.map((reward, index) => {
      const max = getMax(index);
      if (reward.quota && reward.quota > max) reward.quota = max;

      const q = reward.quota || 0;
      const start = currentCount + 1;
      let end = start + q - 1;
      if (q === 0) end = start;

      currentCount += q;

      // ใช้ rangeEnd ที่ผู้ใช้กำหนด หรือถ้าไม่มีให้ใช้ค่าเริ่มต้น
      return {
        ...reward,
        rangeStart: start,
        rangeEnd: reward.rangeEnd, // เก็บค่าที่ user ใส่ หรือ null
      };
    });
    ce_formData = { ...ce_formData };
  }

  function ce_addTier() {
    if (!ce_hasSlots) return;
    ce_formData.rewards = [
      ...ce_formData.rewards,
      {
        quota: null,
        rangeStart: 0,
        rangeEnd: null,
        name: "",
        requirement: null, // Add this line
      },
    ];
    ce_calcTiers();
  }

  function ce_removeTier(idx: number) {
    ce_formData.rewards = ce_formData.rewards.filter((_, i) => i !== idx);
    ce_calcTiers();
  }

  // จัดการ Holiday
  const getMonthIdx = (m: string) => ce_months.indexOf(m);

  // สร้าง Date Object เพื่อเปรียบเทียบ
  $: startDateObj =
    ce_formData.sDay && ce_formData.sMonth && ce_formData.sYear
      ? new Date(
          Number(ce_formData.sYear),
          getMonthIdx(ce_formData.sMonth),
          Number(ce_formData.sDay)
        )
      : null;

  $: endDateObj =
    ce_formData.eDay && ce_formData.eMonth && ce_formData.eYear
      ? new Date(
          Number(ce_formData.eYear),
          getMonthIdx(ce_formData.eMonth),
          Number(ce_formData.eDay)
        )
      : null;

  // เช็คว่าวันที่ถูกต้องไหม (Start <= End)
  $: isDateRangeValid =
    startDateObj &&
    endDateObj &&
    startDateObj.getTime() <= endDateObj.getTime();
  // กำหนดขอบเขตวัน (min/max) สำหรับปฏิทิน Holiday
  $: holidayMin = startDateObj ? startDateObj.toISOString().split("T")[0] : "";
  $: holidayMax = endDateObj ? endDateObj.toISOString().split("T")[0] : "";

  // 2. Logic คำนวณ Rewards แบบ Real-time
  $: usedSlots = ce_formData.rewards.reduce(
    (sum, r) => sum + (r.quota || 0),
    0
  );
  $: remainingSlots = (ce_formData.totalSlots || 0) - usedSlots;
  $: isCapacityOver = remainingSlots < 0; // เช็คว่าเกินโควต้าไหม

  function ce_recalcRewards() {
    // คำนวณ rangeStart และ rangeEnd จาก quota
    let prevEnd = 0;
    ce_formData.rewards.forEach((reward: any, i: number) => {
      reward.rangeStart = prevEnd + 1;
      reward.rangeEnd = prevEnd + (reward.quota || 0);
      prevEnd = reward.rangeEnd;
    });
  }

  // 3. Logic เพิ่ม Holiday (ต้องอยู่ในช่วงวันที่จัดงานเท่านั้น)
  // แทนที่ฟังก์ชันเดิม
  function ce_addHoliday() {
    if (!ce_formData.tempHoliday) return;

    // ไม่ต้องเช็คช่วงเพราะ dropdown มีแค่วันในช่วงอยู่แล้ว
    if (!ce_formData.holidays.includes(ce_formData.tempHoliday)) {
      ce_formData.holidays = [...ce_formData.holidays, ce_formData.tempHoliday];
    }
    ce_formData.tempHoliday = "";
    ce_activeDropdown = null;
  }

  $: statusTitle = (() => {
    if (!ce_formData.isPublic && !ce_formData.isActive) return "Draft Mode";
    if (ce_formData.isPublic && !ce_formData.isActive) return "Preview Mode";
    if (!ce_formData.isPublic && ce_formData.isActive) return "Private Link";
    return "Live & Public";
  })();

  $: statusDesc = (() => {
    if (!ce_formData.isPublic && !ce_formData.isActive)
      return "Users cannot see or join this event.";
    if (ce_formData.isPublic && !ce_formData.isActive)
      return "Visible on feed, but registration is closed.";
    if (!ce_formData.isPublic && ce_formData.isActive)
      return "Hidden from feed. Join via direct link only.";
    return "Visible to everyone and registration is open.";
  })();

  function ce_handleTimeInput(e: Event, key: string) {
    const target = e.target as HTMLInputElement;
    let val = target.value.replace(/[^0-9]/g, ""); // เอาเฉพาะตัวเลข

    // จำกัดชั่วโมง 23 และ นาที 59
    if (val.length >= 2) {
      let hh = parseInt(val.substring(0, 2));
      if (hh > 23) val = "23" + val.substring(2);
    }
    if (val.length >= 4) {
      let mm = parseInt(val.substring(2, 4));
      if (mm > 59) val = val.substring(0, 2) + "59";
    }

    // เติม : อัตโนมัติ
    if (val.length > 2) {
      val = val.substring(0, 2) + ":" + val.substring(2, 4);
    }

    (ce_formData as any)[key] = val;
    // ✅ Force Svelte reactivity update
    ce_formData = { ...ce_formData };
  }

  function ce_delHoliday(h: string) {
    ce_formData.holidays = ce_formData.holidays.filter((x) => x !== h);
  }

  // สร้างลิสต์วันที่ทั้งหมดที่อยู่ในช่วง Start - End Date
  $: availableDates = (() => {
    
    if (!startDateObj || !endDateObj || !isDateRangeValid) return [];

    const dates = [];
    const current = new Date(startDateObj);

    while (current <= endDateObj) {
      const dayOfWeek = current.getDay(); // 0=Sunday, 6=Saturday
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

      dates.push({
        value: current.toISOString().split("T")[0],
        day: current.getDate(),
        dayName: dayNames[dayOfWeek],
        month: ce_months[current.getMonth()],
        year: current.getFullYear(),
        fullDisplay: `${dayNames[dayOfWeek]}, ${current.getDate()} ${ce_months[current.getMonth()]} ${current.getFullYear()}`,
      });
      current.setDate(current.getDate() + 1);
    }

    return dates;
  })();

  // จัดกลุ่มวันที่ตามเดือน
  $: groupedDates = (() => {
    const groups: { [key: string]: typeof availableDates } = {};
    availableDates.forEach((date) => {
      const key = `${date.month} ${date.year}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(date);
    });
    return groups;
  })();

  function ce_toggleHoliday(dateValue: string) {
    if (ce_formData.holidays.includes(dateValue)) {
      ce_formData.holidays = ce_formData.holidays.filter(
        (h) => h !== dateValue
      );
    } else {
      ce_formData.holidays = [...ce_formData.holidays, dateValue];
    }
  }

  // จัดการรูปภาพ
  function ce_handleImg(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files[0]) {
      const reader: FileReader = new FileReader();
      reader.onload = (ev) => {
        ce_formData.imagePreview = ev.target?.result as string;
      };
      reader.readAsDataURL(target.files[0]);
    }
  }
  function ce_trigFile() {
    ce_fileInput.click();
  }

  let editingEventId: number | null = null;

  /**
   * handleEdit - โหลดข้อมูล Event เข้าฟอร์มเพื่อแก้ไข
   * @param event - Event object ที่ต้องการแก้ไข
   *
   * การทำงาน:
   * 1. เก็บ ID ของ Event ที่กำลังแก้ไข
   * 2. ดึงค่า isPublic/isActive จาก event object
   * 3. Set ค่าทั้งหมดเข้า ce_formData
   * 4. บังคับ Svelte reactivity update ด้วย tick()
   * 5. เปลี่ยนไปหน้า create form
   */
  async function handleEdit(event: AppEvent) {
    console.log("📝 handleEdit called with event:", event);

    // Debug: แสดงค่า status flags จาก event object
    console.log("📝 Status flags from event:", {
      isPublic: event.isPublic,
      isActive: event.isActive,
      is_published: (event as any).is_published,
      is_active: (event as any).is_active,
      typeOfIsPublic: typeof event.isPublic,
      typeOfIsActive: typeof event.isActive,
    });

    // เก็บ ID ของ Event ที่กำลัง Edit
    editingEventId = event.id as number;

    // ดึงค่า boolean - ต้องใช้ทั้ง isPublic และ is_published เพราะอาจมาจากคนละที่
    // Priority: isPublic > is_published > false
    let isPublicValue = false;
    if (typeof event.isPublic === "boolean") {
      isPublicValue = event.isPublic;
    } else if (typeof (event as any).is_published === "boolean") {
      isPublicValue = (event as any).is_published;
    }

    let isActiveValue = false;
    if (typeof event.isActive === "boolean") {
      isActiveValue = event.isActive;
    } else if (typeof (event as any).is_active === "boolean") {
      isActiveValue = (event as any).is_active;
    }

    console.log("📝 Computed boolean values:", {
      isPublicValue,
      isActiveValue,
    });

    // สร้าง form data object ใหม่
    const newFormData: CreateEventForm = {
      // Basic info
      title: event.title || "",
      description: event.description || "",
      location: event.location || "",

      // Start date
      sDay: String(event.startDate?.day || ""),
      sMonth: event.startDate?.month || "",
      sYear: String(event.startDate?.year || ""),

      // End date
      eDay: String(event.endDate?.day || ""),
      eMonth: event.endDate?.month || "",
      eYear: String(event.endDate?.year || ""),

      // Time
      startTime: event.startTime || "",
      endTime: event.endTime || "",

      // Capacity & Distance
      totalSlots: event.totalSlots || null,
      distanceKm: event.distanceKm || null,

      // Holidays
      holidays: event.holidays || [],
      excludeWeekends: event.excludeWeekends || false,
      tempHoliday: "",

      // Rewards
      rewards:
        event.rewards && event.rewards.length > 0
          ? event.rewards.map((r) => ({
              quota: r.quota,
              rangeStart: r.rangeStart,
              rangeEnd: r.rangeEnd,
              name: r.name,
              requirement: r.requirement ?? null,
            }))
          : [
              {
                quota: null,
                rangeStart: 1,
                rangeEnd: null,
                name: "",
                requirement: null,
              },
            ],

      // Status flags - ใช้ค่าที่คำนวณมาแล้ว
      isPublic: isPublicValue,
      isActive: isActiveValue,

      // Image
      imagePreview: event.image || null,
    };

    // Set form data
    ce_formData = newFormData;

    console.log("📝 ce_formData after set:", {
      isPublic: ce_formData.isPublic,
      isActive: ce_formData.isActive,
    });

    // บังคับ Svelte reactivity update
    await tick();

    // Double check หลัง tick
    console.log("📝 ce_formData after tick:", {
      isPublic: ce_formData.isPublic,
      isActive: ce_formData.isActive,
    });

    // ตั้งค่า holidayMode
    if (event.excludeWeekends) {
      ce_holidayMode = "weekends";
    } else if (event.holidays && event.holidays.length > 0) {
      ce_holidayMode = "specific";
    } else {
      ce_holidayMode = "none";
    }

    // เปลี่ยนไปหน้า Create (ซึ่งจะแสดงเป็น Edit)
    currentView = "create";

    console.log("📝 Editing event ID:", editingEventId);
  }

  /**
   * ce_submit - บันทึก Event (สร้างใหม่หรือแก้ไข)
   *
   * การทำงาน:
   * 1. Validate ข้อมูลในฟอร์ม
   * 2. สร้าง Date objects จาก form data
   * 3. อัพโหลดรูปภาพถ้ามี
   * 4. ส่งข้อมูลไป API (POST หรือ PUT)
   * 5. บันทึก holidays และ rewards
   * 6. Refresh events list
   */
  async function ce_submit() {
    // 1. Clear previous errors & Validation
    ce_validationErrors = new Set();
    const errors: string[] = [];

    if (!ce_formData.title) {
      ce_validationErrors.add("title");
      errors.push("Event Name is required");
    }
    if (!ce_formData.description) {
      ce_validationErrors.add("description");
      errors.push("Description is required");
    }
    if (!ce_formData.location) {
      ce_validationErrors.add("location");
      errors.push("Location is required");
    }
    if (!ce_formData.sDay || !ce_formData.sMonth || !ce_formData.sYear) {
      ce_validationErrors.add("startDate");
      errors.push("Start Date is required");
    }
    if (!ce_formData.eDay || !ce_formData.eMonth || !ce_formData.eYear) {
      ce_validationErrors.add("endDate");
      errors.push("End Date is required");
    }
    if (!ce_formData.startTime) {
      ce_validationErrors.add("startTime");
      errors.push("Start Time is required");
    }
    if (!ce_formData.endTime) {
      ce_validationErrors.add("endTime");
      errors.push("End Time is required");
    }
    if (!ce_formData.totalSlots) {
      ce_validationErrors.add("totalSlots");
      errors.push("Capacity is required");
    }

    if (!isDateRangeValid && ce_hasDates) {
      ce_validationErrors.add("dateRange");
      errors.push("Invalid date range");
    }
    if (isDateRangeValid && !ce_holidayMode) {
      ce_validationErrors.add("holidays");
      errors.push("Please select a holiday option");
    }

    if (errors.length > 0) {
      ce_validationErrors = new Set(ce_validationErrors);
      setTimeout(() => {
        ce_validationErrors = new Set();
      }, 5000);
      return;
    }

    // 2. เตรียมข้อมูล Payload
    const startMonthIndex = ce_months.indexOf(ce_formData.sMonth) + 1;
    const endMonthIndex = ce_months.indexOf(ce_formData.eMonth) + 1;

    const startDate = new Date(
      Date.UTC(
        Number(ce_formData.sYear),
        getMonthIdx(ce_formData.sMonth),
        Number(ce_formData.sDay),
        Number(ce_formData.startTime.split(":")[0]), // ชั่วโมง
        Number(ce_formData.startTime.split(":")[1]) // นาที
      )
    );
    const endDate = new Date(
      Date.UTC(
        Number(ce_formData.eYear),
        getMonthIdx(ce_formData.eMonth),
        Number(ce_formData.eDay),
        Number(ce_formData.endTime.split(":")[0]),
        Number(ce_formData.endTime.split(":")[1])
      )
    );

    try {
      // 🔵 STEP A: จัดการรูปภาพ
      const token = localStorage.getItem("access_token");

      // ✅ แก้เป็น: เริ่มต้นด้วยค่าจาก imagePreview เดิม (ถ้าเป็น URL) หรือค่าว่าง
      let bannerImageUrl = "";

      // เช็คว่า imagePreview มีค่าไหม
      if (ce_formData.imagePreview) {
        if (ce_formData.imagePreview.startsWith("data:")) {
          // 1. กรณีเป็น Base64 (มีการอัปโหลดใหม่) -> ให้ทำ Upload เหมือนเดิม
          console.log("📤 Uploading new image...");

          const base64Data = ce_formData.imagePreview;
          const byteString = atob(base64Data.split(",")[1]);
          const mimeType = base64Data.split(",")[0].split(":")[1].split(";")[0];
          const ab = new ArrayBuffer(byteString.length);
          const ia = new Uint8Array(ab);
          for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
          }
          const blob = new Blob([ab], { type: mimeType });
          const file = new File([blob], "banner.jpg", { type: mimeType });

          const formData = new FormData();
          formData.append("file", file);

          try {
            const uploadRes = await api.post("/api/images/upload", formData, {
              headers: { "Content-Type": "multipart/form-data" },
            });
            bannerImageUrl =
              uploadRes.data.url || uploadRes.data.image_url || "";
            console.log("✅ Image uploaded:", bannerImageUrl);
          } catch (uploadErr) {
            console.warn("Image upload failed:", uploadErr);
          }
        } else if (ce_formData.imagePreview.startsWith("http")) {
          // 2. ✅ กรณีเป็น URL (รูปเดิมที่ไม่ได้แก้) -> ให้ใช้ค่าเดิมเลย
          bannerImageUrl = ce_formData.imagePreview;
          console.log("ℹ️ Using existing image:", bannerImageUrl);
        }
      }

      // 🔵 STEP B: ส่งข้อมูล Event ไปที่ API หลัก
      const apiPayload: any = {
        title: ce_formData.title,
        description: ce_formData.description,
        event_date: startDate.toISOString(),
        event_end_date: endDate.toISOString(),
        location: ce_formData.location,
        distance_km: Math.round(Number(ce_formData.distanceKm) || 0), // API requires integer
        max_participants: Number(ce_formData.totalSlots) || 1,
        is_active: Boolean(ce_formData.isActive),
        is_published: Boolean(ce_formData.isPublic),
      };

      // เพิ่ม banner_image_url เฉพาะเมื่อมีค่า
      if (bannerImageUrl) {
        apiPayload.banner_image_url = bannerImageUrl;
      }

      console.log("📤 Sending payload:", apiPayload);
      console.log("📤 ce_formData dates:", {
        sDay: ce_formData.sDay,
        sMonth: ce_formData.sMonth,
        sYear: ce_formData.sYear,
        eDay: ce_formData.eDay,
        eMonth: ce_formData.eMonth,
        eYear: ce_formData.eYear,
      });
      console.log("📤 Calculated dates:", {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });
      console.log(
        "📤 isEditing:",
        editingEventId !== null,
        "eventId:",
        editingEventId
      );

      const isEditing = editingEventId !== null;

      let responseData;
      try {
        if (isEditing) {
          const response = await api.put(
            `/api/events/${editingEventId}`,
            apiPayload
          );
          responseData = response.data;
        } else {
          const response = await api.post("/api/events/", apiPayload);
          responseData = response.data;
        }
        console.log("📥 Response data:", responseData);
      } catch (apiErr: any) {
        console.error("❌ API Error:", apiErr.response?.data || apiErr);
        const errorData = apiErr.response?.data;
        const errorMsg = errorData?.detail
          ? Array.isArray(errorData.detail)
            ? errorData.detail
                .map((d: any) => d.msg || JSON.stringify(d))
                .join(", ")
            : errorData.detail
          : `Failed to ${isEditing ? "update" : "create"} event`;
        throw new Error(errorMsg);
      }

      const createdEvent = responseData;

      // 🔵 STEP C: บันทึกวันหยุดลงไฟล์ JSON
      // คำนวณวันเสาร์-อาทิตย์ทั้งหมดถ้า excludeWeekends เป็น true
      let allHolidays: string[] = [...ce_formData.holidays];

      if (ce_formData.excludeWeekends) {
        const weekends: string[] = [];
        const current = new Date(startDate);
        const end = new Date(endDate);

        while (current <= end) {
          const dayOfWeek = current.getDay();
          if (dayOfWeek === 0 || dayOfWeek === 6) {
            // 0 = Sunday, 6 = Saturday
            const dateStr = current.toISOString().split("T")[0]; // "YYYY-MM-DD"
            if (!allHolidays.includes(dateStr)) {
              weekends.push(dateStr);
            }
          }
          current.setDate(current.getDate() + 1);
        }

        // รวม weekends เข้ากับ allHolidays
        allHolidays.push(...weekends);
        allHolidays.sort();

        console.log("📅 Calculated weekends:", weekends.length, "days");
      }

      console.log("📅 Final allHolidays:", allHolidays.length, allHolidays);

      const holidayPayload = {
        eventId: createdEvent.id,
        eventTitle: createdEvent.title,
        holidays: allHolidays,
        excludeWeekends: ce_formData.excludeWeekends,
        rewards: ce_formData.rewards.filter((r) => r.name && r.quota),
      };

      console.log("📅 Saving holidays:", JSON.stringify(holidayPayload));

      // ✅ ส่ง POST request เพื่อบันทึกข้อมูล (รองรับทั้ง CREATE และ EDIT)
      try {
        const holidayRes = await fetch("/ku-run/internal/holidays", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(holidayPayload)
        });

        if (!holidayRes.ok) {
          const errorData = await holidayRes.json();
          console.error("❌ Failed to save holidays:", errorData);
          throw new Error("Failed to save holiday configuration");
        }

        const holidayResult = await holidayRes.json();
        console.log("✅ Holidays saved successfully:", holidayResult);

      } catch (holidayErr) {
        console.error("❌ Holiday save error:", holidayErr);
        // แจ้งเตือนแต่ไม่ block การสร้าง/แก้ไข event
        Swal.fire({
          icon: "warning",
          title: currentLang === "th" ? "เกิดข้อผิดพลาดบางส่วน" : "Partial Error",
          text: currentLang === "th" 
            ? `Event ${isEditing ? "อัพเดท" : "สร้าง"}สำเร็จ แต่ไม่สามารถบันทึกข้อมูลวันหยุดได้` 
            : `Event ${isEditing ? "updated" : "created"} but failed to save holiday configuration`,
          background: "#1e293b",
          color: "#fff",
          confirmButtonColor: "#f59e0b",
        });
      }

      // 3. แสดงผล Success และล้างฟอร์ม
      Swal.fire({
        title: isEditing ? lang.eventUpdated : lang.eventCreated,
        text: `"${ce_formData.title}" ${isEditing ? (currentLang === "th" ? "อัพเดทสำเร็จแล้ว" : "has been updated successfully") : currentLang === "th" ? "สร้างสำเร็จแล้ว" : "has been created successfully"}`,
        icon: "success",
        background: "#1e293b",
        color: "#fff",
        confirmButtonColor: "#10b981",
        timer: 2000,
        showConfirmButton: false,
      });

      // ✅ Reset ALL caches to force fresh data display
      lastFilteredEventsKey = "";
      cachedFilteredEvents = [];
      filterCache.clear(); // Clear the global filter cache Map

      // ✅ Invalidate SvelteKit's internal cache
      await invalidateAll();

      // ✅ Fetch fresh data from API
      await fetchEvents();

      // ✅ Force Svelte reactivity by creating new array reference
      events = [...events];

      // ✅ Reset pagination
      currentPage = 1;

      // ✅ Also clear reward events cache
      cachedFilteredEventsForReward = [];

      // ✅ Small delay to ensure DOM updates properly
      await new Promise((resolve) => setTimeout(resolve, 150));

      // ✅ Double-ensure cache is cleared after delay (race condition prevention)
      lastFilteredEventsKey = "";

      currentView = "list";
      editingEventId = null;
      // Reset Form
      ce_formData = {
        title: "",
        description: "",
        location: "",
        sDay: "",
        sMonth: "",
        sYear: "",
        eDay: "",
        eMonth: "",
        eYear: "",
        startTime: "",
        endTime: "",
        totalSlots: null,
        distanceKm: null,
        holidays: [],
        excludeWeekends: false,
        tempHoliday: "",
        rewards: [
          {
            quota: null,
            rangeStart: 1,
            rangeEnd: null,
            name: "",
            requirement: null,
          },
        ],
        isPublic: false,
        isActive: false,
        imagePreview: null,
      };

      ce_holidayMode = null;
      ce_validationErrors = new Set();
    } catch (error) {
      console.error(error);
      Swal.fire({
        icon: "error",
        title: lang.error,
        text:
          currentLang === "th"
            ? "ไม่สามารถเชื่อมต่อ API ได้ กรุณาลองใหม่อีกครั้ง"
            : "Failed to connect to API. Please try again.",
        background: "#1e293b",
        color: "#fff",
      });
    }
  }
  // ==========================================
  // 🔧 LOGS VIEW STATE VARIABLES
  // ==========================================

  let logsData: LogsData = {
    selectedEvent: null,
    logs: [],
    loading: false,
    error: "",
    searchQuery: "",
    selectedAction: "All",
    selectedStatus: "All",
    dateFrom: "",
    dateTo: "",
    currentPage: 1,
    itemsPerPage: 10,
    totalItems: 0,
    totalPages: 0,

    // กำหนดค่าเริ่มต้นให้ส่วนที่เพิ่มมา
    actionDropdownOpen: false,
    statusDropdownOpen: false,
    dateFromDropdownOpen: false,
    dateToDropdownOpen: false,
    showDetailModal: false,
    selectedLog: null,
    statistics: {
      totalLogs: 0,
      uniqueUsers: 0,
      successRate: 0,
      topAction: "-",
    },
  };

  let filteredLogs: Log[] = [];

  $: logsToDisplay =
    filteredLogs.length > 0 ||
    logsData.selectedAction ||
    logsData.selectedStatus ||
    logsData.searchQuery ||
    logsData.dateFrom ||
    logsData.dateTo
      ? filteredLogs
      : logsData.logs;

  $: paginatedLogsForList = logsToDisplay.slice(
    (logsListPage - 1) * logsListPerPage,
    logsListPage * logsListPerPage
  );

  let eventsForLogsPage = 1;
  const eventsForLogsPerPage = 8;

  // Action Types Configuration
  const actionTypes = [
    {
      value: "registration",
      label: "Joined",
      icon: "M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z",
      color: "#3b82f6",
    },
    {
      value: "check_in",
      label: "Checked In",
      icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
      color: "#06b6d4",
    },
    {
      value: "reward_unlocked",
      label: "Completed",
      icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
      color: "#10b981",
    },
    {
      value: "registration_cancelled",
      label: "Cancelled",
      icon: "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z",
      color: "#64748b",
    },
    {
      value: "no_show",
      label: "Rejected",
      icon: "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z",
      color: "#ef4444",
    },
  ];

  const statusTypes = [
    { value: "All", label: "All Status", color: "#64748b" },
    { value: "success", label: "Success", color: "#10b981" },
    { value: "failed", label: "Failed", color: "#ef4444" },
    { value: "pending", label: "Pending", color: "#f59e0b" },
    { value: "warning", label: "Warning", color: "#f97316" },
  ];

  // ==========================================
  // 🔄 LOGS FUNCTIONS
  // ==========================================

  $: availableDatesForFilter = (() => {
    if (!logsData.selectedEvent) return [];

    const event = logsData.selectedEvent;
    const startDate = new Date(
      parseInt(event.year),
      getMonthIdx(event.month),
      1
    );
    const endDate = new Date(
      parseInt(event.year),
      getMonthIdx(event.month) + 1,
      0
    );

    const dates = [];
    const current = new Date(startDate);
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    while (current <= endDate) {
      dates.push({
        value: current.toISOString().split("T")[0],
        display: `${dayNames[current.getDay()]}, ${current.getDate()} ${event.month} ${event.year}`,
      });
      current.setDate(current.getDate() + 1);
    }

    return dates;
  })();

  $: totalEventsForLogsDisplayPages = Math.ceil(
    filteredEventsForLogs.length / eventsForLogsPerPage
  );
  $: paginatedEventsForLogsDisplay = filteredEventsForLogs.slice(
    (eventsForLogsPage - 1) * eventsForLogsPerPage,
    eventsForLogsPage * eventsForLogsPerPage
  );

  function nextEventsForLogsPage() {
    if (eventsForLogsPage < totalEventsForLogsDisplayPages) {
      eventsForLogsPage += 1;
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function prevEventsForLogsPage() {
    if (eventsForLogsPage > 1) {
      eventsForLogsPage -= 1;
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function jumpToEventsForLogsPage(page: number) {
    eventsForLogsPage = page;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function selectEventForLogs(event: AppEvent) {
    logsData.selectedEvent = event;
    logsData.loading = true;
    logsData.error = "";

    // Reset filters
    logsData.searchQuery = "";
    logsData.selectedAction = "";
    logsData.selectedStatus = "";
    logsData.dateFrom = "";
    logsData.dateTo = "";

    try {
      await fetchLogs();

      // ⬇️ สำคัญ: set filteredLogs ให้เท่ากับ logsData.logs
      filteredLogs = [...logsData.logs];
    } catch (err: any) {
      logsData.error = err.message;
    } finally {
      logsData.loading = false;
    }
  }

  function backToEventsList() {
    logsData.selectedEvent = null;
    logsData.logs = [];
    logsData.searchQuery = "";
    logsData.selectedAction = "All";
    logsData.selectedStatus = "All";
    logsData.dateFrom = "";
    logsData.dateTo = "";
    eventsForLogsPage = 1;
    // Force rebuild cache
    lastLogsEventsKey = "";
  }

  async function fetchLogs() {
  logsData.loading = true;
  logsData.error = "";

  try {
    const eventId = logsData.selectedEvent?.id;
    if (!eventId) return;

    console.log("🔍 Fetching logs for event:", eventId);

    // ✅ ลองดึงจาก current-status แทน report (เพราะ report อาจจะว่าง หรือสิทธิ์ไม่ถึง)
    // และตัด Search API ออกก่อนเพราะติด 422
    let subs = [];
    try {
      const res = await api.get(`/api/participations/event/${eventId}/current-status`);
      console.log("📦 [Debug] Current Status Response:", res.data);
      
      const data = res.data;
      // API current-status มักจะส่งมาเป็น { data: [...] } หรือ { participants: [...] }
      subs = Array.isArray(data) ? data : (data.data || data.participants || data.timeline || []);
    } catch (err) {
      console.warn("⚠️ current-status failed, trying report as last resort...");
      const resReport = await api.get(`/api/participations/event/${eventId}/report`);
      subs = Array.isArray(resReport.data) ? resReport.data : (resReport.data.data || []);
    }

    console.log(`📋 Found total ${subs.length} items`);

    if (subs.length === 0) {
      logsData.logs = [];
      filteredLogs = [];
      logsData.loading = false;
      return;
    }

    // ✅ ส่วนการดึง User (ปรับให้ยิง API /api/users โดยตรง ไม่ต้องมี prefix แปลกๆ)
    const userIdSet = new Set<number>();
    subs.forEach((p: any) => { if(p.user_id) userIdSet.add(p.user_id); });
    const userIds = Array.from(userIdSet);
    const userCache: Record<number, any> = {};

    // ดึงทีละนิดเพื่อป้องกัน Server ค้าง
    const batchSize = 10;
    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);
      await Promise.all(batch.map(async (userId) => {
        try {
          const userRes = await api.get(`/api/users/${userId}`);
          userCache[userId] = userRes.data.data || userRes.data;
        } catch (e) {
          userCache[userId] = null;
        }
      }));
    }

    // ✅ Map ข้อมูล
    const logs: Log[] = subs.map((p: any) => {
      const user = userCache[p.user_id];
      const userName = user ? `${user.first_name || ""} ${user.last_name || ""}`.trim() : `User ${p.user_id}`;
      
      let action = "registration";
      let timestamp = p.joined_at || p.created_at || p.updated_at || new Date().toISOString();

      // Mapping Status
      if (p.status === "cancelled") action = "registration_cancelled";
      else if (p.status === "completed") action = "reward_unlocked";
      else if (p.status === "checked_in") action = "check_in";
      else if (p.status === "proof_submitted") action = "proof_submitted";
      else if (p.status === "rejected") action = "no_show";

      return {
        id: `log_${p.id || p.participation_id}`,
        eventId: eventId.toString(),
        eventTitle: logsData.selectedEvent?.title || "",
        userId: p.user_id?.toString(),
        userName,
        userAvatar: user?.profile_image_url 
          ? (user.profile_image_url.startsWith('http') ? user.profile_image_url : `${API_BASE_URL}${user.profile_image_url.startsWith('/') ? '' : '/'}${user.profile_image_url}`)
          : `https://api.dicebear.com/7.x/avataaars/svg?seed=${userName}`,
        action,
        timestamp,
        status: "success",
        details: { ...p },
        metadata: { role: user?.role || "student", participationStatus: p.status }
      };
    });

    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    logsData.logs = logs;
    filteredLogs = [...logs];
    logsData.totalItems = logs.length;
    logsData.totalPages = Math.ceil(logs.length / logsData.itemsPerPage);
    
    calculateLogsStatistics(logs);
    applyLogsFilters();

  } catch (err: any) {
    console.error("❌ fetchLogs Final Error:", err);
    logsData.error = "เกิดข้อผิดพลาดในการดึงข้อมูล";
  } finally {
    logsData.loading = false;
  }
}

  function generateMockLogs() {
    const allMockLogs = [
      // ✅ JOINED - แสดงเฉพาะ Join Code และ Joined
      {
        id: "log_001",
        eventId: "evt_123",
        eventTitle: "Executive Green Marathon",
        userId: "usr_456",
        userName: "John Doe",
        userEmail: "john.doe@example.com",
        userAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=John",
        action: "registration",
        timestamp: "2025-01-15T14:30:25Z",
        userNisitId: "6730200001",
        status: "success",
        details: {
          registrationCode: "EVT-ABC123",
          slotNumber: 125,
          rewardTier: "Silver Medal",
          tierRange: "51-150",
        },
        metadata: {
          ipAddress: "192.168.1.100",
          device: "Chrome 120 / Windows 10",
          role: "student",
        },
      },

      // ✅ CHECKED IN - แสดง Join Code, Joined, Checked In
      {
        id: "log_002",
        eventId: "evt_123",
        eventTitle: "Executive Green Marathon",
        userId: "usr_789",
        userName: "Jane Smith",
        userEmail: "jane.smith@example.com",
        userAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Jane",
        action: "check_in",
        timestamp: "2025-01-16T09:15:42Z",
        userNisitId: "6730200021",
        status: "success",
        details: {
          registrationCode: "EVT-XYZ789",
          checkInMethod: "QR Code",
          location: "Gate A",
          joinedAt: "2025-01-15T10:00:00Z", // เพิ่ม timestamp ของการ Join
        },
        metadata: {
          ipAddress: "192.168.1.101",
          device: "Safari / iPhone",
          role: "student",
        },
      },

      // ✅ COMPLETED - แสดงครบทุกอย่าง
      {
        id: "log_003",
        eventId: "evt_123",
        eventTitle: "Executive Green Marathon",
        userId: "usr_456",
        userName: "John Doe",
        userEmail: "john.doe@example.com",
        userAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=John",
        action: "reward_unlocked",
        timestamp: "2025-01-17T17:00:12Z",
        status: "success",
        details: {
          registrationCode: "EVT-DEF456",
          rewardName: "Gold Medal",
          rank: 25,
          joinedAt: "2025-01-15T08:00:00Z", // เพิ่ม
          checkedInAt: "2025-01-16T09:00:00Z", // เพิ่ม
        },
        metadata: {
          ipAddress: "192.168.1.100",
          device: "Chrome 120 / Windows 10",
          role: "officer",
        },
      },

      // ✅ CANCELLED - แสดง Join Code, Joined, Cancelled
      {
        id: "log_004",
        eventId: "evt_123",
        eventTitle: "Executive Green Marathon",
        userId: "usr_999",
        userName: "Bob Johnson",
        userEmail: "bob@example.com",
        userAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Bob",
        action: "registration_cancelled",
        timestamp: "2025-01-12T15:45:30Z",
        status: "success",
        details: {
          registrationCode: "EVT-GHI789",
          reason: "Schedule conflict",
          refundAmount: 500,
          joinedAt: "2025-01-10T10:00:00Z",
        },
        metadata: {
          ipAddress: "192.168.1.105",
          device: "Firefox / Windows 11",
          role: "student",
        },
      },
      {
        id: "log_005",
        eventId: "evt_123",
        eventTitle: "Executive Green Marathon",
        userId: "usr_999",
        userName: "Bob Johnson",
        userEmail: "bob@example.com",
        userAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Bob",
        action: "registration_cancelled",
        timestamp: "2025-01-12T15:45:30Z",
        status: "success",
        details: {
          registrationCode: "EVT-GHI789",
          reason: "Schedule conflict",
          refundAmount: 500,
          joinedAt: "2025-01-10T10:00:00Z",
        },
        metadata: {
          ipAddress: "192.168.1.105",
          device: "Firefox / Windows 11",
          role: "student",
        },
      },
      {
        id: "log_006",
        eventId: "evt_123",
        eventTitle: "Executive Green Marathon",
        userId: "usr_999",
        userName: "Bob Johnson",
        userEmail: "bob@example.com",
        userAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Bob",
        action: "registration_cancelled",
        timestamp: "2025-01-12T15:45:30Z",
        status: "success",
        details: {
          registrationCode: "EVT-GHI789",
          reason: "Schedule conflict",
          refundAmount: 500,
          joinedAt: "2025-01-10T10:00:00Z",
        },
        metadata: {
          ipAddress: "192.168.1.105",
          device: "Firefox / Windows 11",
          role: "student",
        },
      },
      {
        id: "log_007",
        eventId: "evt_123",
        eventTitle: "Executive Green Marathon",
        userId: "usr_999",
        userName: "Bob Johnson",
        userEmail: "bob@example.com",
        userAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Bob",
        action: "registration_cancelled",
        timestamp: "2025-01-12T15:45:30Z",
        status: "success",
        details: {
          registrationCode: "EVT-GHI789",
          reason: "Schedule conflict",
          refundAmount: 500,
          joinedAt: "2025-01-10T10:00:00Z",
        },
        metadata: {
          ipAddress: "192.168.1.105",
          device: "Firefox / Windows 11",
          role: "student",
        },
      },
      {
        id: "log_008",
        eventId: "evt_123",
        eventTitle: "Executive Green Marathon",
        userId: "usr_999",
        userName: "Bob Johnson",
        userEmail: "bob@example.com",
        userAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Bob",
        action: "registration_cancelled",
        timestamp: "2025-01-12T15:45:30Z",
        status: "success",
        details: {
          registrationCode: "EVT-GHI789",
          reason: "Schedule conflict",
          refundAmount: 500,
          joinedAt: "2025-01-10T10:00:00Z",
        },
        metadata: {
          ipAddress: "192.168.1.105",
          device: "Firefox / Windows 11",
          role: "student",
        },
      },
      {
        id: "log_009",
        eventId: "evt_123",
        eventTitle: "Executive Green Marathon",
        userId: "usr_999",
        userName: "Bob Johnson",
        userEmail: "bob@example.com",
        userAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Bob",
        action: "registration_cancelled",
        timestamp: "2025-01-12T15:45:30Z",
        status: "success",
        details: {
          registrationCode: "EVT-GHI789",
          reason: "Schedule conflict",
          refundAmount: 500,
          joinedAt: "2025-01-10T10:00:00Z",
        },
        metadata: {
          ipAddress: "192.168.1.105",
          device: "Firefox / Windows 11",
          role: "student",
        },
      },
      {
        id: "log_010",
        eventId: "evt_123",
        eventTitle: "Executive Green Marathon",
        userId: "usr_999",
        userName: "Bob Johnson",
        userEmail: "bob@example.com",
        userAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Bob",
        action: "registration_cancelled",
        timestamp: "2025-01-12T15:45:30Z",
        status: "success",
        details: {
          registrationCode: "EVT-GHI789",
          reason: "Schedule conflict",
          refundAmount: 500,
          joinedAt: "2025-01-10T10:00:00Z",
        },
        metadata: {
          ipAddress: "192.168.1.105",
          device: "Firefox / Windows 11",
          role: "student",
        },
      },
    ];

    return {
      logs: allMockLogs,
      pagination: {
        currentPage: logsData.currentPage,
        totalPages: Math.ceil(allMockLogs.length / logsData.itemsPerPage),
        totalItems: allMockLogs.length,
        itemsPerPage: logsData.itemsPerPage,
      },
    };
  }

  function getActionConfig(action: string) {
    return actionTypes.find((a) => a.value === action) || actionTypes[0];
  }

  function getStatusConfig(status: string) {
    return statusTypes.find((s) => s.value === status) || statusTypes[0];
  }

  function formatTimestamp(timestamp: string) {
    const date = new Date(timestamp);
    return date.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  }

  function formatLogDetails(log: Log) {
    const action = log.action;
    const details = log.details;

    switch (action) {
      case "registration":
        return `Code: ${details.registrationCode} • Slot #${details.slotNumber} • ${details.rewardTier}`;
      case "check_in":
        return `${details.checkInMethod} • Location: ${details.location}`;
      case "reward_unlocked":
        return `${details.rewardName} • Rank #${details.rank}`;
      case "registration_cancelled":
        return `Reason: ${details.reason}${details.refundAmount ? ` • Refund: ฿${details.refundAmount}` : ""}`;
      case "event_updated":
        return `Updated: ${details.changedFields?.join(", ")}`;
      case "reward_claimed":
        return `${details.rewardName} • ${details.estimatedDelivery}`;
      default:
        return JSON.stringify(details);
    }
  }

  function openProofImage(log: any) {
    // Get proof image URL from log
    const proofImageUrl = log.proofImage || null;

    if (!proofImageUrl) {
      Swal.fire({
        title: currentLang === "th" ? "ไม่มีรูปหลักฐาน" : "No Proof Image",
        text:
          currentLang === "th"
            ? "ไม่พบรูปหลักฐานสำหรับรายการนี้"
            : "No proof image available for this entry",
        icon: "info",
        background: "#1e293b",
        color: "#fff",
        confirmButtonColor: "#10b981",
      });
      return;
    }

    Swal.fire({
      title: currentLang === "th" ? "รูปหลักฐาน" : "Proof Image",
      html: `
      <div style="padding: 0; border-radius: 12px; overflow: hidden;">
        <img src="${proofImageUrl}" style="width: 100%; height: auto; display: block; border-radius: 8px; max-height: 70vh; object-fit: contain;" alt="Proof" onerror="this.onerror=null; this.src='https://placehold.co/800x600/1e293b/64748b?text=Image+Not+Found';" />
      </div>
    `,
      width: "600px",
      showCloseButton: true,
      showConfirmButton: false,
      background: "#1e293b",
      customClass: {
        popup: "swal-rounded-popup",
      },
    });
  }

  function calculateLogsStatistics(logs: Log[]) {
  // Basic stats
  logsData.statistics.totalLogs = logs.length;
  logsData.statistics.uniqueUsers = new Set(logs.map((l) => l.userId)).size;
  logsData.statistics.successRate =
    logs.length > 0
      ? (logs.filter((l) => l.status === "success").length / logs.length) * 100
      : 0;

  // Count by action type
  logsData.statistics.totalRegistrations = logs.filter(
    (l) => l.action === "registration"
  ).length;
  
  logsData.statistics.totalCheckIns = logs.filter(
    (l) => l.action === "check_in"
  ).length;
  
  logsData.statistics.totalRewards = logs.filter(
    (l) => l.action === "reward_unlocked"
  ).length;
  
  logsData.statistics.totalCancelled = logs.filter(
    (l) => l.action === "registration_cancelled"
  ).length;

  // Calculate topAction
  const actionCounts = logs.reduce(
    (acc, log) => {
      acc[log.action] = (acc[log.action] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  logsData.statistics.topAction =
    Object.keys(actionCounts).length > 0
      ? Object.entries(actionCounts).sort((a, b) => b[1] - a[1])[0][0]
      : "none";

  // ✅ Calculate by_status
  const byStatus: Record<string, number> = {};
  logs.forEach(log => {
    const status = log.metadata?.participationStatus || "unknown";
    byStatus[status] = (byStatus[status] || 0) + 1;
  });

  // ✅ Calculate by_role
  const byRole: Record<string, number> = {
    officer: logs.filter(l => l.metadata?.role === "officer").length,
    student: logs.filter(l => l.metadata?.role === "student").length,
  };

  // ✅ Update eventStats with all required fields
  logsData.eventStats = {
    total: logs.length,
    by_status: byStatus,
    by_role: byRole,
  };

  console.log("📊 Statistics:", logsData.statistics);
  console.log("📊 Event Stats:", logsData.eventStats);
}

  function openLogDetailModal(log: Log) {
    logsData.selectedLog = log;
    logsData.showDetailModal = true;
  }

  function closeLogDetailModal() {
    logsData.showDetailModal = false;
    logsData.selectedLog = null;
  }

  function applyLogsFilters() {
    let filtered: Log[] = [...logsData.logs];

    // 1. กรองตาม Search Query
    if (logsData.searchQuery && logsData.searchQuery.trim() !== "") {
      const query = logsData.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (log: Log) =>
          log.userName.toLowerCase().includes(query) ||
          log.userEmail.toLowerCase().includes(query) ||
          (log.userNisitId && log.userNisitId.includes(query))
      );
    }

    if (logsNisitYearFilter && logsNisitYearFilter.trim() !== "") {
      filtered = filtered.filter(
        (log: Log) =>
          log.userNisitId && log.userNisitId.startsWith(logsNisitYearFilter)
      );
    }

    // 1.6 กรองตาม Nisit ID (เลขหลัง)
    if (logsNisitIdFilter && logsNisitIdFilter.trim() !== "") {
      filtered = filtered.filter(
        (log: Log) =>
          log.userNisitId &&
          log.userNisitId.slice(-6).includes(logsNisitIdFilter)
      );
    }

    // 2. กรองตาม Action
    if (
      logsData.selectedAction &&
      logsData.selectedAction !== "" &&
      logsData.selectedAction !== "All"
    ) {
      const actionMap: Record<string, string> = {
        officer: "officer",
        student: "student",
        registration: "registration",
        check_in: "check_in",
        reward_unlocked: "reward_unlocked",
        no_show: "no_show",
        registration_cancelled: "registration_cancelled",
      };

      const targetAction = actionMap[logsData.selectedAction];

      if (targetAction === "officer") {
        filtered = filtered.filter(
          (log: Log) => log.metadata?.role === "officer"
        );
      } else if (targetAction === "student") {
        filtered = filtered.filter(
          (log: Log) => log.metadata?.role === "student"
        );
      } else if (targetAction) {
        filtered = filtered.filter((log: Log) => log.action === targetAction);
      }
    }

    // ❌ ลบส่วน Status filter ออก (ข้อ 3 เดิม)

    // 3. กรองตาม Date Range (เลื่อนขึ้นมาเป็นข้อ 3)
    if (logsData.dateFrom) {
      filtered = filtered.filter((log: Log) => {
        const logDate = new Date(log.timestamp);
        const fromDate = new Date(logsData.dateFrom);
        return logDate >= fromDate;
      });
    }

    if (logsData.dateTo) {
      filtered = filtered.filter((log: Log) => {
        const logDate = new Date(log.timestamp);
        const toDate = new Date(logsData.dateTo);
        toDate.setHours(23, 59, 59, 999);
        return logDate <= toDate;
      });
    }

    // อัพเดทผลลัพธ์
    filteredLogs = filtered;
    logsData.totalItems = filtered.length;
    logsData.totalPages = Math.ceil(filtered.length / logsData.itemsPerPage);
    logsData.currentPage = 1;
    logsListPage = 1;
  }

  function resetLogsFilters() {
    logsData.searchQuery = "";
    logsData.selectedAction = "";
    logsData.selectedStatus = "";
    logsData.dateFrom = "";
    logsData.dateTo = "";
    logsNisitYearFilter = "";
    logsNisitIdFilter = "";

    // ปิด dropdowns
    logsData.actionDropdownOpen = false;
    logsData.statusDropdownOpen = false;
    logsData.dateFromDropdownOpen = false;
    logsData.dateToDropdownOpen = false;

    // รีเซ็ตกลับไปแสดงทั้งหมด
    filteredLogs = [...logsData.logs];
    logsData.totalItems = logsData.logs.length;
    logsData.totalPages = Math.ceil(
      logsData.logs.length / logsData.itemsPerPage
    );
    logsData.currentPage = 1;

    console.log("Filters reset");
  }

  async function exportLogsReport(format: string) {
    if (!logsData.selectedEvent) return;

    const event = logsData.selectedEvent;
    const logs = logsData.logs;

    const totalLogs = logs.length;
    const registrations = logs.filter(
      (l) => l.action === "registration"
    ).length;
    const checkIns = logs.filter((l) => l.action === "check_in").length;
    const completed = logs.filter((l) => l.action === "reward_unlocked").length;
    const cancelled = logs.filter(
      (l) => l.action === "registration_cancelled"
    ).length;
    const noShow = logs.filter((l) => l.action === "no_show").length;
    const uniqueUsers = new Set(logs.map((l) => l.userId)).size;
    const checkInRate =
      registrations > 0 ? ((checkIns / registrations) * 100).toFixed(1) : "0";
    const completionRate =
      checkIns > 0 ? ((completed / checkIns) * 100).toFixed(1) : "0";

    // Action Distribution Data
    const actionStats = [
      { label: "Joined", value: registrations, color: "#3b82f6" },
      { label: "Checked In", value: checkIns, color: "#06b6d4" },
      { label: "Completed", value: completed, color: "#10b981" },
      { label: "Cancelled", value: cancelled, color: "#64748b" },
      { label: "No Show", value: noShow, color: "#ef4444" },
    ];

    // User Journey Funnel Data
    const funnelData = [
      { label: "Registered", value: registrations, color: "#3b82f6" },
      { label: "Checked In", value: checkIns, color: "#06b6d4" },
      { label: "Completed", value: completed, color: "#10b981" },
    ];

    // Success vs Drop-off Data
    const successData = [
      { label: "Completed", value: completed, color: "#10b981" },
      { label: "In Progress", value: checkIns - completed, color: "#f59e0b" },
      {
        label: "Dropped",
        value: registrations - checkIns + cancelled + noShow,
        color: "#ef4444",
      },
    ];

    // Engagement Rate Data
    const engagementData = [
      { label: "Active", value: checkIns, color: "#10b981" },
      {
        label: "Inactive",
        value: Math.max(0, registrations - checkIns),
        color: "#e2e8f0",
      },
    ];

    

    // Hourly Activity Data for Line Chart
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const hourlyData = {
      labels: hours.map((h) => `${h.toString().padStart(2, "0")}:00`),
      joined: hours.map(
        (h) =>
          logs.filter(
            (l) =>
              l.action === "registration" &&
              new Date(l.timestamp).getHours() === h
          ).length
      ),
      checkIn: hours.map(
        (h) =>
          logs.filter(
            (l) =>
              l.action === "check_in" && new Date(l.timestamp).getHours() === h
          ).length
      ),
      completed: hours.map(
        (h) =>
          logs.filter(
            (l) =>
              l.action === "reward_unlocked" &&
              new Date(l.timestamp).getHours() === h
          ).length
      ),
      cancelled: hours.map(
        (h) =>
          logs.filter(
            (l) =>
              l.action === "registration_cancelled" &&
              new Date(l.timestamp).getHours() === h
          ).length
      ),
    };

    // Cumulative Activity Data
    let cumJoined = 0,
      cumCheckIn = 0,
      cumCompleted = 0;
    const cumulativeData = {
      labels: hours.map((h) => `${h.toString().padStart(2, "0")}:00`),
      joined: hours.map((h) => {
        cumJoined += hourlyData.joined[h];
        return cumJoined;
      }),
      checkIn: hours.map((h) => {
        cumCheckIn += hourlyData.checkIn[h];
        return cumCheckIn;
      }),
      completed: hours.map((h) => {
        cumCompleted += hourlyData.completed[h];
        return cumCompleted;
      }),
    };

    const generatedDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const generatedTime = new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const eventTitle = event.title;
    const eventLocation = event.location;
    const fileName =
      "logs-report-" +
      eventTitle.replace(/\s+/g, "-").toLowerCase() +
      "-" +
      new Date().toISOString().split("T")[0];

    

    const cssStyles = `
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
      :root{--primary:#0f766e;--primary-light:#14b8a6;--secondary:#1e293b;--bg:#ffffff;--bg-alt:#f8fafc;--border:#e2e8f0;--text:#1e293b;--text-muted:#64748b}
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--text);line-height:1.6;font-size:14px}
      .container{max-width:1100px;margin:0 auto;padding:40px}
      .report-header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:24px;border-bottom:2px solid var(--primary);margin-bottom:32px}
      .brand{display:flex;align-items:center;gap:12px}
      .brand-logo{width:48px;height:48px;background:linear-gradient(135deg,var(--primary),var(--primary-light));border-radius:10px;display:flex;align-items:center;justify-content:center}
      .brand-logo svg{width:28px;height:28px;color:white}
      .brand-text h1{font-size:20px;font-weight:700;color:var(--primary)}
      .brand-text p{font-size:12px;color:var(--text-muted)}
      .report-meta{text-align:right}
      .report-meta h2{font-size:14px;font-weight:600;color:var(--text)}
      .report-meta p{font-size:12px;color:var(--text-muted)}
      .event-title{background:var(--bg-alt);border:1px solid var(--border);border-radius:12px;padding:24px;margin-bottom:32px}
      .event-title h3{font-size:24px;font-weight:700;color:var(--secondary);margin-bottom:8px}
      .event-info{display:flex;flex-wrap:wrap;gap:24px;color:var(--text-muted);font-size:13px}
      .event-info span{display:flex;align-items:center;gap:6px}
      .section{margin-bottom:32px}
      .section-title{font-size:16px;font-weight:600;color:var(--secondary);margin-bottom:16px;display:flex;align-items:center;gap:8px}
      .section-title svg{width:20px;height:20px;color:var(--primary)}
      .stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
      .stat-card{background:var(--bg-alt);border:1px solid var(--border);border-radius:12px;padding:20px;text-align:center}
      .stat-card.highlight{background:linear-gradient(135deg,var(--primary),var(--primary-light));border:none;color:white}
      .stat-card.highlight .stat-label{color:rgba(255,255,255,0.8)}
      .stat-value{font-size:28px;font-weight:700;margin-bottom:4px}
      .stat-label{font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px}
      .charts-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}
      .charts-grid-2{display:grid;grid-template-columns:repeat(2,1fr);gap:24px;margin-top:24px}
      .chart-card{background:var(--bg-alt);border:1px solid var(--border);border-radius:12px;padding:20px}
      .chart-title{font-size:14px;font-weight:600;color:var(--secondary);margin-bottom:16px}
      .chart-container{height:220px;position:relative}
      .table-wrapper{overflow-x:auto}
      table{width:100%;border-collapse:collapse;font-size:13px}
      th,td{padding:12px;text-align:left;border-bottom:1px solid var(--border)}
      th{background:var(--bg-alt);font-weight:600;color:var(--secondary)}
      .text-center{text-align:center}
      .action-badge{display:inline-block;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:500}
      .report-footer{margin-top:40px;padding-top:20px;border-top:1px solid var(--border);display:flex;justify-content:space-between;font-size:12px;color:var(--text-muted)}
      @media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
    `;

    const chartScript = `
      const actionData=${JSON.stringify(actionStats)};
      const funnelData=${JSON.stringify(funnelData)};
      const successData=${JSON.stringify(successData)};
      const engagementData=${JSON.stringify(engagementData)};
      const hourlyData=${JSON.stringify(hourlyData)};
      const cumulativeData=${JSON.stringify(cumulativeData)};
      
      Chart.defaults.font.family="'Inter',sans-serif";
      
      // 1. Activity Distribution - Doughnut
      new Chart(document.getElementById('activityPieChart'),{
        type:'doughnut',
        data:{
          labels:actionData.map(a=>a.label),
          datasets:[{data:actionData.map(a=>a.value),backgroundColor:actionData.map(a=>a.color),borderWidth:0}]
        },
        options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{boxWidth:12,padding:8,font:{size:11}}}}}
      });
      
      // 2. Success Rate - Pie
      new Chart(document.getElementById('successChart'),{
        type:'pie',
        data:{
          labels:successData.map(s=>s.label),
          datasets:[{data:successData.map(s=>s.value),backgroundColor:successData.map(s=>s.color),borderWidth:0}]
        },
        options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{boxWidth:12,padding:8,font:{size:11}}}}}
      });
      
      // 3. Engagement Rate - Doughnut
      new Chart(document.getElementById('engagementChart'),{
        type:'doughnut',
        data:{
          labels:engagementData.map(e=>e.label),
          datasets:[{data:engagementData.map(e=>e.value),backgroundColor:engagementData.map(e=>e.color),borderWidth:0}]
        },
        options:{responsive:true,maintainAspectRatio:false,cutout:'70%',plugins:{legend:{position:'right',labels:{boxWidth:12,padding:8,font:{size:11}}}}}
      });
      
      // 4. Activity Bar Chart
      new Chart(document.getElementById('activityBarChart'),{
        type:'bar',
        data:{
          labels:actionData.map(a=>a.label),
          datasets:[{label:'Count',data:actionData.map(a=>a.value),backgroundColor:actionData.map(a=>a.color),borderRadius:4}]
        },
        options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,grid:{color:'#f1f5f9'}},x:{grid:{display:false}}}}
      });
      
      // 5. User Journey Funnel - Horizontal Bar
      new Chart(document.getElementById('funnelChart'),{
        type:'bar',
        data:{
          labels:funnelData.map(f=>f.label),
          datasets:[{label:'Users',data:funnelData.map(f=>f.value),backgroundColor:funnelData.map(f=>f.color),borderRadius:4}]
        },
        options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{beginAtZero:true}}}
      });

      // 6. Hourly Activity Timeline - Line Chart
      new Chart(document.getElementById('hourlyLineChart'),{
        type:'line',
        data:{
          labels:hourlyData.labels,
          datasets:[
            {label:'Joined',data:hourlyData.joined,borderColor:'#3b82f6',backgroundColor:'rgba(59,130,246,0.1)',fill:true,tension:0.4,borderWidth:2,pointRadius:3,pointBackgroundColor:'#3b82f6'},
            {label:'Check-in',data:hourlyData.checkIn,borderColor:'#06b6d4',backgroundColor:'transparent',fill:false,tension:0.4,borderWidth:2,pointRadius:3,pointBackgroundColor:'#06b6d4'},
            {label:'Completed',data:hourlyData.completed,borderColor:'#10b981',backgroundColor:'transparent',fill:false,tension:0.4,borderWidth:2,pointRadius:3,pointBackgroundColor:'#10b981'},
            {label:'Cancelled',data:hourlyData.cancelled,borderColor:'#ef4444',backgroundColor:'transparent',fill:false,tension:0.4,borderWidth:2,pointRadius:3,pointBackgroundColor:'#ef4444'}
          ]
        },
        options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top',labels:{boxWidth:12,padding:15,font:{size:11}}}},scales:{y:{beginAtZero:true,grid:{color:'#f1f5f9'}},x:{grid:{display:false},ticks:{maxTicksLimit:12}}}}
      });

      // 7. Cumulative Progress - Area Line Chart
      new Chart(document.getElementById('cumulativeLineChart'),{
        type:'line',
        data:{
          labels:cumulativeData.labels,
          datasets:[
            {label:'Total Joined',data:cumulativeData.joined,borderColor:'#3b82f6',backgroundColor:'rgba(59,130,246,0.15)',fill:true,tension:0.4,borderWidth:2.5,pointRadius:0},
            {label:'Total Check-in',data:cumulativeData.checkIn,borderColor:'#06b6d4',backgroundColor:'rgba(6,182,212,0.15)',fill:true,tension:0.4,borderWidth:2.5,pointRadius:0},
            {label:'Total Completed',data:cumulativeData.completed,borderColor:'#10b981',backgroundColor:'rgba(16,185,129,0.15)',fill:true,tension:0.4,borderWidth:2.5,pointRadius:0}
          ]
        },
        options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top',labels:{boxWidth:12,padding:15,font:{size:11}}}},scales:{y:{beginAtZero:true,grid:{color:'#f1f5f9'}},x:{grid:{display:false},ticks:{maxTicksLimit:12}}}}
      });
    `;

    const reportHTML = `
      <!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Activity Logs Report - ${eventTitle}</title>
      <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"><\/script>
      <style>${cssStyles}</style></head><body>
      <div class="container">
      
      <header class="report-header">
        <div class="brand">
          <div class="brand-logo"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg></div>
          <div class="brand-text"><h1>Activity Logs</h1><p>Event Analytics Report</p></div>
        </div>
        <div class="report-meta"><h2>Analysis Report</h2><p>Generated: ${generatedDate}</p><p>Time: ${generatedTime}</p></div>
      </header>
      
      <div class="event-title"><h3>${eventTitle}</h3><div class="event-info">
        <span><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16" style="vertical-align:middle;margin-right:4px"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>${eventLocation}</span>
      </div></div>
      
      <section class="section">
        <h4 class="section-title"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20" style="vertical-align:middle;margin-right:6px;color:#0f766e"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>Executive Summary</h4>
        <div class="stats-grid">
          <div class="stat-card highlight"><div class="stat-value">${totalLogs.toLocaleString()}</div><div class="stat-label">Total Activities</div></div>
          <div class="stat-card"><div class="stat-value">${uniqueUsers.toLocaleString()}</div><div class="stat-label">Unique Users</div></div>
          <div class="stat-card"><div class="stat-value">${checkInRate}%</div><div class="stat-label">Check-in Rate</div></div>
          <div class="stat-card"><div class="stat-value">${completionRate}%</div><div class="stat-label">Completion Rate</div></div>
        </div>
      </section>
      
      <section class="section">
        <h4 class="section-title"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20" style="vertical-align:middle;margin-right:6px;color:#0f766e"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"></path></svg>Activity Analytics - Distribution Charts</h4>
        <div class="charts-grid">
          <div class="chart-card"><div class="chart-title"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16" style="vertical-align:middle;margin-right:4px;color:#3b82f6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>Activity Distribution</div><div class="chart-container"><canvas id="activityPieChart"></canvas></div></div>
          <div class="chart-card"><div class="chart-title"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16" style="vertical-align:middle;margin-right:4px;color:#10b981"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>Success Rate</div><div class="chart-container"><canvas id="successChart"></canvas></div></div>
          <div class="chart-card"><div class="chart-title"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16" style="vertical-align:middle;margin-right:4px;color:#8b5cf6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"></path></svg>Engagement Rate</div><div class="chart-container"><canvas id="engagementChart"></canvas></div></div>
        </div>
        <div class="charts-grid-2">
          <div class="chart-card"><div class="chart-title"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16" style="vertical-align:middle;margin-right:4px;color:#06b6d4"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>Activity Count by Type</div><div class="chart-container"><canvas id="activityBarChart"></canvas></div></div>
          <div class="chart-card"><div class="chart-title"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16" style="vertical-align:middle;margin-right:4px;color:#f59e0b"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>User Journey Funnel</div><div class="chart-container"><canvas id="funnelChart"></canvas></div></div>
        </div>
      </section>

      <section class="section">
        <h4 class="section-title"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20" style="vertical-align:middle;margin-right:6px;color:#0f766e"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"></path></svg>Activity Timeline - Trend Analysis (Line Charts)</h4>
        <div class="charts-grid-2">
          <div class="chart-card"><div class="chart-title"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16" style="vertical-align:middle;margin-right:4px;color:#3b82f6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>Hourly Activity Timeline</div><div class="chart-container" style="height:280px"><canvas id="hourlyLineChart"></canvas></div></div>
          <div class="chart-card"><div class="chart-title"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16" style="vertical-align:middle;margin-right:4px;color:#10b981"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>Cumulative Progress</div><div class="chart-container" style="height:280px"><canvas id="cumulativeLineChart"></canvas></div></div>
        </div>
      </section>
      
      <section class="section">
        <h4 class="section-title"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20" style="vertical-align:middle;margin-right:6px;color:#0f766e"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>Recent Activities (Top 10)</h4>
        <div class="table-wrapper"><table><thead><tr><th>#</th><th>Name</th><th>Nisit ID</th><th>Action</th><th>Time</th></tr></thead>
        <tbody>${recentLogsHTML}</tbody></table></div>
      </section>
      
      <footer class="report-footer"><span>Activity Logs Management System - Confidential</span><span>Page 1 of 1</span></footer>
      </div>
      <script>${chartScript}<\/script></body></html>
    `;

    // สร้าง iframe ซ่อนเพื่อ render แล้ว capture
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.left = "-9999px";
    iframe.style.width = "1200px";
    iframe.style.height = "3200px";
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      document.body.removeChild(iframe);
      return;
    }

    iframeDoc.open();
    iframeDoc.write(reportHTML);
    iframeDoc.close();

    // รอให้ Chart.js โหลดและ render
    await new Promise((resolve) => setTimeout(resolve, 2500));

    try {
      // โหลด html2canvas และ jspdf
      if (!document.querySelector('script[src*="html2canvas"]')) {
        const html2canvasScript = document.createElement("script");
        html2canvasScript.src =
          "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
        document.head.appendChild(html2canvasScript);
      }

      if (!document.querySelector('script[src*="jspdf"]')) {
        const jspdfScript = document.createElement("script");
        jspdfScript.src =
          "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
        document.head.appendChild(jspdfScript);
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const container = iframeDoc.querySelector(".container");
      if (!container) {
        throw new Error("Container not found");
      }

      // @ts-ignore
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      if (format === "png") {
        const link = document.createElement("a");
        link.download = fileName + ".png";
        link.href = canvas.toDataURL("image/png");
        link.click();
      } else if (format === "pdf") {
        // @ts-ignore
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF("p", "mm", "a4");
        const imgWidth = 210;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        const imgData = canvas.toDataURL("image/png");

        let position = 0;
        const pageHeight = 297;

        if (imgHeight > pageHeight) {
          while (position < imgHeight) {
            if (position > 0) pdf.addPage();
            pdf.addImage(imgData, "PNG", 0, -position, imgWidth, imgHeight);
            position += pageHeight;
          }
        } else {
          pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
        }
        pdf.save(fileName + ".pdf");
      }

      Swal.fire({
        title: "Report Downloaded!",
        text: "Your " + format.toUpperCase() + " report has been saved.",
        icon: "success",
        background: "#1e293b",
        color: "#fff",
        confirmButtonColor: "#10b981",
      });
    } catch (error) {
      console.error("Export error:", error);
      // Fallback: เปิดใน tab ใหม่
      const blob = new Blob([reportHTML], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");

      Swal.fire({
        title: "Report Generated!",
        text: "Please use the browser's save function to download.",
        icon: "info",
        background: "#1e293b",
        color: "#fff",
        confirmButtonColor: "#10b981",
      });
    } finally {
      document.body.removeChild(iframe);
    }
  }

  let logs: any[] = []; 
  let recentLogsHTML = "";
  

  const getLogColor = (action: string) => {
    // ลองเรียก getActionConfig ถ้ามี ถ้าไม่มีให้ใช้สีเทา
    try {
      // @ts-ignore
      if (typeof getActionConfig === 'function') return getActionConfig(action).color;
    } catch (e) {}
    return "#64748b"; // สี Default
  };

  const getLogLabel = (action: string) => {
    try {
      // @ts-ignore
      if (typeof getActionConfig === 'function') return getActionConfig(action).label;
    } catch (e) {}
    return action;
  };

  // 3. ใช้ $: เพื่อสร้าง HTML ใหม่ทุกครั้งที่ logsData หรือ currentLang เปลี่ยน
  $: {
    // เช็คว่า logsData และ logsData.logs มีอยู่จริงไหม
    // (แก้จุดที่ Code เก่าเรียกใช้ logs เฉยๆ ซึ่งไม่มีอยู่จริง)
    const sourceLogs = (typeof logsData !== 'undefined' && logsData.logs) ? logsData.logs : [];

    if (sourceLogs && Array.isArray(sourceLogs)) {
      
      // สร้าง HTML ก้อนเดียว (ใช้ map แล้ว join จะเร็วกว่า)
      recentLogsHTML = sourceLogs.slice(0, 10).map((log: any, idx: number) => {
        
        // -- ส่วนจัดการวันที่ (หัวใจสำคัญของ Real-time) --
        const dateText = new Date(log.timestamp).toLocaleString(
          currentLang === 'th' ? 'th-TH' : 'en-US'
        );
        // ---------------------------------------------

        const color = getLogColor(log.action);
        const label = getLogLabel(log.action);

        // คืนค่าเป็น HTML String
        return `
          <tr>
            <td class="text-center">${idx + 1}</td>
            <td>${log.userName || '-'}</td>
            <td>${log.userNisitId || '-'}</td>
            <td>
              <span class="action-badge" style="background:${color}20; color:${color}">
                ${label}
              </span>
            </td>
            <td>${dateText}</td>
          </tr>
        `;
      }).join(""); // รวมทุกแถวเข้าด้วยกัน
    } else {
        recentLogsHTML = "";
    }
  }
 



  const formatLogDate = (dateStr: string, lang: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString(lang === 'th' ? 'th-TH' : 'en-US');
  };

  function changeLogsPage(page: number) {
    if (page < 1 || page > logsData.totalPages) return;
    logsData.currentPage = page;
    fetchLogs();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function selectDateFrom(date: string) {
    logsData.dateFrom = date;
    logsData.dateFromDropdownOpen = false;
  }

  function selectDateTo(date: string) {
    logsData.dateTo = date;
    logsData.dateToDropdownOpen = false;
  }

  // Pagination for Logs List
  let logsListPage = 1;
  const logsListPerPage = 8;

  $: totalLogsListPages = Math.ceil(logsToDisplay.length / logsListPerPage);

  function nextLogsListPage() {
    if (logsListPage < totalLogsListPages) {
      logsListPage += 1;
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function prevLogsListPage() {
    if (logsListPage > 1) {
      logsListPage -= 1;
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function jumpToLogsListPage(page: number) {
    logsListPage = page;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Reset pagination when filters change
  $: if (
    logsData.searchQuery ||
    logsData.selectedAction ||
    logsData.selectedStatus ||
    logsData.dateFrom ||
    logsData.dateTo
  ) {
    logsListPage = 1;
  }

  $: if (currentView === "log" && !logsData.selectedEvent) {
    // Reset filters only when entering log view without selected event
    eventsForLogsPage = 1;
  }

  // OPTIMIZED: filteredEventsForLogs with memoization
  let lastLogsEventsKey = "";
  let cachedFilteredEventsForLogs: AppEvent[] = [];

  $: {
    // Only rebuild cache when in log view and no event is selected
    if (currentView === "log" && !logsData.selectedEvent) {
      const cacheKey = `logs_${events.length}_${searchQueryLogs}_${selectedMonthLogs}_${selectedYearLogs}`;
      if (cacheKey !== lastLogsEventsKey) {
        lastLogsEventsKey = cacheKey;
        cachedFilteredEventsForLogs = filterEventsOptimized(
          events,
          searchQueryLogs,
          selectedMonthLogs,
          selectedYearLogs
        );
      }
    }
  }

  $: filteredEventsForLogs = cachedFilteredEventsForLogs;

  // ✅ Pagination สำหรับ Events in Logs View

  $: paginatedEventsForLogs = filteredEventsForLogs.slice(
    (eventsForLogsPage - 1) * eventsForLogsPerPage,
    eventsForLogsPage * eventsForLogsPerPage
  );

  // ========================================
  // 📤 EXPORT FUNCTIONS
  // ========================================

  function toggleExportMenu() {
    showExportMenu = !showExportMenu;
  }

  async function exportLogs(format: string) {
    isExporting = true;
    showExportMenu = false;

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate export

      const allLogs = logsData.logs; // ใช้ logs ที่ filter แล้ว

      if (format === "csv") {
        exportToCSV(allLogs);
      } else if (format === "json") {
        exportToJSON(allLogs);
      } else if (format === "pdf") {
        exportToPDF(allLogs);
      } else if (format === "excel") {
        exportToExcel(allLogs);
      }

      Swal.fire({
        title: "Export Successful!",
        text: `Logs exported as ${format.toUpperCase()}`,
        icon: "success",
        background: "#1e293b",
        color: "#fff",
        confirmButtonColor: "#10b981",
        timer: 2000,
      });
    } catch (error) {
      Swal.fire({
        title: "Export Failed",
        text: "Failed to export logs. Please try again.",
        icon: "error",
        background: "#1e293b",
        color: "#fff",
        confirmButtonColor: "#ef4444",
      });
    } finally {
      isExporting = false;
    }
  }

  function exportToCSV(logs: Log[]) {
    const headers = [
      "Timestamp",
      "Event Title",
      "User Name",
      "User Email",
      "Action Type",
      "Status",
      "Details",
      "IP Address",
    ];
    const rows = logs.map((log) => [
      log.timestamp,
      log.eventTitle,
      log.userName,
      log.userEmail,
      log.action,
      log.status,
      JSON.stringify(log.details),
      log.metadata?.ipAddress || "N/A",
    ]);

    let csvContent = headers.join(",") + "\n";
    rows.forEach((row) => {
      csvContent += row.map((cell) => `"${cell}"`).join(",") + "\n";
    });

    downloadFile(csvContent, "logs-export.csv", "text/csv");
  }

  function exportToJSON(logs: Log[]) {
    const jsonContent = JSON.stringify(logs, null, 2);
    downloadFile(jsonContent, "logs-export.json", "application/json");
  }

  function exportToPDF(logs: Log[]) {
    // Simplified PDF export - in production, use a library like jsPDF
    let pdfContent = "Event Logs Report\n\n";
    logs.forEach((log) => {
      pdfContent += `Timestamp: ${log.timestamp}\n`;
      pdfContent += `User: ${log.userName} (${log.userEmail})\n`;
      pdfContent += `Action: ${log.action}\n`;
      pdfContent += `Status: ${log.status}\n`;
      pdfContent += `---\n\n`;
    });
    downloadFile(pdfContent, "logs-export.txt", "text/plain");
  }

  async function exportToExcel(logs: Log[]) {
    // โหลด SheetJS library
    // @ts-ignore
    if (typeof window.XLSX === "undefined") {
      await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src =
          "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }

    // @ts-ignore
    const XLSX = window.XLSX;

    // เตรียมข้อมูล
    const data = logs.map((log, idx) => ({
      "No.": idx + 1,
      Name: log.userName,
      "Nisit ID": log.userNisitId || "N/A",
      Email: log.userEmail,
      Action: getActionConfig(log.action).label,
      Status: log.status,
      "Join Code": log.details?.registrationCode || "N/A",
      Timestamp: new Date(log.timestamp).toLocaleString("th-TH"),
      Role: log.metadata?.role || "N/A",
    }));

    // สร้าง workbook และ worksheet
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();

    // ปรับความกว้างคอลัมน์
    ws["!cols"] = [
      { wch: 5 }, // No.
      { wch: 20 }, // Name
      { wch: 12 }, // Nisit ID
      { wch: 25 }, // Email
      { wch: 12 }, // Action
      { wch: 10 }, // Status
      { wch: 12 }, // Join Code
      { wch: 20 }, // Timestamp
      { wch: 10 }, // Role
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Activity Logs");

    // ดาวน์โหลด
    const fileName = `logs-${logsData.selectedEvent?.title?.replace(/\s+/g, "-") || "export"}-${new Date().toISOString().split("T")[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }

  async function exportRewardsToExcel(users: RewardUser[]) {
    // โหลด SheetJS library
    // @ts-ignore
    if (typeof window.XLSX === "undefined") {
      await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src =
          "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }

    // @ts-ignore
    const XLSX = window.XLSX;

    // เตรียมข้อมูล
    const data = users.map((user) => ({
      "Global Rank": user.globalRank,
      "Tier Rank": user.tierRank || "—",
      Name: user.name,
      "Nisit ID": user.nisitId,
      Email: user.email,
      Tier: user.tier,
      Progress: user.completedCount,
      Required: user.requiredCount,
      Status:
        user.status === "completed"
          ? "Completed"
          : user.status === "in_progress"
            ? "In Progress"
            : "No Tier",
      "Completed At": user.completedAt
        ? new Date(user.completedAt).toLocaleString("th-TH")
        : "N/A",
      "Join Code": user.joinCode,
    }));

    // สร้าง workbook และ worksheet
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();

    // ปรับความกว้างคอลัมน์
    ws["!cols"] = [
      { wch: 12 }, // Global Rank
      { wch: 10 }, // Tier Rank
      { wch: 20 }, // Name
      { wch: 12 }, // Nisit ID
      { wch: 25 }, // Email
      { wch: 15 }, // Tier
      { wch: 10 }, // Progress
      { wch: 10 }, // Required
      { wch: 12 }, // Status
      { wch: 20 }, // Completed At
      { wch: 12 }, // Join Code
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Rewards");

    // ดาวน์โหลด
    const fileName = `rewards-${rewardData.selectedEvent?.title?.replace(/\s+/g, "-") || "export"}-${new Date().toISOString().split("T")[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }

  function downloadFile(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // ========================================
  // 🔌 WEBSOCKET FUNCTIONS
  // ========================================

  let logsRefreshInterval: any = null;

  function initWebSocket() {
    if (!logsData.selectedEvent) return;

    // Simulate WebSocket connection (in production, use real WebSocket URL)
    // ws = new WebSocket('ws://your-api.com/logs');

    isConnected = true;

    // Simulate receiving new logs
    if (autoRefreshEnabled && !logsRefreshInterval) {
      logsRefreshInterval = setInterval(() => {
        if (autoRefreshEnabled && logsData.selectedEvent) {
          newLogsCount++;
          // You would fetch new logs here in production
        }
      }, 30000); // Every 30 seconds
    }
  }

  function disconnectWebSocket() {
    if (ws) {
      ws.close();
      ws = null;
    }
    if (logsRefreshInterval) {
      clearInterval(logsRefreshInterval);
      logsRefreshInterval = null;
    }
    isConnected = false;
  }

  function refreshLogs() {
    newLogsCount = 0;
    fetchLogs();

    Swal.fire({
      title: "Refreshed!",
      text: "Logs have been refreshed",
      icon: "success",
      background: "#1e293b",
      color: "#fff",
      confirmButtonColor: "#10b981",
      timer: 1500,
      showConfirmButton: false,
    });
  }

  function toggleAutoRefresh() {
    autoRefreshEnabled = !autoRefreshEnabled;

    if (autoRefreshEnabled) {
      initWebSocket();
    } else {
      disconnectWebSocket();
    }
  }

  // ========================================
  // 📅 TIMELINE FUNCTIONS
  // ========================================

  function openTimelineModal() {
    console.log("🔵 Opening timeline modal");
    console.log("📊 Selected Event:", logsData.selectedEvent);
    console.log("📝 Total Logs:", logsData.logs?.length || 0);

    if (!logsData.selectedEvent) {
      console.error("❌ No event selected!");
      Swal.fire({
        title: "No Event Selected",
        text: "Please select an event first",
        icon: "warning",
        background: "#1e293b",
        color: "#fff",
        confirmButtonColor: "#10b981",
      });
      return;
    }

    showTimelineModal = true;
    console.log("✅ Modal opened");
  }

  /**
   * closeTimelineModal - ปิด modal แสดง timeline
   */
  function closeTimelineModal() {
    console.log("🔴 Closing timeline modal");
    showTimelineModal = false;
  }

  /**
   * generateTimeline - สร้าง timeline items จาก logs data
   * @returns TimelineItem[] - array ของ timeline items เรียงตามเวลา
   *
   * การทำงาน:
   * 1. ตรวจสอบว่ามี logs หรือไม่
   * 2. Sort logs ตาม timestamp
   * 3. Map เป็น TimelineItem format
   */
  function generateTimeline(): TimelineItem[] {
    // ถ้าไม่มี logs ให้ return array เปล่า (ไม่ต้อง warn)
    if (!logsData.logs || logsData.logs.length === 0) {
      return [];
    }

    // Sort logs ตาม timestamp (เก่าสุดก่อน)
    const sortedLogs = [...logsData.logs].sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Map เป็น TimelineItem format
    const timeline = sortedLogs.map((log) => ({
      timestamp: log.timestamp,
      action: log.action,
      userName: log.userName,
      status: log.status,
      details: formatLogDetails(log),
    }));

    console.log("✅ Timeline items generated:", timeline.length);
    return timeline;
  }

  // ฟังก์ชันแสดง วันที่ + เวลา (เช่น 04 ม.ค. 2569 10:30)

  // ✅ ฟังก์ชันแสดง วัน(04) เดือน(Jan) ปี + เวลา + วินาที (English)
  // ✅ ฟังก์ชันแสดงวันเวลา (รองรับเปลี่ยนภาษาแบบ Real-time)
  function formatFullDate(dateInput: any, language: string = 'th'): string {
    // 1. เช็คค่าว่าง
    if (!dateInput || dateInput === "-" || dateInput === "") return "-";

    try {
      // 2. แปลงเป็น Date
      const date = new Date(dateInput);
      if (isNaN(date.getTime())) return "-";

      // 3. เลือก Locale ตามภาษาที่ส่งมา (th=ไทย, en=อังกฤษ)
      const locale = language === 'en' ? 'en-GB' : 'th-TH';

      // 4. แสดงผล (ถ้าเป็น th-TH ปีจะเป็น พ.ศ. ให้เองโดยอัตโนมัติ)
      return date.toLocaleString(locale, {
        day: "2-digit",
        month: "short",    // th=ม.ค., en=Jan
        year: "numeric",   // th=2569, en=2026
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      });
    } catch (error) {
      return "-";
    }
  }

  // Initialize WebSocket when event is selected
  $: if (logsData.selectedEvent && autoRefreshEnabled) {
    initWebSocket();
  }

  $: timelineItems = generateTimeline();

  // Cleanup on component destroy
  onDestroy(() => {
    disconnectWebSocket();
  });
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link
    rel="preconnect"
    href="https://fonts.gstatic.com"
    crossorigin="anonymous"
  />
  <link
    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<svelte:window on:click={() => (showPageDropdown = false)} />

<div class="app-container">
  <header class="header-bar">
    <div class="header-inner">
      <div class="brand">
        <div class="logo-container"></div>
        <span class="brand-name">{lang.organizer}</span>
      </div>

      <nav class="nav-menu desktop-only">
        {#each menuItems as item}
          <button
            class="menu-btn"
            class:active={currentView === item.id}
            on:click={() => selectView(item.id)}
          >
            <svg
              class="line-icon"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              ><path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d={item.svg}
              ></path></svg
            >
            <span class="btn-label">{item.label}</span>
          </button>
        {/each}
        <div class="nav-divider"></div>

        {#if isSearchableView && showSearchSection && !(currentView === "log" && logsData.selectedEvent) && !(currentView === "reward" && rewardData.selectedEvent) && !(currentView === "verify-proof" && verifyProofData.selectedEvent)}
          <!-- Search Toggle Button -->
          <button
            class="search-toggle-btn"
            class:active={showSearchSection}
            on:click={toggleSearchSection}
            title="Toggle Search"
          >
            <svg
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              ></path>
            </svg>
          </button>
        {/if}
      </nav>

      <div class="user-zone">
        <!-- Language Toggle Switch - Simple TH/EN -->
        <button
          class="lang-toggle-btn"
          on:click={toggleLanguage}
          title={currentLang === "th"
            ? "Switch to English"
            : "เปลี่ยนเป็นภาษาไทย"}
          aria-label="Toggle language"
        >
          <span class="lang-option" class:active={currentLang === "th"}>TH</span
          >
          <span class="lang-divider">/</span>
          <span class="lang-option" class:active={currentLang === "en"}>EN</span
          >
        </button>

        <!-- Performance Monitor -->
        <div
          class="perf-monitor"
          on:mouseenter={() => (showPerfTooltip = true)}
          on:mouseleave={() => (showPerfTooltip = false)}
          role="status"
          aria-label="Performance Monitor"
        >
          <div class="perf-graph">
            <svg viewBox="0 0 120 32" preserveAspectRatio="none">
              <line
                x1="0"
                y1="8"
                x2="120"
                y2="8"
                stroke="rgba(255,255,255,0.05)"
                stroke-width="1"
              />
              <line
                x1="0"
                y1="16"
                x2="120"
                y2="16"
                stroke="rgba(255,255,255,0.05)"
                stroke-width="1"
              />
              <line
                x1="0"
                y1="24"
                x2="120"
                y2="24"
                stroke="rgba(255,255,255,0.05)"
                stroke-width="1"
              />

              {#if perfHistory.length > 1}
                <polyline
                  fill="none"
                  stroke="url(#perfGradient)"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  points={perfPointsStr}
                />
                <polyline
                  fill="none"
                  stroke="url(#perfGradient)"
                  stroke-width="4"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  opacity="0.3"
                  points={perfPointsStr}
                />
              {/if}

              <defs>
                <linearGradient
                  id="perfGradient"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="0%"
                >
                  <stop offset="0%" stop-color="#10b981" />
                  <stop offset="50%" stop-color="#3b82f6" />
                  <stop
                    offset="100%"
                    stop-color={connectionStatus === "connected"
                      ? "#10b981"
                      : connectionStatus === "slow"
                        ? "#f59e0b"
                        : "#ef4444"}
                  />
                </linearGradient>
              </defs>
            </svg>
          </div>

          <div class="perf-stats">
            <div
              class="perf-latency"
              class:good={connectionStatus === "connected"}
              class:warning={connectionStatus === "slow"}
              class:bad={connectionStatus === "disconnected"}
            >
              {currentLatency >= 0 ? `${currentLatency}ms` : "---"}
            </div>
            <div
              class="perf-status-dot"
              class:connected={connectionStatus === "connected"}
              class:slow={connectionStatus === "slow"}
              class:disconnected={connectionStatus === "disconnected"}
            ></div>
          </div>

          {#if showPerfTooltip}
            <div class="perf-tooltip">
              <div class="perf-tooltip-header">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
                Performance Monitor
              </div>
              <div class="perf-tooltip-row">
                <span>Current Latency:</span>
                <span
                  class="perf-value"
                  class:good={connectionStatus === "connected"}
                  class:warning={connectionStatus === "slow"}
                  class:bad={connectionStatus === "disconnected"}
                >
                  {currentLatency >= 0 ? `${currentLatency}ms` : "N/A"}
                </span>
              </div>
              <div class="perf-tooltip-row">
                <span>Average Latency:</span>
                <span class="perf-value">{avgLatency}ms</span>
              </div>
              <div class="perf-tooltip-row">
                <span>Status:</span>
                <span
                  class="perf-status-text"
                  class:connected={connectionStatus === "connected"}
                  class:slow={connectionStatus === "slow"}
                  class:disconnected={connectionStatus === "disconnected"}
                >
                  {connectionStatus === "connected"
                    ? "● Stable"
                    : connectionStatus === "slow"
                      ? "● Slow"
                      : "● Unstable"}
                </span>
              </div>

              <!-- Real-time Status Section -->
              <div class="perf-tooltip-divider"></div>
              <div class="perf-tooltip-header" style="margin-top: 8px;">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M4.5 12.5l3 3 8-8" />
                  <circle cx="12" cy="12" r="10" />
                </svg>
                Real-time Sync
              </div>
              <div class="perf-tooltip-row">
                <span>Polling:</span>
                <span
                  class="perf-status-text"
                  class:connected={realtimePollingActive}
                >
                  {realtimePollingActive ? "● Active" : "○ Inactive"}
                </span>
              </div>
              <div class="perf-tooltip-row">
                <span>Interval:</span>
                <span class="perf-value">{POLLING_INTERVAL / 1000}s</span>
              </div>
              <div class="perf-tooltip-row">
                <span>Last Sync:</span>
                <span class="perf-value">{lastSyncTime || "Never"}</span>
              </div>
              {#if currentView === "reward" && rewardData.selectedEvent}
                <div class="perf-tooltip-row">
                  <span>Reward Auto:</span>
                  <span
                    class="perf-status-text"
                    class:connected={rewardAutoRefreshEnabled}
                  >
                    {rewardAutoRefreshEnabled ? "● On" : "○ Off"}
                  </span>
                </div>
              {/if}
              {#if currentView === "verify-proof" && verifyProofData.selectedEvent}
                <div class="perf-tooltip-row">
                  <span>Proof Auto:</span>
                  <span
                    class="perf-status-text"
                    class:connected={verifyProofAutoRefreshEnabled}
                  >
                    {verifyProofAutoRefreshEnabled ? "● On" : "○ Off"}
                  </span>
                </div>
              {/if}

              <div class="perf-tooltip-chart">
                <svg viewBox="0 0 200 50" preserveAspectRatio="none">
                  {#if perfHistory.length > 1}
                    <path
                      fill="url(#tooltipGradient)"
                      opacity="0.2"
                      d={`M0,50 ${perfHistory
                        .map((p, i) => {
                          const x = (i / (MAX_PERF_POINTS - 1)) * 200;
                          const y =
                            p.latency < 0
                              ? 48
                              : Math.min(
                                  48,
                                  Math.max(2, (p.latency / 500) * 46)
                                );
                          return `L${x},${y}`;
                        })
                        .join(" ")} L200,50 Z`}
                    />
                    <polyline
                      fill="none"
                      stroke="url(#perfGradient)"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      points={perfPointsStr}
                    />
                    <polyline
                      fill="none"
                      stroke="url(#perfGradient)"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      opacity="0.3"
                      points={perfPointsStr}
                    />
                  {/if}
                  <defs>
                    <linearGradient
                      id="tooltipGradient"
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="0%"
                    >
                      <stop offset="0%" stop-color="#10b981" />
                      <stop offset="100%" stop-color="#3b82f6" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>
          {/if}
        </div>
        <div class="token-timer" class:warning={timeLeft < 60}>
          {formatTime(timeLeft)}
        </div>
        <button
          class="logout-icon-btn desktop-only"
          on:click={handleLogout}
          aria-label="Logout"
        >
          <svg
            class="line-icon"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            ><path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            ></path></svg
          >
        </button>

        <div class="mobile-controls mobile-only">
          <button
            class="mobile-icon-btn"
            on:click={() => (isMobileMenuOpen = !isMobileMenuOpen)}
            aria-label="Open menu"
          >
            <svg
              width="24"
              height="24"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              ><path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 6h16M4 12h16m-7 6h7"
              ></path></svg
            >
          </button>
        </div>
      </div>
    </div>
  </header>

  {#if isMobileMenuOpen}
    <div
      class="mobile-overlay"
      on:click={() => (isMobileMenuOpen = false)}
      on:keydown={(e) => {
        if (e.key === "Enter" || e.key === " ") isMobileMenuOpen = false;
      }}
      role="button"
      tabindex="0"
      aria-label="Close menu overlay"
    ></div>
    <div class="mobile-drawer">
      <div class="drawer-header">
        <span class="brand-name">{lang.navigation}</span>
        <button
          class="close-btn"
          on:click={() => (isMobileMenuOpen = false)}
          aria-label="Close menu">&times;</button
        >
      </div>
      <div class="drawer-content">
        <!-- Language Toggle in Mobile -->
        <button class="drawer-item lang-drawer-item" on:click={toggleLanguage}>
          <svg
            class="lang-icon-mobile"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
            />
          </svg>
          <span class="drawer-label">
            <span class="mobile-lang-option" class:active={currentLang === "th"}
              >TH</span
            >
            <span class="mobile-lang-divider">/</span>
            <span class="mobile-lang-option" class:active={currentLang === "en"}
              >EN</span
            >
          </span>
        </button>
        <div class="drawer-divider"></div>
        {#each menuItems as item}
          <button
            class="drawer-item"
            class:active={currentView === item.id}
            on:click={() => selectView(item.id)}
          >
            <svg
              class="line-icon fixed-size"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              ><path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d={item.svg}
              ></path></svg
            >
            <span class="drawer-label">{item.label}</span>
          </button>
        {/each}
      </div>
      <div class="drawer-footer">
        <button class="drawer-item logout-special" on:click={handleLogout}>
          <svg
            class="line-icon fixed-size"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            ><path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            ></path></svg
          >
          <span>{lang.logout}</span>
        </button>
      </div>
    </div>
  {/if}

  <main class="page-content">
    <div class="wrapper">
      <div class="static-view-header">
        <div class="title-with-toggle">
          <div class="view-title">
            <h2>{menuItems.find((m) => m.id === currentView)?.label}</h2>
            <div class="divider"></div>
          </div>
        </div>
      </div>

      {#if isSearchableView && showSearchSection && !(currentView === "log" && logsData.selectedEvent) && !(currentView === "reward" && rewardData.selectedEvent)}
        <div class="filter-slide-wrapper">
          <div class="filter-bar-container">
            <div class="filter-bar">
              <div class="search-input-wrapper">
                <svg
                  class="search-icon"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  ></path>
                </svg>
                <input
                  type="text"
                  placeholder={searchPlaceholder}
                  bind:value={currentSearchQuery}
                  on:input={(e) => {
                    const value = e.currentTarget.value;
                    if (currentView === "list") searchQueryEventList = value;
                    else if (currentView === "verify-proof")
                      searchQueryVerifyProof = value;
                    else if (currentView === "log") searchQueryLogs = value;
                    else if (currentView === "reward")
                      searchQueryReward = value;
                  }}
                  on:keydown={(e) => {
                    if (e.key === "Enter") {
                      if (currentView === "list") currentPage = 1;
                      else if (currentView === "log" && !logsData.selectedEvent)
                        eventsForLogsPage = 1;
                      else if (
                        currentView === "reward" &&
                        !rewardData.selectedEvent
                      )
                        rewardEventsPage = 1;
                    }
                  }}
                />
              </div>

              <div class="filter-actions-wrapper">
                <div class="filter-group-dropdowns">
                  <!-- Month Dropdown -->
                  <div class="custom-select-container">
                    <button
                      class="select-trigger"
                      on:click={() => toggleCurrentMonthDropdown()}
                    >
                      <span>{currentSelectedMonth}</span>
                      <svg
                        class="chevron-icon"
                        class:rotated={currentMonthOpen}
                        width="16"
                        height="16"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M19 9l-7 7-7-7"
                        ></path>
                      </svg>
                    </button>
                    {#if currentMonthOpen}
                      <div class="dropdown-wrapper">
                        <div class="dropdown-scroll-area">
                          {#each months as month}
                            <button
                              class="option-btn"
                              class:selected={currentSelectedMonth === month}
                              on:click={() => selectCurrentMonth(month)}
                              >{month}</button
                            >
                          {/each}
                        </div>
                      </div>
                    {/if}
                  </div>

                  <!-- Year Dropdown -->
                  <div class="custom-select-container">
                    <button
                      class="select-trigger"
                      on:click={() => toggleCurrentYearDropdown()}
                    >
                      <span>{currentSelectedYear}</span>
                      <svg
                        class="chevron-icon"
                        class:rotated={currentYearOpen}
                        width="16"
                        height="16"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M19 9l-7 7-7-7"
                        ></path>
                      </svg>
                    </button>
                    {#if currentYearOpen}
                      <div class="dropdown-wrapper">
                        <div class="dropdown-scroll-area">
                          {#each years as year}
                            <button
                              class="option-btn"
                              class:selected={currentSelectedYear === year}
                              on:click={() => selectCurrentYear(year)}
                              >{year}</button
                            >
                          {/each}
                        </div>
                      </div>
                    {/if}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      {/if}

      {#if currentView === "list"}
        <div class="grid-section">
          {#if paginatedEvents.length === 0}
            <div class="empty-state">
              <svg
                width="48"
                height="48"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                ><path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                ></path></svg
              >
              <p>{lang.noResults}</p>
            </div>
          {:else}
            <div class="grid">
              {#each paginatedEvents as event (event.id)}
                <div class="glass-card">
                  <div class="card-img-wrapper">
                    <img
                      src={event.image ||
                        "https://placehold.co/400x200/1e293b/64748b?text=No+Image"}
                      alt={event.title}
                      class="card-img"
                      on:error={(e) => {
                        (e.currentTarget as HTMLImageElement).src =
                          "https://placehold.co/400x200/1e293b/64748b?text=Image+Unavailable";
                      }}
                    />
                  </div>

                  <div class="card-body">
                    <!-- ✅ Header with Status & Participants -->
                    <div class="card-header">
                      <h3>{event.title}</h3>
                      <div class="status-group">
                        <span
                          class="status-badge"
                          class:status-active={event.status === "Active"}
                          class:status-closed={event.status === "Closed"}
                          class:status-draft={event.status === "Draft"}
                        >
                          {translateStatus(event.status)}
                        </span>
                      </div>
                    </div>
                    <!-- ✅ Description -->
                    {#if event.description}
                      <p class="event-description-short">
                        {event.description.substring(0, 80)}{event.description
                          .length > 80
                          ? "..."
                          : ""}
                      </p>
                    {/if}

                    <!-- ✅ Simple Meta Info (Location, Date, Time) -->
                    <div class="event-simple-meta">
                      <div class="meta-row">
                        <svg
                          width="14"
                          height="14"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          stroke-width="2"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                          ></path>
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                          ></path>
                        </svg>
                        <span>{event.location}</span>
                      </div>

                      <div class="meta-row">
                        <svg
                          width="14"
                          height="14"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          stroke-width="2"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          ></path>
                        </svg>
                        <span>{formatDateRange(event)}</span>
                      </div>

                      {#if event.startTime && event.endTime}
                        <div class="meta-row">
                          <svg
                            width="14"
                            height="14"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            stroke-width="2"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            ></path>
                          </svg>
                          <span>{event.startTime} - {event.endTime}</span>
                        </div>
                      {/if}
                      {#if event.distanceKm && event.distanceKm > 0}
                        <div class="meta-row">
                          <svg
                            width="14"
                            height="14"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            stroke-width="2"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                            ></path>
                          </svg>
                          <span>{event.distanceKm} km</span>
                        </div>
                      {/if}
                      {#if getHolidayDisplay(event)}
                        <div class="meta-row holiday-row">
                          <svg
                            width="14"
                            height="14"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            stroke-width="2"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                            ></path>
                          </svg>
                          <span>{getHolidayDisplay(event)}</span>
                        </div>
                      {/if}
                    </div>

                    <!-- ✅ Bottom Section - อยู่ล่างสุดเสมอ -->
                    <div class="card-bottom-section">
                      <!-- ✅ Progress Bar (ถ้ามี capacity) -->
                      {#if event.totalSlots}
                        <div class="capacity-progress">
                          <div class="capacity-info">
                            <span class="capacity-text"
                              >{event.usedSlots || 0} / {event.totalSlots}
                              {lang.participants}</span
                            >
                            <span class="capacity-percent"
                              >{Math.round(getCapacityPercentage(event))}%</span
                            >
                          </div>
                          <div class="progress-bar">
                            <div
                              class="progress-fill"
                              style="width: {getCapacityPercentage(event)}%"
                              class:full={getCapacityPercentage(event) >= 100}
                            ></div>
                          </div>
                        </div>
                      {/if}

                      {#if event.pendingCount !== undefined && event.pendingCount > 0}
                        <div class="capacity-progress" style="margin-top: 8px;">
                          <div class="capacity-info">
                            <span class="capacity-text" style="color: #f59e0b;">
                              {currentLang === "th" ? "รอตรวจสอบ" : "Pending"}: {event.pendingCount}
                            </span>
                          </div>
                          <div class="progress-bar">
                            <div
                              class="progress-fill"
                              style="width: {getPendingPercentage(
                                event
                              )}%; background: linear-gradient(90deg, #f59e0b, #d97706);"
                            ></div>
                          </div>
                        </div>
                      {/if}

                      <div class="action-buttons">
                        <button
                          class="action-btn btn-view"
                          on:click={() => openEventModal(event)}
                        >
                          <svg
                            width="16"
                            height="16"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            stroke-width="2"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            ></path>
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            ></path>
                          </svg>
                          {lang.viewDetails}
                        </button>

                        <div class="small-actions">
                          <button
                            class="action-btn btn-edit"
                            on:click={() => handleEdit(event)}
                          >
                            <svg
                              width="16"
                              height="16"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              stroke-width="2"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              ></path>
                            </svg>
                            {lang.edit}
                          </button>
                          <button
                            class="action-btn btn-delete"
                            on:click|stopPropagation={() =>
                              handleDelete(event.id)}
                          >
                            <svg
                              width="16"
                              height="16"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              stroke-width="2"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              ></path>
                            </svg>
                            {lang.delete}
                          </button>
                        </div>
                      </div>
                    </div>
                    <!-- close card-bottom-section -->
                  </div>
                </div>
              {/each}
            </div>
            {#if totalPages > 1}
              <div class="pagination-controls">
                <!-- Previous Button -->
                <button
                  class="page-btn"
                  on:click={prevPage}
                  disabled={currentPage === 1}
                  aria-label="Previous Page"
                >
                  <svg
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M15 19l-7-7 7-7"
                    ></path>
                  </svg>
                </button>

                <!-- Page Selector -->
                <div class="page-select-wrapper">
                  <button
                    class="page-indicator-box clickable"
                    on:click|stopPropagation={() =>
                      (showPageDropdown = !showPageDropdown)}
                  >
                    <span class="current-page">{currentPage}</span>
                    <span class="sep">/</span>
                    <span class="total-page">{totalPages}</span>
                    <svg
                      class="dropdown-arrow"
                      class:flipped={showPageDropdown}
                      width="12"
                      height="12"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="3"
                        d="M19 9l-7 7-7-7"
                      ></path>
                    </svg>
                  </button>

                  {#if showPageDropdown}
                    <div
                      class="click-outside"
                      on:click|stopPropagation={() =>
                        (showPageDropdown = false)}
                      on:keydown={(e) => {
                        if (e.key === "Enter") showPageDropdown = false;
                      }}
                      role="button"
                      tabindex="0"
                      aria-label="Close dropdown"
                    ></div>
                    <div class="page-dropdown-list">
                      {#each Array(totalPages) as _, i}
                        <button
                          class="page-option"
                          class:active={currentPage === i + 1}
                          on:click={() => jumpToPage(i + 1)}
                        >
                          Page {i + 1}
                        </button>
                      {/each}
                    </div>
                  {/if}
                </div>

                <!-- Next Button -->
                <button
                  class="page-btn"
                  on:click={nextPage}
                  disabled={currentPage === totalPages}
                  aria-label="Next Page"
                >
                  <svg
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 5l7 7-7 7"
                    ></path>
                  </svg>
                </button>
              </div>
              <div class="page-info">
                Showing {(currentPage - 1) * itemsPerPage + 1} - {Math.min(
                  currentPage * itemsPerPage,
                  filteredEvents.length
                )} of {filteredEvents.length} events
              </div>
            {/if}
          {/if}
        </div>
      {:else if currentView === "log"}
        <div class="logs-container">
          {#if !logsData.selectedEvent}
            <!-- Grid Layout เหมือน Event List -->
            <div class="events-selection">
              {#if events.length === 0}
              <div class="empty-state">
                <svg
                  width="48"
                  height="48"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  ><path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  ></path></svg
                >
                <p>{lang.noResults}</p>
              </div>
                
              {:else if paginatedEventsForLogsDisplay.length === 0}
                <div class="empty-state">
                  <svg
                    width="48"
                    height="48"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="1.5"
                      d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    ></path>
                  </svg>
                  <p>{lang.noResults}</p>
                </div>
              {:else}
                <div class="grid">
                  {#each paginatedEventsForLogsDisplay as event (event.id)}
                    <div class="glass-card">
                      <div class="card-img-wrapper">
                        <img
                          src={event.image ||
                            "https://placehold.co/400x200/1e293b/64748b?text=No+Image"}
                          alt={event.title}
                          class="card-img"
                          on:error={(e) => {
                            (e.currentTarget as HTMLImageElement).src =
                              "https://placehold.co/400x200/1e293b/64748b?text=Image+Unavailable";
                          }}
                        />
                      </div>

                      <div class="card-body">
                        <div class="card-header">
                          <h3>{event.title}</h3>
                          <div class="status-group">
                            <span
                              class="status-badge"
                              class:status-active={event.status === "Active"}
                              class:status-closed={event.status === "Closed"}
                              class:status-draft={event.status === "Draft"}
                            >
                              {translateStatus(event.status)}
                            </span>
                          </div>
                        </div>

                        {#if event.description}
                          <p class="event-description-short">
                            {event.description.substring(0, 80)}{event
                              .description.length > 80
                              ? "..."
                              : ""}
                          </p>
                        {/if}

                        <div class="event-simple-meta">
                          <div class="meta-row">
                            <svg
                              width="14"
                              height="14"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              stroke-width="2"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                              ></path>
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                              ></path>
                            </svg>
                            <span>{event.location}</span>
                          </div>

                          <div class="meta-row">
                            <svg
                              width="14"
                              height="14"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              stroke-width="2"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                              ></path>
                            </svg>
                            <span>{formatDateRange(event)}</span>
                          </div>

                          {#if event.startTime && event.endTime}
                            <div class="meta-row">
                              <svg
                                width="14"
                                height="14"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                stroke-width="2"
                              >
                                <path
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                ></path>
                              </svg>
                              <span>{event.startTime} - {event.endTime}</span>
                            </div>
                          {/if}
                        </div>

                        {#if event.totalSlots}
                          <div class="capacity-progress">
                            <div class="progress-bar">
                              <div
                                class="progress-fill"
                                style="width: {getCapacityPercentage(event)}%"
                                class:full={getCapacityPercentage(event) >= 100}
                              ></div>
                            </div>
                          </div>
                        {/if}

                        <div class="action-buttons">
                          <button
                            class="action-btn btn-view"
                            on:click={() => selectEventForLogs(event)}
                          >
                            <svg
                              width="16"
                              height="16"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              stroke-width="2"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                              ></path>
                            </svg>
                            {lang.viewLogs}
                          </button>
                        </div>
                      </div>
                    </div>
                  {/each}
                </div>

                <!-- Pagination เหมือน Event List -->
                {#if paginatedEventsForLogs.length > 0 && totalEventsForLogsDisplayPages > 1}
                  <div class="pagination-controls">
                    <button
                      class="page-btn"
                      aria-label="Previous page"
                      on:click={() => {
                        prevEventsForLogsPage();
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      disabled={eventsForLogsPage === 1}
                    >
                      <svg
                        width="16"
                        height="16"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M15 19l-7-7 7-7"
                        ></path>
                      </svg>
                    </button>

                    <div class="page-select-wrapper">
                      <button
                        class="page-indicator-box clickable"
                        on:click|stopPropagation={() =>
                          (showEventsForLogsPageDropdown =
                            !showEventsForLogsPageDropdown)}
                      >
                        <span class="current-page">{eventsForLogsPage}</span>
                        <span class="sep">/</span>
                        <span class="total-page"
                          >{totalEventsForLogsDisplayPages}</span
                        >
                        <svg
                          class="dropdown-arrow"
                          class:flipped={showEventsForLogsPageDropdown}
                          width="12"
                          height="12"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="3"
                            d="M19 9l-7 7-7-7"
                          ></path>
                        </svg>
                      </button>

                      {#if showEventsForLogsPageDropdown}
                        <button
                          type="button"
                          class="click-outside"
                          on:click|stopPropagation={() =>
                            (showEventsForLogsPageDropdown = false)}
                          aria-label="Close dropdown"
                        ></button>
                        <div class="page-dropdown-list">
                          {#each Array(totalEventsForLogsDisplayPages) as _, i}
                            <button
                              class="page-option"
                              class:active={eventsForLogsPage === i + 1}
                              on:click|stopPropagation={() => {
                                jumpToEventsForLogsPage(i + 1);
                                showEventsForLogsPageDropdown = false;
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              }}
                            >
                              Page {i + 1}
                            </button>
                          {/each}
                        </div>
                      {/if}
                    </div>

                    <button
                      class="page-btn"
                      aria-label="Next page"
                      on:click={() => {
                        nextEventsForLogsPage();
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      disabled={eventsForLogsPage ===
                        totalEventsForLogsDisplayPages}
                    >
                      <svg
                        width="16"
                        height="16"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M9 5l7 7-7 7"
                        ></path>
                      </svg>
                    </button>
                  </div>

                  <!-- Showing text -->
                  <div class="showing-text">
                    Showing {(eventsForLogsPage - 1) * eventsForLogsPerPage + 1}
                    - {Math.min(
                      eventsForLogsPage * eventsForLogsPerPage,
                      filteredEventsForLogs.length
                    )} of {filteredEventsForLogs.length} events
                  </div>
                {/if}
              {/if}
            </div>
          {:else}
            <!-- Logs Detail View -->
            <div class="logs-detail">
              <div class="logs-header">
                <button class="btn-back-logs" on:click={backToEventsList}>
                  <svg
                    width="20"
                    height="20"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M15 19l-7-7 7-7"
                    ></path>
                  </svg>
                  Back to Events
                </button>
                <div class="selected-event-info">
                  <h3>{logsData.selectedEvent.title}</h3>
                  <div class="event-meta-small">
                    <span>
                      <svg
                        width="14"
                        height="14"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        stroke-width="2.5"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        ></path>
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        ></path>
                      </svg>
                      {logsData.selectedEvent.location}
                    </span>
                    <span>
                      <svg
                        width="14"
                        height="14"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        stroke-width="2.5"
                      >formatDate
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        ></path>
                      </svg>
                      {formatDateRange(logsData.selectedEvent)}
                    </span>
                    {#if logsData.selectedEvent.startTime && logsData.selectedEvent.endTime}
                      <span>
                        <svg
                          width="14"
                          height="14"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          stroke-width="2.5"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          ></path>
                        </svg>
                        {logsData.selectedEvent.startTime} - {logsData
                          .selectedEvent.endTime}
                      </span>
                    {/if}
                    <span
                      class="status-badge-inline"
                      class:active={logsData.selectedEvent.status === "Active"}
                      >{logsData.selectedEvent.status}</span
                    >
                  </div>
                </div>

                <!-- ✨ Action Buttons -->
                <div class="logs-action-buttons">
                  <!-- Real-time Indicator & Refresh -->
                  <div class="realtime-controls">
                    {#if newLogsCount > 0}
                      <button class="btn-new-logs" on:click={refreshLogs}>
                        <svg
                          width="16"
                          height="16"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          stroke-width="2.5"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          ></path>
                        </svg>
                        {newLogsCount} New
                      </button>
                    {/if}

                    <button
                      class="btn-auto-refresh"
                      class:active={autoRefreshEnabled}
                      on:click={toggleAutoRefresh}
                      title={autoRefreshEnabled
                        ? "Auto-refresh ON"
                        : "Auto-refresh OFF"}
                    >
                      <svg
                        width="16"
                        height="16"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        stroke-width="2.5"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        ></path>
                      </svg>
                      {#if isConnected}
                        <span class="live-dot"></span>
                      {/if}
                    </button>
                  </div>

                  <!-- Timeline Button -->
                  <button
                    class="btn-timeline"
                    on:click|stopPropagation={() => {
                      console.log("Timeline clicked");
                      showTimelineModal = true;
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      stroke-width="2.5"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      ></path>
                    </svg>
                    Timeline
                  </button>

                  <!-- Export Button -->
                  <div class="export-dropdown-wrapper">
                    <button
                      class="btn-export"
                      on:click={toggleExportMenu}
                      disabled={isExporting}
                    >
                      {#if isExporting}
                        <svg
                          class="spinner-icon"
                          width="16"
                          height="16"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            class="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            stroke-width="4"
                          ></circle>
                          <path
                            class="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Exporting...
                      {:else}
                        <svg
                          width="16"
                          height="16"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          stroke-width="2.5"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                          ></path>
                        </svg>
                        Export
                      {/if}
                    </button>

                    {#if showExportMenu}
                      <div class="export-menu">
                        <button
                          class="export-option"
                          on:click={() => exportLogsReport("png")}
                        >
                          <svg
                            width="16"
                            height="16"
                            fill="none"
                            stroke="#10b981"
                            viewBox="0 0 24 24"
                            stroke-width="2"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            ></path>
                          </svg>
                          Export Report (PNG)
                        </button>
                        <button
                          class="export-option"
                          on:click={() => exportLogsReport("pdf")}
                        >
                          <svg
                            width="16"
                            height="16"
                            fill="none"
                            stroke="#ef4444"
                            viewBox="0 0 24 24"
                            stroke-width="2"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            ></path>
                          </svg>
                          Export Report (PDF)
                        </button>
                        <button
                          class="export-option"
                          on:click={() => exportLogs("csv")}
                        >
                          <svg
                            width="16"
                            height="16"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            stroke-width="2"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            ></path>
                          </svg>
                          Export as CSV
                        </button>
                        <button
                          class="export-option"
                          on:click={() => exportLogs("json")}
                        >
                          <svg
                            width="16"
                            height="16"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            stroke-width="2"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                            ></path>
                          </svg>
                          Export as JSON
                        </button>
                        <button
                          class="export-option"
                          on:click={() => exportLogs("pdf")}
                        >
                          <svg
                            width="16"
                            height="16"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            stroke-width="2"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                            ></path>
                          </svg>
                          Export as PDF
                        </button>
                        <button
                          class="export-option"
                          on:click={() => exportLogs("excel")}
                        >
                          <svg
                            width="16"
                            height="16"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            stroke-width="2"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                            ></path>
                          </svg>
                          Export as Excel
                        </button>
                      </div>
                    {/if}
                  </div>
                </div>
              </div>

              <!-- ✅ Statistics Dashboard - แถวเดียว 4 ตัว -->
              <div class="stats-dashboard-single-row">
                <button
                  class="stat-card-compact clickable"
                  class:active={logsData.selectedAction === ""}
                  on:click={() => {
                    logsData.selectedAction = "";
                    applyLogsFilters();
                  }}
                >
                  <div
                    class="stat-icon-compact"
                    style="background: rgba(100, 116, 139, 0.1);"
                  >
                    <svg
                      width="20"
                      height="20"
                      fill="none"
                      stroke="#64748b"
                      viewBox="0 0 24 24"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      ></path>
                    </svg>
                  </div>
                  <div class="stat-info-compact">
                    <div class="stat-value-compact">
                      {logsData.eventStats?.total ||
                        logsData.statistics.uniqueUsers}
                    </div>
                    <div class="stat-label-compact">All</div>
                  </div>
                </button>
                <!-- Officer -->
                <button
                  class="stat-card-compact clickable"
                  class:active={logsData.selectedAction === "officer"}
                  on:click={() => {
                    logsData.selectedAction = "officer";
                    applyLogsFilters();
                  }}
                >
                  <div
                    class="stat-icon-compact"
                    style="background: rgba(59, 130, 246, 0.1);"
                  >
                    <svg
                      width="20"
                      height="20"
                      fill="none"
                      stroke="#3b82f6"
                      viewBox="0 0 24 24"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      ></path>
                    </svg>
                  </div>
                  <div class="stat-info-compact">
                    <div class="stat-value-compact">
                      {logsData.eventStats?.by_role?.officer || 0}
                    </div>
                    <div class="stat-label-compact">Officer</div>
                  </div>
                </button>

                <!-- Student -->
                <button
                  class="stat-card-compact clickable"
                  class:active={logsData.selectedAction === "student"}
                  on:click={() => {
                    logsData.selectedAction = "student";
                    applyLogsFilters();
                  }}
                >
                  <div
                    class="stat-icon-compact"
                    style="background: rgba(168, 85, 247, 0.1);"
                  >
                    <svg
                      width="20"
                      height="20"
                      fill="none"
                      stroke="#a855f7"
                      viewBox="0 0 24 24"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222"
                      ></path>
                    </svg>
                  </div>
                  <div class="stat-info-compact">
                    <div class="stat-value-compact">
                      {logsData.eventStats?.by_role?.student || 0}
                    </div>
                    <div class="stat-label-compact">Student</div>
                  </div>
                </button>

                <!-- Joined -->
                <button
                  class="stat-card-compact clickable"
                  class:active={logsData.selectedAction === "registration"}
                  on:click={() => {
                    logsData.selectedAction = "registration";
                    applyLogsFilters();
                  }}
                >
                  <div
                    class="stat-icon-compact"
                    style="background: rgba(59, 130, 246, 0.1);"
                  >
                    <svg
                      width="20"
                      height="20"
                      fill="none"
                      stroke="#3b82f6"
                      viewBox="0 0 24 24"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                      ></path>
                    </svg>
                  </div>
                  <div class="stat-info-compact">
                    <div class="stat-value-compact">
                      {logsData.statistics.totalRegistrations}
                    </div>
                    <div class="stat-label-compact">Joined</div>
                  </div>
                </button>

                <!-- Checked In -->
                <button
                  class="stat-card-compact clickable"
                  class:active={logsData.selectedAction === "check_in"}
                  on:click={() => {
                    logsData.selectedAction = "check_in";
                    applyLogsFilters();
                  }}
                >
                  <div
                    class="stat-icon-compact"
                    style="background: rgba(6, 182, 212, 0.1);"
                  >
                    <svg
                      width="20"
                      height="20"
                      fill="none"
                      stroke="#06b6d4"
                      viewBox="0 0 24 24"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      ></path>
                    </svg>
                  </div>
                  <div class="stat-info-compact">
                    <div class="stat-value-compact">
                      {logsData.statistics.totalCheckIns}
                    </div>
                    <div class="stat-label-compact">Checked In</div>
                  </div>
                </button>

                <!-- Completed -->
                <button
                  class="stat-card-compact clickable"
                  class:active={logsData.selectedAction === "reward_unlocked"}
                  on:click={() => {
                    logsData.selectedAction = "reward_unlocked";
                    applyLogsFilters();
                  }}
                >
                  <div
                    class="stat-icon-compact"
                    style="background: rgba(16, 185, 129, 0.1);"
                  >
                    <svg
                      width="20"
                      height="20"
                      fill="none"
                      stroke="#10b981"
                      viewBox="0 0 24 24"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      ></path>
                    </svg>
                  </div>
                  <div class="stat-info-compact">
                    <div class="stat-value-compact">
                      {logsData.statistics.totalRewards}
                    </div>
                    <div class="stat-label-compact">Completed</div>
                  </div>
                </button>

                <!-- Rejected -->
                <button
                  class="stat-card-compact clickable"
                  class:active={logsData.selectedAction === "no_show"}
                  on:click={() => {
                    logsData.selectedAction = "no_show";
                    applyLogsFilters();
                  }}
                >
                  <div
                    class="stat-icon-compact"
                    style="background: rgba(239, 68, 68, 0.1);"
                  >
                    <svg
                      width="20"
                      height="20"
                      fill="none"
                      stroke="#ef4444"
                      viewBox="0 0 24 24"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                      ></path>
                    </svg>
                  </div>
                  <div class="stat-info-compact">
                    <div class="stat-value-compact">
                      {logsData.logs.filter((l) => l.action === "no_show")
                        .length}
                    </div>
                    <div class="stat-label-compact">Rejected</div>
                  </div>
                </button>

                <!-- Cancelled -->
                <button
                  class="stat-card-compact clickable"
                  class:active={logsData.selectedAction ===
                    "registration_cancelled"}
                  on:click={() => {
                    logsData.selectedAction = "registration_cancelled";
                    applyLogsFilters();
                  }}
                >
                  <div
                    class="stat-icon-compact"
                    style="background: rgba(100, 116, 139, 0.1);"
                  >
                    <svg
                      width="20"
                      height="20"
                      fill="none"
                      stroke="#64748b"
                      viewBox="0 0 24 24"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                      ></path>
                    </svg>
                  </div>
                  <div class="stat-info-compact">
                    <div class="stat-value-compact">
                      {logsData.statistics.totalCancelled}
                    </div>
                    <div class="stat-label-compact">Cancelled</div>
                  </div>
                </button>
              </div>

              <!-- ✅ Filter Section - ธีมใหม่ -->
              <div class="filter-section-logs">
                <!-- แถว 1: Search Box + Nisit Filters -->
                <div class="filter-row-logs">
                  <div class="search-box-logs">
                    <svg
                      class="search-icon"
                      width="18"
                      height="18"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      ></path>
                    </svg>
                    <input
                      class="logs-search-input"
                      type="text"
                      placeholder="Search by name, email, or Nisit ID..."
                      bind:value={logsData.searchQuery}
                      on:input={() => applyLogsFilters()}
                    />
                  </div>
                  <div class="nisit-filter-box">
                    <input
                      class="logs-nisit-input"
                      type="text"
                      placeholder="Batch"
                      maxlength="2"
                      bind:value={logsNisitYearFilter}
                      on:input={(e) => {
                        logsNisitYearFilter = e.currentTarget.value.replace(
                          /\D/g,
                          ""
                        );
                        applyLogsFilters();
                      }}
                    />
                  </div>
                  <div class="nisit-filter-box" style="width: 120px;">
                    <input
                      class="logs-nisit-input"
                      type="text"
                      placeholder="Std ID"
                      maxlength="6"
                      bind:value={logsNisitIdFilter}
                      on:input={(e) => {
                        logsNisitIdFilter = e.currentTarget.value.replace(
                          /\D/g,
                          ""
                        );
                        applyLogsFilters();
                      }}
                    />
                  </div>
                </div>

                <!-- แถว 2: Filters และ Date Range -->
                <div class="filter-row-logs">
                  <div
                    class="filter-dropdown-logs"
                    class:dropdown-open={logsData.actionDropdownOpen}
                  >
                    <button
                      class="filter-trigger-logs"
                      on:click|stopPropagation={() => {
                        const wasOpen = logsData.actionDropdownOpen;
                        closeAllLogsDropdowns();
                        logsData.actionDropdownOpen = !wasOpen;
                      }}
                    >
                      <svg
                        width="16"
                        height="16"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        stroke-width="2"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                        ></path>
                      </svg>
                      <span
                        >{logsData.selectedAction
                          ? getActionConfig(logsData.selectedAction).label
                          : "All"}</span
                      >
                      <svg
                        class="chevron"
                        class:rotated={logsData.actionDropdownOpen}
                        width="12"
                        height="12"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        stroke-width="2"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M19 9l-7 7-7-7"
                        ></path>
                      </svg>
                    </button>
                    {#if logsData.actionDropdownOpen}
                      <div class="filter-menu-logs">
                        <button
                          class="filter-option-logs"
                          class:selected={!logsData.selectedAction ||
                            logsData.selectedAction === ""}
                          on:click|stopPropagation={() => {
                            logsData.selectedAction = "";
                            logsData.actionDropdownOpen = false;
                            applyLogsFilters();
                          }}>All Actions</button
                        >
                        <button
                          class="filter-option-logs"
                          class:selected={logsData.selectedAction === "officer"}
                          on:click|stopPropagation={() => {
                            logsData.selectedAction = "officer";
                            logsData.actionDropdownOpen = false;
                            applyLogsFilters();
                          }}
                          ><span style="color: #3b82f6;">●</span> Officer</button
                        >
                        <button
                          class="filter-option-logs"
                          class:selected={logsData.selectedAction === "student"}
                          on:click|stopPropagation={() => {
                            logsData.selectedAction = "student";
                            logsData.actionDropdownOpen = false;
                            applyLogsFilters();
                          }}
                          ><span style="color: #a855f7;">●</span> Student</button
                        >
                        <button
                          class="filter-option-logs"
                          class:selected={logsData.selectedAction ===
                            "registration"}
                          on:click|stopPropagation={() => {
                            logsData.selectedAction = "registration";
                            logsData.actionDropdownOpen = false;
                            applyLogsFilters();
                          }}
                          ><span style="color: #3b82f6;">●</span> Joined</button
                        >
                        <button
                          class="filter-option-logs"
                          class:selected={logsData.selectedAction ===
                            "check_in"}
                          on:click|stopPropagation={() => {
                            logsData.selectedAction = "check_in";
                            logsData.actionDropdownOpen = false;
                            applyLogsFilters();
                          }}
                          ><span style="color: #06b6d4;">●</span> Checked In</button
                        >
                        <button
                          class="filter-option-logs"
                          class:selected={logsData.selectedAction ===
                            "reward_unlocked"}
                          on:click|stopPropagation={() => {
                            logsData.selectedAction = "reward_unlocked";
                            logsData.actionDropdownOpen = false;
                            applyLogsFilters();
                          }}
                          ><span style="color: #10b981;">●</span> Completed</button
                        >
                        <button
                          class="filter-option-logs"
                          class:selected={logsData.selectedAction === "no_show"}
                          on:click|stopPropagation={() => {
                            logsData.selectedAction = "no_show";
                            logsData.actionDropdownOpen = false;
                            applyLogsFilters();
                          }}
                          ><span style="color: #ef4444;">●</span> Rejected</button
                        >
                        <button
                          class="filter-option-logs"
                          class:selected={logsData.selectedAction ===
                            "registration_cancelled"}
                          on:click|stopPropagation={() => {
                            logsData.selectedAction = "registration_cancelled";
                            logsData.actionDropdownOpen = false;
                            applyLogsFilters();
                          }}
                          ><span style="color: #64748b;">●</span> Cancelled</button
                        >
                      </div>
                    {/if}
                  </div>

                  <div
                    class="date-input-group-logs"
                    class:dropdown-open={logsData.dateFromDropdownOpen}
                  >
                    <label for="date-from-trigger">From:</label>
                    <div class="custom-date-dropdown-logs">
                      <button
                        class="custom-date-trigger-logs"
                        on:click|stopPropagation={() => {
                          const wasOpen = logsData.dateFromDropdownOpen;
                          closeAllLogsDropdowns();
                          logsData.dateFromDropdownOpen = !wasOpen;
                        }}
                      >
                        <svg
                          width="14"
                          height="14"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          ></path>
                        </svg>
                        <span
                          >{logsData.dateFrom
                            ? availableDatesForFilter.find(
                                (d) => d.value === logsData.dateFrom
                              )?.display || logsData.dateFrom
                            : "Select"}</span
                        >
                        <svg
                          class="chevron"
                          class:rotated={logsData.dateFromDropdownOpen}
                          width="10"
                          height="10"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M19 9l-7 7-7-7"
                          ></path>
                        </svg>
                      </button>
                      {#if logsData.dateFromDropdownOpen}
                        <div class="custom-date-menu-logs">
                          {#each availableDatesForFilter as date}
                            <button
                              class="date-option-logs"
                              class:selected={logsData.dateFrom === date.value}
                              on:click|stopPropagation={() => {
                                logsData.dateFrom = date.value;
                                logsData.dateFromDropdownOpen = false;
                              }}>{date.display}</button
                            >
                          {/each}
                        </div>
                      {/if}
                    </div>
                  </div>

                  <div
                    class="date-input-group-logs"
                    class:dropdown-open={logsData.dateToDropdownOpen}
                  >
                    <label for="date-from-trigger">To:</label>
                    <div class="custom-date-dropdown-logs">
                      <button
                        class="custom-date-trigger-logs"
                        on:click|stopPropagation={() => {
                          const wasOpen = logsData.dateToDropdownOpen;
                          closeAllLogsDropdowns();
                          logsData.dateToDropdownOpen = !wasOpen;
                        }}
                      >
                        <svg
                          width="14"
                          height="14"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          ></path>
                        </svg>
                        <span
                          >{logsData.dateTo
                            ? availableDatesForFilter.find(
                                (d) => d.value === logsData.dateTo
                              )?.display || logsData.dateTo
                            : "Select"}</span
                        >
                        <svg
                          class="chevron"
                          class:rotated={logsData.dateToDropdownOpen}
                          width="10"
                          height="10"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M19 9l-7 7-7-7"
                          ></path>
                        </svg>
                      </button>
                      {#if logsData.dateToDropdownOpen}
                        <div class="custom-date-menu-logs">
                          {#each availableDatesForFilter as date}
                            <button
                              class="date-option-logs"
                              class:selected={logsData.dateTo === date.value}
                              on:click|stopPropagation={() => {
                                logsData.dateTo = date.value;
                                logsData.dateToDropdownOpen = false;
                              }}>{date.display}</button
                            >
                          {/each}
                        </div>
                      {/if}
                    </div>
                  </div>

                  <button class="btn-apply-logs" on:click={applyLogsFilters}>
                    <svg
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                      ></path>
                    </svg>
                    {lang.apply}
                  </button>
                  <button class="btn-reset-logs" on:click={resetLogsFilters}>
                    <svg
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      ></path>
                    </svg>
                    {lang.reset}
                  </button>
                </div>
              </div>

              <!-- Loading State -->
              {#if logsData.loading}
                <div class="loading-state">
                  <div class="spinner"></div>
                  <p>Loading logs...</p>
                </div>
              {/if}

              <!-- Error State -->
              {#if logsData.error}
                <div class="error-state">
                  <svg
                    width="48"
                    height="48"
                    fill="none"
                    stroke="#ef4444"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    ></path>
                  </svg>
                  <p>{logsData.error}</p>
                  <button class="btn-retry" on:click={fetchLogs}>Retry</button>
                </div>
              {/if}

              <!-- ✅ Logs Grid Layout (เหมือน Event List) -->
              {#if !logsData.loading && !logsData.error}
                <div class="logs-list-container">
                  {#if paginatedLogsForList.length === 0}
                    <div class="empty-state">
                      <svg
                        width="48"
                        height="48"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="1.5"
                          d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        ></path>
                      </svg>
                      <p>{lang.noResults}</p>
                    </div>
                  {:else}
                    <!-- ✅ 2 Column Grid -->
                    <div class="logs-grid-2col">
                      {#each paginatedLogsForList as log, index (log.id)}
                        {@const actionColor = getActionConfig(log.action).color}
                        <div class="log-list-card">
                          <!-- Avatar Circle with Number -->
                          <div
                            class="log-avatar-circle"
                            style="background: linear-gradient(135deg, {actionColor}, {actionColor}dd);"
                          >
                            <span
                              >{index +
                                1 +
                                (logsListPage - 1) * logsListPerPage}</span
                            >
                          </div>

                          <!-- Card Content -->
                          <div class="log-list-content">
                            <!-- Header Row -->
                            <div class="log-list-header">
                              <div class="log-user-info">
                                <h3 class="log-user-name">{log.userName}</h3>
                                <span class="log-user-id"
                                  >{log.userNisitId || "N/A"} • {log.userEmail}</span
                                >
                              </div>
                              <button
                                class="log-status-badge-compact clickable-badge"
                                style="background: {actionColor}20; border-color: {actionColor}40; color: {actionColor};"
                                on:click|stopPropagation={() => {
                                  logsData.selectedAction = log.action;
                                  applyLogsFilters();
                                }}
                              >
                                <svg
                                  width="14"
                                  height="14"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                  stroke-width="2"
                                >
                                  <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    d={getActionConfig(log.action).icon}
                                  ></path>
                                </svg>
                                {getActionConfig(
                                  log.action
                                ).label.toUpperCase()}
                              </button>
                            </div>

                            <!-- Details Grid -->
                            <div class="log-details-grid">
                              <!-- Join Code - แสดงเสมอถ้ามี -->
                              {#if log.details?.registrationCode}
                                <div class="log-detail-item">
                                  <span class="log-detail-label"
                                    >Join Code:</span
                                  >
                                  <span class="log-detail-value log-code"
                                    >{log.details.registrationCode}</span
                                  >
                                </div>
                              {/if}

                              <!-- Joined - แสดงเสมอถ้ามี action registration -->
                              {#if log.action === "registration" || shouldShowJoined(log)}
                                <div class="log-detail-item">
                                  <span class="log-detail-label">Joined:</span>
                                  <span class="log-detail-value">
                                    {log.action === "registration"
                                      ? formatFullDate(log.timestamp)            
                                      : formatFullDate(getJoinedTimestamp(log))} 
                                  </span>
                                </div>
                              {/if}

                              {#if shouldShowCheckedIn(log)}
                                <div class="log-detail-item">
                                  <span class="log-detail-label">Checked In:</span>
                                  <span class="log-detail-value">
                                    {log.action === "check_in"
                                      ? formatFullDate(log.timestamp)
                                      : formatFullDate(getCheckedInTimestamp(log))}
                                  </span>
                                </div>
                              {/if}

                              <!-- Completed - แสดงเฉพาะเมื่อ status เป็น reward_unlocked -->
                              {#if shouldShowCompleted(log)}
                                <div class="log-detail-item">
                                  <span class="log-detail-label"
                                    >Completed:</span
                                  >
                                  <span class="log-detail-value">
                                    {log.action === "reward_unlocked"
                                      ? formatTimestamp(log.timestamp)
                                      : "-"}
                                  </span>
                                </div>
                              {/if}

                              <!-- Proof Submitted - แสดงเฉพาะเมื่อ status เป็น reward_unlocked -->
                              {#if shouldShowProofSubmitted(log)}
                                <div class="log-detail-item">
                                  <span class="log-detail-label"
                                    >Proof Submitted:</span
                                  >
                                  <span class="log-detail-value">
                                    {log.action === "reward_unlocked"
                                      ? formatTimestamp(log.timestamp)
                                      : "-"}
                                  </span>
                                </div>
                              {/if}

                              <!-- Cancelled - แสดงเฉพาะเมื่อ action เป็น registration_cancelled -->
                              {#if log.action === "registration_cancelled"}
                                <div class="log-detail-item">
                                  <span class="log-detail-label"
                                    >Cancelled:</span
                                  >
                                  <span class="log-detail-value">
                                    {formatTimestamp(log.timestamp)}
                                  </span>
                                </div>
                              {/if}
                            </div>

                            <!-- View Proof Image - แสดงเฉพาะ Completed -->
                            {#if log.action === "reward_unlocked"}
                              <button
                                class="log-proof-link"
                                on:click|stopPropagation={() =>
                                  openProofImage(log)}
                              >
                                <svg
                                  width="16"
                                  height="16"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                  stroke-width="2"
                                >
                                  <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                  ></path>
                                </svg>
                                <span>View Proof Image</span>
                              </button>
                            {/if}

                            <!-- Cancellation Reason - แสดงเฉพาะ Cancelled -->
                            {#if log.action === "registration_cancelled" && log.details?.reason}
                              <div class="log-cancellation-reason">
                                <strong>Cancellation Reason:</strong>
                                <p>{log.details.reason}</p>
                              </div>
                            {/if}

                            <!-- Footer -->
                            <div class="log-list-footer">
                              <span class="log-last-updated"
                                >Last updated: {formatTimestamp(
                                  log.timestamp
                                )}</span
                              >
                            </div>
                          </div>
                        </div>
                      {/each}
                    </div>
                  {/if}
                </div>

                <!-- ✅ Pagination (เหมือน Event List) -->
                {#if paginatedLogsForList.length > 0 && totalLogsListPages > 1}
                  <div class="pagination-controls">
                    <button
                      class="page-btn"
                      aria-label="Previous page"
                      on:click={prevLogsListPage}
                      disabled={logsListPage === 1}
                    >
                      <svg
                        width="16"
                        height="16"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M15 19l-7-7 7-7"
                        ></path>
                      </svg>
                    </button>

                    <div class="page-select-wrapper">
                      <button
                        class="page-indicator-box clickable"
                        on:click|stopPropagation={() =>
                          (showLogsPageDropdown = !showLogsPageDropdown)}
                      >
                        <span class="current-page">{logsListPage}</span>
                        <span class="sep">/</span>
                        <span class="total-page">{totalLogsListPages}</span>
                        <svg
                          class="dropdown-arrow"
                          class:flipped={showLogsPageDropdown}
                          width="12"
                          height="12"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          ><path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="3"
                            d="M19 9l-7 7-7-7"
                          ></path></svg
                        >
                      </button>

                      {#if showLogsPageDropdown}
                        <div
                          class="click-outside"
                          role="button"
                          tabindex="0"
                          on:click|stopPropagation={() =>
                            (showLogsPageDropdown = false)}
                          on:keydown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              showLogsPageDropdown = false;
                            }
                          }}
                        ></div>
                        <div class="page-dropdown-list">
                          {#each Array(totalLogsListPages) as _, i}
                            <button
                              class="page-option"
                              class:active={logsListPage === i + 1}
                              on:click|stopPropagation={() => {
                                jumpToLogsListPage(i + 1);
                                showLogsPageDropdown = false;
                              }}
                            >
                              Page {i + 1}
                            </button>
                          {/each}
                        </div>
                      {/if}
                    </div>

                    <button
                      class="page-btn"
                      aria-label="Next page"
                      on:click={nextLogsListPage}
                      disabled={logsListPage === totalLogsListPages}
                    >
                      <svg
                        width="16"
                        height="16"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M9 5l7 7-7 7"
                        ></path>
                      </svg>
                    </button>
                  </div>
                  <!-- Showing text -->
                  <div class="showing-text">
                    Showing {(logsListPage - 1) * logsListPerPage + 1} - {Math.min(
                      logsListPage * logsListPerPage,
                      logsToDisplay.length
                    )} of {logsToDisplay.length} logs
                  </div>
                {/if}
              {/if}
            </div>
          {/if}
        </div>
      {:else if currentView === "reward"}
        <div class="logs-container">
          {#if !rewardData.selectedEvent}
            <div class="grid-section">
              <!-- Events List -->
              {#if paginatedEventsForReward.length === 0}
                <div class="empty-state">
                  <svg
                    width="48"
                    height="48"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="1.5"
                      d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    ></path>
                  </svg>
                  <p>{lang.noResults}</p>
                </div>
              {:else}
                <div class="grid">
                  {#each paginatedEventsForReward as event (event.id)}
                    <div class="glass-card">
                      <div class="card-img-wrapper">
                        <img
                          src={event.image ||
                            "https://placehold.co/400x200/1e293b/64748b?text=No+Image"}
                          alt={event.title}
                          class="card-img"
                          on:error={(e) => {
                            (e.currentTarget as HTMLImageElement).src =
                              "https://placehold.co/400x200/1e293b/64748b?text=Image+Unavailable";
                          }}
                        />
                      </div>

                      <div class="card-body">
                        <div class="card-header">
                          <h3>{event.title}</h3>
                          <div class="status-group">
                            <span
                              class="status-badge"
                              class:status-active={event.status === "Active"}
                              class:status-closed={event.status === "Closed"}
                              class:status-draft={event.status === "Draft"}
                            >
                              {translateStatus(event.status)}
                            </span>
                          </div>
                        </div>

                        {#if event.description}
                          <p class="event-description-short">
                            {event.description.substring(0, 80)}{event
                              .description.length > 80
                              ? "..."
                              : ""}
                          </p>
                        {/if}

                        <div class="event-simple-meta">
                          <div class="meta-row">
                            <svg
                              width="14"
                              height="14"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              stroke-width="2"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                              ></path>
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                              ></path>
                            </svg>
                            <span>{event.location}</span>
                          </div>

                          <div class="meta-row">
                            <svg
                              width="14"
                              height="14"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              stroke-width="2"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                              ></path>
                            </svg>
                            <span>{formatDateRange(event)}</span>
                          </div>

                          {#if event.startTime && event.endTime}
                            <div class="meta-row">
                              <svg
                                width="14"
                                height="14"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                stroke-width="2"
                              >
                                <path
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                ></path>
                              </svg>
                              <span>{event.startTime} - {event.endTime}</span>
                            </div>
                          {/if}
                        </div>

                        {#if event.totalSlots}
                          <div class="capacity-progress">
                            <div class="progress-bar">
                              <div
                                class="progress-fill"
                                style="width: {getCapacityPercentage(event)}%"
                                class:full={getCapacityPercentage(event) >= 100}
                              ></div>
                            </div>
                          </div>
                        {/if}

                        {#if event.pendingCount !== undefined && event.pendingCount > 0}
                          <div
                            class="capacity-progress"
                            style="margin-top: 8px;"
                          >
                            <div
                              class="progress-info"
                              style="display: flex; justify-content: space-between; font-size: 11px; color: #f59e0b; margin-bottom: 4px;"
                            >
                              <span
                                >{currentLang === "th"
                                  ? "รอตรวจสอบ"
                                  : "Pending"}</span
                              >
                              <span>{event.pendingCount}</span>
                            </div>
                            <div class="progress-bar">
                              <div
                                class="progress-fill"
                                style="width: {getPendingPercentage(
                                  event
                                )}%; background: linear-gradient(90deg, #f59e0b, #d97706);"
                              ></div>
                            </div>
                          </div>
                        {/if}

                        <div class="action-buttons">
                          <button
                            class="action-btn btn-view"
                            on:click={() => selectEventForReward(event)}
                          >
                            <svg
                              width="16"
                              height="16"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              stroke-width="2"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V6a2 2 0 10-2 2h2zm0 0h4l-4 4-4-4h4z"
                              ></path>
                            </svg>
                            {lang.viewRewards}
                          </button>
                        </div>
                      </div>
                    </div>
                  {/each}
                </div>

                <!-- Pagination for Reward Events List -->
                {#if totalRewardEventsPages > 1}
                  <div class="pagination-wrapper">
                    <div class="pagination-controls">
                      <button
                        class="page-btn"
                        aria-label="Next page"
                        on:click={prevRewardEventsPage}
                        disabled={rewardEventsPage === 1}
                      >
                        <svg
                          width="16"
                          height="16"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M15 19l-7-7 7-7"
                          ></path>
                        </svg>
                      </button>
                      <div class="page-select-wrapper">
                        <button
                          class="page-indicator-box clickable"
                          on:click|stopPropagation={() =>
                            (showRewardEventsPageDropdown =
                              !showRewardEventsPageDropdown)}
                        >
                          <span class="current-page">{rewardEventsPage}</span>
                          <span class="sep">/</span>
                          <span class="total-page"
                            >{totalRewardEventsPages}</span
                          >
                          <svg
                            class="dropdown-arrow"
                            class:flipped={showRewardEventsPageDropdown}
                            width="12"
                            height="12"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="3"
                              d="M19 9l-7 7-7-7"
                            ></path>
                          </svg>
                        </button>
                        {#if showRewardEventsPageDropdown}
                          <div
                            class="click-outside"
                            role="button"
                            tabindex="0"
                            on:click|stopPropagation={() =>
                              (showRewardEventsPageDropdown = false)}
                            on:keydown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                showRewardEventsPageDropdown = false;
                              }
                            }}
                          ></div>
                          <div class="page-dropdown-list">
                            {#each Array(totalRewardEventsPages) as _, i}
                              <button
                                class="page-option"
                                class:active={rewardEventsPage === i + 1}
                                on:click|stopPropagation={() => {
                                  jumpToRewardEventsPage(i + 1);
                                  showRewardEventsPageDropdown = false;
                                }}
                              >
                                Page {i + 1}
                              </button>
                            {/each}
                          </div>
                        {/if}
                      </div>
                      <button
                        class="page-btn"
                        aria-label="Next page"
                        on:click={nextRewardEventsPage}
                        disabled={rewardEventsPage === totalRewardEventsPages}
                      >
                        <svg
                          width="16"
                          height="16"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M9 5l7 7-7 7"
                          ></path>
                        </svg>
                      </button>
                    </div>
                    <div class="showing-text">
                      Showing {(rewardEventsPage - 1) * rewardEventsPerPage + 1}
                      - {Math.min(
                        rewardEventsPage * rewardEventsPerPage,
                        filteredEventsForReward.length
                      )} of {filteredEventsForReward.length} events
                    </div>
                  </div>
                {/if}
              {/if}
            </div>
          {:else}
            <!-- Selected Event - Reward Users -->
            <div class="logs-detail">
              <div class="logs-header">
                <button class="btn-back-logs" on:click={backToRewardEventsList}>
                  <svg
                    width="20"
                    height="20"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M15 19l-7-7 7-7"
                    ></path>
                  </svg>
                  Back to Events
                </button>

                <div class="selected-event-info">
                  <h3>{rewardData.selectedEvent.title}</h3>
                  <div class="event-meta-small">
                    <span>
                      <svg
                        width="14"
                        height="14"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        stroke-width="2.5"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        ></path>
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        ></path>
                      </svg>
                      {rewardData.selectedEvent.location}
                    </span>
                    <span>
                      <svg
                        width="14"
                        height="14"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        stroke-width="2.5"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        ></path>
                      </svg>
                      {formatDateRange(rewardData.selectedEvent)}
                    </span>
                    {#if rewardData.selectedEvent.startTime && rewardData.selectedEvent.endTime}
                      <span>
                        <svg
                          width="14"
                          height="14"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          stroke-width="2.5"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          ></path>
                        </svg>
                        {rewardData.selectedEvent.startTime} - {rewardData
                          .selectedEvent.endTime}
                      </span>
                    {/if}
                    <span
                      class="status-badge-inline"
                      class:active={rewardData.selectedEvent.status ===
                        "Active"}>{rewardData.selectedEvent.status}</span
                    >
                  </div>
                </div>

                <div class="logs-action-buttons">
                  <div class="realtime-controls">
                    {#if newRewardUsersCount > 0}
                      <button
                        class="btn-new-logs"
                        on:click={refreshRewardUsers}
                      >
                        <svg
                          width="16"
                          height="16"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          stroke-width="2.5"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          ></path>
                        </svg>
                        {newRewardUsersCount} New
                      </button>
                    {/if}

                    <button
                      class="btn-auto-refresh"
                      class:active={rewardAutoRefreshEnabled}
                      on:click={toggleRewardAutoRefresh}
                      title={rewardAutoRefreshEnabled
                        ? "Auto-refresh ON"
                        : "Auto-refresh OFF"}
                    >
                      <svg
                        width="16"
                        height="16"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        stroke-width="2.5"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        ></path>
                      </svg>
                      {#if rewardIsConnected}
                        <span class="live-dot"></span>
                      {/if}
                    </button>
                  </div>

                  <button class="btn-send-all" on:click={openSendAllModal}>
                    <svg
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      ></path>
                    </svg>
                    Send to All
                  </button>

                  <div class="export-dropdown-wrapper">
                    <button
                      class="btn-export"
                      on:click|stopPropagation={() =>
                        (showRewardExportMenu = !showRewardExportMenu)}
                    >
                      <svg
                        width="16"
                        height="16"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        stroke-width="2"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        ></path>
                      </svg>
                      Export
                    </button>

                    {#if showRewardExportMenu}
                      <div class="export-menu" style="z-index: 1000;">
                        <button
                          class="export-option"
                          on:click={() => exportRewardsReportDirect("png")}
                        >
                          <svg
                            width="16"
                            height="16"
                            fill="none"
                            stroke="#10b981"
                            viewBox="0 0 24 24"
                            stroke-width="2"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            ></path>
                          </svg>
                          Export Report (PNG)
                        </button>
                        <button
                          class="export-option"
                          on:click={() => exportRewardsReportDirect("pdf")}
                        >
                          <svg
                            width="16"
                            height="16"
                            fill="none"
                            stroke="#ef4444"
                            viewBox="0 0 24 24"
                            stroke-width="2"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            ></path>
                          </svg>
                          Export Report (PDF)
                        </button>
                        <button
                          class="export-option"
                          on:click={() => exportRewards("csv")}
                        >
                          <svg
                            width="16"
                            height="16"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            stroke-width="2"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            ></path>
                          </svg>
                          Export as CSV
                        </button>
                        <button
                          class="export-option"
                          on:click={() => exportRewards("json")}
                        >
                          <svg
                            width="16"
                            height="16"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            stroke-width="2"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                            ></path>
                          </svg>
                          Export as JSON
                        </button>
                        <button
                          class="export-option"
                          on:click={() => exportRewards("pdf")}
                        >
                          <svg
                            width="16"
                            height="16"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            stroke-width="2"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                            ></path>
                          </svg>
                          Export as PDF
                        </button>
                        <button
                          class="export-option"
                          on:click={() => exportRewards("excel")}
                        >
                          <svg
                            width="16"
                            height="16"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            stroke-width="2"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                            ></path>
                          </svg>
                          Export as Excel
                        </button>
                      </div>
                    {/if}
                  </div>
                </div>
              </div>

              <!-- Tier Cards -->
              {#if rewardData.selectedEvent.rewards && rewardData.selectedEvent.rewards.length > 0}
                {@const sortedTiers = [
                  ...(rewardData.selectedEvent?.rewards || []),
                ].sort((a, b) => {
                  const reqA = a.requirement || a.rangeEnd || 0;
                  const reqB = b.requirement || b.rangeEnd || 0;
                  return reqB - reqA;
                })}
                <div class="stats-dashboard-single-row">
                  <!-- All -->
                  <button
                    class="stat-card-compact clickable"
                    class:active={rewardData.selectedTier === "All"}
                    on:click={() => {
                      rewardData.selectedTier = "All";
                      rewardUsersPage = 1;
                    }}
                  >
                    <div
                      class="stat-icon-compact"
                      style="background: rgba(100, 116, 139, 0.1);"
                    >
                      <svg
                        width="20"
                        height="20"
                        fill="none"
                        stroke="#64748b"
                        viewBox="0 0 24 24"
                        stroke-width="2"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                        ></path>
                      </svg>
                    </div>
                    <div class="stat-info-compact">
                      <div class="stat-value-compact">
                        {rewardData.users.length}
                      </div>
                      <div class="stat-label-compact">All</div>
                    </div>
                  </button>

                  <!-- Dynamic Tiers -->
                  {#each sortedTiers as tier, index}
                    {@const tierInfo = getTierDisplayName(tier.name, index)}
                    {@const completedInTier = rewardData.users.filter(
                      (u) => u.tier === tier.name
                    ).length}
                    <button
                      class="stat-card-compact clickable"
                      class:active={rewardData.selectedTier === tier.name}
                      on:click={() => {
                        rewardData.selectedTier =
                          rewardData.selectedTier === tier.name
                            ? "All"
                            : tier.name;
                        rewardUsersPage = 1;
                      }}
                    >
                      <div
                        class="stat-icon-compact"
                        style="background: {tierInfo.color}15;"
                      >
                        <!-- Icon ดาวสำหรับทุก Tier -->
                        <svg
                          width="20"
                          height="20"
                          fill="none"
                          stroke={tierInfo.color}
                          viewBox="0 0 24 24"
                          stroke-width="2"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                          ></path>
                        </svg>
                      </div>
                      <div class="stat-info-compact">
                        <div class="stat-value-compact">
                          {completedInTier}/{tier.quota || 0}
                        </div>
                        <div
                          class="stat-label-compact"
                          style="color: {tierInfo.color};"
                        >
                          {tierInfo.name}
                        </div>
                      </div>
                    </button>
                  {/each}

                  <!-- In Progress -->
                  <button
                    class="stat-card-compact clickable"
                    class:active={rewardData.selectedTier === "In Progress"}
                    on:click={() => {
                      rewardData.selectedTier =
                        rewardData.selectedTier === "In Progress"
                          ? "All"
                          : "In Progress";
                      rewardUsersPage = 1;
                    }}
                  >
                    <div
                      class="stat-icon-compact"
                      style="background: rgba(59, 130, 246, 0.1);"
                    >
                      <svg
                        width="20"
                        height="20"
                        fill="none"
                        stroke="#3b82f6"
                        viewBox="0 0 24 24"
                        stroke-width="2"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M13 10V3L4 14h7v7l9-11h-7z"
                        ></path>
                      </svg>
                    </div>
                    <div class="stat-info-compact">
                      <div class="stat-value-compact">
                        {rewardData.users.filter(
                          (u) => u.status === "in_progress"
                        ).length}
                      </div>
                      <div class="stat-label-compact">In Progress</div>
                    </div>
                  </button>

                  <!-- Newcomer (No Tier) -->
                  <button
                    class="stat-card-compact clickable"
                    class:active={rewardData.selectedTier === "No Tier"}
                    on:click={() => {
                      rewardData.selectedTier =
                        rewardData.selectedTier === "No Tier"
                          ? "All"
                          : "No Tier";
                      rewardUsersPage = 1;
                    }}
                  >
                    <div
                      class="stat-icon-compact"
                      style="background: rgba(100, 116, 139, 0.1);"
                    >
                      <svg
                        width="20"
                        height="20"
                        fill="none"
                        stroke="#64748b"
                        viewBox="0 0 24 24"
                        stroke-width="2"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        ></path>
                      </svg>
                    </div>
                    <div class="stat-info-compact">
                      <div class="stat-value-compact">
                        {rewardData.users.filter((u) => u.tier === "No Tier")
                          .length}
                      </div>
                      <div class="stat-label-compact">Newcomer</div>
                    </div>
                  </button>
                </div>
              {/if}

              <!-- Filter -->
              <div class="filter-section-logs">
                <div
                  class="filter-row-logs"
                  style="flex-wrap: wrap; gap: 0.75rem;"
                >
                  <!-- Search -->
                  <div
                    class="search-box-logs"
                    style="flex: 1; min-width: 200px;"
                  >
                    <svg
                      class="search-icon"
                      width="18"
                      height="18"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      ></path>
                    </svg>
                    <input
                      type="text"
                      placeholder="Search by name or email..."
                      bind:value={rewardData.searchQuery}
                      on:input={() => {
                        rewardData.selectedTier = "All";
                      }}
                      on:keydown={(e) =>
                        e.key === "Enter" && applyRewardFilters()}
                    />
                  </div>

                  <!-- Nisit Year Filter (เลขหน้า) -->
                  <div class="nisit-filter-box">
                    <input
                      type="text"
                      placeholder="Batch"
                      maxlength="2"
                      bind:value={nisitYearFilter}
                      on:input={(e) => {
                        nisitYearFilter = e.currentTarget.value.replace(
                          /\D/g,
                          ""
                        );
                        rewardData.selectedTier = "All";
                      }}
                    />
                  </div>

                  <!-- Nisit ID Filter (เลขหลัง) -->
                  <div class="nisit-filter-box" style="width: 120px;">
                    <input
                      type="text"
                      placeholder="Std ID"
                      maxlength="6"
                      bind:value={nisitIdFilter}
                      on:input={(e) => {
                        nisitIdFilter = e.currentTarget.value.replace(
                          /\D/g,
                          ""
                        );
                        rewardData.selectedTier = "All";
                      }}
                    />
                  </div>

                  <!-- Sort Dropdown -->
                  <div class="filter-dropdown-logs">
                    <button
                      class="filter-trigger-logs"
                      on:click|stopPropagation={() => {
                        rewardSortDropdownOpen = !rewardSortDropdownOpen;
                        // Reset status card selection เมื่อเปิด dropdown
                        rewardData.selectedTier = "All";
                      }}
                    >
                      <svg
                        width="16"
                        height="16"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        stroke-width="2"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
                        ></path>
                      </svg>
                      <span>
                        {#if rewardSortBy === "all"}
                          All (Default)
                        {:else if rewardSortBy === "global_best"}
                          Global: Best → Lowest
                        {:else if rewardSortBy === "global_lowest"}
                          Global: Lowest → Best
                        {:else if rewardSortBy === "tier_best"}
                          Tier: Best → Lowest
                        {:else if rewardSortBy === "tier_lowest"}
                          Tier: Lowest → Best
                        {:else}
                          All (Default)
                        {/if}
                      </span>
                      <svg
                        class="chevron"
                        class:rotated={rewardSortDropdownOpen}
                        width="12"
                        height="12"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        stroke-width="2"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M19 9l-7 7-7-7"
                        ></path>
                      </svg>
                    </button>
                    {#if rewardSortDropdownOpen}
                      <div class="filter-menu-logs">
                        <button
                          class="filter-option-logs"
                          class:selected={rewardSortBy === "all"}
                          on:click|stopPropagation={() => {
                            rewardSortBy = "all";
                            rewardTierFilter = "all";
                            rewardData.selectedTier = "All";
                            rewardSortDropdownOpen = false;
                          }}
                        >
                          <svg
                            width="14"
                            height="14"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            stroke-width="2"
                            ><path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="M4 6h16M4 12h16M4 18h16"
                            ></path></svg
                          >
                          All (Default)
                        </button>
                        <div
                          style="height: 1px; background: rgba(255,255,255,0.1); margin: 0.5rem 0;"
                        ></div>
                        <div
                          style="padding: 0.25rem 0.75rem; font-size: 0.7rem; color: #64748b; text-transform: uppercase;"
                        >
                          Global Rank
                        </div>
                        <button
                          class="filter-option-logs"
                          class:selected={rewardSortBy === "global_best"}
                          on:click|stopPropagation={() => {
                            rewardSortBy = "global_best";
                            rewardTierFilter = "all";
                            rewardData.selectedTier = "All";
                            rewardSortDropdownOpen = false;
                          }}
                        >
                          <svg
                            width="14"
                            height="14"
                            fill="none"
                            stroke="#10b981"
                            viewBox="0 0 24 24"
                            stroke-width="2"
                            ><path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="M5 10l7-7m0 0l7 7m-7-7v18"
                            ></path></svg
                          >
                          Best → Lowest
                        </button>
                        <button
                          class="filter-option-logs"
                          class:selected={rewardSortBy === "global_lowest"}
                          on:click|stopPropagation={() => {
                            rewardSortBy = "global_lowest";
                            rewardTierFilter = "all";
                            rewardData.selectedTier = "All";
                            rewardSortDropdownOpen = false;
                          }}
                        >
                          <svg
                            width="14"
                            height="14"
                            fill="none"
                            stroke="#ef4444"
                            viewBox="0 0 24 24"
                            stroke-width="2"
                            ><path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="M19 14l-7 7m0 0l-7-7m7 7V3"
                            ></path></svg
                          >
                          Lowest → Best
                        </button>
                        <div
                          style="height: 1px; background: rgba(255,255,255,0.1); margin: 0.5rem 0;"
                        ></div>
                        <div
                          style="padding: 0.25rem 0.75rem; font-size: 0.7rem; color: #64748b; text-transform: uppercase;"
                        >
                          Tier Rank
                        </div>
                        <button
                          class="filter-option-logs"
                          class:selected={rewardSortBy === "tier_best"}
                          on:click|stopPropagation={() => {
                            rewardSortBy = "tier_best";
                            rewardData.selectedTier = "All";
                            rewardSortDropdownOpen = false;
                          }}
                        >
                          <svg
                            width="14"
                            height="14"
                            fill="none"
                            stroke="#f59e0b"
                            viewBox="0 0 24 24"
                            stroke-width="2"
                            ><path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="M5 10l7-7m0 0l7 7m-7-7v18"
                            ></path></svg
                          >
                          Best → Lowest
                        </button>
                        <button
                          class="filter-option-logs"
                          class:selected={rewardSortBy === "tier_lowest"}
                          on:click|stopPropagation={() => {
                            rewardSortBy = "tier_lowest";
                            rewardData.selectedTier = "All";
                            rewardSortDropdownOpen = false;
                          }}
                        >
                          <svg
                            width="14"
                            height="14"
                            fill="none"
                            stroke="#f59e0b"
                            viewBox="0 0 24 24"
                            stroke-width="2"
                            ><path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="M19 14l-7 7m0 0l-7-7m7 7V3"
                            ></path></svg
                          >
                          Lowest → Best
                        </button>
                      </div>
                    {/if}
                  </div>

                  <!-- Tier Filter (แสดงเฉพาะเมื่อเลือก Tier Rank) -->
                  {#if rewardSortBy === "tier_best" || rewardSortBy === "tier_lowest"}
                    {@const sortedTiersForFilter = [
                      ...(rewardData.selectedEvent?.rewards || []),
                    ].sort((a, b) => {
                      const reqA = a.requirement || a.rangeEnd || 0;
                      const reqB = b.requirement || b.rangeEnd || 0;
                      return reqB - reqA;
                    })}
                    <div class="filter-dropdown-logs">
                      <button
                        class="filter-trigger-logs"
                        on:click|stopPropagation={() =>
                          (rewardTierFilterDropdownOpen =
                            !rewardTierFilterDropdownOpen)}
                      >
                        <svg
                          width="16"
                          height="16"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          stroke-width="2"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V6a2 2 0 10-2 2h2zm0 0h4l-4 4-4-4h4z"
                          ></path>
                        </svg>
                        <span>
                          {#if rewardTierFilter === "all"}
                            All Tiers
                          {:else if rewardTierFilter === "No Tier"}
                            Newcomer
                          {:else}
                            {@const tierIdx = sortedTiersForFilter.findIndex(
                              (t) => t.name === rewardTierFilter
                            )}
                            {@const tInfo = getTierDisplayName(
                              rewardTierFilter,
                              tierIdx >= 0 ? tierIdx : 0
                            )}
                            {tInfo.name}
                          {/if}
                        </span>
                        <svg
                          class="chevron"
                          class:rotated={rewardTierFilterDropdownOpen}
                          width="12"
                          height="12"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          stroke-width="2"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M19 9l-7 7-7-7"
                          ></path>
                        </svg>
                      </button>
                      {#if rewardTierFilterDropdownOpen}
                        <div class="filter-menu-logs">
                          <button
                            class="filter-option-logs"
                            class:selected={rewardTierFilter === "all"}
                            on:click|stopPropagation={() => {
                              rewardTierFilter = "all";
                              rewardTierFilterDropdownOpen = false;
                              rewardUsersPage = 1;
                            }}
                          >
                            <svg
                              width="14"
                              height="14"
                              fill="none"
                              stroke="#64748b"
                              viewBox="0 0 24 24"
                              stroke-width="2"
                              ><path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M4 6h16M4 12h16M4 18h16"
                              ></path></svg
                            >
                            All Tiers
                          </button>
                          <div
                            style="height: 1px; background: rgba(255,255,255,0.1); margin: 0.5rem 0;"
                          ></div>
                          {#each sortedTiersForFilter as tier, index}
                            {@const tierInfo = getTierDisplayName(
                              tier.name,
                              index
                            )}
                            <button
                              class="filter-option-logs"
                              class:selected={rewardTierFilter === tier.name}
                              on:click|stopPropagation={() => {
                                rewardTierFilter = tier.name;
                                rewardTierFilterDropdownOpen = false;
                                rewardUsersPage = 1;
                              }}
                            >
                              <span style="color: {tierInfo.color};">●</span>
                              {tierInfo.name}
                              <span
                                style="color: #64748b; font-size: 0.75rem; margin-left: auto;"
                                >({rewardData.users.filter(
                                  (u) => u.tier === tier.name
                                ).length})</span
                              >
                            </button>
                          {/each}
                          <button
                            class="filter-option-logs"
                            class:selected={rewardTierFilter === "No Tier"}
                            on:click|stopPropagation={() => {
                              rewardTierFilter = "No Tier";
                              rewardTierFilterDropdownOpen = false;
                              rewardUsersPage = 1;
                            }}
                          >
                            <span style="color: #64748b;">●</span>
                            Newcomer
                            <span
                              style="color: #64748b; font-size: 0.75rem; margin-left: auto;"
                              >({rewardData.users.filter(
                                (u) => u.tier === "No Tier"
                              ).length})</span
                            >
                          </button>
                        </div>
                      {/if}
                    </div>
                  {/if}

                  <!-- Apply & Reset -->
                  <button class="btn-apply-logs" on:click={applyRewardFilters}>
                    <svg
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                      ></path>
                    </svg>
                    {lang.apply}
                  </button>
                  <button class="btn-reset-logs" on:click={resetRewardFilters}>
                    <svg
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      ></path>
                    </svg>
                    {lang.reset}
                  </button>
                </div>
              </div>

              <!-- Loading -->
              {#if rewardData.loading}
                <div class="loading-state">
                  <div class="spinner"></div>
                  <p>Loading rewards...</p>
                </div>
              {/if}

              <!-- Users Grid -->
              {#if !rewardData.loading}
                {#if paginatedRewardUsers.length === 0}
                  <div class="empty-state">
                    <svg
                      width="48"
                      height="48"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="1.5"
                        d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      ></path>
                    </svg>
                    <p>{lang.noResults}</p>
                  </div>
                {:else}
                  <div class="logs-grid-2col">
                    {#each paginatedRewardUsers as user, index (user.id)}
                      {@const sortedTiersForCard = [
                        ...(rewardData.selectedEvent?.rewards || []),
                      ].sort((a, b) => {
                        const reqA = a.requirement || a.rangeEnd || 0;
                        const reqB = b.requirement || b.rangeEnd || 0;
                        return reqB - reqA;
                      })}
                      {@const tierIndex = sortedTiersForCard.findIndex(
                        (t) => t.name === user.tier
                      )}
                      {@const tierInfo = getTierDisplayName(
                        user.tier,
                        tierIndex >= 0 ? tierIndex : 999
                      )}
                      <div
                        class="log-list-card"
                        style="display: flex; flex-direction: column;"
                      >
                        <!-- Rank Badge -->
                        <div
                          class="log-avatar-circle"
                          style="background: linear-gradient(135deg, {tierInfo.color}, {tierInfo.color}dd);"
                        >
                          <span>#{user.globalRank}</span>
                        </div>

                        <div
                          class="log-list-content"
                          style="display: flex; flex-direction: column; flex: 1;"
                        >
                          <!-- Header -->
                          <div class="log-list-header">
                            <div class="log-user-info">
                              <h3 class="log-user-name">{user.name}</h3>
                              <span class="log-user-id"
                                >{user.nisitId} • {user.email}</span
                              >
                            </div>
                            <div
                              style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;"
                            >
                              <!-- Status Badge -->
                              {#if user.status === "completed"}
                                <span
                                  class="log-status-badge-compact"
                                  style="background: rgba(16, 185, 129, 0.15); border-color: rgba(16, 185, 129, 0.4); color: #10b981; text-transform: uppercase; font-weight: 700;"
                                >
                                  <svg
                                    width="12"
                                    height="12"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                    stroke-width="2.5"
                                  >
                                    <path
                                      stroke-linecap="round"
                                      stroke-linejoin="round"
                                      d="M5 13l4 4L19 7"
                                    ></path>
                                  </svg>
                                  Completed
                                </span>
                              {:else if user.status === "in_progress"}
                                <span
                                  class="log-status-badge-compact"
                                  style="background: rgba(59, 130, 246, 0.15); border-color: rgba(59, 130, 246, 0.4); color: #3b82f6; text-transform: uppercase; font-weight: 700;"
                                >
                                  <svg
                                    width="12"
                                    height="12"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                    stroke-width="2.5"
                                  >
                                    <path
                                      stroke-linecap="round"
                                      stroke-linejoin="round"
                                      d="M13 10V3L4 14h7v7l9-11h-7z"
                                    ></path>
                                  </svg>
                                  In Progress
                                </span>
                              {:else}
                                <span
                                  class="log-status-badge-compact"
                                  style="background: rgba(100, 116, 139, 0.15); border-color: rgba(100, 116, 139, 0.4); color: #64748b; text-transform: uppercase; font-weight: 700;"
                                >
                                  <svg
                                    width="12"
                                    height="12"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                    stroke-width="2.5"
                                  >
                                    <path
                                      stroke-linecap="round"
                                      stroke-linejoin="round"
                                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                    ></path>
                                  </svg>
                                  Not Started
                                </span>
                              {/if}
                              <!-- Tier Badge -->
                              <span
                                class="log-status-badge-compact"
                                style="background: {tierInfo.color}20; border-color: {tierInfo.color}40; color: {tierInfo.color}; text-transform: uppercase; font-weight: 700;"
                              >
                                {#if user.tierRank > 0}#{user.tierRank}{/if}
                                {tierInfo.name}
                              </span>
                            </div>
                          </div>

                          <!-- Progress Section (fixed height) -->
                          <div style="margin: 1rem 0; min-height: 60px;">
                            <div
                              style="display: flex; justify-content: space-between; font-size: 0.8rem; color: #94a3b8; margin-bottom: 0.5rem;"
                            >
                              <span>Progress to {tierInfo.name}</span>
                              <span
                                >{user.completedCount} / {user.requiredCount}</span
                              >
                            </div>
                            <div
                              style="height: 8px; background: rgba(100, 116, 139, 0.2); border-radius: 10px; overflow: hidden;"
                            >
                              <div
                                style="height: 100%; width: {Math.min(
                                  (user.completedCount / user.requiredCount) *
                                    100,
                                  100
                                )}%; background: linear-gradient(90deg, {tierInfo.color}, {tierInfo.color}cc); border-radius: 10px; transition: width 0.5s ease;"
                              ></div>
                            </div>
                            <!-- Next Tier Info (always show space) -->
                            <div
                              style="font-size: 0.75rem; color: #64748b; margin-top: 0.25rem; min-height: 1.2em;"
                            >
                              {#if user.tier !== "No Tier" && user.nextTierCount > user.requiredCount}
                                {@const nextTierIdx =
                                  tierIndex > 0 ? tierIndex - 1 : 0}
                                {@const nextTierInfo = getTierDisplayName(
                                  "",
                                  nextTierIdx
                                )}
                                Next: {nextTierInfo.name} at {user.nextTierCount}
                                ({user.nextTierCount - user.completedCount} more)
                              {/if}
                            </div>
                          </div>

                          <!-- Details Grid -->
                          <div
                            style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem; margin-bottom: 1rem;"
                          >
                            <div
                              style="padding: 0.5rem; background: rgba(15, 23, 42, 0.5); border-radius: 8px;"
                            >
                              <div style="font-size: 0.7rem; color: #64748b;">
                                Global Rank
                              </div>
                              <div
                                style="font-size: 0.9rem; color: #f8fafc; font-weight: 600;"
                              >
                                #{user.globalRank}
                              </div>
                            </div>
                            <div
                              style="padding: 0.5rem; background: rgba(15, 23, 42, 0.5); border-radius: 8px;"
                            >
                              <div style="font-size: 0.7rem; color: #64748b;">
                                Tier Rank
                              </div>
                              <div
                                style="font-size: 0.9rem; color: {tierInfo.color}; font-weight: 600;"
                              >
                                {#if user.tierRank > 0}#{user.tierRank}
                                  {tierInfo.name}{:else}—{/if}
                              </div>
                            </div>
                            <div
                              style="padding: 0.5rem; background: rgba(15, 23, 42, 0.5); border-radius: 8px;"
                            >
                              <div style="font-size: 0.7rem; color: #64748b;">
                                Completed
                              </div>
                              <div
                                style="font-size: 0.9rem; color: #f8fafc; font-weight: 600;"
                              >
                                {user.completedCount} times
                              </div>
                            </div>
                            <div
                              style="padding: 0.5rem; background: rgba(15, 23, 42, 0.5); border-radius: 8px;"
                            >
                              <div style="font-size: 0.7rem; color: #64748b;">
                                Completed At
                              </div>
                              <div
                                style="font-size: 0.9rem; color: #f8fafc; font-weight: 600;"
                              >
                                {#if user.completedAt}
                                  {new Date(
                                    user.completedAt
                                  ).toLocaleDateString("en-US", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  })}
                                {:else}
                                  —
                                {/if}
                              </div>
                            </div>
                          </div>

                          <!-- Action Button (always at bottom) -->
                          <div style="margin-top: auto;">
                            <button
                              class="btn-message"
                              on:click={() => openMessageModal(user)}
                              style="width: 100%;"
                            >
                              <svg
                                width="16"
                                height="16"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                stroke-width="2"
                              >
                                <path
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                                ></path>
                              </svg>
                              Send Message
                            </button>
                          </div>
                        </div>
                      </div>
                    {/each}
                  </div>

                  <!-- Pagination -->
                  {#if totalRewardUsersPages > 1}
                    <div class="pagination-controls">
                      <button
                        class="page-btn"
                        aria-label="Next page"
                        on:click={prevRewardUsersPage}
                        disabled={rewardUsersPage === 1}
                      >
                        <svg
                          width="16"
                          height="16"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M15 19l-7-7 7-7"
                          ></path>
                        </svg>
                      </button>
                      <div class="page-select-wrapper">
                        <button
                          class="page-indicator-box clickable"
                          on:click|stopPropagation={() =>
                            (showRewardUsersPageDropdown =
                              !showRewardUsersPageDropdown)}
                        >
                          <span class="current-page">{rewardUsersPage}</span>
                          <span class="sep">/</span>
                          <span class="total-page">{totalRewardUsersPages}</span
                          >
                          <svg
                            class="dropdown-arrow"
                            class:flipped={showRewardUsersPageDropdown}
                            width="12"
                            height="12"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="3"
                              d="M19 9l-7 7-7-7"
                            ></path>
                          </svg>
                        </button>
                        {#if showRewardUsersPageDropdown}
                          <div
                            class="click-outside"
                            role="button"
                            tabindex="0"
                            on:click|stopPropagation={() =>
                              (showRewardUsersPageDropdown = false)}
                            on:keydown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                showRewardUsersPageDropdown = false;
                              }
                            }}
                          ></div>

                          <div class="page-dropdown-list">
                            {#each Array(totalRewardUsersPages) as _, i}
                              <button
                                class="page-option"
                                class:active={rewardUsersPage === i + 1}
                                on:click|stopPropagation={() => {
                                  jumpToRewardUsersPage(i + 1);
                                  showRewardUsersPageDropdown = false;
                                }}
                              >
                                Page {i + 1}
                              </button>
                            {/each}
                          </div>
                        {/if}
                      </div>
                      <button
                        class="page-btn"
                        aria-label="Next page"
                        on:click={nextRewardUsersPage}
                        disabled={rewardUsersPage === totalRewardUsersPages}
                      >
                        <svg
                          width="16"
                          height="16"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M9 5l7 7-7 7"
                          ></path>
                        </svg>
                      </button>
                    </div>
                    <div class="showing-text">
                      Showing {(rewardUsersPage - 1) * rewardUsersPerPage + 1} -
                      {Math.min(
                        rewardUsersPage * rewardUsersPerPage,
                        filteredRewardUsers.length
                      )} of {filteredRewardUsers.length} users
                    </div>
                  {/if}
                {/if}
              {/if}
            </div>
          {/if}

          <!-- Message Modal -->
          {#if showMessageModal && selectedUserForMessage}
            {@const user = selectedUserForMessage}
            {@const sortedTiersForModal = [
              ...(rewardData.selectedEvent?.rewards || []),
            ].sort((a, b) => {
              const reqA = a.requirement || a.rangeEnd || 0;
              const reqB = b.requirement || b.rangeEnd || 0;
              return reqB - reqA;
            })}
            {@const modalTierIndex = sortedTiersForModal.findIndex(
              (t) => t.name === user.tier
            )}
            {@const modalTierInfo = getTierDisplayName(
              user.tier,
              modalTierIndex >= 0 ? modalTierIndex : 999
            ) || { name: "Member", color: "#64748b" }}

            <div
              class="modal-overlay"
              role="dialog"
              aria-modal="true"
              aria-labelledby="modal-title"
              tabindex="-1"
              on:click={(e) => {
                // Logic นี้สำคัญ: เช็คว่าสิ่งที่ถูกคลิกคือตัว overlay เอง (ไม่ใช่ลูกหลาน)
                if (e.target === e.currentTarget) closeMessageModal();
              }}
              on:keydown={(e) => {
                if (e.key === "Escape") closeMessageModal();
              }}
              style="cursor: pointer;"
            >
              <div class="modal-container" style="cursor: default;">
                <div class="modal-header">
                  <h3 id="modal-title">
                    <svg
                      width="20"
                      height="20"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      ></path>
                    </svg>
                    Send Message
                  </h3>
                  <button
                    class="modal-close"
                    aria-label="Close modal"
                    on:click={closeMessageModal}
                  >
                    <svg
                      width="24"
                      height="24"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M6 18L18 6M6 6l12 12"
                      ></path>
                    </svg>
                  </button>
                </div>

                <div class="modal-body">
                  <div
                    style="display: flex; align-items: center; gap: 1rem; padding: 1rem; background: rgba(15, 23, 42, 0.5); border-radius: 12px; margin-bottom: 1.5rem;"
                  >
                    <div
                      style="width: 50px; height: 50px; border-radius: 50%; background: linear-gradient(135deg, {modalTierInfo.color}, {modalTierInfo.color}dd); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1rem; color: #0f172a; flex-shrink: 0;"
                    >
                      #{user.globalRank}
                    </div>
                    <div style="flex: 1; min-width: 0;">
                      <h4 style="margin: 0 0 0.25rem 0; color: #f8fafc;">
                        {user.name}
                      </h4>
                      <span style="color: #64748b; font-size: 0.85rem;"
                        >{user.email}</span
                      >
                    </div>
                    {#if user.tier !== "No Tier"}
                      <span
                        style="padding: 0.35rem 0.75rem; background: {modalTierInfo.color}20; border: 1px solid {modalTierInfo.color}40; border-radius: 20px; color: {modalTierInfo.color}; font-size: 0.75rem; font-weight: 600; white-space: nowrap;"
                      >
                        #{user.tierRank}
                        {modalTierInfo.name}
                      </span>
                    {/if}
                  </div>

                  <div style="margin-bottom: 1rem;">
                    <span
                      style="display: block; font-size: 0.9rem; color: #94a3b8; margin-bottom: 0.5rem;"
                    >
                      Quick Message
                    </span>
                    <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                      {#if user.tier !== "No Tier"}
                        <button
                          class="quick-msg-btn"
                          style="background: {modalTierInfo.color}15; border-color: {modalTierInfo.color}40; color: {modalTierInfo.color};"
                          on:click={() => {
                            messageText = `ยินดีด้วย! คุณ${user.name} ได้รับรางวัล "${modalTierInfo.name}" (อันดับที่ ${user.tierRank}) จากกิจกรรม "${rewardData.selectedEvent?.title}" กรุณามารับรางวัลได้ที่`;
                          }}
                        >
                          <svg
                            width="14"
                            height="14"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            stroke-width="2"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                            ></path>
                          </svg>
                          รางวัล {modalTierInfo.name} (TH)
                        </button>
                        <button
                          class="quick-msg-btn"
                          style="background: {modalTierInfo.color}15; border-color: {modalTierInfo.color}40; color: {modalTierInfo.color};"
                          on:click={() => {
                            messageText = `Congratulations! ${user.name}, you have received the "${modalTierInfo.name}" reward (Rank #${user.tierRank}) from "${rewardData.selectedEvent?.title}". Please collect your reward`;
                          }}
                        >
                          <svg
                            width="14"
                            height="14"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            stroke-width="2"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                            ></path>
                          </svg>
                          {modalTierInfo.name} Reward (EN)
                        </button>
                      {/if}

                      <button
                        class="quick-msg-btn"
                        on:click={() => {
                          messageText = `สวัสดีครับ/ค่ะ คุณ${user.name} ขอบคุณที่เข้าร่วมกิจกรรม "${rewardData.selectedEvent?.title}"`;
                        }}
                      >
                        <svg
                          width="14"
                          height="14"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          stroke-width="2"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11"
                          ></path>
                        </svg>
                        ทักทาย (TH)
                      </button>
                      <button
                        class="quick-msg-btn"
                        on:click={() => {
                          messageText = `Hello ${user.name}, thank you for joining "${rewardData.selectedEvent?.title}".`;
                        }}
                      >
                        <svg
                          width="14"
                          height="14"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          stroke-width="2"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11"
                          ></path>
                        </svg>
                        Greeting (EN)
                      </button>

                      <button
                        class="quick-msg-btn"
                        on:click={() => {
                          messageText = `แจ้งเตือน: กิจกรรม "${rewardData.selectedEvent?.title}" กำลังจะสิ้นสุดลงเร็วๆ นี้ อย่าลืมมาร่วมกิจกรรมนะครับ/ค่ะ`;
                        }}
                      >
                        <svg
                          width="14"
                          height="14"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          stroke-width="2"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          ></path>
                        </svg>
                        แจ้งเตือน (TH)
                      </button>
                      <button
                        class="quick-msg-btn"
                        on:click={() => {
                          messageText = `Reminder: "${rewardData.selectedEvent?.title}" is ending soon. Don't forget to participate!`;
                        }}
                      >
                        <svg
                          width="14"
                          height="14"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          stroke-width="2"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          ></path>
                        </svg>
                        Reminder (EN)
                      </button>

                      <button
                        class="quick-msg-btn"
                        on:click={() => {
                          messageText = `ขอบคุณที่เข้าร่วมกิจกรรม "${rewardData.selectedEvent?.title}" หวังว่าจะได้พบกันอีกในกิจกรรมครั้งหน้าครับ/ค่ะ`;
                        }}
                      >
                        <svg
                          width="14"
                          height="14"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          stroke-width="2"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                          ></path>
                        </svg>
                        ขอบคุณ (TH)
                      </button>
                      <button
                        class="quick-msg-btn"
                        on:click={() => {
                          messageText = `Thank you for joining "${rewardData.selectedEvent?.title}". We hope to see you again at our next event!`;
                        }}
                      >
                        <svg
                          width="14"
                          height="14"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          stroke-width="2"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                          ></path>
                        </svg>
                        Thank you (EN)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label
                      for="message-input-area"
                      style="display: block; font-size: 0.9rem; color: #94a3b8; margin-bottom: 0.5rem;"
                    >
                      Message
                    </label>
                    <textarea
                      id="message-input-area"
                      bind:value={messageText}
                      placeholder="Type your message here..."
                      rows="5"
                      style="width: 100%; padding: 1rem; background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; color: #f8fafc; font-size: 0.9rem; resize: vertical;"
                    ></textarea>
                  </div>
                </div>

                <div
                  style="display: flex; justify-content: flex-end; gap: 1rem; padding: 1.5rem; border-top: 1px solid rgba(255, 255, 255, 0.08);"
                >
                  <button
                    style="padding: 0.7rem 1.5rem; background: transparent; border: 1px solid rgba(100, 116, 139, 0.3); border-radius: 10px; color: #94a3b8; cursor: pointer;"
                    on:click={closeMessageModal}>Cancel</button
                  >
                  <button
                    style="display: flex; align-items: center; gap: 0.5rem; padding: 0.7rem 1.5rem; background: linear-gradient(135deg, #10b981, #059669); border: none; border-radius: 10px; color: white; cursor: pointer;"
                    on:click={sendMessage}
                    disabled={!messageText.trim()}
                  >
                    <svg
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                      ></path>
                    </svg>
                    Send
                  </button>
                </div>
              </div>
            </div>
          {/if}
          {#if showSendAllModal}
            {@const sortedTiersForSendAll = [
              ...(rewardData.selectedEvent?.rewards || []),
            ].sort((a, b) => {
              const reqA = a.requirement || a.rangeEnd || 0;
              const reqB = b.requirement || b.rangeEnd || 0;
              return reqB - reqA;
            })}
            {@const targetUsers = getTargetUsers()}

            <div
              class="modal-overlay"
              role="button"
              tabindex="0"
              on:click={closeSendAllModal}
              on:keydown={(e) => {
                if (e.key === "Escape" || e.key === "Enter")
                  closeSendAllModal();
              }}
            >
              <div
                class="modal-container"
                role="dialog"
                aria-modal="true"
                tabindex="-1"
                style="max-width: 600px;"
                on:click|stopPropagation
                on:keydown|stopPropagation
              >
                <div class="modal-header">
                  <h3>
                    <svg
                      width="20"
                      height="20"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      ></path>
                    </svg>
                    Send to All Users
                  </h3>
                  <button
                    class="modal-close"
                    on:click={closeSendAllModal}
                    aria-label="Close modal"
                  >
                    <svg
                      width="24"
                      height="24"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M6 18L18 6M6 6l12 12"
                      ></path>
                    </svg>
                  </button>
                </div>

                <div class="modal-body">
                  <div style="margin-bottom: 1.5rem;">
                    <span
                      style="display: block; font-size: 0.9rem; color: #94a3b8; margin-bottom: 0.5rem;"
                    >
                      Send to
                    </span>
                    <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                      <button
                        class="target-btn"
                        class:active={sendAllTargetTier === "All"}
                        on:click={() => (sendAllTargetTier = "All")}
                      >
                        All ({rewardData.users.length})
                      </button>
                      {#each sortedTiersForSendAll as tier, index}
                        {@const tierInfo = getTierDisplayName(tier.name, index)}
                        {@const count = rewardData.users.filter(
                          (u) => u.tier === tier.name
                        ).length}
                        <button
                          class="target-btn"
                          class:active={sendAllTargetTier === tier.name}
                          style={sendAllTargetTier === tier.name
                            ? `background: ${tierInfo.color}20; border-color: ${tierInfo.color}; color: ${tierInfo.color};`
                            : ""}
                          on:click={() => (sendAllTargetTier = tier.name)}
                        >
                          <svg
                            width="12"
                            height="12"
                            fill="none"
                            stroke={sendAllTargetTier === tier.name
                              ? tierInfo.color
                              : "currentColor"}
                            viewBox="0 0 24 24"
                            stroke-width="2"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                            ></path>
                          </svg>
                          {tierInfo.name} ({count})
                        </button>
                      {/each}
                      <button
                        class="target-btn"
                        class:active={sendAllTargetTier === "In Progress"}
                        on:click={() => (sendAllTargetTier = "In Progress")}
                      >
                        In Progress ({rewardData.users.filter(
                          (u) => u.status === "in_progress"
                        ).length})
                      </button>
                      <button
                        class="target-btn"
                        class:active={sendAllTargetTier === "No Tier"}
                        on:click={() => (sendAllTargetTier = "No Tier")}
                      >
                        Newcomer ({rewardData.users.filter(
                          (u) => u.tier === "No Tier"
                        ).length})
                      </button>
                    </div>
                  </div>

                  <div
                    style="margin-bottom: 1rem; padding: 1rem; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 10px;"
                  >
                    <label
                      style="display: flex; align-items: center; gap: 0.75rem; cursor: pointer;"
                    >
                      <input
                        type="checkbox"
                        bind:checked={sendAllUseTemplate}
                        style="width: 18px; height: 18px; accent-color: #3b82f6;"
                      />
                      <div>
                        <span style="color: #f8fafc; font-weight: 500;"
                          >Use Dynamic Variables</span
                        >
                        <p
                          style="margin: 0.25rem 0 0 0; font-size: 0.8rem; color: #94a3b8;"
                        >
                          Replace {"{name}"}, {"{tier}"}, {"{tierRank}"}, {"{globalRank}"},
                          {"{event}"} with actual values
                        </p>
                      </div>
                    </label>
                  </div>

                  <div style="margin-bottom: 1rem;">
                    <span
                      style="display: block; font-size: 0.9rem; color: #94a3b8; margin-bottom: 0.5rem;"
                    >
                      Quick Templates
                    </span>
                    <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                      <button
                        class="quick-msg-btn"
                        on:click={() => {
                          sendAllUseTemplate = true;
                          sendAllMessageTemplate = `ยินดีด้วย! คุณ{name} ได้รับรางวัล "{tier}" (อันดับที่ {tierRank}) จากกิจกรรม "{event}" กรุณามารับรางวัลได้ที่`;
                        }}
                      >
                        <svg
                          width="14"
                          height="14"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          stroke-width="2"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                          ></path>
                        </svg>
                        รางวัล (TH)
                      </button>
                      <button
                        class="quick-msg-btn"
                        on:click={() => {
                          sendAllUseTemplate = true;
                          sendAllMessageTemplate = `Congratulations! {name}, you have received the "{tier}" reward (Rank #{tierRank}) from "{event}". Please collect your reward at`;
                        }}
                      >
                        <svg
                          width="14"
                          height="14"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          stroke-width="2"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                          ></path>
                        </svg>
                        Reward (EN)
                      </button>
                      <button
                        class="quick-msg-btn"
                        on:click={() => {
                          sendAllUseTemplate = true;
                          sendAllMessageTemplate = `สวัสดีครับ/ค่ะ คุณ{name} ขอบคุณที่เข้าร่วมกิจกรรม "{event}"`;
                        }}
                      >
                        <svg
                          width="14"
                          height="14"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          stroke-width="2"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11"
                          ></path>
                        </svg>
                        ทักทาย (TH)
                      </button>
                      <button
                        class="quick-msg-btn"
                        on:click={() => {
                          sendAllUseTemplate = true;
                          sendAllMessageTemplate = `Hello {name}, thank you for joining "{event}".`;
                        }}
                      >
                        <svg
                          width="14"
                          height="14"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          stroke-width="2"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11"
                          ></path>
                        </svg>
                        Greeting (EN)
                      </button>
                      <button
                        class="quick-msg-btn"
                        on:click={() => {
                          sendAllUseTemplate = true;
                          sendAllMessageTemplate = `แจ้งเตือน: กิจกรรม "{event}" กำลังจะสิ้นสุดลงเร็วๆ นี้ อย่าลืมมาร่วมกิจกรรมนะครับ/ค่ะ`;
                        }}
                      >
                        <svg
                          width="14"
                          height="14"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          stroke-width="2"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          ></path>
                        </svg>
                        แจ้งเตือน (TH)
                      </button>
                      <button
                        class="quick-msg-btn"
                        on:click={() => {
                          sendAllUseTemplate = true;
                          sendAllMessageTemplate = `Reminder: "{event}" is ending soon. Don't forget to participate!`;
                        }}
                      >
                        <svg
                          width="14"
                          height="14"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          stroke-width="2"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          ></path>
                        </svg>
                        Reminder (EN)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label
                      for="message-template-input"
                      style="display: block; font-size: 0.9rem; color: #94a3b8; margin-bottom: 0.5rem;"
                    >
                      Message {#if sendAllUseTemplate}<span
                          style="color: #3b82f6;">(with variables)</span
                        >{/if}
                    </label>
                    <textarea
                      id="message-template-input"
                      bind:value={sendAllMessageTemplate}
                      placeholder={sendAllUseTemplate
                        ? "Use {name}, {tier}, {tierRank}, {globalRank}, {event}..."
                        : "Type your message here..."}
                      rows="4"
                      style="width: 100%; padding: 1rem; background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; color: #f8fafc; font-size: 0.9rem; resize: vertical;"
                    ></textarea>
                  </div>

                  {#if sendAllUseTemplate && sendAllMessageTemplate && targetUsers.length > 0}
                    <div
                      style="margin-top: 1rem; padding: 1rem; background: rgba(15, 23, 42, 0.5); border-radius: 10px;"
                    >
                      <span
                        style="display: block; font-size: 0.8rem; color: #64748b; margin-bottom: 0.5rem;"
                      >
                        Preview (for {targetUsers[0].name}):
                      </span>
                      <p
                        style="margin: 0; color: #94a3b8; font-size: 0.85rem; font-style: italic;"
                      >
                        "{generateMessageForUser(
                          targetUsers[0],
                          sendAllMessageTemplate
                        )}"
                      </p>
                    </div>
                  {/if}
                </div>

                <div
                  style="display: flex; justify-content: space-between; align-items: center; padding: 1.5rem; border-top: 1px solid rgba(255, 255, 255, 0.08);"
                >
                  <span style="color: #64748b; font-size: 0.85rem;">
                    Sending to <strong style="color: #f8fafc;"
                      >{targetUsers.length}</strong
                    > users
                  </span>
                  <div style="display: flex; gap: 1rem;">
                    <button
                      style="padding: 0.7rem 1.5rem; background: transparent; border: 1px solid rgba(100, 116, 139, 0.3); border-radius: 10px; color: #94a3b8; cursor: pointer;"
                      on:click={closeSendAllModal}
                    >
                      Cancel
                    </button>
                    <button
                      style="display: flex; align-items: center; gap: 0.5rem; padding: 0.7rem 1.5rem; background: linear-gradient(135deg, #10b981, #059669); border: none; border-radius: 10px; color: white; cursor: pointer; opacity: {!sendAllMessageTemplate.trim() ||
                      targetUsers.length === 0
                        ? 0.5
                        : 1};"
                      on:click={sendAllMessages}
                      disabled={!sendAllMessageTemplate.trim() ||
                        targetUsers.length === 0}
                    >
                      <svg
                        width="16"
                        height="16"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        stroke-width="2"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                        ></path>
                      </svg>
                      Send to All ({targetUsers.length})
                    </button>
                  </div>
                </div>
              </div>
            </div>
          {/if}
        </div>
      {:else if currentView === "verify-proof"}
        <div class="logs-container">
          {#if !verifyProofData.selectedEvent}
            <div class="grid-section">
              {#if paginatedEventsForVerifyProof.length === 0}
                <div class="empty-state">
                  <svg
                    width="48"
                    height="48"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="1.5"
                      d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    ></path>
                  </svg>
                  <p>{lang.noEventsFound}</p>
                </div>
              {:else}
                <div class="grid">
                  {#each paginatedEventsForVerifyProof as event (event.id)}
                    <div class="glass-card">
                      <div class="card-img-wrapper">
                        <img
                          src={event.image ||
                            "https://placehold.co/400x200/1e293b/64748b?text=No+Image"}
                          alt={event.title}
                          class="card-img"
                          on:error={(e) => {
                            (e.currentTarget as HTMLImageElement).src =
                              "https://placehold.co/400x200/1e293b/64748b?text=Image+Unavailable";
                          }}
                        />
                        {#if event.pendingCount && event.pendingCount > 0}
                          <div class="pending-badge-overlay">
                            {event.pendingCount} Pending
                          </div>
                        {/if}
                      </div>
                      <div class="card-body">
                        <div class="card-header">
                          <h3>{event.title}</h3>
                          <div class="status-group">
                            <span
                              class="status-badge"
                              class:status-active={event.status === "Active"}
                              class:status-closed={event.status === "Closed"}
                              class:status-draft={event.status === "Draft"}
                              >{translateStatus(event.status)}</span
                            >
                          </div>
                        </div>
                        {#if event.description}
                          <p class="event-description-short">
                            {event.description.substring(0, 80)}{event
                              .description.length > 80
                              ? "..."
                              : ""}
                          </p>
                        {/if}
                        <div class="event-simple-meta">
                          <div class="meta-row">
                            <svg
                              width="14"
                              height="14"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              stroke-width="2"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                              ></path>
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                              ></path>
                            </svg>
                            <span>{event.location}</span>
                          </div>
                          <div class="meta-row">
                            <svg
                              width="14"
                              height="14"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              stroke-width="2"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                              ></path>
                            </svg>
                            <span>{formatDateRange(event)}</span>
                          </div>
                          {#if event.startTime && event.endTime}
                            <div class="meta-row">
                              <svg
                                width="14"
                                height="14"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                stroke-width="2"
                              >
                                <path
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                ></path>
                              </svg>
                              <span>{event.startTime} - {event.endTime}</span>
                            </div>
                          {/if}
                        </div>
                        {#if event.pendingCount !== undefined}
                          <div class="capacity-progress">
                            <div
                              class="progress-info"
                              style="display: flex; justify-content: space-between; font-size: 12px; color: #9ca3af; margin-bottom: 4px;"
                            >
                              <span
                                >{currentLang === "th"
                                  ? "รอตรวจสอบ"
                                  : "Pending"}</span
                              >
                              <span
                                >{event.pendingCount || 0}
                                {currentLang === "th"
                                  ? "รายการ"
                                  : "submissions"}</span
                              >
                            </div>
                            <div class="progress-bar">
                              <div
                                class="progress-fill pending-fill"
                                style="width: {getPendingPercentage(
                                  event
                                )}%; background: linear-gradient(90deg, #f59e0b, #d97706);"
                                class:full={getPendingPercentage(event) >= 100}
                              ></div>
                            </div>
                          </div>
                        {/if}
                        <div class="action-buttons">
                          <button
                            class="action-btn btn-view"
                            on:click={() => selectEventForVerifyProof(event)}
                          >
                            <svg
                              width="16"
                              height="16"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              stroke-width="2"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                              ></path>
                            </svg>
                            Verify Submissions
                          </button>
                        </div>
                      </div>
                    </div>
                  {/each}
                </div>

                {#if totalVerifyProofEventsPages > 1}
                  <div class="pagination-wrapper">
                    <div class="pagination-controls">
                      <button
                        class="page-btn"
                        on:click={prevVerifyProofEventsPage}
                        disabled={verifyProofEventsPage === 1}
                        aria-label="Previous page"
                      >
                        <svg
                          width="16"
                          height="16"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          ><path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M15 19l-7-7 7-7"
                          ></path></svg
                        >
                      </button>
                      <div class="page-select-wrapper">
                        <button
                          class="page-indicator-box clickable"
                          on:click|stopPropagation={() =>
                            (showVerifyProofEventsPageDropdown =
                              !showVerifyProofEventsPageDropdown)}
                        >
                          <span class="current-page"
                            >{verifyProofEventsPage}</span
                          >
                          <span class="sep">/</span>
                          <span class="total-page"
                            >{totalVerifyProofEventsPages}</span
                          >
                          <svg
                            class="dropdown-arrow"
                            class:flipped={showVerifyProofEventsPageDropdown}
                            width="12"
                            height="12"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            ><path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="3"
                              d="M19 9l-7 7-7-7"
                            ></path></svg
                          >
                        </button>
                        {#if showVerifyProofEventsPageDropdown}
                          <div
                            class="click-outside"
                            role="button"
                            tabindex="0"
                            aria-label="Close dropdown"
                            on:click|stopPropagation={() =>
                              (showVerifyProofEventsPageDropdown = false)}
                            on:keydown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                showVerifyProofEventsPageDropdown = false;
                              }
                            }}
                          ></div>
                          <div class="page-dropdown-list">
                            {#each Array(totalVerifyProofEventsPages) as _, i}
                              <button
                                class="page-dropdown-item"
                                class:active={verifyProofEventsPage === i + 1}
                                on:click={() => {
                                  verifyProofEventsPage = i + 1;
                                  showVerifyProofEventsPageDropdown = false;
                                }}>Page {i + 1}</button
                              >
                            {/each}
                          </div>
                        {/if}
                      </div>
                      <button
                        class="page-btn"
                        on:click={nextVerifyProofEventsPage}
                        disabled={verifyProofEventsPage ===
                          totalVerifyProofEventsPages}
                        aria-label="Next page"
                      >
                        <svg
                          width="16"
                          height="16"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M9 5l7 7-7 7"
                          ></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div class="page-info">
                    Showing {(currentPage - 1) * itemsPerPage + 1} - {Math.min(
                      currentPage * itemsPerPage,
                      filteredEvents.length
                    )} of {filteredEvents.length} events
                  </div>
                {/if}
              {/if}
            </div>
          {:else}
            <div class="logs-detail">
              <div class="logs-header">
                <button
                  class="btn-back-logs"
                  on:click={backToVerifyProofEventsList}
                >
                  <svg
                    width="20"
                    height="20"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    ><path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M15 19l-7-7 7-7"
                    ></path></svg
                  >
                  Back to Events
                </button>
                <div class="selected-event-info">
                  <h3>{verifyProofData.selectedEvent.title}</h3>
                  <div class="event-meta-small">
                    <span>
                      <svg
                        width="14"
                        height="14"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        stroke-width="2.5"
                        ><path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        ></path><path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        ></path></svg
                      >
                      {verifyProofData.selectedEvent.location}
                    </span>
                    <span>
                      <svg
                        width="14"
                        height="14"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        stroke-width="2.5"
                        ><path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        ></path></svg
                      >
                      {formatDateRange(verifyProofData.selectedEvent)}
                    </span>
                    {#if verifyProofData.selectedEvent.startTime && verifyProofData.selectedEvent.endTime}
                      <span>
                        <svg
                          width="14"
                          height="14"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          stroke-width="2.5"
                          ><path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          ></path></svg
                        >
                        {verifyProofData.selectedEvent.startTime} - {verifyProofData
                          .selectedEvent.endTime}
                      </span>
                    {/if}
                    <span
                      class="status-badge-inline"
                      class:active={verifyProofData.selectedEvent.status ===
                        "Active"}>{verifyProofData.selectedEvent.status}</span
                    >
                  </div>
                </div>
                <div class="logs-action-buttons">
                  <div class="realtime-controls">
                    {#if newVerifyProofCount > 0}
                      <button
                        class="btn-new-logs"
                        on:click={refreshVerifyProofSubmissions}
                      >
                        <svg
                          width="16"
                          height="16"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          stroke-width="2.5"
                          ><path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          ></path></svg
                        >
                        {newVerifyProofCount} New
                      </button>
                    {/if}
                    <button
                      class="btn-auto-refresh"
                      class:active={verifyProofAutoRefreshEnabled}
                      on:click={toggleVerifyProofAutoRefresh}
                      title={verifyProofAutoRefreshEnabled
                        ? "Auto-refresh ON"
                        : "Auto-refresh OFF"}
                    >
                      <svg
                        width="16"
                        height="16"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        stroke-width="2.5"
                        ><path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        ></path></svg
                      >
                      {#if verifyProofIsConnected}<span class="live-dot"
                        ></span>{/if}
                    </button>
                  </div>
                </div>
              </div>

              <div class="stats-dashboard-single-row">
                <div class="stat-card-compact pending">
                  <div class="stat-icon-compact">
                    <svg
                      width="20"
                      height="20"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      ></path>
                    </svg>
                  </div>
                  <div class="stat-info-compact">
                    <div class="stat-value-compact">
                      {verifyProofData.submissions.length}
                    </div>
                    <div class="stat-label-compact">Pending</div>
                  </div>
                </div>
              </div>

              <div class="filter-section-logs">
                <!-- แถว 1: Search Box + Batch + Std ID -->
                <div class="filter-row-logs">
                  <div class="search-box-logs">
                    <svg
                      class="search-icon"
                      width="18"
                      height="18"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      ></path>
                    </svg>
                    <input
                      type="text"
                      placeholder="Search by name, email, or Nisit ID..."
                      bind:value={verifyProofSearchQuery}
                    />
                  </div>
                  <div class="nisit-filter-box">
                    <input
                      type="text"
                      placeholder="Batch"
                      maxlength="2"
                      bind:value={verifyProofBatchFilter}
                      on:input={(e) => {
                        verifyProofBatchFilter = e.currentTarget.value.replace(
                          /\D/g,
                          ""
                        );
                      }}
                    />
                  </div>
                  <div class="nisit-filter-box">
                    <input
                      type="text"
                      placeholder="Std ID"
                      maxlength="6"
                      bind:value={verifyProofStdIdFilter}
                      on:input={(e) => {
                        verifyProofStdIdFilter = e.currentTarget.value.replace(
                          /\D/g,
                          ""
                        );
                      }}
                    />
                  </div>
                </div>

                <!-- แถว 2: Filter + Date Range + Buttons -->
                <div class="filter-row-logs">
                  <div
                    class="filter-dropdown-logs"
                    class:dropdown-open={showVerifyStatusDropdown}
                  >
                    <button
                      class="filter-trigger-logs"
                      on:click|stopPropagation={() => {
                        showVerifyFromDateDropdown = false;
                        showVerifyToDateDropdown = false;
                        showVerifyStatusDropdown = !showVerifyStatusDropdown;
                      }}
                    >
                      <svg
                        width="16"
                        height="16"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        stroke-width="2"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                        ></path>
                      </svg>
                      <span>{verifyProofStatusFilter || "All"}</span>
                      <svg
                        class="chevron"
                        class:rotated={showVerifyStatusDropdown}
                        width="12"
                        height="12"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        stroke-width="2"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M19 9l-7 7-7-7"
                        ></path>
                      </svg>
                    </button>
                    {#if showVerifyStatusDropdown}
                      <div class="filter-menu-logs">
                        <button
                          class="filter-option-logs"
                          class:selected={verifyProofStatusFilter === "All"}
                          on:click|stopPropagation={() => {
                            verifyProofStatusFilter = "All";
                            showVerifyStatusDropdown = false;
                          }}>All</button
                        >
                        <button
                          class="filter-option-logs"
                          class:selected={verifyProofStatusFilter === "Pending"}
                          on:click|stopPropagation={() => {
                            verifyProofStatusFilter = "Pending";
                            showVerifyStatusDropdown = false;
                          }}>Pending</button
                        >
                      </div>
                    {/if}
                  </div>

                  <div
                    class="date-input-group-logs"
                    class:dropdown-open={showVerifyFromDateDropdown}
                  >
                    <label for="date-from">From:</label>
                    <div class="custom-date-dropdown-logs">
                      <button
                        class="custom-date-trigger-logs"
                        on:click|stopPropagation={() => {
                          showVerifyStatusDropdown = false;
                          showVerifyToDateDropdown = false;
                          showVerifyFromDateDropdown =
                            !showVerifyFromDateDropdown;
                        }}
                      >
                        <svg
                          width="14"
                          height="14"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          ></path>
                        </svg>
                        <span
                          >{verifyProofFromDate
                            ? availableVerifyProofDates.find(
                                (d) => d.value === verifyProofFromDate
                              )?.display || verifyProofFromDate
                            : "Select"}</span
                        >
                        <svg
                          class="chevron"
                          class:rotated={showVerifyFromDateDropdown}
                          width="10"
                          height="10"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M19 9l-7 7-7-7"
                          ></path>
                        </svg>
                      </button>
                      {#if showVerifyFromDateDropdown}
                        <div class="custom-date-menu-logs">
                          {#each availableVerifyProofDates as date}
                            <button
                              class="date-option-logs"
                              class:selected={verifyProofFromDate ===
                                date.value}
                              on:click|stopPropagation={() => {
                                verifyProofFromDate = date.value;
                                showVerifyFromDateDropdown = false;
                              }}>{date.display}</button
                            >
                          {/each}
                        </div>
                      {/if}
                    </div>
                  </div>

                  <div
                    class="date-input-group-logs"
                    class:dropdown-open={showVerifyToDateDropdown}
                  >
                    <label for="date-from">To:</label>
                    <div class="custom-date-dropdown-logs">
                      <button
                        class="custom-date-trigger-logs"
                        on:click|stopPropagation={() => {
                          showVerifyStatusDropdown = false;
                          showVerifyFromDateDropdown = false;
                          showVerifyToDateDropdown = !showVerifyToDateDropdown;
                        }}
                      >
                        <svg
                          width="14"
                          height="14"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          ></path>
                        </svg>
                        <span
                          >{verifyProofToDate
                            ? availableVerifyProofDates.find(
                                (d) => d.value === verifyProofToDate
                              )?.display || verifyProofToDate
                            : "Select"}</span
                        >
                        <svg
                          class="chevron"
                          class:rotated={showVerifyToDateDropdown}
                          width="10"
                          height="10"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M19 9l-7 7-7-7"
                          ></path>
                        </svg>
                      </button>
                      {#if showVerifyToDateDropdown}
                        <div class="custom-date-menu-logs">
                          {#each availableVerifyProofDates as date}
                            <button
                              class="date-option-logs"
                              class:selected={verifyProofToDate === date.value}
                              on:click|stopPropagation={() => {
                                verifyProofToDate = date.value;
                                showVerifyToDateDropdown = false;
                              }}>{date.display}</button
                            >
                          {/each}
                        </div>
                      {/if}
                    </div>
                  </div>

                  <button
                    class="btn-apply-logs"
                    on:click={() => {
                      verifyProofSubmissionsPage = 1;
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                      ></path>
                    </svg>
                    {lang.apply}
                  </button>

                  <button
                    class="btn-reset-logs"
                    on:click={() => {
                      verifyProofSearchQuery = "";
                      verifyProofBatchFilter = "";
                      verifyProofStdIdFilter = "";
                      verifyProofStatusFilter = "All";
                      verifyProofFromDate = "";
                      verifyProofToDate = "";
                      verifyProofSubmissionsPage = 1;
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      ></path>
                    </svg>
                    {lang.reset}
                  </button>
                </div>
              </div>

              <div class="verify-proof-submissions-section">
                {#if verifyProofData.loading}
                  <div class="loading-state">
                    <div class="spinner"></div>
                    <span>Loading submissions...</span>
                  </div>
                {:else if sortedVerifyProofSubmissions.length === 0}
                  <div class="empty-state">
                    <svg
                      width="64"
                      height="64"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="1.5"
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      ></path>
                    </svg>
                    <p>No pending submissions</p>
                  </div>
                {:else}
                  <div class="submissions-grid-new">
                    {#each paginatedVerifyProofSubmissions as sub, index (sub.id)}
                      {@const globalIndex =
                        (verifyProofSubmissionsPage - 1) *
                          verifyProofSubmissionsPerPage +
                        index}
                      <div class="proof-card" style="position: relative;">
                        <div class="rank-circle">#{globalIndex + 1}</div>
                        <div class="user-details">
                          <h4 class="user-name">{sub.runnerName}</h4>
                          <p class="user-meta">
                            <span class="nisit-id">{sub.odySd}</span>
                            <span class="separator">•</span>
                            <span class="user-email">{sub.email}</span>
                          </p>
                          <p class="status-text">Pending Verification</p>
                        </div>
                        <div
                          class="proof-image-box"
                          role="button"
                          tabindex="0"
                          on:click={() => onProofImageClick(sub.proofImage)}
                          on:keydown={(e) => {
                            if (e.key === "Enter" || e.key === " ")
                              onProofImageClick(sub.proofImage);
                          }}
                        >
                          {#if sub.proofImage}
                            <img src={sub.proofImage} alt="Proof" />
                            <div class="image-overlay">
                              <svg
                                width="24"
                                height="24"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                stroke-width="2"
                                ><path d="M21 21l-4.35-4.35"></path><path
                                  d="M11 8v6M8 11h6"
                                ></path><circle cx="11" cy="11" r="8"
                                ></circle></svg
                              >
                              <span>Click to view</span>
                            </div>
                          {:else}
                            <div class="no-image-placeholder">No image</div>
                          {/if}
                        </div>
                        <div class="proof-card-actions">
                          <button
                            class="btn-reject"
                            on:click={() => onRejectSubmission(sub)}
                            >Reject</button
                          >
                          <button
                            class="btn-approve"
                            on:click={() => onApproveSubmission(sub)}
                            >Approve</button
                          >
                        </div>
                      </div>
                    {/each}
                  </div>

                  {#if totalVerifyProofSubmissionsPages > 1}
                    <div class="pagination-wrapper">
                      <div class="pagination-controls">
                        <!-- ปุ่ม Previous (ลูกศรชี้ซ้าย) -->
                        <button
                          type="button"
                          class="page-btn prev"
                          on:click={prevVerifyProofSubmissionsPage}
                          disabled={verifyProofSubmissionsPage === 1}
                          aria-label="Previous page"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                          >
                            <path
                              d="M15 19l-7-7 7-7"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            />
                          </svg>
                        </button>

                        <div class="page-select-wrapper">
                          <button
                            type="button"
                            class="page-indicator-box clickable"
                            on:click|stopPropagation={() =>
                              (showVerifyProofSubmissionsPageDropdown =
                                !showVerifyProofSubmissionsPageDropdown)}
                            aria-haspopup="listbox"
                            aria-expanded={showVerifyProofSubmissionsPageDropdown}
                          >
                            <span class="current-page"
                              >{verifyProofSubmissionsPage}</span
                            >
                            <span class="sep">/</span>
                            <span class="total-page"
                              >{totalVerifyProofSubmissionsPages}</span
                            >

                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              class="dropdown-arrow"
                              class:flipped={showVerifyProofSubmissionsPageDropdown}
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                              aria-hidden="true"
                            >
                              <path
                                d="M19 9l-7 7-7-7"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                              />
                            </svg>
                          </button>

                          {#if showVerifyProofSubmissionsPageDropdown}
                            <div
                              class="click-outside"
                              role="button"
                              tabindex="0"
                              aria-label="Close dropdown"
                              on:click|stopPropagation={() =>
                                (showVerifyProofSubmissionsPageDropdown = false)}
                              on:keydown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  showVerifyProofSubmissionsPageDropdown = false;
                                }
                              }}
                            ></div>
                            <div
                              class="page-dropdown-list"
                              role="listbox"
                              aria-label="Page list"
                            >
                              {#each Array(totalVerifyProofSubmissionsPages) as _, i}
                                <button
                                  type="button"
                                  class="page-dropdown-item"
                                  class:active={verifyProofSubmissionsPage ===
                                    i + 1}
                                  on:click={() => {
                                    verifyProofSubmissionsPage = i + 1;
                                    showVerifyProofSubmissionsPageDropdown = false;
                                  }}
                                  role="option"
                                  aria-selected={verifyProofSubmissionsPage ===
                                    i + 1}
                                >
                                  Page {i + 1}
                                </button>
                              {/each}
                            </div>
                          {/if}
                        </div>

                        <!-- ปุ่ม Next (ลูกศรชี้ขวา) -->
                        <button
                          type="button"
                          class="page-btn next"
                          on:click={nextVerifyProofSubmissionsPage}
                          disabled={verifyProofSubmissionsPage ===
                            totalVerifyProofSubmissionsPages}
                          aria-label="Next page"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                          >
                            <path
                              d="M9 5l7 7-7 7"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div class="page-info">
                      Showing {(verifyProofSubmissionsPage - 1) * itemsPerPage +
                        1} - {Math.min(
                        verifyProofSubmissionsPage * itemsPerPage,
                        totalVerifyProofSubmissions
                      )} of {totalVerifyProofSubmissions} submissions
                    </div>
                  {/if}
                {/if}
              </div>
            </div>
          {/if}
        </div>
      {:else if currentView === "verify-code"}
        <div class="vc-container">
          <!-- Main Card -->
          <div class="vc-main-card">
            <!-- Card Header with Icon -->
            <div class="vc-card-header">
              <div class="vc-icon-wrapper">
                <div class="vc-icon-bg"></div>
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 class="vc-title">{lang.participantCheckIn}</h2>
              <p class="vc-subtitle">{lang.verifyParticipantCode}</p>
            </div>

            <!-- Mode Selector -->
            <div class="vc-mode-selector">
              <button
                class="vc-mode-tab"
                class:active={verifyMode === "pin"}
                on:click={() => switchVerifyMode("pin")}
              >
                <div class="vc-mode-icon">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="22"
                    height="22"
                    viewBox="-2 -2 28 28"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <rect x="3" y="3" width="7" height="7"></rect>
                    <rect x="14" y="3" width="7" height="7"></rect>
                    <rect x="14" y="14" width="7" height="7"></rect>
                    <rect x="3" y="14" width="7" height="7"></rect>
                  </svg>
                </div>
                <span>{lang.pinCode}</span>
              </button>

              <button
                class="vc-mode-tab"
                class:active={verifyMode === "qr"}
                on:click={() => switchVerifyMode("qr")}
              >
                <div class="vc-mode-icon">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="22"
                    height="22"
                    viewBox="-2 -2 28 28"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M3 7V5a2 2 0 0 1 2-2h2"></path>
                    <path d="M17 3h2a2 2 0 0 1 2 2v2"></path>
                    <path d="M21 17v2a2 2 0 0 1-2 2h-2"></path>
                    <path d="M7 21H5a2 2 0 0 1-2-2v-2"></path>
                    <rect x="7" y="7" width="10" height="10" rx="1.5"></rect>
                  </svg>
                </div>
                <span>{lang.scanQR}</span>
              </button>

              <div class="vc-mode-slider" class:qr={verifyMode === "qr"}></div>
            </div>

            <!-- Success Message -->
            {#if lastVerifySuccess}
              <div class="vc-success">
                <div class="vc-success-check">
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="3"
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
                <div class="vc-success-info">
                  <span class="vc-success-label">Check-in Successful</span>
                  <span class="vc-success-name">{lastParticipantName}</span>
                </div>
              </div>
            {/if}

            <!-- Content Area -->
            <div class="vc-content">
              <!-- PIN Mode -->
              <div class="vc-pin-mode" class:active={verifyMode === "pin"}>
                <!-- Auto Toggle -->
                <div class="vc-auto-toggle">
                  <div class="vc-auto-info">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                    </svg>
                    <span>{lang.autoCheckIn}</span>
                  </div>
                  <button
                    class="vc-switch"
                    aria-label="Switch"
                    class:on={autoCheckIn}
                    on:click={() => {
                      autoCheckIn = !autoCheckIn;
                      clearPins();
                    }}
                  >
                    <span class="vc-switch-knob"></span>
                  </button>
                </div>

                <!-- PIN Input -->
                <div class="vc-pin-area" style="margin-bottom: 1rem;">
                  <div class="vc-pin-row">
                    {#each pins as pin, i}
                      <div
                        class="vc-pin-cell"
                        class:filled={pin !== ""}
                        class:error={verifyErrorIndex !== null &&
                          (verifyErrorMessage ? true : verifyErrorIndex === i)}
                      >
                        <input
                          type="text"
                          inputmode="numeric"
                          maxlength="1"
                          class="vc-pin-input"
                          bind:value={pins[i]}
                          bind:this={pinInputRefs[i]}
                          on:input={(e) => handlePinInput(i, e)}
                          on:keydown={(e) => handlePinKeydown(i, e)}
                          on:focus={() => handlePinFocus(i)}
                          disabled={isVerifying}
                        />
                      </div>
                    {/each}
                  </div>
                </div>

                <!-- Error -->
                {#if verifyErrorMessage && verifyMode === "pin"}
                  <div class="vc-error-msg">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="-2 -2 28 28"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="8" x2="12" y2="12"></line>
                      <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <span>{verifyErrorMessage}</span>
                  </div>
                {/if}

                <!-- Submit Button -->
                <div class="vc-submit-wrapper" class:hidden={autoCheckIn}>
                  <button
                    class="vc-submit"
                    on:click={handleVerifyPin}
                    disabled={isVerifying ||
                      pins.some((p) => p === "") ||
                      autoCheckIn}
                  >
                    {#if isVerifying}
                      <span class="vc-loader"></span>
                      <span
                        >{currentLang === "th"
                          ? "กำลังตรวจสอบ..."
                          : "Verifying..."}</span
                      >
                    {:else}
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <path
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span>{lang.checkIn}</span>
                    {/if}
                  </button>
                </div>

                <!-- Loading State -->
                {#if isVerifying && autoCheckIn}
                  <div class="vc-verifying">
                    <span class="vc-loader lg"></span>
                    <span
                      >{currentLang === "th"
                        ? "กำลังตรวจสอบรหัส..."
                        : "Verifying code..."}</span
                    >
                  </div>
                {/if}

                <!-- Hint -->
                <p class="vc-hint">
                  {#if autoCheckIn}
                    {lang.enterDigitCode} • {lang.autoCheckInEnabled}
                  {:else}
                    {lang.enterDigitCode} • {lang.pressCheckIn}
                  {/if}
                </p>
              </div>

              <!-- QR Mode -->
              <div class="vc-qr-mode" class:active={verifyMode === "qr"}>
                <div class="vc-scanner">
                  {#if cameraError}
                    <div class="vc-camera-err">
                      <svg
                        width="56"
                        height="56"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.5"
                      >
                        <path
                          d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"
                        />
                        <circle cx="12" cy="13" r="4" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                      <p>{cameraError}</p>
                      <button class="vc-retry" on:click={startCamera}>
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <path d="M23 4v6h-6M1 20v-6h6" />
                          <path
                            d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"
                          />
                        </svg>
                        Try Again
                      </button>
                    </div>
                  {:else}
                    <video
                      bind:this={videoRef}
                      class="vc-video"
                      playsinline
                      muted
                    ></video>
                    <canvas bind:this={canvasRef} class="vc-canvas"></canvas>

                    <!-- Scanner Overlay -->
                    <div class="vc-scan-overlay">
                      <div
                        class="vc-scan-frame"
                        class:active={scanning && !isVerifying}
                      >
                        <span class="vc-frame-corner tl"></span>
                        <span class="vc-frame-corner tr"></span>
                        <span class="vc-frame-corner bl"></span>
                        <span class="vc-frame-corner br"></span>
                        {#if scanning && !isVerifying}
                          <div class="vc-scan-beam"></div>
                        {/if}
                      </div>
                    </div>

                    <!-- Status Badge -->
                    {#if isVerifying}
                      <div class="vc-scan-status verifying">
                        <span class="vc-loader sm"></span>
                        <span>Verifying...</span>
                      </div>
                    {:else if scanning}
                      <div class="vc-scan-status active">
                        <span class="vc-pulse-dot"></span>
                        <span>Scanning...</span>
                      </div>
                    {/if}
                  {/if}
                </div>

                <!-- Error -->
                {#if verifyErrorMessage && verifyMode === "qr"}
                  <div class="vc-error-msg">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 8v4m0 4h.01" />
                    </svg>
                    <span>{verifyErrorMessage}</span>
                  </div>
                {/if}

                <p class="vc-hint">Point camera at participant's QR code</p>
              </div>
            </div>
          </div>
        </div>
      {:else if currentView == "settings"}
        <div class="settings-container">
          {#if dataIsLoading}
            <div class="loading-state">
              <div class="loader"></div>
              <p>Loading your profile...</p>
            </div>
          {:else}
            <div class="settings-content">
              <!-- Header Section -->
              <div class="header-section">
                <div class="icon-wrapper">
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </div>
                <div class="header-text">
                  <h1>{lang.accountSettings}</h1>
                  <p>{lang.manageProfile}</p>
                </div>
              </div>

              <!-- Personal Information Card -->
              <div class="info-card">
                <div class="card-headerr">
                  <div class="card-icon">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
                      ></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                  </div>
                  <h2>{lang.personalInfo}</h2>
                </div>

                <div class="card-content">
                  <!-- Title & First Name Row -->
                  <div class="field-row">
                    <div class="form-field" style="flex: 0 0 100px;">
                      <label for="date-from">{lang.title}</label>
                      <div class="custom-select">
                        <button
                          type="button"
                          class="select-btn {fieldValidationErrors.title
                            ? 'error'
                            : ''}"
                          class:active={showTitleDropdown}
                          on:click={(e) => toggleDropdownVisibility("title", e)}
                        >
                          <span class:placeholder={!userTitle}
                            >{userTitle || lang.title}</span
                          >
                          <svg
                            class="arrow"
                            class:rotate={showTitleDropdown}
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                          >
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                        </button>
                        {#if showTitleDropdown}
                          <div class="dropdown-menu">
                            {#each nameTitles as title}
                              <button
                                class="dropdown-item"
                                on:click={() => chooseTitle(title)}
                              >
                                {title}
                              </button>
                            {/each}
                          </div>
                        {/if}
                      </div>
                    </div>

                    <div class="form-field" style="flex: 1;">
                      <label for="date-from">{lang.firstName}</label>
                      <div
                        class="input-wrapper {fieldValidationErrors.firstName
                          ? 'error'
                          : ''}"
                      >
                        <input
                          type="text"
                          bind:value={userFirstName}
                          on:input={dismissAlert}
                          placeholder={lang.enterFirstName}
                        />
                      </div>
                    </div>
                  </div>

                  <!-- Last Name -->
                  <div class="form-field">
                    <label for="date-from">{lang.lastName}</label>
                    <div
                      class="input-wrapper {fieldValidationErrors.lastName
                        ? 'error'
                        : ''}"
                    >
                      <input
                        type="text"
                        bind:value={userLastName}
                        on:input={dismissAlert}
                        placeholder={lang.enterLastName}
                      />
                    </div>
                  </div>

                  <!-- Email (Locked) -->
                  <div class="form-field">
                    <label for="date-from">{lang.emailAddress}</label>
                    <div class="input-wrapper locked">
                      <input type="email" value={userEmail} disabled />
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"
                        ></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Role-Specific Information Card -->
              <div class="info-card" style="position: relative; z-index: 50;">
                <div class="card-headerr">
                  <div class="card-icon">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      {#if userRole === "student"}
                        <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
                        <path d="M6 12v5c3 3 9 3 12 0v-5"></path>
                      {:else}
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"
                        ></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                      {/if}
                    </svg>
                  </div>
                  <h2>
                    {userRole === "student"
                      ? lang.academicInfo
                      : lang.departmentInfo}
                  </h2>
                </div>

                <div class="card-content">
                  {#if userRole === "student"}
                    <!-- Nisit ID (Locked) -->
                    <div class="form-field">
                      <label for="date-from">{lang.studentId}</label>
                      <div class="input-wrapper locked">
                        <input type="text" value={studentIdNumber} disabled />
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <rect
                            x="3"
                            y="11"
                            width="18"
                            height="11"
                            rx="2"
                            ry="2"
                          ></rect>
                          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                      </div>
                    </div>

                    <!-- Faculty -->
                    <div class="form-field">
                      <label for="date-from">{lang.faculty}</label>
                      <div class="custom-select">
                        <button
                          type="button"
                          class="select-btn {fieldValidationErrors.faculty
                            ? 'error'
                            : ''}"
                          class:active={showFacultyDropdown}
                          on:click={(e) =>
                            toggleDropdownVisibility("faculty", e)}
                        >
                          <span class:placeholder={!userFaculty}
                            >{retrieveFacultyName(userFaculty)}</span
                          >
                          <svg
                            class="arrow"
                            class:rotate={showFacultyDropdown}
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                          >
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                        </button>
                        {#if showFacultyDropdown}
                          <div class="dropdown-menu">
                            {#each universityFaculties as faculty}
                              <button
                                class="dropdown-item"
                                on:click={() => chooseFaculty(faculty.id)}
                              >
                                {faculty.name}
                              </button>
                            {/each}
                          </div>
                        {/if}
                      </div>
                    </div>

                    <!-- Major -->
                    <div class="form-field">
                      <label for="date-from">{lang.major}</label>
                      <div class="custom-select" class:disabled={!userFaculty}>
                        <button
                          type="button"
                          class="select-btn {fieldValidationErrors.major
                            ? 'error'
                            : ''}"
                          class:active={showMajorDropdown}
                          class:placeholder={!userMajor}
                          disabled={!userFaculty}
                          on:click={(e) => {
                            if (userFaculty)
                              toggleDropdownVisibility("major", e);
                          }}
                        >
                          <span class:placeholder={!userMajor}
                            >{retrieveMajorName(userMajor)}</span
                          >
                          <svg
                            class="arrow"
                            class:rotate={showMajorDropdown}
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                          >
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                        </button>
                        {#if showMajorDropdown}
                          <div class="dropdown-menu">
                            {#each availableMajorsForFaculty as major}
                              <button
                                class="dropdown-item"
                                on:click={() => chooseMajor(major.id)}
                              >
                                {major.name}
                              </button>
                            {/each}
                          </div>
                        {/if}
                      </div>
                    </div>
                  {:else}
                    <!-- Department -->
                    <div class="form-field">
                      <label for="date-from">{lang.department}</label>
                      <div class="custom-select">
                        <button
                          type="button"
                          class="select-btn {fieldValidationErrors.department
                            ? 'error'
                            : ''}"
                          class:active={showDepartmentDropdown}
                          on:click={(e) => toggleDropdownVisibility("dept", e)}
                        >
                          <span class:placeholder={!userDepartment}
                            >{retrieveDepartmentName(userDepartment)}</span
                          >
                          <svg
                            class="arrow"
                            class:rotate={showDepartmentDropdown}
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                          >
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                        </button>
                        {#if showDepartmentDropdown}
                          <div class="dropdown-menu">
                            {#each staffDepartments as dept}
                              <button
                                class="dropdown-item"
                                on:click={() => chooseDepartment(dept.id)}
                              >
                                {dept.name}
                              </button>
                            {/each}
                          </div>
                        {/if}
                      </div>
                    </div>
                  {/if}
                </div>
              </div>

              <!-- Security Card -->
              <div class="info-card">
                <div class="card-headerr">
                  <div class="card-icon">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"
                      ></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                  </div>
                  <h2>{lang.security}</h2>
                </div>

                <div class="card-content">
                  <div class="form-field">
                    <div class="password-row">
                      <label for="date-from">{lang.password}</label>
                      <a
                        href="/auth/forgot-password?return_to={$page.url
                          .pathname}"
                        class="change-link"
                      >
                        {lang.changePassword}
                      </a>
                    </div>
                    <div class="input-wrapper locked">
                      <input type="password" value="••••••••••••" disabled />
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"
                        ></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Feedback Message -->
              {#if feedbackMessage}
                <div class="feedback-toast {feedbackType}">
                  <div class="toast-icon">
                    {#if feedbackType === "error"}
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="15" y1="9" x2="9" y2="15"></line>
                        <line x1="9" y1="9" x2="15" y2="15"></line>
                      </svg>
                    {:else}
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    {/if}
                  </div>
                  <span>{feedbackMessage}</span>
                </div>
              {/if}

              <!-- Action Buttons -->
              <div class="action-section">
                <button
                  type="button"
                  class="save-btn"
                  class:disabled={!hasUnsavedChanges || savingChanges}
                  disabled={!hasUnsavedChanges || savingChanges}
                  on:click|preventDefault={submitProfileUpdate}
                >
                  {#if savingChanges}
                    <div class="btn-loader"></div>
                    <span
                      >{currentLang === "th"
                        ? "กำลังบันทึก..."
                        : "Saving Changes..."}</span
                    >
                  {:else}
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path
                        d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"
                      ></path>
                      <polyline points="17 21 17 13 7 13 7 21"></polyline>
                      <polyline points="7 3 7 8 15 8"></polyline>
                    </svg>
                    <span>{lang.saveChanges}</span>
                  {/if}
                </button>
              </div>
            </div>
          {/if}
        </div>
      {:else if currentView == "unlock"}
        <div class="unlock-user-component">
          <div class="unlock-card">
            <div class="unlock-card-header">
              <div class="unlock-icon-circle">
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"
                  ></rect>
                  <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
                </svg>
              </div>
              <h2 class="unlock-main-title">{lang.unlockAccount}</h2>
              <p class="unlock-sub-title">
                {lang.enterEmailToRestore}
              </p>
            </div>

            <form
              class="unlock-form-section"
              on:submit|preventDefault={handleUnlock}
              autocomplete="off"
            >
              <div class="unlock-form-group">
                <label class="unlock-label" for="unlock-email-input"
                  >{lang.userEmailAddress}</label
                >
                <div
                  class="unlock-input-wrapper {errorField === 'email'
                    ? 'unlock-error'
                    : ''}"
                >
                  <input
                    id="unlock-email-input"
                    type="email"
                    placeholder={lang.enterEmailPlaceholder}
                    bind:value={email}
                    on:input={clearNotification}
                    disabled={isLoading}
                  />
                </div>
              </div>

              {#if notificationMessage}
                <div class="unlock-notification unlock-{notificationType}">
                  <div class="unlock-notif-icon">
                    {#if notificationType === "error"}
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                      </svg>
                    {:else}
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    {/if}
                  </div>
                  <span>{notificationMessage}</span>
                </div>
              {/if}

              <button
                type="submit"
                class="unlock-submit-btn"
                disabled={isLoading}
              >
                {#if isLoading}
                  <div class="unlock-spinner"></div>
                  <span
                    >{currentLang === "th"
                      ? "กำลังดำเนินการ..."
                      : "Processing..."}</span
                  >
                {:else}
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"
                    ></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                  <span>{lang.unlockAccount}</span>
                {/if}
              </button>
            </form>
          </div>
        </div>
      {:else if currentView !== "create"}
        <div
          style="padding: 4rem; text-align: center; color: var(--text-muted); border: 1px dashed rgba(255,255,255,0.1); border-radius: 20px;"
        >
          <h3>
            Content for {menuItems.find((m) => m.id === currentView)?.label}
          </h3>
          <p>This page does not have search or pagination enabled.</p>
        </div>
      {/if}
    </div>

    <div class="pagination-controls"></div>

    {#if currentView === "create"}
      <div class="ce-wrapper">
        <div
          class="ce-container"
          role="button"
          tabindex="0"
          on:click={() => (ce_activeDropdown = null)}
          on:keydown={(e) => {
            if (e.key === "Escape" || e.key === "Enter")
              ce_activeDropdown = null;
          }}
        >
          <div class="ce-header">
            <h2 class="ce-title">
              {editingEventId ? lang.editEvent : lang.createNewEvent}
            </h2>
            <div class="ce-header-right">
              {#if ce_validationErrors.size > 0}
                <div class="ce-validation-alert">
                  <svg
                    class="ce-alert-icon"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    ></path>
                  </svg>
                  <span class="ce-alert-text">{lang.fillAllFields}</span>
                </div>
              {/if}
              <div class="ce-header-actions">
                <button
                  class="ce-btn-cancel"
                  on:click={() => {
                    editingEventId = null;
                    ce_formData = {
                      title: "",
                      description: "",
                      location: "",
                      sDay: "",
                      sMonth: "",
                      sYear: "",
                      eDay: "",
                      eMonth: "",
                      eYear: "",
                      startTime: "",
                      endTime: "",
                      totalSlots: null,
                      distanceKm: null,
                      holidays: [],
                      excludeWeekends: false,
                      tempHoliday: "",
                      rewards: [
                        {
                          quota: null,
                          rangeStart: 1,
                          rangeEnd: null,
                          name: "",
                          requirement: null,
                        },
                      ],
                      isPublic: false,
                      isActive: false,
                      imagePreview: null,
                    };
                    ce_holidayMode = null;
                    currentView = "list";
                  }}>{lang.cancel}</button
                >
                <button class="ce-btn-save" on:click={ce_submit}
                  >{editingEventId
                    ? lang.update
                    : currentLang === "th"
                      ? "เผยแพร่"
                      : "Publish"}</button
                >
              </div>
            </div>
          </div>

          <div class="ce-grid-layout">
            <!-- Image Upload Section -->
            <div
              class="ce-card ce-img-card"
              class:has-img={ce_formData.imagePreview}
              role="button"
              tabindex="0"
              aria-label="Upload event image"
              on:click|stopPropagation={ce_trigFile}
              on:keydown={(e) => {
                if (e.key === "Enter" || e.key === " ") ce_trigFile();
              }}
            >
              <input
                type="file"
                accept="image/*"
                bind:this={ce_fileInput}
                on:change={ce_handleImg}
                hidden
              />
              {#if ce_formData.imagePreview}
                <img
                  src={ce_formData.imagePreview}
                  alt="Preview"
                  class="ce-preview-img"
                />
                <div class="ce-overlay">
                  <span
                    >{currentLang === "th"
                      ? "เปลี่ยนรูปภาพ"
                      : "Change Image"}</span
                  >
                </div>
              {:else}
                <div class="ce-upload-placeholder">
                  <div class="ce-icon-upload">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      ></path>
                    </svg>
                  </div>
                  <span
                    >{currentLang === "th"
                      ? "อัพโหลดแบนเนอร์กิจกรรม"
                      : "Upload Event Banner"}</span
                  >
                </div>
              {/if}
            </div>

            <!-- Basic Info -->
            <div class="ce-card ce-form-card">
              <div class="ce-card-head">
                <svg
                  class="ce-icon-svg"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  ></path>
                </svg>
                <span
                  >{currentLang === "th"
                    ? "ข้อมูลพื้นฐาน"
                    : "Basic Information"}</span
                >
              </div>

              <div class="ce-input-group">
                <label for="event-title"
                  >{lang.eventName} <span class="ce-req">*</span></label
                >
                <input
                  id="event-title"
                  type="text"
                  bind:value={ce_formData.title}
                  placeholder={currentLang === "th"
                    ? "ชื่อกิจกรรมอย่างเป็นทางการ"
                    : "Official Event Name"}
                  class="ce-input"
                  class:error={ce_validationErrors.has("title")}
                />
              </div>

              <div class="ce-input-group">
                <label for="event-desc"
                  >{lang.description} <span class="ce-req">*</span></label
                >
                <textarea
                  id="event-desc"
                  bind:value={ce_formData.description}
                  placeholder={currentLang === "th"
                    ? "รายละเอียดกิจกรรม..."
                    : "Event details..."}
                  class="ce-textarea"
                  class:error={ce_validationErrors.has("description")}
                ></textarea>
              </div>

              <div class="ce-input-group">
                <label for="event-location"
                  >{lang.location} <span class="ce-req">*</span></label
                >
                <input
                  id="event-location"
                  type="text"
                  bind:value={ce_formData.location}
                  placeholder={currentLang === "th"
                    ? "สถานที่จัดกิจกรรม"
                    : "Location"}
                  class="ce-input"
                  class:error={ce_validationErrors.has("location")}
                />
              </div>
            </div>

            <!-- Date & Time -->
            <div class="ce-card ce-config-card">
              <div class="ce-card-head">
                <svg
                  class="ce-icon-svg"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  ></path>
                </svg>
                <span>Date & Time</span>
              </div>

              <div class="ce-dual-row">
                <div class="ce-input-group">
                  <label for="ce-sDay-input"
                    >Start Date <span class="ce-req">*</span></label
                  >

                  <div
                    class="ce-date-row compact-gap"
                    class:error={ce_validationErrors.has("startDate")}
                  >
                    <div class="ce-dd-wrap flex-1-5">
                      <div
                        class="ce-trigger"
                        role="button"
                        tabindex="0"
                        aria-haspopup="listbox"
                        aria-expanded={ce_activeDropdown === "sDay"}
                        on:click|stopPropagation={() => ce_toggleDD("sDay")}
                        on:keydown={(e) => {
                          if (["Enter", " "].includes(e.key)) {
                            e.preventDefault();
                            ce_toggleDD("sDay");
                          }
                        }}
                      >
                        <input
                          id="ce-sDay-input"
                          type="text"
                          value={ce_formData.sDay}
                          placeholder="Day"
                          class="ce-input-dis"
                          readonly
                          tabindex="-1"
                          on:click|stopPropagation
                        />
                        <span class="ce-arrow">▼</span>
                      </div>
                      {#if ce_activeDropdown === "sDay"}
                        <div
                          class="ce-options"
                          role="listbox"
                          tabindex="-1"
                          on:click|stopPropagation={() => {}}
                          on:keydown|stopPropagation={() => {}}
                        >
                          {#each ce_days as d}
                            <button
                              type="button"
                              class="ce-opt"
                              role="option"
                              aria-selected={ce_formData.sDay === String(d)}
                              on:click|stopPropagation={() =>
                                ce_selectOpt("sDay", d)}
                            >
                              {d}
                            </button>
                          {/each}
                        </div>
                      {/if}
                    </div>

                    <div class="ce-dd-wrap flex-2">
                      <div
                        class="ce-trigger"
                        role="button"
                        tabindex="0"
                        aria-haspopup="listbox"
                        on:click|stopPropagation={() => ce_toggleDD("sMonth")}
                        on:keydown={(e) => {
                          if (["Enter", " "].includes(e.key)) {
                            e.preventDefault();
                            ce_toggleDD("sMonth");
                          }
                        }}
                      >
                        <input
                          type="text"
                          value={ce_formData.sMonth}
                          placeholder="Month"
                          class="ce-input-dis"
                          readonly
                          tabindex="-1"
                          on:click|stopPropagation
                        />
                        <span class="ce-arrow">▼</span>
                      </div>
                      {#if ce_activeDropdown === "sMonth"}
                        <div
                          class="ce-options"
                          role="listbox"
                          tabindex="-1"
                          on:click|stopPropagation={() => {}}
                          on:keydown|stopPropagation={() => {}}
                        >
                          {#each ce_months as m}
                            <button
                              type="button"
                              class="ce-opt"
                              role="option"
                              aria-selected={ce_formData.sMonth === m}
                              on:click|stopPropagation={() =>
                                ce_selectOpt("sMonth", m)}
                            >
                              {m}
                            </button>
                          {/each}
                        </div>
                      {/if}
                    </div>

                    <div class="ce-dd-wrap flex-1-5">
                      <div
                        class="ce-trigger"
                        role="button"
                        tabindex="0"
                        aria-haspopup="listbox"
                        on:click|stopPropagation={() => ce_toggleDD("sYear")}
                        on:keydown={(e) => {
                          if (["Enter", " "].includes(e.key)) {
                            e.preventDefault();
                            ce_toggleDD("sYear");
                          }
                        }}
                      >
                        <input
                          type="text"
                          value={ce_formData.sYear}
                          placeholder="Year"
                          class="ce-input-dis"
                          readonly
                          tabindex="-1"
                          on:click|stopPropagation
                        />
                        <span class="ce-arrow">▼</span>
                      </div>
                      {#if ce_activeDropdown === "sYear"}
                        <div
                          class="ce-options"
                          role="listbox"
                          tabindex="-1"
                          on:click|stopPropagation={() => {}}
                          on:keydown|stopPropagation={() => {}}
                        >
                          {#each ce_years as y}
                            <button
                              type="button"
                              class="ce-opt"
                              role="option"
                              aria-selected={ce_formData.sYear === y.toString()}
                              on:click|stopPropagation={() =>
                                ce_selectOpt("sYear", y)}
                            >
                              {y}
                            </button>
                          {/each}
                        </div>
                      {/if}
                    </div>
                  </div>
                </div>

                <div class="ce-input-group">
                  <label for="ce-eDay-input"
                    >End Date <span class="ce-req">*</span></label
                  >
                  <div
                    class="ce-date-row compact-gap"
                    class:error={ce_validationErrors.has("endDate")}
                  >
                    <div class="ce-dd-wrap flex-1-5">
                      <div
                        class="ce-trigger"
                        role="button"
                        tabindex="0"
                        aria-haspopup="listbox"
                        on:click|stopPropagation={() => ce_toggleDD("eDay")}
                        on:keydown={(e) => {
                          if (["Enter", " "].includes(e.key)) {
                            e.preventDefault();
                            ce_toggleDD("eDay");
                          }
                        }}
                      >
                        <input
                          id="ce-eDay-input"
                          type="text"
                          value={ce_formData.eDay}
                          placeholder="Day"
                          class="ce-input-dis"
                          readonly
                          tabindex="-1"
                          on:click|stopPropagation
                        />
                        <span class="ce-arrow">▼</span>
                      </div>
                      {#if ce_activeDropdown === "eDay"}
                        <div
                          class="ce-options"
                          role="listbox"
                          tabindex="-1"
                          on:click|stopPropagation={() => {}}
                          on:keydown|stopPropagation={() => {}}
                        >
                          {#each ce_days as d}
                            <button
                              type="button"
                              class="ce-opt"
                              role="option"
                              aria-selected={ce_formData.eDay === String(d)}
                              on:click|stopPropagation={() =>
                                ce_selectOpt("eDay", d)}
                            >
                              {d}
                            </button>
                          {/each}
                        </div>
                      {/if}
                    </div>

                    <div class="ce-dd-wrap flex-2">
                      <div
                        class="ce-trigger"
                        role="button"
                        tabindex="0"
                        aria-haspopup="listbox"
                        on:click|stopPropagation={() => ce_toggleDD("eMonth")}
                        on:keydown={(e) => {
                          if (["Enter", " "].includes(e.key)) {
                            e.preventDefault();
                            ce_toggleDD("eMonth");
                          }
                        }}
                      >
                        <input
                          type="text"
                          value={ce_formData.eMonth}
                          placeholder="Month"
                          class="ce-input-dis"
                          readonly
                          tabindex="-1"
                          on:click|stopPropagation
                        />
                        <span class="ce-arrow">▼</span>
                      </div>
                      {#if ce_activeDropdown === "eMonth"}
                        <div
                          class="ce-options"
                          role="listbox"
                          tabindex="-1"
                          on:click|stopPropagation={() => {}}
                          on:keydown|stopPropagation={() => {}}
                        >
                          {#each ce_months as m}
                            <button
                              type="button"
                              class="ce-opt"
                              role="option"
                              aria-selected={ce_formData.eMonth == m}
                              on:click|stopPropagation={() =>
                                ce_selectOpt("eMonth", m)}
                            >
                              {m}
                            </button>
                          {/each}
                        </div>
                      {/if}
                    </div>

                    <div class="ce-dd-wrap flex-1-5">
                      <div
                        class="ce-trigger"
                        role="button"
                        tabindex="0"
                        aria-haspopup="listbox"
                        on:click|stopPropagation={() => ce_toggleDD("eYear")}
                        on:keydown={(e) => {
                          if (["Enter", " "].includes(e.key)) {
                            e.preventDefault();
                            ce_toggleDD("eYear");
                          }
                        }}
                      >
                        <input
                          type="text"
                          value={ce_formData.eYear}
                          placeholder="Year"
                          class="ce-input-dis"
                          readonly
                          tabindex="-1"
                          on:click|stopPropagation
                        />
                        <span class="ce-arrow">▼</span>
                      </div>
                      {#if ce_activeDropdown === "eYear"}
                        <div
                          class="ce-options"
                          role="listbox"
                          tabindex="-1"
                          on:click|stopPropagation={() => {}}
                          on:keydown|stopPropagation={() => {}}
                        >
                          {#each ce_years as y}
                            <button
                              type="button"
                              class="ce-opt"
                              role="option"
                              aria-selected={ce_formData.eYear === y.toString()}
                              on:click|stopPropagation={() =>
                                ce_selectOpt("eYear", y)}
                            >
                              {y}
                            </button>
                          {/each}
                        </div>
                      {/if}
                    </div>
                  </div>
                </div>
              </div>

              {#if (startDateObj && endDateObj && !isDateRangeValid) || ce_validationErrors.has("dateRange")}
                <div class="ce-error-msg">
                  ⚠️ Start Date must not be later than End Date.
                </div>
              {/if}

              <div class="ce-time-capacity-row">
                <div class="ce-input-group">
                  <label for="ce_startTime"
                    >Start Time <span class="ce-req">*</span></label
                  >
                  <div
                    class="ce-dd-wrap"
                    class:error={ce_validationErrors.has("startTime")}
                  >
                    <div
                      class="ce-trigger-compact"
                      role="button"
                      tabindex="0"
                      on:click|stopPropagation={() => ce_toggleDD("startTime")}
                      on:keydown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.stopPropagation();
                          ce_toggleDD("startTime");
                        }
                      }}
                    >
                      <input
                        id="ce_startTime"
                        type="text"
                        value={ce_formData.startTime}
                        placeholder="00:00"
                        class="ce-input-inline"
                        maxlength="5"
                        on:input={(e) => ce_handleTimeInput(e, "startTime")}
                        on:click|stopPropagation={() =>
                          ce_toggleDD("startTime")}
                      />
                      <span class="ce-arrow">▼</span>
                    </div>

                    {#if ce_activeDropdown === "startTime"}
                      <div class="ce-options" role="listbox">
                        {#each ce_timeList as t}
                          <div
                            class="ce-opt"
                            role="option"
                            tabindex="0"
                            aria-selected={ce_formData.startTime === t}
                            on:click|stopPropagation={() =>
                              ce_selectCombo("startTime", t)}
                            on:keydown={(e) => {
                              if (e.key === "Enter") {
                                e.stopPropagation();
                                ce_selectCombo("startTime", t);
                              }
                            }}
                          >
                            {t}
                          </div>
                        {/each}
                      </div>
                    {/if}
                  </div>
                </div>

                <div class="ce-input-group">
                  <label for="ce_endTime"
                    >End Time <span class="ce-req">*</span></label
                  >
                  <div
                    class="ce-dd-wrap"
                    class:error={ce_validationErrors.has("endTime")}
                  >
                    <div
                      class="ce-trigger-compact"
                      role="button"
                      tabindex="0"
                      on:click|stopPropagation={() => ce_toggleDD("endTime")}
                      on:keydown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.stopPropagation();
                          ce_toggleDD("endTime");
                        }
                      }}
                    >
                      <input
                        id="ce_endTime"
                        type="text"
                        value={ce_formData.endTime}
                        placeholder="00:00"
                        class="ce-input-inline"
                        maxlength="5"
                        on:input={(e) => ce_handleTimeInput(e, "endTime")}
                        on:click|stopPropagation={() => ce_toggleDD("endTime")}
                      />
                      <span class="ce-arrow">▼</span>
                    </div>

                    {#if ce_activeDropdown === "endTime"}
                      <div class="ce-options" role="listbox">
                        {#each ce_timeList as t}
                          <div
                            class="ce-opt"
                            role="option"
                            tabindex="0"
                            aria-selected={ce_formData.endTime === t}
                            on:click|stopPropagation={() =>
                              ce_selectCombo("endTime", t)}
                            on:keydown={(e) => {
                              if (e.key === "Enter") {
                                e.stopPropagation();
                                ce_selectCombo("endTime", t);
                              }
                            }}
                          >
                            {t}
                          </div>
                        {/each}
                      </div>
                    {/if}
                  </div>
                </div>

                <div class="ce-input-group">
                  <label for="ce_totalSlots"
                    >Capacity <span class="ce-req">*</span></label
                  >
                  <div
                    class="ce-dd-wrap"
                    class:error={ce_validationErrors.has("totalSlots")}
                  >
                    <div
                      class="ce-trigger-compact"
                      role="button"
                      tabindex="0"
                      on:click|stopPropagation={() => ce_toggleDD("slots")}
                      on:keydown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.stopPropagation();
                          ce_toggleDD("slots");
                        }
                      }}
                    >
                      <input
                        id="ce_totalSlots"
                        type="number"
                        min="0"
                        bind:value={ce_formData.totalSlots}
                        placeholder="Max"
                        class="ce-input-inline"
                        on:input={(e) => {
                          ce_noNegative(e);
                          ce_recalcRewards();
                        }}
                        on:click|stopPropagation={() => ce_toggleDD("slots")}
                      />
                      <span class="ce-arrow">▼</span>
                    </div>

                    {#if ce_activeDropdown === "slots"}
                      <div class="ce-options" role="listbox">
                        {#each [50, 100, 200, 500, 1000, 2000, 5000] as s}
                          <div
                            class="ce-opt"
                            role="option"
                            tabindex="0"
                            aria-selected={ce_formData.totalSlots === s}
                            on:click|stopPropagation={() =>
                              ce_selectCombo("totalSlots", s)}
                            on:keydown={(e) => {
                              if (e.key === "Enter") {
                                e.stopPropagation();
                                ce_selectCombo("totalSlots", s);
                              }
                            }}
                          >
                            {s} Slots
                          </div>
                        {/each}
                      </div>
                    {/if}
                  </div>
                </div>

                <div class="ce-input-group">
                  <label for="ce_distanceKm">Distance (km)</label>
                  <div class="ce-dd-wrap">
                    <div
                      class="ce-trigger-compact"
                      role="button"
                      tabindex="0"
                      on:click|stopPropagation={() => ce_toggleDD("distanceKm")}
                      on:keydown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.stopPropagation();
                          ce_toggleDD("distanceKm");
                        }
                      }}
                    >
                      <input
                        id="ce_distanceKm"
                        type="number"
                        min="0"
                        step="1"
                        bind:value={ce_formData.distanceKm}
                        placeholder="0"
                        class="ce-input-inline"
                        on:click|stopPropagation={() =>
                          ce_toggleDD("distanceKm")}
                      />
                      <span class="ce-unit-label">km</span>
                      <span class="ce-arrow">▼</span>
                    </div>

                    {#if ce_activeDropdown === "distanceKm"}
                      <div class="ce-options" role="listbox">
                        {#each [1, 2, 3, 5, 10, 15, 21, 42] as d}
                          <div
                            class="ce-opt"
                            role="option"
                            tabindex="0"
                            aria-selected={ce_formData.distanceKm === d}
                            on:click|stopPropagation={() =>
                              ce_selectOpt("distanceKm", d)}
                            on:keydown={(e) => {
                              if (e.key === "Enter") {
                                e.stopPropagation();
                                ce_selectOpt("distanceKm", d);
                              }
                            }}
                          >
                            {d} km
                          </div>
                        {/each}
                      </div>
                    {/if}
                  </div>
                </div>
              </div>
            </div>

            <!-- Holidays & Exclusions -->
            <div
              class="ce-card ce-config-card"
              role="button"
              tabindex="0"
              on:click|stopPropagation
              on:keydown|stopPropagation
            >
              {#if !isDateRangeValid}
                <div class="ce-lock-overlay">
                  <svg
                    class="ce-lock-icon-svg"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    ></path>
                  </svg>
                  <span>Set valid <b>Start & End Date</b> to unlock.</span>
                </div>
              {/if}

              <div class="ce-card-head">
                <svg
                  class="ce-icon-svg"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                  ></path>
                </svg>
                <span>Holidays & Exclusions</span>
              </div>

              <div class="ce-holiday-control">
                <div class="ce-holiday-buttons">
                  <label
                    class="ce-check-row"
                    class:active={ce_holidayMode === "weekends"}
                  >
                    <input
                      type="checkbox"
                      checked={ce_holidayMode === "weekends"}
                      disabled={!isDateRangeValid}
                      on:change={() =>
                        ce_setHolidayMode(
                          ce_holidayMode === "weekends" ? null : "weekends"
                        )}
                    />
                    <div class="ce-check-content">
                      <span class="ce-check-title">Auto Exclude Weekends</span>
                      <span class="ce-check-desc"
                        >Automatically skip Saturdays & Sundays.</span
                      >
                    </div>
                  </label>

                  <label
                    class="ce-check-row"
                    class:active={ce_holidayMode === "none"}
                  >
                    <input
                      type="checkbox"
                      checked={ce_holidayMode === "none"}
                      disabled={!isDateRangeValid}
                      on:change={() =>
                        ce_setHolidayMode(
                          ce_holidayMode === "none" ? null : "none"
                        )}
                    />
                    <div class="ce-check-content">
                      <span class="ce-check-title">No Holidays</span>
                      <span class="ce-check-desc"
                        >Event runs every day without breaks.</span
                      >
                    </div>
                  </label>
                </div>

                <hr class="ce-divider" />

                <div class="ce-input-group">
                  <div
                    style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;"
                  >
                    <span
                      style="font-weight: 500; font-size: 0.9rem; color: #374151;"
                    >
                      Add Specific Holiday (Within Range)
                    </span>
                    {#if ce_formData.holidays.length > 0}
                      <button
                        class="ce-btn-reset"
                        on:click|stopPropagation={ce_resetHolidays}
                        type="button"
                      >
                        Reset All
                      </button>
                    {/if}
                  </div>

                  <div class="ce-dd-wrap">
                    <button
                      type="button"
                      class="ce-trigger-compact"
                      on:click|stopPropagation={() => {
                        if (isDateRangeValid) {
                          ce_setHolidayMode("specific");
                          ce_toggleDD("holidayDate");
                        }
                      }}
                    >
                      <input
                        type="text"
                        value={ce_formData.holidays.length > 0
                          ? `${ce_formData.holidays.length} date(s) selected`
                          : ""}
                        placeholder="Select dates"
                        class="ce-input-inline"
                        readonly
                        disabled={!isDateRangeValid}
                        tabindex="-1"
                        style="pointer-events: none;"
                      />
                      <span class="ce-arrow">▼</span>
                    </button>

                    {#if ce_activeDropdown === "holidayDate" && isDateRangeValid}
                      <div class="ce-options ce-options-calendar">
                        {#each Object.entries(groupedDates) as [monthYear, dates]}
                          <div class="ce-month-group">
                            <div class="ce-month-header">{monthYear}</div>
                            <div class="ce-date-grid">
                              {#each dates as date}
                                <button
                                  type="button"
                                  class="ce-date-item"
                                  class:selected={ce_formData.holidays.includes(
                                    date.value
                                  )}
                                  class:weekend={date.dayName === "Sat" ||
                                    date.dayName === "Sun"}
                                  on:click|stopPropagation={() =>
                                    ce_toggleHoliday(date.value)}
                                >
                                  <div class="ce-date-day">{date.day}</div>
                                  <div class="ce-date-name">{date.dayName}</div>
                                  {#if ce_formData.holidays.includes(date.value)}
                                    <div class="ce-check-mark">✓</div>
                                  {/if}
                                </button>
                              {/each}
                            </div>
                          </div>
                        {/each}
                      </div>
                    {/if}
                  </div>
                  <span class="ce-hint">
                    Click dates to select/deselect holidays. Dropdown stays open
                    for multiple selections.
                  </span>

                  {#if ce_formData.holidays.length > 0}
                    <div class="ce-tags">
                      {#each ce_formData.holidays as h}
                        <span class="ce-tag">
                          {availableDates.find((d) => d.value === h)
                            ?.fullDisplay || h}
                          <button
                            type="button"
                            class="ce-tag-remove"
                            on:click={() => ce_delHoliday(h)}
                            aria-label="Remove holiday">×</button
                          >
                        </span>
                      {/each}
                    </div>
                  {/if}
                </div>
              </div>
            </div>
            <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
            <div
              class="ce-card ce-config-card"
              class:ce-locked-card={!ce_formData.totalSlots}
              class:error={ce_validationErrors.has("rewards")}
              role="group"
              aria-label="Rewards Distribution Configuration"
              on:click|stopPropagation
              on:keydown|stopPropagation
            >
              {#if !ce_formData.totalSlots}
                <div class="ce-lock-overlay">
                  <svg
                    class="ce-lock-icon-svg"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    ></path>
                  </svg>
                  <span
                    >Enter <b>Total Capacity</b> first to unlock rewards.</span
                  >
                </div>
              {/if}

              <div class="ce-card-head">
                <svg
                  class="ce-icon-svg"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  ></path>
                </svg>
                <span>Rewards Distribution</span>
              </div>

              <div class="ce-rewards-section">
                <div class="ce-progress-info">
                  <span
                    >Allocated: <b>{usedSlots}</b> / {ce_formData.totalSlots ||
                      0}</span
                  >
                  <span class:ce-text-err={isCapacityOver}>
                    {isCapacityOver
                      ? `Exceeded by ${Math.abs(remainingSlots)}`
                      : `${remainingSlots} remaining`}
                  </span>
                </div>
                <div class="ce-progress-bar">
                  <div
                    class="ce-bar-fill"
                    style="width: {Math.min(
                      (usedSlots / (ce_formData.totalSlots || 1)) * 100,
                      100
                    )}%; background: {isCapacityOver ? '#ef4444' : '#10b981'};"
                  ></div>
                </div>

                <div class="ce-stack">
                  {#each ce_formData.rewards as reward, i}
                    <div class="ce-tier-card">
                      <div class="ce-tier-header">
                        <span class="ce-badge">Tier {i + 1}</span>
                        <div class="ce-tier-range-badge">
                          Rank {reward.rangeStart} - {reward.rangeEnd || "?"}
                        </div>
                        {#if ce_formData.rewards.length > 1}
                          <button
                            type="button"
                            class="ce-btn-remove"
                            on:click={() => ce_removeTier(i)}
                            title="Remove Tier"
                            aria-label="Remove Tier {i + 1}">×</button
                          >
                        {/if}
                      </div>
                      <div class="ce-tier-body">
                        <div class="ce-tier-field">
                          <label for="ce_quota_{i}">Quota</label>
                          <input
                            id="ce_quota_{i}"
                            type="number"
                            min="0"
                            bind:value={reward.quota}
                            on:input={(e) => {
                              ce_noNegative(e);
                              ce_recalcRewards();
                            }}
                            class="ce-input-compact"
                            disabled={!ce_formData.totalSlots}
                            placeholder="Enter quota"
                          />
                        </div>
                        <div class="ce-tier-field">
                          <label for="ce_req_{i}">Requirement</label>
                          <input
                            id="ce_req_{i}"
                            type="number"
                            min="1"
                            bind:value={reward.requirement}
                            on:input={(e) => {
                              ce_noNegative(e);
                            }}
                            class="ce-input-compact"
                            disabled={!ce_formData.totalSlots}
                            placeholder="Enter rounds"
                          />
                        </div>
                        <div class="ce-tier-field ce-tier-field-name">
                          <label for="ce_name_{i}">Reward Name</label>
                          <input
                            id="ce_name_{i}"
                            type="text"
                            bind:value={reward.name}
                            placeholder="Enter reward name"
                            class="ce-input-compact"
                            disabled={!ce_formData.totalSlots}
                          />
                        </div>
                      </div>
                    </div>
                  {/each}
                </div>

                {#if !isCapacityOver && remainingSlots > 0}
                  <button
                    type="button"
                    class="ce-btn-dashed"
                    on:click={ce_addTier}
                    disabled={!ce_formData.totalSlots}>+ Add Tier</button
                  >
                {/if}
              </div>
            </div>

            <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
            <div
              class="ce-card ce-config-card"
              role="group"
              aria-label="Event Status Configuration"
              on:click|stopPropagation
              on:keydown|stopPropagation
            >
              <div class="ce-card-head">
                <svg
                  class="ce-icon-svg"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  ></path>
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  ></path>
                </svg>
                <span>Event Status</span>
              </div>
              <div class="ce-status-row">
                <div class="ce-switch-box">
                  <span>Public Visibility</span>
                  <label class="ce-switch">
                    <input
                      type="checkbox"
                      bind:checked={ce_formData.isPublic}
                    />
                    <span class="ce-slider"></span>
                  </label>
                </div>
                <div class="ce-switch-box">
                  <span>Active (Open)</span>
                  <label class="ce-switch">
                    <input
                      type="checkbox"
                      bind:checked={ce_formData.isActive}
                    />
                    <span class="ce-slider"></span>
                  </label>
                </div>
              </div>

              <div
                class="ce-status-card"
                class:status-live={ce_formData.isActive && ce_formData.isPublic}
              >
                <div class="ce-status-icon-box">
                  {#if ce_formData.isActive && ce_formData.isPublic}
                    <svg
                      class="ce-status-icon"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      ></path>
                    </svg>
                  {:else}
                    <svg
                      class="ce-status-icon"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      ></path>
                    </svg>
                  {/if}
                </div>
                <div class="ce-status-text">
                  <strong>{statusTitle}</strong>
                  <p>{statusDesc}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    {/if}

    {#if showTimelineModal && logsData.selectedEvent}
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div class="modal-overlay" on:click={closeTimelineModal}>
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
        <div
          class="timeline-modal-container"
          on:click|stopPropagation
          role="dialog"
          aria-modal="true"
          aria-labelledby="timeline-modal-title"
          tabindex="-1"
        >
          <div class="timeline-modal-header">
            <h3 id="timeline-modal-title">
              <svg
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                stroke-width="2.5"
                style="display: inline; vertical-align: middle; margin-right: 8px;"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                ></path>
              </svg>
              Activity Timeline
            </h3>

            <button
              class="modal-close"
              on:click={closeTimelineModal}
              aria-label="Close modal"
            >
              <svg
                width="24"
                height="24"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                ></path>
              </svg>
            </button>
          </div>

          <div class="timeline-modal-body">
            <div class="timeline-event-title">
              <svg
                width="16"
                height="16"
                fill="none"
                stroke="#10b981"
                viewBox="0 0 24 24"
                stroke-width="2.5"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                ></path>
              </svg>
              {logsData.selectedEvent.title}
            </div>

            <div class="timeline-container">
              {#each timelineItems as item, index}
                <div class="timeline-item">
                  <div
                    class="timeline-dot"
                    class:success={item.status === "success"}
                    class:failed={item.status === "failed"}
                    class:pending={item.status === "pending"}
                  ></div>

                  <div
                    class="timeline-line"
                    class:last={index === timelineItems.length - 1}
                  ></div>

                  <div class="timeline-content">
                    <div class="timeline-time">
                      <svg
                        width="14"
                        height="14"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        stroke-width="2"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        ></path>
                      </svg>
                      {new Date(item.timestamp).toLocaleString(currentLang === 'th' ? 'th-TH' : 'en-US')}
                    </div>

                    <div class="timeline-action">
                      <span
                        class="action-badge"
                        style="background: {getActionConfig(item.action)
                          .color}20; 
                           color: {getActionConfig(item.action).color};"
                      >
                        {getActionConfig(item.action).label}
                      </span>
                    </div>

                    <div class="timeline-user">
                      <svg
                        width="14"
                        height="14"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        stroke-width="2"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        ></path>
                      </svg>
                      {item.userName}
                    </div>

                    <div class="timeline-details">{item.details}</div>
                  </div>
                </div>
              {/each}
            </div>

            {#if generateTimeline().length === 0}
              <div class="timeline-empty">
                <svg
                  width="48"
                  height="48"
                  fill="none"
                  stroke="#64748b"
                  viewBox="0 0 24 24"
                  stroke-width="1.5"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  ></path>
                </svg>
                <p>No activities yet</p>
              </div>
            {/if}
          </div>
        </div>
      </div>
    {/if}
  </main>
  <footer class="app-footer">
    <div class="footer-divider"></div>
    <p class="copyright">© 2025 Cyber Geek. All rights reserved.</p>

    <p class="credits">
      Designed & Developed by <span class="dev-name"
        >Cyber Geek Development</span
      >
    </p>

    <p class="credits" style="margin-top: 5px;">
  Contact: 
  <a href="mailto:cybergeek.dev@proton.me" class="footer-email">
    cybergeek.dev@proton.me
  </a>
</p>
  </footer>
</div>

<style>
  :root {
    --bg-deep: #0f172a;
    --bar-dark: #1e293b;
    --emerald-pri: #10b981;
    --text-pure: #f8fafc;
    --text-muted: #94a3b8;
    --nav-height: 72px;
    --danger: #ef4444;
    --warning: #f59e0b;
  }

  /* ==========================================================================
     HIDE SCROLLBAR GLOBALLY (FORCE) & SWAL CUSTOMIZATION
     ========================================================================== */
  :global(html),
  :global(body) {
    scrollbar-width: none !important;
    -ms-overflow-style: none !important;
    overflow-y: auto;
    margin: 0;
  }
  :global(::-webkit-scrollbar) {
    display: none !important;
    width: 0 !important;
    height: 0 !important;
    background: transparent !important;
  }
  * {
    scrollbar-width: none !important;
    -ms-overflow-style: none !important;
    box-sizing: border-box;
  }

  :global(.swal-rounded-popup.glass-modal) {
    border: 1px solid rgba(255, 255, 255, 0.1) !important;
    overflow: hidden;
  }

  /* SWAL BACKDROP BLUR & INDEX */
  :global(.swal2-container) {
    backdrop-filter: blur(8px) !important;
    background: rgba(15, 23, 42, 0.7) !important; /* Dark blue tint */
    z-index: 9999 !important; /* Ensure it is top most */
  }
  :global(.glass-modal-popup) {
    border: 1px solid rgba(255, 255, 255, 0.1) !important;
    border-radius: 20px !important;
    padding: 0 !important; /* บังคับลบขอบขาว */
    overflow: hidden !important; /* บังคับตัดส่วนเกินทุกอย่าง */
    display: grid !important; /* แก้บั๊ก Layout */
  }

  :global(.modal-close-btn) {
    color: #fff !important;
  }
  /* ========================================================================== */

  :global(.swal2-close) {
    color: white !important;
    outline: none !important;
    box-shadow: none !important;
  }
  :global(.swal2-popup) {
    border-radius: 20px !important; /* บังคับมุมโค้ง */
  }
  /* GLOBAL */
  .app-container {
    min-height: 100vh;
    background-color: var(--bg-deep);
    color: var(--text-pure);
    font-family: "Inter", sans-serif;
    display: flex;
    flex-direction: column;
  }

  /* HEADER */
  .header-bar {
    width: 100%;
    height: var(--nav-height);
    background-color: var(--bar-dark);
    position: fixed;
    top: 0;
    left: 0;
    z-index: 1000;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
  }
  .header-inner {
    height: 100%;
    display: flex;
    align-items: center;
    padding: 0 1.5rem;
    justify-content: space-between;
    gap: 1rem;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }
  .logo-icon {
    width: 45px; /* ปรับขนาดกรอบตามต้องการ */
    height: 45px;

    /* 👇 ถ้าโลโก้คุณมีพื้นหลังมาแล้ว ให้ลบบรรทัด background นี้ทิ้งครับ */
    /* แต่ถ้าเป็น PNG พื้นใส อยากให้มีสีเขียวรองหลัง ก็เก็บไว้ */
    background: linear-gradient(135deg, var(--emerald-pri), var(--teal-sec));

    border-radius: 12px; /* ความมนของมุม */
    overflow: hidden; /* ตัดส่วนเกินของรูปให้อยู่ในกรอบมนๆ */

    display: flex;
    align-items: center;
    justify-content: center;

    flex-shrink: 0;
    padding: 0; /* ลบ padding เพื่อให้รูปเต็มกรอบ */
  }

  /* --- 2. เพิ่ม CSS ควบคุมรูปภาพ --- */
  .my-logo-img {
    width: 100%;
    height: 100%;

    /* เลือกเอาอันใดอันหนึ่ง: */
    object-fit: cover; /* ขยายรูปให้เต็มช่อง (รูปอาจโดนตัดขอบนิดหน่อย) */
    /* object-fit: contain; */ /* ย่อรูปให้เห็นครบทั้งภาพ (อาจมีขอบว่างเหลือ) */
  }
  .brand-name {
    font-weight: 800; /* ปรับให้หนาพิเศษ */
    font-size: 1.8rem; /* ขยายให้ใหญ่สะใจ (จากเดิม 1rem) */
    text-transform: uppercase; /* บังคับตัวพิมพ์ใหญ่ทั้งหมด (ดูขลังกว่า) */
    letter-spacing: 1px; /* เว้นช่องไฟนิดนึงให้อ่านง่าย */

    /* 🔥 เทคนิคทำตัวหนังสือไล่สี (Gradient Text) */
    background: linear-gradient(
      to right,
      #6ee7b7,
      #10b981
    ); /* เขียวมิ้นต์ -> เขียวมรกต */
    -webkit-background-clip: text; /* ตัดพื้นหลังให้เป็นรูปตัวอักษร */
    -webkit-text-fill-color: transparent; /* ถมสีตัวอักษรให้ใส เพื่อให้เห็นพื้นหลัง */
    background-clip: text;

    /* ✨ เพิ่มแสงเงาเรืองแสง (Glow) */
    filter: drop-shadow(0 2px 10px rgba(16, 185, 129, 0.4));

    white-space: nowrap;
    cursor: default; /* เมาส์ชี้แล้วเป็นลูกศรปกติ */
  }
  /* NAV */
  .line-icon {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    stroke-width: 2;
  }
  .fixed-size {
    width: 22px;
    height: 22px;
  }
  .nav-menu {
    display: flex;
    gap: 6px;
    flex: 1;
    justify-content: center;
    align-items: center;
    position: relative;
    z-index: 1050; /* เพิ่มบรรทัดนี้ */
  }
  .menu-btn {
    background: transparent;
    border: 1px solid transparent;
    padding: 8px 14px;
    border-radius: 12px;
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.85rem;
    transition: all 0.2s;
  }

  .menu-btn.active {
    color: var(--emerald-pri);
    background: #141d2b;
    border: 1px solid rgba(16, 185, 129, 0.2);
    box-shadow: inset 4px 4px 8px rgba(0, 0, 0, 0.5);
    transform: translateY(1px) scale(0.97);
  }
  .menu-btn:hover:not(.active) {
    color: var(--text-pure);
    background: rgba(255, 255, 255, 0.03);
  }
  .nav-divider {
    width: 1px;
    height: 24px;
    background-color: rgba(255, 255, 255, 0.1);
    margin: 0 8px;
  }
  .search-toggle {
    color: var(--emerald-pri);
    border: 1px solid rgba(16, 185, 129, 0.1);
  }
  .search-toggle:hover {
    background: rgba(16, 185, 129, 0.1);
  }
  .search-toggle.active {
    background: var(--emerald-pri);
    color: #fff;
  }

  .user-zone {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }
  .token-timer {
    padding: 6px 14px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: var(--emerald-pri);
    font-family: monospace;
    font-weight: bold;
    font-size: 0.85rem;
  }

  /* LOGOUT BUTTON */
  .logout-icon-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    padding: 8px;
    border-radius: 50%;
    transition: all 0.3s ease;
  }
  .logout-icon-btn:hover {
    background-color: rgba(239, 68, 68, 0.15);
    color: #ef4444;
    transform: scale(1.1);
    box-shadow: 0 0 10px rgba(239, 68, 68, 0.3);
  }

  /* MOBILE CONTROLS */
  .mobile-controls {
    display: none;
    gap: 8px;
    align-items: center;
  }

  .mobile-icon-btn {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.05);
    padding: 8px;
    border-radius: 10px;
    color: var(--text-muted);
    cursor: pointer;
    transition: 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .mobile-icon-btn.active {
    color: var(--emerald-pri);
    border-color: rgba(16, 185, 129, 0.3);
    background: rgba(16, 185, 129, 0.1);
  }
  .mobile-icon-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: white;
  }

  /* DRAWER */
  .mobile-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    z-index: 2000;
    backdrop-filter: blur(5px);
  }
  .mobile-drawer {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: 75vw;
    max-width: 280px;
    background: rgba(30, 41, 59, 0.98);
    backdrop-filter: blur(10px);
    z-index: 2001;
    padding: 1.25rem;
    box-shadow: -10px 0 30px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    border-left: 1px solid rgba(255, 255, 255, 0.1);
  }
  .drawer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    padding-bottom: 0.75rem;
  }
  .close-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 2rem;
    cursor: pointer;
  }
  .drawer-content {
    flex: 1;
    overflow-y: auto;
  }
  .drawer-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-radius: 10px;
    color: var(--text-muted);
    margin-bottom: 6px;
    cursor: pointer;
    border: 1px solid transparent;
    background: transparent;
  }
  .drawer-item.active {
    color: var(--emerald-pri);
    background: #141d2b;
    border-color: rgba(16, 185, 129, 0.2);
  }
  .drawer-footer {
    margin-top: auto;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    padding-top: 1rem;
  }
  .logout-special {
    color: var(--danger);
  }
  .logout-special:hover {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
  }

  /* CONTENT */
  .page-content {
    margin-top: var(--nav-height);
    padding: 2.5rem 1.5rem;
    position: relative;
    z-index: 1;
    flex: 1;
  }
  .wrapper {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
  }
  .static-view-header {
    margin-bottom: 0;
    flex-shrink: 0;
  }

  .header-search-section {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .header-search-box {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: rgba(15, 23, 42, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    padding: 0.5rem 1rem;
    min-width: 200px;
  }
  .header-search-box svg {
    color: #64748b;
    flex-shrink: 0;
  }

  .header-filter-dropdown {
    position: relative;
    z-index: 1100;
  }

  .header-filter-trigger {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: rgba(15, 23, 42, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    padding: 0.5rem 0.75rem;
    color: #94a3b8;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .header-filter-trigger:hover {
    border-color: rgba(16, 185, 129, 0.3);
    color: #10b981;
  }

  .header-filter-menu {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    background: #1e293b;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    padding: 0.5rem;
    min-width: 120px;
    max-height: 200px;
    overflow-y: auto;
    z-index: 1100; /* เพิ่มบรรทัดนี้ */
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
  }

  .header-filter-option {
    display: block;
    width: 100%;
    padding: 0.5rem 0.75rem;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: #94a3b8;
    font-size: 0.85rem;
    text-align: left;
    cursor: pointer;
    transition: all 0.2s;
  }

  .header-filter-option:hover {
    background: rgba(16, 185, 129, 0.1);
    color: #10b981;
  }

  .header-filter-option.active {
    background: rgba(16, 185, 129, 0.2);
    color: #10b981;
  }

  .showing-text {
    text-align: center;
    color: #64748b;
    font-size: 0.85rem;
    margin-top: 1rem;
  }

  .page-numbers {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .page-num {
    min-width: 40px;
    height: 40px;
    background: rgba(30, 41, 59, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    color: #94a3b8;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .page-num:hover {
    background: rgba(16, 185, 129, 0.1);
    border-color: rgba(16, 185, 129, 0.3);
    color: #10b981;
  }

  .page-num.active {
    background: linear-gradient(135deg, #10b981, #059669);
    border-color: #10b981;
    color: white;
  }

  .page-dots {
    color: #64748b;
    padding: 0 0.5rem;
    user-select: none;
  }

  .page-number-btn {
    min-width: 40px;
    height: 40px;
    background: var(--bar-dark);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: var(--text-muted);
    border-radius: 10px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.9rem;
    font-weight: 600;
    transition: all 0.2s;
  }

  .page-number-btn:hover {
    border-color: var(--emerald-pri);
    color: var(--emerald-pri);
    background: rgba(16, 185, 129, 0.1);
  }

  .page-number-btn.active {
    background: var(--emerald-pri);
    color: white;
    border-color: var(--emerald-pri);
  }

  .title-with-toggle {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    width: 100%;
    min-height: 50px;
    margin-bottom: 1rem;
  }
  .view-title h2 {
    font-size: 1.75rem;
    letter-spacing: -0.5px;
    margin: 0;
    margin-bottom: 0.5rem;
  }

  .view-title {
    margin-bottom: 1.5rem;
  }
  .divider {
    width: 40px;
    height: 3px;
    background: var(--emerald-pri);
    margin-top: 0.5rem;
    border-radius: 2px;
  }

  .title-line {
    height: 3px;
    width: 60px;
    background: linear-gradient(90deg, #10b981, #059669);
    border-radius: 2px;
    margin-top: 0.5rem; /* ระยะห่างจากข้อความถึงเส้น */
  }

  /* ===== VERIFY CODE - NEW DESIGN ===== */
  .vc-container {
    max-width: 480px;
    margin: 0 auto;
    padding: 0 1rem;
  }

  .vc-main-card {
    background: linear-gradient(
      165deg,
      rgba(30, 41, 59, 0.9) 0%,
      rgba(15, 23, 42, 0.95) 100%
    );
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 24px;
    padding: 2rem;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
  }

  .vc-submit-wrapper {
    min-height: 52px;
    transition: all 0.3s ease; /* เพิ่ม transition ให้ปุ่มยุบตัวสวยๆ */
  }

  .vc-submit-wrapper.hidden .vc-submit {
    opacity: 0;
    pointer-events: none;
  }
  .vc-submit-wrapper.hidden {
    height: 0; /* ยุบความสูง */
    min-height: 0; /* ยุบ min-height */
    margin: 0; /* เอา margin ออก */
    padding: 0; /* เอา padding ออก */
    opacity: 0;
    overflow: hidden; /* ซ่อนส่วนเกิน */
    pointer-events: none;
  }

  /* Card Header */
  .vc-card-header {
    text-align: center;
    margin-bottom: 1.75rem;
  }

  .vc-icon-wrapper {
    position: relative;
    width: 72px;
    height: 72px;
    margin: 0 auto 1.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--emerald-pri);
  }

  .vc-icon-bg {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      135deg,
      rgba(16, 185, 129, 0.2),
      rgba(16, 185, 129, 0.05)
    );
    border-radius: 20px;
    border: 1px solid rgba(16, 185, 129, 0.2);
    animation: vc-glow 3s ease-in-out infinite;
  }

  @keyframes vc-glow {
    0%,
    100% {
      box-shadow: 0 0 20px rgba(16, 185, 129, 0.15);
    }
    50% {
      box-shadow: 0 0 35px rgba(16, 185, 129, 0.25);
    }
  }

  .vc-icon-wrapper svg {
    position: relative;
    z-index: 1;
  }

  .vc-title {
    margin: 0 0 0.5rem;
    font-size: 1.5rem;
    font-weight: 700;
    color: #f8fafc;
  }

  .vc-subtitle {
    margin: 0;
    font-size: 0.9rem;
    color: var(--text-muted);
  }

  /* Mode Selector */
  .vc-mode-selector {
    position: relative;
    display: flex;
    background: rgba(15, 23, 42, 0.6);
    border-radius: 16px;
    padding: 6px;
    margin-bottom: 1.75rem;
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .vc-mode-tab {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 14px 20px;
    background: transparent;
    border: none;
    border-radius: 12px;
    color: var(--text-muted);
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    position: relative;
    z-index: 1;
  }

  .vc-mode-tab:hover {
    color: #cbd5e1;
  }

  .vc-mode-tab.active {
    color: white;
  }

  .vc-mode-icon {
    display: flex; /* จัดให้อยู่กึ่งกลาง */
    align-items: center;
    justify-content: center;
    width: 24px; /* กำหนดขนาดให้พอดีกับ SVG */
    height: 24px;
    margin-right: 0.5rem; /* ระยะห่างจากตัวหนังสือ */
    flex-shrink: 0; /* ห้ามหดตัว */
  }

  .vc-mode-icon svg {
    width: 100%;
    height: 100%;
    display: block;
    overflow: visible; /* ⭐ สำคัญ: เพื่อให้เส้นขอบที่เกินออกมานิดหน่อยไม่โดนตัด */
  }

  .vc-mode-slider {
    position: absolute;
    top: 6px;
    left: 6px;
    width: calc(50% - 6px);
    height: calc(100% - 12px);
    background: linear-gradient(135deg, var(--emerald-pri), #059669);
    border-radius: 12px;
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
  }

  .vc-mode-slider.qr {
    transform: translateX(100%);
  }

  /* Success Message */
  .vc-success {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem 1.25rem;
    background: linear-gradient(
      135deg,
      rgba(16, 185, 129, 0.15),
      rgba(16, 185, 129, 0.05)
    );
    border: 1px solid rgba(16, 185, 129, 0.25);
    border-radius: 16px;
    margin-bottom: 1.5rem;
  }

  .vc-success-check {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, var(--emerald-pri), #059669);
    border-radius: 50%;
    color: white;
    flex-shrink: 0;
    animation: vc-check-pop 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }

  @keyframes vc-check-pop {
    0% {
      transform: scale(0);
    }
    50% {
      transform: scale(1.2);
    }
    100% {
      transform: scale(1);
    }
  }

  .vc-success-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .vc-success-label {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--emerald-pri);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .vc-success-name {
    font-size: 1.15rem;
    font-weight: 700;
    color: #f8fafc;
  }

  /* Content Area */
  .vc-content {
    position: relative;
    height: auto; /* สำคัญ: ให้สูงตามลูก */
    min-height: 200px; /* กันบั๊กตอนสลับโหมด */
    overflow: visible; /* เพื่อให้เงาไม่โดนตัด */
    transition: height 0.3s ease; /* (ถ้าอยากให้ยืดหดนุ่มๆ ต้องใช้ JS ช่วย แต่ใส่ไว้ก่อนได้) */
  }

  /* PIN Mode */
  .vc-pin-mode {
    position: relative; /* แก้จาก absolute: ให้ดันความสูงพ่อ */
    width: 100%;

    display: none; /* สำคัญ: ซ่อนแบบคืนพื้นที่ */

    flex-direction: column;
    gap: 0.5rem;

    /* Animation เริ่มต้น */
    opacity: 0;
    transform: translateX(-10px);
  }
  .vc-pin-mode.active {
    display: flex; /* แสดงผล */
    animation: fadeInSlide 0.4s forwards; /* เล่น animation */
  }

  /* Auto Toggle */
  .vc-auto-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    background: rgba(15, 23, 42, 0.5);
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .vc-auto-info {
    display: flex;
    align-items: center;
    gap: 10px;
    color: #94a3b8;
    font-size: 0.95rem;
    font-weight: 500;
  }

  .vc-auto-info svg {
    color: #fbbf24;
  }

  .vc-switch {
    position: relative;
    width: 52px;
    height: 28px;
    background: #475569;
    border: none;
    border-radius: 14px;
    cursor: pointer;
    transition: all 0.3s ease;
    padding: 0;
  }

  .vc-switch.on {
    background: linear-gradient(135deg, var(--emerald-pri), #059669);
  }

  .vc-switch-knob {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 22px;
    height: 22px;
    background: white;
    border-radius: 50%;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  }

  .vc-switch.on .vc-switch-knob {
    transform: translateX(24px);
  }

  /* PIN Input Area */
  .vc-pin-area {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    margin-top: 1.5rem; /* <--- เพิ่มบรรทัดนี้! ปรับเลขได้ตามความสวยงาม (เช่น 20px, 1.5rem) */

    margin-bottom: 1.5rem;
  }

  .vc-pin-row {
    display: flex;
    gap: 10px;
  }

  .vc-pin-cell {
    position: relative;
    width: 56px;
    height: 68px;
    background: rgba(15, 23, 42, 0.7);
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-radius: 14px;
    transition: all 0.25s ease;
    overflow: hidden;
  }

  .vc-pin-cell::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, var(--emerald-pri), transparent);
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .vc-pin-cell.filled {
    border-color: var(--emerald-pri);
    background: rgba(16, 185, 129, 0.08);
  }

  .vc-pin-cell.filled::before {
    opacity: 0.1;
  }

  .vc-pin-cell.focus {
    border-color: var(--emerald-pri);
    box-shadow:
      0 0 0 4px rgba(16, 185, 129, 0.15),
      0 8px 20px rgba(16, 185, 129, 0.1);
    transform: translateY(-3px);
  }

  .vc-pin-cell.error {
    border-color: var(--danger) !important;
    background: rgba(239, 68, 68, 0.08) !important;
    animation: vc-shake 0.4s ease;
  }

  @keyframes vc-shake {
    0%,
    100% {
      transform: translateX(0);
    }
    20%,
    60% {
      transform: translateX(-4px);
    }
    40%,
    80% {
      transform: translateX(4px);
    }
  }

  .vc-pin-input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    background: transparent;
    border: none;
    outline: none;
    text-align: center;
    font-size: 1.75rem;
    font-weight: 700;
    color: #f8fafc;
    caret-color: var(--emerald-pri);
  }

  .vc-pin-input:disabled {
    opacity: 0.5;
  }

  .vc-pin-dot {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 10px;
    height: 10px;
    background: #475569;
    border-radius: 50%;
    pointer-events: none;
  }

  .vc-clear {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    border-radius: 12px;
    color: #f87171;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .vc-clear:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.2);
    transform: scale(1.05);
  }

  .vc-clear:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* Error Message */
  .vc-error-msg {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    gap: 10px;
    padding: 12px 16px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    border-radius: 12px;
    color: #f87171;
    font-size: 0.9rem;
    font-weight: 500;
  }

  .vc-error-msg svg {
    width: 18px !important;
    height: 18px !important;
    min-width: 18px !important;
    min-height: 18px !important;
    flex-shrink: 0 !important;
  }

  /* Submit Button */
  .vc-submit {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    padding: 16px;
    background: linear-gradient(135deg, var(--emerald-pri), #059669);
    border: none;
    border-radius: 14px;
    color: white;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.3s ease;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .vc-submit:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 10px 30px rgba(16, 185, 129, 0.35);
  }

  .vc-submit:disabled {
    background: #475569;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  /* Verifying State */
  .vc-verifying {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 1.5rem;
    color: var(--text-muted);
    font-weight: 500;
  }

  /* Loader */
  .vc-loader {
    width: 20px;
    height: 20px;
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-top-color: currentColor;
    border-radius: 50%;
    animation: vc-spin 0.7s linear infinite;
  }

  .vc-loader.lg {
    width: 32px;
    height: 32px;
    border-width: 3px;
  }

  .vc-loader.sm {
    width: 16px;
    height: 16px;
  }

  @keyframes vc-spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Hint */
  .vc-hint {
    text-align: center;
    color: var(--text-muted);
    font-size: 0.85rem;
    margin: 0;
    padding-top: 0.5rem;
  }

  /* QR Mode */
  .vc-qr-mode {
    position: relative; /* แก้จาก absolute */
    width: 100%;

    display: none; /* ซ่อนแบบคืนพื้นที่ */

    /* Animation เริ่มต้น */
    opacity: 0;
    transform: translateX(10px);
  }

  .vc-qr-mode.active {
    display: block; /* แสดงผล */
    animation: fadeInSlide 0.4s forwards;
  }

  @keyframes fadeInSlide {
    from {
      opacity: 0;
      transform: translateX(10px); /* หรือ -10px แล้วแต่ทิศ */
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  .vc-scanner {
    position: relative;
    width: 100%;
    height: 280px;
    border-radius: 20px;
    overflow: hidden;
    background: #0f172a;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .vc-video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .vc-canvas {
    display: none;
  }

  /* Camera Error */
  .vc-camera-err {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.25rem;
    color: var(--text-muted);
    text-align: center;
    padding: 2rem;
    background: rgba(15, 23, 42, 0.9);
  }

  .vc-camera-err svg {
    color: #64748b;
  }

  .vc-camera-err p {
    margin: 0;
    font-size: 0.95rem;
  }

  .vc-retry {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 24px;
    background: rgba(16, 185, 129, 0.15);
    border: 1px solid rgba(16, 185, 129, 0.3);
    border-radius: 12px;
    color: var(--emerald-pri);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .vc-retry:hover {
    background: rgba(16, 185, 129, 0.25);
    transform: translateY(-2px);
  }

  /* Scanner Overlay */
  .vc-scan-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.4);
  }

  .vc-scan-frame {
    position: relative;
    width: 70%;
    aspect-ratio: 1;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 24px;
    transition: all 0.3s ease;
  }

  .vc-scan-frame.active {
    border-color: var(--emerald-pri);
    box-shadow:
      0 0 40px rgba(16, 185, 129, 0.2),
      inset 0 0 40px rgba(16, 185, 129, 0.05);
  }

  .vc-frame-corner {
    position: absolute;
    width: 28px;
    height: 28px;
    border-color: var(--emerald-pri);
    border-style: solid;
  }

  .vc-frame-corner.tl {
    top: -2px;
    left: -2px;
    border-width: 4px 0 0 4px;
    border-radius: 20px 0 0 0;
  }
  .vc-frame-corner.tr {
    top: -2px;
    right: -2px;
    border-width: 4px 4px 0 0;
    border-radius: 0 20px 0 0;
  }
  .vc-frame-corner.bl {
    bottom: -2px;
    left: -2px;
    border-width: 0 0 4px 4px;
    border-radius: 0 0 0 20px;
  }
  .vc-frame-corner.br {
    bottom: -2px;
    right: -2px;
    border-width: 0 4px 4px 0;
    border-radius: 0 0 20px 0;
  }

  .vc-scan-beam {
    position: absolute;
    left: 8%;
    right: 8%;
    height: 3px;
    background: linear-gradient(
      90deg,
      transparent,
      var(--emerald-pri),
      transparent
    );
    border-radius: 3px;
    box-shadow:
      0 0 20px var(--emerald-pri),
      0 0 40px var(--emerald-pri);
    animation: vc-beam 2s ease-in-out infinite;
  }

  @keyframes vc-beam {
    0%,
    100% {
      top: 8%;
    }
    50% {
      top: 88%;
    }
  }

  /* Scan Status */
  .vc-scan-status {
    position: absolute;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 20px;
    border-radius: 25px;
    font-size: 0.9rem;
    font-weight: 600;
    backdrop-filter: blur(10px);
  }

  .vc-scan-status.active {
    background: rgba(16, 185, 129, 0.2);
    border: 1px solid rgba(16, 185, 129, 0.3);
    color: var(--emerald-pri);
  }

  .vc-scan-status.verifying {
    background: rgba(59, 130, 246, 0.2);
    border: 1px solid rgba(59, 130, 246, 0.3);
    color: #60a5fa;
  }

  .vc-pulse-dot {
    width: 10px;
    height: 10px;
    background: var(--emerald-pri);
    border-radius: 50%;
    animation: vc-pulse 1.5s ease-in-out infinite;
  }

  @keyframes vc-pulse {
    0%,
    100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.5;
      transform: scale(0.8);
    }
  }

  /* Responsive */
  @media (max-width: 480px) {
    .vc-container {
      padding: 0 0.75rem;
    }

    .vc-main-card {
      padding: 1.5rem;
      border-radius: 20px;
    }

    .vc-icon-wrapper {
      width: 60px;
      height: 60px;
    }

    .vc-icon-wrapper svg {
      width: 26px;
      height: 26px;
    }

    .vc-title {
      font-size: 1.25rem;
    }

    .vc-mode-tab {
      padding: 12px 16px;
      font-size: 0.9rem;
    }

    .vc-pin-cell {
      width: 48px;
      height: 60px;
    }

    .vc-pin-input {
      font-size: 1.5rem;
    }

    .vc-pin-row {
      gap: 8px;
    }

    .vc-clear {
      width: 42px;
      height: 42px;
    }
  }
  /* FILTER BAR */
  .filter-slide-wrapper {
    overflow: visible;
    margin-bottom: 2rem;
    position: relative;
    z-index: 500; /* เพิ่มบรรทัดนี้ - สูงมาก */
  }
  .filter-bar-container {
    width: 100%;
    display: flex;
    justify-content: center;
    position: relative;
    z-index: 500;
  }
  .filter-bar {
    display: flex;
    gap: 0.75rem;
    background: rgba(30, 41, 59, 0.6);
    padding: 0.8rem;
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(12px);
    width: 100%;
    max-width: 850px;
    align-items: center;
    flex-wrap: nowrap;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
    z-index: 500;
  }
  .search-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    background: #0f172a;
    border-radius: 14px;
    padding: 0 1rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
    flex-grow: 2;
    min-width: 200px;
  }
  .search-icon {
    width: 18px;
    height: 18px;
    color: var(--text-muted);
    margin-right: 0.75rem;
    flex-shrink: 0;
  }
  .search-input-wrapper input {
    background: transparent;
    border: none;
    color: white;
    padding: 12px 0;
    width: 100%;
    outline: none;
    font-size: 0.9rem;
  }

  .perf-monitor {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 6px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    cursor: pointer;
    transition: all 0.3s ease;
  }
  .perf-monitor:hover {
    border-color: rgba(16, 185, 129, 0.3);
    background: rgba(0, 0, 0, 0.4);
  }
  .perf-graph {
    width: 35px;
    height: 24px;
    overflow: hidden;
  }
  .perf-graph svg {
    width: 100%;
    height: 100%;
  }
  .perf-stats {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .perf-latency {
    font-family: monospace;
    font-size: 0.75rem;
    font-weight: 600;
    min-width: 42px;
    text-align: right;
  }
  .perf-latency.good {
    color: #10b981;
  }
  .perf-latency.warning {
    color: #f59e0b;
  }
  .perf-latency.bad {
    color: #ef4444;
  }

  .perf-status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    animation: pulse 2s infinite;
  }
  .perf-status-dot.connected {
    background: #10b981;
    box-shadow: 0 0 8px rgba(16, 185, 129, 0.5);
  }
  .perf-status-dot.slow {
    background: #f59e0b;
    box-shadow: 0 0 8px rgba(245, 158, 11, 0.5);
    animation: pulse-warning 1.5s infinite;
  }
  .perf-status-dot.disconnected {
    background: #ef4444;
    box-shadow: 0 0 8px rgba(239, 68, 68, 0.5);
    animation: pulse-danger 1s infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.7;
      transform: scale(0.9);
    }
  }
  @keyframes pulse-warning {
    0%,
    100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.5;
      transform: scale(0.85);
    }
  }
  @keyframes pulse-danger {
    0%,
    100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.3;
      transform: scale(0.8);
    }
  }

  .perf-tooltip {
    position: absolute;
    top: calc(100% + 10px);
    right: 0;
    width: 240px;
    padding: 12px;
    background: rgba(30, 41, 59, 0.98);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
    z-index: 1000;
    backdrop-filter: blur(10px);
  }
  .perf-tooltip-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.85rem;
    font-weight: 600;
    color: #f8fafc;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }
  .perf-tooltip-header svg {
    color: #10b981;
  }
  .perf-tooltip-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.8rem;
    color: #94a3b8;
    margin-bottom: 6px;
  }
  .perf-tooltip-divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.1);
    margin: 10px 0;
  }
  .perf-value {
    font-family: monospace;
    font-weight: 600;
    color: #f8fafc;
  }
  .perf-value.good {
    color: #10b981;
  }
  .perf-value.warning {
    color: #f59e0b;
  }
  .perf-value.bad {
    color: #ef4444;
  }

  .perf-status-text {
    font-weight: 600;
  }
  .perf-status-text.connected {
    color: #10b981;
  }
  .perf-status-text.slow {
    color: #f59e0b;
  }
  .perf-status-text.disconnected {
    color: #ef4444;
  }

  .perf-tooltip-chart {
    margin-top: 10px;
    height: 50px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
    overflow: hidden;
    padding: 4px;
  }
  .perf-tooltip-chart svg {
    width: 100%;
    height: 100%;
  }

  .search-toggle-btn {
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.2);
    color: #10b981;
    padding: 8px 12px;
    border-radius: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.85rem;
    transition: all 0.2s;
    flex-shrink: 0;
    position: relative;
    z-index: 1100; /* เพิ่มบรรทัดนี้ */
  }

  .search-toggle-btn:hover {
    background: rgba(16, 185, 129, 0.15);
    border-color: rgba(16, 185, 129, 0.4);
    transform: scale(1.05);
  }

  .search-toggle-btn.active {
    background: #10b981;
    color: white;
    border-color: #10b981;
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
  }

  .search-toggle-btn svg {
    flex-shrink: 0;
  }
  .filter-actions-wrapper {
    display: flex;
    gap: 0.75rem;
    flex-shrink: 0;
    align-items: center;
  }
  .filter-group-dropdowns {
    display: flex;
    gap: 0.75rem;
  }
  .custom-select-container {
    position: relative;
    min-width: 110px;
    z-index: 600;
  }
  .select-trigger {
    width: 100%;
    background: #0f172a;
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: var(--text-pure);
    padding: 10px 14px;
    border-radius: 14px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    font-size: 0.85rem;
    white-space: nowrap;
  }
  .select-trigger:hover {
    border-color: var(--emerald-pri);
  }
  .chevron-icon {
    transition: transform 0.3s;
    opacity: 0.6;
    flex-shrink: 0;
    margin-left: 6px;
  }
  .chevron-icon.rotated {
    transform: rotate(180deg);
  }
  .dropdown-wrapper {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    right: 0;
    background: #1e293b;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 14px;
    z-index: 700;
    box-shadow: 0 15px 30px rgba(0, 0, 0, 0.4);
    overflow: hidden;
    min-width: 120px;
  }
  .dropdown-scroll-area {
    max-height: 250px;
    overflow-y: auto;
  }
  .option-btn {
    width: 100%;
    padding: 10px 14px;
    background: transparent;
    border: none;
    color: var(--text-muted);
    text-align: left;
    cursor: pointer;
    font-size: 0.85rem;
    display: block;
  }
  .option-btn:hover {
    background: rgba(16, 185, 129, 0.1);
    color: var(--emerald-pri);
  }
  .option-btn.selected {
    color: var(--emerald-pri);
    background: rgba(16, 185, 129, 0.05);
    font-weight: 600;
  }
  .search-apply-btn {
    background: var(--emerald-pri);
    color: var(--bg-deep);
    border: none;
    padding: 0 1.5rem;
    border-radius: 14px;
    font-weight: 700;
    font-size: 0.85rem;
    cursor: pointer;
    transition: 0.2s;
    white-space: nowrap;
    height: 100%;
    min-height: 42px;
  }
  .search-apply-btn:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  /* GRID */
  .grid-section {
    margin-top: 1rem;
  }

  .empty-state {
    text-align: center;
    padding: 4rem;
    color: var(--text-muted);
    opacity: 0.6;
  }

  .grid-section,
  .logs-container .events-selection,
  .grid-section .grid,
  .events-selection .grid {
    margin-top: 0;
  }

  .grid-section,
  .logs-container,
  .grid {
    margin-top: 1.5rem;
  }

  .empty-state-custom {
    text-align: center;
    padding: 5rem 2rem;
    color: var(--text-muted);
  }

  .empty-state-custom svg {
    margin: 0 auto 1.5rem;
    opacity: 0.3;
  }

  .logs-search-input {
    flex: 1;
    background: transparent !important;
    border: none !important;
    color: #f8fafc !important;
    padding: 0.75rem 0 !important;
    font-size: 0.9rem !important;
    outline: none !important;
    pointer-events: auto !important;
    cursor: text !important;
  }

  .logs-nisit-input {
    width: 100%;
    background: transparent !important;
    border: none !important;
    color: #f8fafc !important;
    padding: 0.625rem 0 !important;
    font-size: 0.85rem !important;
    outline: none !important;
    text-align: center;
    letter-spacing: 1px;
    pointer-events: auto !important;
    cursor: text !important;
  }

  
  .grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr); /* บังคับ 4 คอลัมน์เท่ากัน */
    gap: 1.5rem;
  }

  /* Responsive */
  @media (max-width: 1200px) {
    .grid {
      grid-template-columns: repeat(3, 1fr); /* 3 คอลัมน์ */
    }
  }

  @media (max-width: 900px) {
    .grid {
      grid-template-columns: repeat(2, 1fr); /* 2 คอลัมน์ */
    }

    .mobile-only {
      display: flex;
    }
    .mobile-controls.mobile-only {
      display: flex !important;
    }
    .mobile-toggle {
      display: block;
    }
  }
  @media (max-width: 600px) {
    .grid {
      grid-template-columns: 1fr; /* 1 คอลัมน์ */
    }
  }
  .glass-card {
    background: var(--bar-dark);
    padding: 0;
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.05);
    transition: 0.3s;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    height: 100%; /* เพิ่มบรรทัดนี้ */
    min-height: auto !important;
  }

  .glass-card .card-body {
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex: 1;
    min-height: 420px; /* กำหนดความสูงขั้นต่ำ */
  }

  /* ✅ Bottom section - อยู่ล่างสุดเสมอ */
  .card-bottom-section {
    margin-top: auto;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .card-header {
    min-height: 45px; /* กำหนดความสูงของ header ให้คงที่ */
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }

  .card-header h3 {
    flex: 1;
    margin: 0;
    font-size: 1.05rem;
    line-height: 1.4;
    color: #fff;
    font-weight: 600;
    display: -webkit-box;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
    max-height: 2.8em; /* ความสูงของ 2 บรรทัด */
  }

  .showing-text {
    text-align: center;
    color: #64748b;
    font-size: 0.85rem;
    margin-top: 1rem;
  }

  .event-simple-meta {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
    min-height: 80px; /* ความสูงคงที่สำหรับ meta */
  }

  .event-description-short {
    font-size: 0.8rem;
    color: #94a3b8;
    line-height: 1.5;
    margin: 0.75rem 0 0.75rem 0; /* ปรับตรงนี้ เพิ่ม margin-top */
    display: -webkit-box;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .events-selection .event-description-short {
    margin-top: 0.88rem; /* ระยะห่างจาก title */
  }

  .capacity-progress {
    margin-bottom: 0.35rem !important;
  }

  .capacity-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.35rem;
  }

  .capacity-text {
    font-size: 0.8rem;
    color: #94a3b8;
  }

  .capacity-percent {
    font-size: 0.8rem;
    font-weight: 600;
    color: #10b981;
  }

  .glass-card:hover {
    transform: translateY(-5px);
    border-color: rgba(16, 185, 129, 0.2);
  }

  .card-img-wrapper {
    position: relative;
    width: 100%;
    height: 200px; /* ปรับตรงนี้ เช่น 150px, 200px, 220px */
    overflow: hidden;
  }
  .card-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: 0.3s;
  }
  .glass-card:hover .card-img {
    transform: scale(1.05);
  }

  /* เอฟเฟกต์ซูมเมื่อเอาเมาส์ชี้การ์ด */
  .glass-card:hover .card-img {
    transform: scale(1.05);
  }

  .card-body {
    padding: 1rem;
    display: flex;
    flex-direction: column;
    flex: 1;
    gap: 0.5rem !important; /* ← ลด gap */
    min-height: auto !important;
  }
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }

  .card-header h3 {
    flex: 1;
    margin: 0;
    font-size: 1.05rem;
    line-height: 1.4;
    color: #fff;
  }

  .status-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: flex-end;
    flex-shrink: 0;
  }

  /* Status Badge */
  .status-badge {
    display: inline-flex;
    align-items: center;
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border: 1px solid;
    white-space: nowrap;
  }

  .status-badge.status-active {
    background: rgba(16, 185, 129, 0.15);
    border-color: rgba(16, 185, 129, 0.4);
    color: #10b981;
  }

  .status-badge.status-closed {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.4);
    color: #ef4444;
  }

  .status-badge.status-draft {
    background: rgba(245, 158, 11, 0.15);
    border-color: rgba(245, 158, 11, 0.4);
    color: #f59e0b;
  }

  .quick-msg-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 0.75rem;
    background: rgba(100, 116, 139, 0.1);
    border: 1px solid rgba(100, 116, 139, 0.3);
    border-radius: 8px;
    color: #94a3b8;
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .quick-msg-btn:hover {
    background: rgba(100, 116, 139, 0.2);
    transform: translateY(-1px);
  }

  .quick-msg-btn svg {
    flex-shrink: 0;
  }

  /* Participants Badge */
  .participants-badge {
    /* ใช้สไตล์เดียวกับ status badge */
    display: inline-flex;
    padding: 4px 8px;
    border-radius: 10px;
    font-size: 0.7rem;
    font-weight: 600;
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.3);
    color: #3b82f6;
  }

  .participants-badge svg {
    flex-shrink: 0;
  }
  .loc-text,
  .date-text {
    color: var(--text-muted);
    font-size: 0.85rem;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  /* Reward Status Pills */
  .reward-status-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.6rem;
    border-radius: 20px;
    font-size: 0.7rem;
    font-weight: 600;
  }

  .reward-status-pill.completed {
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
  }

  .reward-status-pill.in-progress {
    background: rgba(59, 130, 246, 0.15);
    color: #3b82f6;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-shrink: 0;
  }

  .btn-icon-action {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: rgba(100, 116, 139, 0.1);
    border: 1px solid rgba(100, 116, 139, 0.3);
    border-radius: 10px;
    color: #94a3b8;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-icon-action:hover {
    background: rgba(100, 116, 139, 0.2);
    color: #f8fafc;
  }

  .btn-send-all {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0 1rem;
    height: 36px;
    background: transparent;
    border: 1px solid #10b981;
    border-radius: 10px;
    color: #10b981;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .btn-send-all:hover {
    background: rgba(16, 185, 129, 0.1);
  }

  .btn-send-all:hover:not(:disabled) {
    background: rgba(16, 185, 129, 0.2);
    border-color: #10b981;
    transform: translateY(-2px);
  }

  .export-dropdown-wrapper {
    position: relative;
  }
  .reward-status-pill.no-tier {
    background: rgba(100, 116, 139, 0.15);
    color: #64748b;
  }

  /* Export menu z-index fix */
  .export-dropdown-wrapper {
    position: relative;
    z-index: 100;
  }

  .export-menu {
    z-index: 1000;
  }
  .action-btn {
    padding: 0.75rem 1rem;
    border-radius: 12px;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    flex: 1;
  }
  .action-btn:hover {
    background: var(--emerald-pri);
    color: white;
  }

  .glass-card .action-btn,
  .grid .action-btn,
  .events-selection .action-btn {
    padding: 0.75rem 1rem !important;
    border-radius: 12px !important;
    font-size: 0.9rem !important;
    font-weight: 600 !important;
    gap: 0.5rem !important;
  }

  /* ========================================== */
  /* ✅ Event Meta Grid (เรียงสวยงาม) */
  /* ========================================== */

  .event-meta-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 0.75rem;
  }

  .meta-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 10px;
    background: rgba(100, 116, 139, 0.08);
    border: 1px solid rgba(100, 116, 139, 0.15);
    border-radius: 8px;
    font-size: 0.8rem;
    color: #cbd5e1;
    transition: all 0.2s;
  }

  .meta-item:hover {
    background: rgba(100, 116, 139, 0.12);
    border-color: rgba(100, 116, 139, 0.25);
  }

  .meta-item svg {
    flex-shrink: 0;
    color: #94a3b8;
  }

  .meta-item span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.3;
  }

  /* Highlight Meta Item (Rewards) */
  .meta-item.meta-highlight {
    background: rgba(245, 158, 11, 0.08);
    border-color: rgba(245, 158, 11, 0.2);
    color: #f59e0b;
  }

  .meta-item.meta-highlight svg {
    color: #f59e0b;
  }

  .progress-bar {
    height: 6px;
    background: #334155;
    border-radius: 3px;
    overflow: hidden;
  }

  /* ========================================== */
  /* ✅ Capacity Progress Bar */
  /* ========================================== */

  .action-buttons {
    display: flex;
    flex-direction: column;
    gap: 1rem; /* ปรับตรงนี้ ลดจาก 0.85rem เป็น 0.5rem */
    margin-top: auto;
  }

  .grid .action-buttons {
    gap: 1rem !important; /* ให้เท่ากัน */
  }

  /* สไตล์ปุ่มพื้นฐาน */
  .action-btn {
    padding: 0.5rem 0.875rem;
    border-radius: 10px;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    flex: 1;
  }

  /* ปุ่ม View Details (สีเขียว Theme หลัก) */
  .btn-view {
    background: transparent;
    border: 1px solid rgba(16, 185, 129, 0.4);
    color: #10b981;
    box-shadow: none;
  }

  .btn-view:hover {
    background: rgba(16, 185, 129, 0.1);
    border-color: #10b981;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
  }

  /* กล่องคลุมปุ่มเล็ก (เรียงแนวนอน) */
  .small-actions {
    display: flex;
    gap: 10px;
  }

  /* ปุ่ม Edit (สีเหลือง/ส้ม) */
  .btn-edit {
    background: rgba(251, 191, 36, 0.1);
    border: 1px solid rgba(251, 191, 36, 0.3);
    color: #fbbf24;
    gap: 0px;
  }

  .btn-edit:hover {
    background: rgba(251, 191, 36, 0.2);
    border-color: #fbbf24;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(251, 191, 36, 0.3);
  }

  /* ปุ่ม Delete (สีแดง) */
  .btn-delete {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #ef4444;
  }

  .btn-delete:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: #ef4444;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
  }

  /* PAGINATION */
  .pagination-controls {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 1rem;
    margin-top: 2rem;
    flex-wrap: wrap;
  }

  .page-indicator-box {
    background: var(--bar-dark);
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 10px 20px;
    border-radius: 12px;
    color: var(--text-muted);
    font-size: 0.9rem;
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }
  .page-indicator-box:hover {
    border-color: var(--emerald-pri);
  }
  .current-page {
    color: var(--text-pure);
    font-weight: bold;
  }
  .dropdown-arrow {
    transition: transform 0.2s;
  }
  .dropdown-arrow.flipped {
    transform: rotate(180deg);
  }
  .page-dropdown-list {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-bottom: 8px;
    background: #1e293b;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    max-height: 200px;
    overflow-y: auto;
    width: 120px;
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.5);

    z-index: 9999 !important; /* 🔥 สูงที่สุด (ต้องมากกว่า click-outside) */
  }
  .page-option {
    width: 100%;
    padding: 8px;
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 0.85rem;
  }
  .page-option:hover {
    background: rgba(255, 255, 255, 0.05);
    color: white;
  }
  .page-option.active {
    color: var(--emerald-pri);
    font-weight: bold;
    background: rgba(16, 185, 129, 0.1);
  }
  .click-outside {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: transparent; /* สีใส */
    cursor: default;
    z-index: 9998 !important; /* 🔥 สูงเกือบสุด */
  }
  .page-info {
    text-align: center;
    margin-top: 1rem;
    color: var(--text-muted);
    font-size: 0.8rem;
    width: 100%;
  }

  /* RESPONSIVE */
  .mobile-only {
    display: none;
  }
  .mobile-toggle {
    display: none;
  }

  .modal-content-wrapper {
    text-align: left;
  }
  /* 2. ปรับความสูงรูปให้เตี้ยลงหน่อย (จะได้ไม่ดูใหญ่เทอะทะ) */
  .modal-img-container {
    width: 100%;
    height: 160px; /* ✅ ลดความสูงรูปลง (จาก 220px -> 160px) */
    position: relative;
    margin: 0;
    padding: 0;
    display: block; /* แก้บั๊กรูปมีขอบล่าง */
  }

  .modal-main-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    /* ✅ บังคับมุมโค้งด้านบนให้รูปด้วย (กันเหนียว) */
    border-top-left-radius: 19px;
    border-top-right-radius: 19px;
  }
  .modal-status-badge {
    position: absolute;
    top: 15px;
    right: 15px;
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 0.8rem;
    font-weight: bold;
    color: white;
    text-transform: uppercase;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
  }
  .modal-status-badge.active {
    background: var(--emerald-pri);
  }
  .modal-status-badge.closed {
    background: var(--danger);
  }

  .modal-body-text {
    padding: 1.5rem;
  }
  .modal-title {
    margin: 0 0 0.8rem 0;
    font-size: 1.6rem;
    color: var(--emerald-pri);
    line-height: 1.3;
  }
  .modal-meta {
    display: flex;
    gap: 1rem;
    color: var(--text-muted);
    font-size: 0.9rem;
    margin-bottom: 1rem;
  }
  .modal-divider {
    border: 0;
    height: 1px;
    background: rgba(255, 255, 255, 0.1);
    margin: 1rem 0;
  }
  .modal-desc {
    line-height: 1.6;
    color: #e2e8f0;
    font-size: 0.95rem;
    margin: 0;
  }

  .meta-item {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(255, 255, 255, 0.03);
    padding: 8px 12px;
    border-radius: 8px;
  }

  .modal-divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.1);
    margin-bottom: 1.5rem;
  }

  .modal-img-container {
    width: 100%;
    height: 160px; /* ความสูงของรูป */
    position: relative;
    margin: 0;
    padding: 0;
    display: block;
  }

  /* 2. บังคับรูปภาพให้ยืดเต็มกรอบและตัดมุม (ถ้าไม่มีบรรทัดนี้ รูปล้นแน่นอน) */
  .modal-main-img {
    width: 100%;
    height: 100%;
    object-fit: cover; /* ตัดส่วนเกินของรูปทิ้ง */
    display: block;
    /* บังคับตัดมุมบนซ้าย-ขวาให้โค้งตามกรอบ */
    border-top-left-radius: 19px;
    border-top-right-radius: 19px;
  }

  /* 3. จัดระยะห่างเนื้อหาด้านล่างให้สวยงาม */
  .modal-body-text {
    padding: 1.25rem 1.5rem;
    text-align: left;
  }

  .modal-title {
    margin: 0 0 0.5rem 0;
    font-size: 1.3rem;
    color: var(--emerald-pri);
    line-height: 1.2;
  }

  .modal-meta {
    display: flex;
    gap: 0.8rem;
    color: var(--text-muted);
    font-size: 0.85rem;
    margin-bottom: 0.8rem;
  }

  .modal-divider {
    border: 0;
    height: 1px;
    background: rgba(255, 255, 255, 0.1);
    margin: 0.8rem 0;
  }

  .modal-desc-scroll {
    max-height: 100px;
    overflow-y: auto;
    padding-right: 5px;
  }

  .modal-desc {
    line-height: 1.5;
    color: #e2e8f0;
    font-size: 0.9rem;
    margin: 0;
  }

  /* ป้ายสถานะบนรูป */
  .modal-status-badge {
    position: absolute;
    top: 10px;
    right: 10px;
    padding: 4px 10px;
    border-radius: 20px;
    font-size: 0.7rem;
    font-weight: bold;
    color: white;
    text-transform: uppercase;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
  }
  .modal-status-badge.active {
    background: var(--emerald-pri);
  }
  .modal-status-badge.closed {
    background: var(--danger);
  }

  .app-footer {
    margin-top: auto;
    padding-top: 4rem;
    padding-bottom: 2rem;
    text-align: center;
    width: 100%;
  }

  .footer-divider {
    height: 1px;
    width: 100%;
    max-width: 200px; /* ขีดเส้นคั่นเล็กๆ ไม่ต้องยาวมาก */
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.1),
      transparent
    );
    margin: 0 auto 1.5rem auto; /* จัดกึ่งกลางและเว้นระยะ */
  }

  .copyright {
    color: var(--text-muted);
    font-size: 0.85rem;
    margin: 0 0 0.5rem 0;
  }

  .credits {
    color: #64748b; /* สีเทาเข้มกว่านิดนึง */
    font-size: 0.8rem;
    margin: 0;
  }

  .dev-name {
    color: var(--emerald-pri); /* ใส่สีเขียวให้ชื่อผู้พัฒนาเด่นขึ้น */
    font-weight: 500;
    letter-spacing: 0.5px;
  }

  .footer-email {
    color: #94a3b8; /* สีเทาอ่อน */
    text-decoration: none; /* เอาขีดเส้นใต้ออก */
    font-weight: 500;
    transition: color 0.2s ease;
  }

  .footer-email:hover {
    color: var(--emerald-pri); /* ชี้แล้วเปลี่ยนเป็นสีเขียวหลัก */
    text-decoration: underline; /* ชี้แล้วมีขีดเส้นใต้ */
  }

  .create-event-wrapper {
    max-width: 1100px;
    margin: 0 auto;
    width: 100%;
    padding-bottom: 4rem; /* เว้นระยะด้านล่างไม่ให้ชิด Footer เกินไป */
  }

  /* ส่วนหัว (Header) */
  .create-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
  }

  .section-title {
    font-size: 2rem;
    font-weight: 700;
    color: #fff;
    /* ไล่สีตัวหนังสือให้ดูพรีเมียม */
    background: linear-gradient(to right, #fff, #94a3b8);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .btn-back {
    background: transparent;
    border: 1px solid #334155;
    color: #94a3b8;
    padding: 0.6rem 1.5rem;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    font-weight: 500;
  }

  .btn-back:hover {
    border-color: #fff;
    color: #fff;
    background: rgba(255, 255, 255, 0.05);
  }

  /* การ์ดฟอร์ม (แบ่งครึ่งซ้าย-ขวา) */
  .create-card {
    background: #1e293b; /* สีพื้นหลังโทนน้ำเงินเข้ม */
    border: 1px solid #334155;
    border-radius: 20px;
    overflow: hidden;
    display: grid;
    grid-template-columns: 400px 1fr; /* ซ้าย 400px, ขวาคือพื้นที่ที่เหลือ */
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4); /* เงาลอยๆ */
  }

  /* --- ฝั่งซ้าย: อัปโหลดรูปภาพ --- */
  .image-upload-section {
    background: #0f172a; /* สีเข้มกว่าการ์ดนิดนึง */
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    position: relative;
    border-right: 1px solid #334155;
    transition: background 0.3s ease;
    min-height: 500px; /* ความสูงขั้นต่ำ */
  }

  .image-upload-section:hover {
    background: #152035; /* เปลี่ยนสีตอนเอาเมาส์ชี้ */
  }

  /* ข้อความและไอคอนตอนยังไม่มีรูป */
  .upload-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.2rem;
    color: #64748b;
  }

  .icon-circle {
    width: 70px;
    height: 70px;
    border-radius: 50%;
    background: rgba(16, 185, 129, 0.1);
    color: var(--emerald-pri); /* ใช้สีเขียวหลัก */
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 20px rgba(16, 185, 129, 0.1);
  }

  .upload-text {
    font-size: 1.1rem;
    font-weight: 600;
    color: #cbd5e1;
  }

  .upload-hint {
    font-size: 0.85rem;
    opacity: 0.7;
  }

  /* แสดงรูปภาพตัวอย่าง */
  .preview-img {
    width: 100%;
    height: 100%;
    object-fit: cover; /* ขยายเต็มพื้นที่ */
    display: block;
  }

  /* Overlay ตอนมีรูปแล้ว (เพื่อให้รู้ว่ากดเปลี่ยนได้) */
  .overlay-edit {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 600;
    opacity: 0;
    transition: opacity 0.2s ease;
    backdrop-filter: blur(2px);
  }

  .form-section {
    padding: 3rem;
    display: flex;
    flex-direction: column;
    gap: 1.8rem;
  }

  /* จัด Layout แถวคู่ (วันที่-เวลา) */
  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
  }

  /* ไอคอนในช่อง Input (Location) */
  .input-icon-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .input-icon {
    position: absolute;
    right: 1rem;
    color: #64748b;
    pointer-events: none;
  }

  /* ปุ่ม Save (Publish) */
  .btn-save {
    width: 100%;
    background: linear-gradient(135deg, var(--emerald-pri), var(--teal-sec));
    color: white;
    border: none;
    padding: 1rem;
    border-radius: 10px;
    font-weight: 700;
    font-size: 1.05rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.8rem;
    cursor: pointer;
    margin-top: 1rem;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  .btn-save:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 25px rgba(16, 185, 129, 0.4); /* เงาเขียวเรืองแสง */
  }

  .btn-save:active {
    transform: translateY(0);
  }

  /* --- Responsive Layout (มือถือ) --- */
  @media (max-width: 900px) {
    .create-card {
      grid-template-columns: 1fr; /* เปลี่ยนเป็นแนวตั้งเรียงลงมา */
    }

    .image-upload-section {
      height: 300px; /* ลดความสูงรูปลง */
      min-height: auto;
      border-right: none;
      border-bottom: 1px solid #334155;
    }

    .form-section {
      padding: 2rem 1.5rem;
    }
  }

  .event-simple-meta {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .meta-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    color: #94a3b8;
  }

  .meta-row svg {
    flex-shrink: 0;
    color: #64748b;
  }

  .meta-row span {
    line-height: 1.4;
  }
  /* Status Badge with Participants */
  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border: 1px solid;
    white-space: nowrap;
  }

  .status-badge svg {
    flex-shrink: 0;
  }

  .ce-options-calendar {
    max-height: 400px;
    padding: 12px;
  }
  .ce-month-group {
    margin-bottom: 20px;
  }
  .ce-month-group:last-child {
    margin-bottom: 0;
  }
  .ce-month-header {
    font-weight: 700;
    font-size: 0.95rem;
    color: #10b981;
    padding: 8px 12px;
    background: rgba(16, 185, 129, 0.1);
    border-radius: 8px;
    margin-bottom: 12px;
    text-align: center;
    border: 1px solid rgba(16, 185, 129, 0.2);
  }
  .ce-date-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 6px;
  }
  .ce-date-item {
    aspect-ratio: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    position: relative;
    padding: 4px;
    min-height: 50px;
  }
  .ce-date-item:hover {
    background: rgba(16, 185, 129, 0.1);
    border-color: #10b981;
    transform: translateY(-2px);
  }
  .ce-date-item.selected {
    background: #10b981;
    border-color: #10b981;
    color: white;
  }
  .ce-date-item.weekend {
    background: rgba(239, 68, 68, 0.05);
    border-color: rgba(239, 68, 68, 0.2);
  }
  .ce-date-item.weekend.selected {
    background: #10b981;
    border-color: #10b981;
  }
  .ce-date-day {
    font-size: 1.1rem;
    font-weight: 700;
    line-height: 1;
  }

  .target-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 0.75rem;
    background: rgba(100, 116, 139, 0.1);
    border: 1px solid rgba(100, 116, 139, 0.3);
    border-radius: 8px;
    color: #94a3b8;
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .target-btn:hover {
    background: rgba(100, 116, 139, 0.2);
  }

  .target-btn.active {
    background: rgba(16, 185, 129, 0.15);
    border-color: #10b981;
    color: #10b981;
  }
  .ce-date-name {
    font-size: 0.65rem;
    opacity: 0.7;
    margin-top: 2px;
    text-transform: uppercase;
  }
  .ce-check-mark {
    position: absolute;
    top: 2px;
    right: 2px;
    font-size: 0.7rem;
    background: white;
    color: #10b981;
    border-radius: 50%;
    width: 14px;
    height: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
  }

  .ce-wrapper {
    max-width: 1100px;
    margin: 0 auto;
    width: 100%;
    padding-bottom: 3rem;
    font-family:
      "Inter",
      system-ui,
      -apple-system,
      sans-serif;
    animation: ceFade 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .ce-container {
    background: linear-gradient(145deg, #1e293b 0%, #0f172a 100%);
    border: 1px solid #334155;
    border-radius: 24px;
    padding: 2.5rem;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    position: relative;
    overflow: hidden;
  }
  .ce-container::before {
    content: "";
    position: absolute;
    top: -50%;
    right: -20%;
    width: 500px;
    height: 500px;
    background: radial-gradient(
      circle,
      rgba(16, 185, 129, 0.08) 0%,
      transparent 70%
    );
    border-radius: 50%;
    pointer-events: none;
  }
  .ce-container::after {
    content: "";
    position: absolute;
    bottom: -30%;
    left: -15%;
    width: 400px;
    height: 400px;
    background: radial-gradient(
      circle,
      rgba(59, 130, 246, 0.06) 0%,
      transparent 70%
    );
    border-radius: 50%;
    pointer-events: none;
  }
  @keyframes ceFade {
    from {
      opacity: 0;
      transform: translateY(15px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  .ce-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2.5rem;
    position: relative;
    z-index: 10;
    gap: 15px;
    flex-wrap: wrap;
  }

  .ce-header-right {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }

  .ce-validation-alert {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.4);
    color: #fca5a5;
    padding: 8px 14px;
    border-radius: 10px;
    font-size: 0.8rem;
    font-weight: 600;
    animation: ceSlideIn 0.3s ease;
    white-space: nowrap;
    box-shadow: 0 2px 8px rgba(239, 68, 68, 0.2);
  }

  @keyframes ceSlideIn {
    from {
      opacity: 0;
      transform: translateX(-10px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .ce-alert-icon {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    color: #ef4444;
    stroke-width: 2;
  }

  .ce-alert-text {
    white-space: nowrap;
    line-height: 1.2;
  }

  .ce-header-actions {
    display: flex;
    gap: 10px;
  }
  .ce-title {
    font-size: 2rem;
    font-weight: 800;
    background: linear-gradient(135deg, #f8fafc 0%, #94a3b8 100%);
    background-clip: text;
    -webkit-text-fill-color: transparent;
    margin: 0;
    letter-spacing: -0.5px;
  }
  .ce-header-actions {
    display: flex;
    gap: 12px;
  }
  .ce-btn-cancel {
    background: transparent;
    border: 1px solid #475569;
    color: #94a3b8;
    padding: 0.7rem 1.5rem;
    border-radius: 12px;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.2s;
  }
  .ce-btn-cancel:hover {
    border-color: #e2e8f0;
    color: #e2e8f0;
  }
  .ce-btn-save {
    background: linear-gradient(135deg, #10b981, #059669);
    border: none;
    color: white;
    padding: 0.7rem 2rem;
    border-radius: 12px;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
    transition: all 0.2s;
  }
  .ce-btn-save:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
  }
  /* --- 2. Grid System --- */
  .ce-grid-layout {
    display: flex;
    flex-direction: column;
    gap: 24px;
    max-width: 900px;
    margin: 0 auto;
    position: relative;
    z-index: 10;
  }
  .ce-card {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 20px;
    padding: 24px;
    position: relative;
    box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.3);
    overflow: visible;
  }
  .ce-card-head {
    font-size: 1.1rem;
    font-weight: 700;
    color: #f1f5f9;
    display: flex;
    align-items: center;
    gap: 10px;
    border-bottom: 1px solid #334155;
    padding-bottom: 15px;
    margin-bottom: 20px;
  }
  .ce-icon-svg {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    color: #10b981;
  }
  .ce-card.error {
    border-color: #ef4444 !important;
    animation: cePulseError 2s ease-in-out infinite;
  }
  @keyframes cePulseError {
    0%,
    100% {
      box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4);
    }
    50% {
      box-shadow: 0 0 0 8px rgba(239, 68, 68, 0);
    }
  }
  /* --- 3. Image Upload --- */
  .ce-img-card {
    padding: 0;
    min-height: 280px;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    border: 2px dashed #334155;
    background: #0f172a;
    transition: 0.2s;
    overflow: hidden;
  }
  .ce-img-card:hover {
    border-color: #10b981;
    background: #131c31;
  }
  .ce-img-card.has-img {
    border-style: solid;
    border-color: #334155;
  }
  .ce-preview-img {
    width: 100%;
    height: 280px;
    object-fit: cover;
  }
  .ce-upload-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    color: #64748b;
    font-weight: 500;
  }
  .ce-icon-upload {
    font-size: 2.5rem;
    color: #334155;
    margin-bottom: 5px;
  }
  .ce-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 600;
    opacity: 0;
    transition: 0.2s;
    backdrop-filter: blur(4px);
  }
  .ce-img-card:hover .ce-overlay {
    opacity: 1;
  }
  /* --- 4. Inputs & Forms --- */
  .ce-input-group {
    margin-bottom: 1.2rem;
  }
  .ce-input-group:last-child {
    margin-bottom: 0;
  }
  .ce-input-group label {
    display: block;
    color: #94a3b8;
    font-size: 0.85rem;
    font-weight: 600;
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .ce-req {
    color: #ef4444;
    margin-left: 4px;
  }
  .ce-input,
  .ce-textarea,
  .ce-input-dis,
  .ce-input-sm {
    width: 100%;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 12px;
    padding: 0 14px;
    color: white;
    height: 48px;
    font-size: 0.95rem;
    transition: all 0.2s;
  }
  .ce-textarea {
    height: auto;
    min-height: 140px;
    padding: 14px;
    resize: vertical;
    line-height: 1.6;
  }
  .ce-input:focus,
  .ce-textarea:focus,
  .ce-input-sm:focus {
    border-color: #10b981;
    outline: none;
    box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.1);
  }

  .ce-input:focus,
  .ce-textarea:focus,
  .ce-input-sm:focus {
    border-color: #10b981;
    outline: none;
    box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.1);
  }
  /* Error states */
  .ce-input.error,
  .ce-textarea.error {
    border-color: #ef4444 !important;
    animation: ceShake 0.4s;
  }
  .ce-date-row.error .ce-trigger,
  .ce-dd-wrap.error .ce-trigger-compact {
    border-color: #ef4444 !important;
    animation: ceShake 0.4s;
  }
  @keyframes ceShake {
    0%,
    100% {
      transform: translateX(0);
    }
    25% {
      transform: translateX(-5px);
    }
    75% {
      transform: translateX(5px);
    }
  }
  /* --- 5. Custom Dropdowns --- */
  .ce-dual-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-bottom: 1.5rem;
  }
  .ce-time-capacity-row {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 15px;
    margin-top: 1.5rem;
  }
  .ce-date-row {
    display: flex;
    gap: 10px;
  }
  .ce-date-row.compact-gap {
    gap: 6px;
  }
  .ce-flex-row {
    display: flex;
    gap: 15px;
    align-items: flex-end;
  }
  .flex-1 {
    flex: 1;
  }
  .flex-2 {
    flex: 2;
  }
  .flex-3 {
    flex: 3;
  }
  .flex-1-5 {
    flex: 1.5;
  }
  .ce-dd-wrap {
    position: relative;
    width: 100%;
  }
  .ce-trigger {
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 12px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 14px;
    cursor: pointer;
    transition: 0.2s;
  }
  .ce-trigger:hover {
    border-color: #64748b;
    background: #131c31;
  }
  .ce-trigger-compact {
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 12px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 14px;
    cursor: pointer;
    transition: 0.2s;
    position: relative;
  }
  .ce-trigger-compact:hover {
    border-color: #64748b;
    background: #131c31;
  }
  .ce-arrow {
    font-size: 0.75rem;
    color: #64748b;
    margin-left: 10px;
    flex-shrink: 0;
    pointer-events: none;
  }
  .ce-trigger:hover .ce-arrow,
  .ce-trigger-compact:hover .ce-arrow {
    color: white;
  }
  .ce-input-dis {
    background: transparent !important;
    border: none !important;
    pointer-events: none;
    padding: 0 !important;
    height: 100%;
    box-shadow: none !important;
    width: 100%;
    color: white;
    font-size: 0.95rem;
  }
  .ce-input-inline {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    padding: 0 !important;
    width: 100%;
    height: 100%;
    color: white;
    font-size: 0.95rem;
    cursor: pointer;
    outline: none;
  }
  .ce-input-inline::placeholder {
    color: #475569;
  }
  .ce-options {
    position: absolute;
    top: 110%;
    left: 0;
    right: 0;
    background: #1e293b;
    border: 1px solid #475569;
    border-radius: 12px;
    max-height: 240px;
    overflow-y: auto;
    z-index: 100;
    padding: 6px;
    box-shadow: 0 15px 30px rgba(0, 0, 0, 0.5);
  }
  .ce-options::-webkit-scrollbar {
    width: 5px;
  }
  .ce-options::-webkit-scrollbar-thumb {
    background: #475569;
    border-radius: 5px;
  }
  .ce-opt {
    padding: 10px 12px;
    cursor: pointer;
    color: #cbd5e1;
    border-radius: 8px;
    font-size: 0.9rem;
    transition: 0.1s;
    display: flex;
    justify-content: space-between;
    align-items: center;
    /* Reset button styles */
    background: transparent;
    border: none;
    width: 100%;
    text-align: left;
  }
  .ce-opt:hover {
    background: #10b981;
    color: white;
  }
  .ce-opt[aria-selected="true"] {
    background: rgba(16, 185, 129, 0.2);
    color: #10b981;
    font-weight: 600;
  }
  .ce-opt[aria-selected="true"]::after {
    content: "✓";
    margin-left: 8px;
  }
  button.ce-opt:focus {
    outline: 2px solid #10b981;
    outline-offset: -2px;
  }
  /* --- 6. Holidays Section --- */
  .ce-locked-card {
    opacity: 0.5;
    pointer-events: none;
    border-style: dashed;
    border-color: #475569;
    filter: grayscale(0.8);
  }
  .ce-lock-overlay {
    position: absolute;
    inset: 0;
    background: rgba(15, 23, 42, 0.85);
    z-index: 50;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border-radius: 20px;
    color: #e2e8f0;
    font-weight: 500;
    backdrop-filter: blur(2px);
    gap: 10px;
  }
  .ce-lock-icon-svg {
    width: 48px;
    height: 48px;
    color: #64748b;
    margin-bottom: 10px;
  }
  .ce-status-icon {
    width: 24px;
    height: 24px;
    color: currentColor;
  }
  .ce-status-icon-box {
    width: 44px;
    height: 44px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.4rem;
    flex-shrink: 0;
    color: #64748b;
  }
  .status-live .ce-status-icon-box {
    color: #10b981;
  }
  .ce-upload-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    color: #64748b;
    font-weight: 500;
  }
  .ce-icon-upload {
    width: 60px;
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(16, 185, 129, 0.1);
    border-radius: 50%;
    margin-bottom: 5px;
  }
  .ce-icon-upload svg {
    width: 32px;
    height: 32px;
    color: #10b981;
  }
  .ce-check-row {
    display: flex;
    align-items: center;
    gap: 15px;
    cursor: pointer;
    padding: 14px;
    background: #0f172a;
    border-radius: 12px;
    border: 1px solid #334155;
    transition: 0.2s;
    user-select: none; /* เพิ่มบรรทัดนี้ */
  }
  .ce-check-row:hover {
    border-color: #64748b;
    background: #162032;
  }

  .ce-check-row.active {
    border-color: #10b981;
    background: rgba(16, 185, 129, 0.05);
  }
  .ce-check-row input {
    width: 20px;
    height: 20px;
    accent-color: #10b981;
    cursor: pointer;
    pointer-events: none;
  }
  .ce-check-row input:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .ce-holiday-buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 20px;
  }

  /* Style สำหรับวันที่ที่เลือกแล้ว */
  .ce-opt.disabled {
    opacity: 0.4;
    cursor: not-allowed;
    background: rgba(100, 116, 139, 0.1);
  }
  .ce-opt.disabled:hover {
    background: rgba(100, 116, 139, 0.1);
  }

  /* เครื่องหมาย ✓ */
  .already-added {
    margin-left: auto;
    font-size: 0.75rem;
    color: #10b981;
    font-weight: 600;
  }
  .ce-check-row input {
    width: 20px;
    height: 20px;
    accent-color: #10b981;
    cursor: pointer;
  }
  .ce-check-content {
    display: flex;
    flex-direction: column;
  }
  .ce-check-title {
    color: white;
    font-weight: 600;
    font-size: 0.95rem;
  }
  .ce-check-desc {
    color: #64748b;
    font-size: 0.8rem;
    margin-top: 2px;
  }
  .ce-divider {
    border: 0;
    border-top: 1px solid #334155;
    margin: 20px 0;
  }
  .ce-hint {
    display: block;
    font-size: 0.8rem;
    color: #64748b;
    margin-top: 8px;
    font-style: italic;
  }
  .ce-btn-icon {
    width: 48px;
    height: 48px;
    background: #334155;
    color: white;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    font-size: 1.5rem;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: 0.2s;
  }
  .ce-btn-icon:hover {
    background: #10b981;
  }
  .ce-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 15px;
  }
  .ce-tag {
    background: rgba(239, 68, 68, 0.15);
    color: #fca5a5;
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 0.85rem;
    display: flex;
    align-items: center;
    gap: 8px;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }
  .ce-tag button {
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    font-size: 1.1rem;
    line-height: 1;
  }
  /* --- 7. Rewards Section --- */
  .ce-rewards-section {
    margin-top: 1.5rem;
  }
  .ce-progress-info {
    display: flex;
    justify-content: space-between;
    font-size: 0.9rem;
    color: #94a3b8;
    margin-bottom: 6px;
    font-weight: 500;
  }
  .ce-text-err {
    color: #ef4444;
    font-weight: 700;
    animation: cePulse 1.5s infinite;
  }
  @keyframes cePulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
  .ce-progress-bar {
    height: 8px;
    background: #334155;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 20px;
  }
  .ce-bar-fill {
    height: 100%;
    transition:
      width 0.4s ease,
      background 0.3s ease;
  }
  .ce-stack {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .ce-tier-card {
    background: linear-gradient(135deg, #0f172a 0%, #1a2332 100%);
    border: 1px solid #334155;
    border-radius: 14px;
    padding: 0;
    overflow: hidden;
    transition: all 0.2s ease;
  }
  .ce-tier-card:hover {
    border-color: #10b981;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.15);
  }
  .ce-tier-header {
    background: rgba(51, 65, 85, 0.3);
    padding: 12px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    border-bottom: 1px solid #334155;
  }
  .ce-badge {
    background: linear-gradient(135deg, #334155, #475569);
    color: white;
    padding: 5px 12px;
    border-radius: 8px;
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.5px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }
  .ce-tier-range-badge {
    font-size: 0.85rem;
    color: #10b981;
    font-weight: 600;
    background: rgba(16, 185, 129, 0.1);
    padding: 5px 12px;
    border-radius: 8px;
    border: 1px solid rgba(16, 185, 129, 0.2);
    flex-grow: 1;
  }
  .ce-btn-remove {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #ef4444;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 1.3rem;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    margin-left: auto;
  }
  .ce-btn-remove:hover {
    background: #ef4444;
    color: white;
    transform: scale(1.05);
  }
  .ce-tier-body {
    padding: 16px;
    display: grid;
    grid-template-columns: 100px 120px 1fr;
    gap: 12px;
    align-items: end;
  }

  .ce-tier-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  @media (max-width: 768px) {
    .ce-tier-body {
      grid-template-columns: 1fr;
    }

    .ce-tier-field-wide {
      grid-column: 1 / 2;
    }
    .search-toggle-btn {
      padding: 8px;
      min-width: 40px;
      justify-content: center;
    }
  }
  .ce-tier-field label {
    font-size: 0.75rem;
    color: #94a3b8;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 0;
    white-space: nowrap;
  }
  .ce-tier-field-wide {
    grid-column: 2 / 3;
  }
  .ce-input-compact {
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 10px;
    padding: 0 12px;
    height: 42px;
    color: white;
    font-size: 0.9rem;
    transition: all 0.2s;
    width: 100%;
  }
  .ce-input-compact:focus {
    border-color: #10b981;
    outline: none;
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
  }

  .ce-input-compact::placeholder {
    color: #475569;
    font-size: 0.85rem;
  }

  .ce-input-compact:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .ce-btn-dashed {
    width: 100%;
    border: 1px dashed #475569;
    background: transparent;
    color: #94a3b8;
    padding: 12px;
    border-radius: 12px;
    cursor: pointer;
    margin-top: 15px;
    transition: 0.2s;
    font-weight: 500;
  }
  .ce-btn-dashed:hover {
    border-color: #10b981;
    color: #10b981;
    background: rgba(16, 185, 129, 0.05);
  }
  /* --- 8. Status Section --- */
  .ce-status-row {
    display: flex;
    gap: 20px;
    margin-bottom: 15px;
  }
  .ce-switch-box {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #0f172a;
    padding: 14px;
    border-radius: 12px;
    border: 1px solid #334155;
  }
  .ce-switch-box label {
    margin: 0;
    color: #e2e8f0;
    font-weight: 600;
    cursor: pointer;
  }
  .ce-switch {
    position: relative;
    width: 48px;
    height: 26px;
  }
  .ce-switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }
  .ce-slider {
    position: absolute;
    inset: 0;
    background: #334155;
    border-radius: 30px;
    transition: 0.3s;
    cursor: pointer;
  }
  .ce-slider:before {
    position: absolute;
    content: "";
    height: 20px;
    width: 20px;
    left: 3px;
    bottom: 3px;
    background: white;
    border-radius: 50%;
    transition: 0.3s;
  }
  input:checked + .ce-slider {
    background: #10b981;
  }
  input:checked + .ce-slider:before {
    transform: translateX(22px);
  }
  .ce-status-card {
    background: linear-gradient(145deg, #1e293b, #0f172a);
    border: 1px solid #334155;
    border-radius: 12px;
    padding: 16px;
    display: flex;
    align-items: center;
    gap: 15px;
    transition: 0.3s all;
  }
  .ce-status-card.status-live {
    background: linear-gradient(
      145deg,
      rgba(16, 185, 129, 0.1),
      rgba(6, 95, 70, 0.2)
    );
    border-color: #10b981;
  }

  .status-badge.status-draft {
    background: rgba(245, 158, 11, 0.15);
    border-color: rgba(245, 158, 11, 0.4);
    color: #f59e0b;
  }
  .ce-status-icon-box {
    width: 44px;
    height: 44px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.4rem;
    flex-shrink: 0;
  }
  .ce-status-text strong {
    display: block;
    color: #f1f5f9;
    font-size: 1rem;
    margin-bottom: 4px;
  }
  .ce-status-text p {
    margin: 0;
    color: #94a3b8;
    font-size: 0.85rem;
    line-height: 1.4;
  }
  .status-live .ce-status-text strong {
    color: #34d399;
  }
  /* --- 9. Error Message --- */
  .ce-error-msg {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #fca5a5;
    padding: 10px 14px;
    border-radius: 10px;
    font-size: 0.85rem;
    margin-top: 15px; /* เปลี่ยนจาก 10px เป็น 15px */
    display: flex;
    align-items: center;
    gap: 8px;
  }
  /* --- 10. Utility & Fixes --- */
  input[type="number"]::-webkit-outer-spin-button,
  input[type="number"]::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  input[type="number"] {
    -moz-appearance: textfield;
    appearance: textfield;
  }
  /* --- 11. Responsive --- */
  @media (max-width: 1024px) {
    .ce-grid-layout {
      grid-template-columns: 1fr;
      gap: 20px;
    }
    .ce-dual-row {
      grid-template-columns: 1fr;
    }
    .ce-time-capacity-row {
      grid-template-columns: 1fr;
    }
    .ce-tier-body {
      grid-template-columns: 1fr;
    }
    .ce-tier-field-wide {
      grid-column: 1 / 2;
    }
  }
  @media (max-width: 600px) {
    .ce-header {
      flex-direction: column;
      align-items: stretch;
      gap: 12px;
    }

    .ce-header-right {
      width: 100%;
      flex-direction: column;
      align-items: stretch;
      gap: 10px;
    }

    .ce-validation-alert {
      width: 100%;
      justify-content: center;
      font-size: 0.75rem;
      padding: 8px 12px;
    }

    .ce-alert-icon {
      width: 18px;
      height: 18px;
    }

    .ce-header-actions {
      width: 100%;
      gap: 8px;
    }

    .ce-btn-cancel,
    .ce-btn-save {
      flex: 1;
      text-align: center;
      padding: 0.6rem 1rem;
      font-size: 0.85rem;
    }

    @keyframes ceSlideIn {
      from {
        opacity: 0;
        transform: translateX(-10px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }
    .ce-alert-icon {
      width: 20px;
      height: 20px;
      flex-shrink: 0;
      color: #ef4444;
    }
    .ce-alert-text {
      white-space: nowrap;
    }

    /* Card Head with SVG Icons */
    .ce-card-head {
      font-size: 1.1rem;
      font-weight: 700;
      color: #f1f5f9;
      display: flex;
      align-items: center;
      gap: 10px;
      border-bottom: 1px solid #334155;
      padding-bottom: 15px;
      margin-bottom: 20px;
    }
    .ce-icon-svg {
      width: 20px;
      height: 20px;
      flex-shrink: 0;
      color: #10b981;
    }

    /* Error State */
    .ce-card.error {
      border-color: #ef4444 !important;
      animation: cePulseError 2s ease-in-out infinite;
    }
    @keyframes cePulseError {
      0%,
      100% {
        box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4);
      }
      50% {
        box-shadow: 0 0 0 8px rgba(239, 68, 68, 0);
      }
    }

    /* Lock Icons */
    .ce-lock-icon-svg {
      width: 48px;
      height: 48px;
      color: #64748b;
      margin-bottom: 10px;
    }

    /* Status Icons */
    .ce-status-icon {
      width: 24px;
      height: 24px;
      color: currentColor;
    }
    .ce-status-icon-box {
      width: 44px;
      height: 44px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.4rem;
      flex-shrink: 0;
      color: #64748b;
    }
    .status-live .ce-status-icon-box {
      color: #10b981;
    }

    /* Upload Icon */
    .ce-upload-placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      color: #64748b;
      font-weight: 500;
    }
    .ce-icon-upload {
      width: 60px;
      height: 60px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(16, 185, 129, 0.1);
      border-radius: 50%;
      margin-bottom: 5px;
    }
    .ce-icon-upload svg {
      width: 32px;
      height: 32px;
      color: #10b981;
    }

    /* Responsive */
    @media (max-width: 600px) {
      .ce-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 15px;
      }
      .ce-header-right {
        width: 100%;
        flex-direction: column;
        align-items: stretch;
      }
      .ce-validation-alert {
        width: 100%;
        justify-content: center;
      }
      .ce-header-actions {
        width: 100%;
        justify-content: stretch;
      }
      .ce-btn-cancel,
      .ce-btn-save {
        flex: 1;
        text-align: center;
      }
      .ce-date-row {
        flex-direction: column;
      }
      .ce-flex-row {
        flex-direction: column;
      }
      .ce-status-row {
        flex-direction: column;
        gap: 10px;
      }
      .ce-dual-row {
        grid-template-columns: 1fr;
        gap: 12px;
      }
      .ce-time-capacity-row {
        grid-template-columns: 1fr;
        gap: 12px;
      }
    }
    .ce-header-actions {
      width: 100%;
      justify-content: stretch;
    }
    .ce-btn-cancel,
    .ce-btn-save {
      flex: 1;
      text-align: center;
    }
    .ce-date-row {
      flex-direction: column;
    }
    .ce-flex-row {
      flex-direction: column;
    }
    .ce-status-row {
      flex-direction: column;
      gap: 10px;
    }
    .ce-dual-row {
      grid-template-columns: 1fr;
      gap: 12px;
    }
    .ce-time-capacity-row {
      grid-template-columns: 1fr;
      gap: 12px;
    }
  }

  .ce-btn-reset {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #ef4444;
    padding: 6px 14px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: 600;
    transition: all 0.2s;
  }
  .ce-btn-reset:hover {
    background: #ef4444;
    color: white;
    transform: scale(1.02);
  }

  /* ========================================== */
  /* ✅ Logs Intro Header - เหมือน Event List */
  /* ========================================== */

  .logs-action-buttons {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  .glass-card .card-body .action-buttons {
    gap: 0.85rem !important; /* ปรับตรงนี้ */
  }

  .events-selection .glass-card .card-body .action-buttons {
    gap: 0.85rem !important; /* ปรับตรงนี้ */
  }

  .realtime-controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn-new-logs {
    background: linear-gradient(135deg, #10b981, #059669);
    border: none;
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 10px;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 600;
    transition: all 0.3s;
    animation: pulse 2s infinite;
  }

  .btn-new-logs:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(16, 185, 129, 0.4);
  }

  @keyframes pulse {
    0%,
    100% {
      box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4);
    }
    50% {
      box-shadow: 0 0 0 8px rgba(16, 185, 129, 0);
    }
  }

  .btn-auto-refresh {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    padding: 0;
    background: transparent;
    border: 1px solid rgba(100, 116, 139, 0.3);
    border-radius: 10px;
    color: #94a3b8;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
  }

  .btn-auto-refresh:hover {
    background: rgba(100, 116, 139, 0.1);
    border-color: rgba(100, 116, 139, 0.5);
  }

  .btn-auto-refresh.active {
    background: rgba(16, 185, 129, 0.1);
    border-color: #10b981;
    color: #10b981;
  }

  .btn-auto-refresh.active:hover {
    background: rgba(16, 185, 129, 0.2);
  }

  .live-dot {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 8px;
    height: 8px;
    background: #10b981;
    border-radius: 50%;
    animation: blink 1.5s infinite;
  }

  @keyframes blink {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.3;
    }
  }

  .btn-timeline,
  .btn-export {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0 1rem;
    height: 36px;
    background: transparent;
    border: 1px solid #10b981;
    border-radius: 10px;
    color: #10b981;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .btn-export:hover {
    background: rgba(16, 185, 129, 0.1);
  }

  .btn-export:hover:not(:disabled) {
    background: rgba(16, 185, 129, 0.2);
    border-color: #10b981;
    transform: translateY(-2px);
  }

  .btn-timeline:hover:not(:disabled) {
    background: rgba(16, 185, 129, 0.2);
    border-color: #10b981;
    transform: translateY(-2px);
  }

  .btn-export:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .spinner-icon {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  /* Export Dropdown */
  .export-dropdown-wrapper {
    position: relative;
    z-index: 100; /* เพิ่มบรรทัดนี้ */
  }

  .export-menu {
    position: absolute;
    top: 100%;
    right: 0;
    min-width: 160px;
    background: #1e293b;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 0.4rem;
    margin-top: 0.5rem;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    z-index: 1000;
  }

  .export-option {
    width: 100%;
    background: transparent;
    border: none;
    color: #f8fafc;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-size: 0.75rem;
    font-weight: 500;
    transition: all 0.2s;
    text-align: left;
    white-space: nowrap;
  }

  .export-option svg {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
  }

  .export-option:hover {
    background: rgba(16, 185, 129, 0.1);
    color: #10b981;
  }

  /* ========================================== */
  /* ✨ Timeline Modal */
  /* ========================================== */

  .timeline-modal-container {
    background: #1e293b;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 20px;
    width: 90%;
    max-width: 700px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    position: relative;
    z-index: 100000 !important;
  }

  .timeline-modal-header {
    padding: 1.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .timeline-modal-header h3 {
    font-size: 1.25rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
    display: flex;
    align-items: center;
  }

  .timeline-modal-body {
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
  }

  .timeline-event-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1rem;
    font-weight: 600;
    color: #10b981;
    margin-bottom: 1.5rem;
    padding: 0.75rem 1rem;
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.2);
    border-radius: 12px;
  }

  .timeline-container {
    position: relative;
  }

  .timeline-item {
    position: relative;
    padding-left: 2.5rem;
    padding-bottom: 2rem;
  }

  .timeline-dot {
    position: absolute;
    left: 0;
    top: 4px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid #1e293b;
    z-index: 2;
  }

  .timeline-dot.success {
    background: #10b981;
    box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.2);
  }

  .timeline-dot.failed {
    background: #ef4444;
    box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.2);
  }

  .timeline-dot.pending {
    background: #f59e0b;
    box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.2);
  }

  .timeline-line {
    position: absolute;
    left: 5px;
    top: 16px;
    bottom: 0;
    width: 2px;
    background: linear-gradient(
      180deg,
      rgba(16, 185, 129, 0.3),
      rgba(16, 185, 129, 0.05)
    );
  }

  .timeline-line.last {
    display: none;
  }

  .timeline-content {
    background: linear-gradient(
      135deg,
      rgba(0, 0, 0, 0.15),
      rgba(0, 0, 0, 0.05)
    ); /* ไล่เฉดสวยๆ */
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 1rem;
    transition: all 0.3s ease;
  }

  .timeline-item:hover .timeline-content {
    background: rgba(
      16,
      185,
      129,
      0.05
    ); /* เปลี่ยนเป็นสีเขียวอ่อนเมื่อ Hover */
    border-color: rgba(16, 185, 129, 0.2);
    transform: translateX(4px);
  }

  /* ✅ Action Badge - ปรับให้สวยขึ้น */
  .action-badge {
    display: inline-flex;
    align-items: center;
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 0.75rem;
    font-weight: 600;
    border: 1px solid currentColor; /* ✅ เพิ่ม border ตามสี */
    opacity: 0.95;
    transition: all 0.2s;
  }

  .timeline-item:hover .action-badge {
    opacity: 1;
    transform: scale(1.05);
  }

  /* ✅ Timeline Time - ทำให้อ่านง่ายขึ้น */
  .timeline-time {
    font-size: 0.75rem;
    color: #94a3b8;
    margin-bottom: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  /* ✅ Timeline User - ทำให้เด่นขึ้น */
  .timeline-user {
    font-size: 0.9rem;
    font-weight: 600;
    color: #f8fafc;
    margin-bottom: 0.375rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  /* ✅ Timeline Details - ทำให้อ่านง่าย */
  .timeline-details {
    font-size: 0.85rem;
    color: #cbd5e1;
    line-height: 1.6;
    padding: 0.5rem;
    background: rgba(0, 0, 0, 0.1); /* ✅ เพิ่มพื้นหลังอ่อนๆ */
    border-radius: 6px;
    border-left: 3px solid rgba(16, 185, 129, 0.3); /* ✅ เพิ่มขีดด้านซ้าย */
  }

  /* ✅ Timeline Dot - ปรับให้สวยขึ้น */
  .timeline-dot {
    position: absolute;
    left: 0;
    top: 4px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 3px solid #1e293b; /* ✅ เพิ่มความหนา */
    z-index: 2;
    transition: all 0.3s;
  }

  .timeline-item:hover .timeline-dot {
    transform: scale(1.3); /* ✅ ขยายเมื่อ Hover */
  }

  .timeline-dot.success {
    background: #10b981;
    box-shadow:
      0 0 0 4px rgba(16, 185, 129, 0.2),
      0 0 10px rgba(16, 185, 129, 0.4); /* ✅ เพิ่มเงา */
  }

  .timeline-dot.failed {
    background: #ef4444;
    box-shadow:
      0 0 0 4px rgba(239, 68, 68, 0.2),
      0 0 10px rgba(239, 68, 68, 0.4);
  }

  .timeline-dot.pending {
    background: #f59e0b;
    box-shadow:
      0 0 0 4px rgba(245, 158, 11, 0.2),
      0 0 10px rgba(245, 158, 11, 0.4);
    animation: pulse 2s infinite; /* ✅ เพิ่ม animation */
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.7;
      transform: scale(1.1);
    }
  }

  /* ✅ Timeline Line - ทำให้สวยขึ้น */
  .timeline-line {
    position: absolute;
    left: 5px;
    top: 20px; /* ✅ ปรับตำแหน่ง */
    bottom: 0;
    width: 2px;
    background: linear-gradient(
      180deg,
      rgba(16, 185, 129, 0.4) 0%,
      rgba(16, 185, 129, 0.2) 50%,
      rgba(16, 185, 129, 0.05) 100%
    );
  }

  .timeline-line.last {
    display: none;
  }

  .timeline-time {
    font-size: 0.75rem;
    color: #94a3b8;
    margin-bottom: 0.5rem;
  }

  .timeline-action {
    margin-bottom: 0.5rem;
  }

  .timeline-user {
    font-size: 0.9rem;
    font-weight: 600;
    color: #f8fafc;
    margin-bottom: 0.25rem;
  }

  .timeline-details {
    font-size: 0.85rem;
    color: #cbd5e1;
    line-height: 1.5;
  }

  .timeline-empty {
    text-align: center;
    padding: 3rem 1rem;
    color: #64748b;
  }

  .timeline-empty svg {
    margin: 0 auto 1rem;
    opacity: 0.5;
  }

  .timeline-empty p {
    margin: 0;
    font-size: 0.95rem;
  }

  .logs-intro-header {
    margin-bottom: 3rem;
    text-align: left;
  }

  .logs-page-title {
    font-size: 2rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0 0 0.5rem 0;
    letter-spacing: -0.02em;
  }

  .logs-page-divider {
    width: 60px;
    height: 4px;
    background: linear-gradient(90deg, #10b981, #059669);
    border-radius: 2px;
    margin: 1rem 0 1.5rem 0;
  }

  .logs-page-subtitle {
    font-size: 1.25rem;
    font-weight: 600;
    color: #cbd5e1;
    margin: 0 0 0.5rem 0;
  }

  .logs-page-description {
    font-size: 0.95rem;
    color: #94a3b8;
    margin: 0;
    line-height: 1.6;
  }

  /* ========================================== */
  /* 📋 LOGS VIEW STYLES */
  /* ========================================== */

  .logs-container {
    width: 100%;
  }

  .events-selection {
    width: 100%;
  }

  /* Events Selection Grid - เหมือน Event List */

  .section-header {
    margin-bottom: 2rem;
  }

  .section-title {
    font-size: 1.75rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0 0 0.5rem 0;
  }

  .section-subtitle {
    color: #94a3b8;
    font-size: 0.95rem;
    margin: 0;
  }

  /* Glass Cards สำหรับ Events - Clickable */

  /* Logs Detail Header - แก้ไข Status Badge */
  .logs-detail {
    animation: fadeIn 0.3s ease;
    margin-top: 0.5rem;
  }

  .logs-header {
    background: #1e293b;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    padding: 1.5rem;
    margin-bottom: 2rem;
    display: flex;
    align-items: center;
    gap: 1.5rem;
    flex-wrap: wrap;
  }

  .btn-back-logs {
    background: rgba(100, 116, 139, 0.2);
    border: 1px solid rgba(100, 116, 139, 0.3);
    color: #94a3b8;
    padding: 0.625rem 1rem;
    border-radius: 10px;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 600;
    transition: all 0.2s;
    flex-shrink: 0;
  }

  .btn-back-logs:hover {
    background: rgba(100, 116, 139, 0.3);
    border-color: #64748b;
    color: #f8fafc;
    transform: translateX(-2px);
  }

  .selected-event-info {
    flex: 1;
    min-width: 250px;
  }

  .selected-event-info h3 {
    font-size: 1.25rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0 0 0.5rem 0;
  }

  .event-meta-small {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    font-size: 0.85rem;
    color: #94a3b8;
    align-items: center;
  }

  .event-meta-small > span {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .event-meta-small svg {
    flex-shrink: 0;
  }
  /* แก้ไข Status Badge ให้อยู่ในกรอบ */
  .status-badge-inline {
    display: inline-flex;
    align-items: center;
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #ef4444;
    text-transform: uppercase;
  }

  .status-badge-inline.active {
    background: rgba(16, 185, 129, 0.15);
    border-color: rgba(16, 185, 129, 0.3);
    color: #10b981;
  }

  .icon-outline {
    stroke-width: 2;
    fill: none;
  }

  .action-icon-svg {
    stroke-width: 2;
    fill: none;
  }

  /* ========================================== */
  /* ✅ EMPTY STATE ICONS */
  /* ========================================== */

  .empty-state svg,
  .empty-state-custom svg,
  .loading-state svg,
  .error-state svg {
    stroke-width: 1.5;
  }

  .loc-text svg,
  .date-text svg {
    flex-shrink: 0;
    margin-right: 4px;
  }

  .action-btn svg {
    flex-shrink: 0;
  }

  /* Card Header Spacing */
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }

  .card-header h3 {
    flex: 1;
    margin: 0;
    font-size: 1.05rem;
    line-height: 1.4;
    color: #fff;
  }
  /* Statistics Dashboard - เรียงแถวเดียว 4 ตัว */
  .stats-dashboard {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .stat-card-compact {
    display: flex !important;
    flex-direction: row !important;
    align-items: center !important;
    gap: 12px;
    padding: 16px 20px;
    background: #1f2937;
    border: 1px solid #374151;
    border-radius: 8px;
  }

  .stat-icon-compact {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 40px;
    height: 40px;
    border-radius: 8px;
    flex-shrink: 0;
  }

  /* Pending variant */
  .stat-card-compact.pending .stat-icon-compact {
    background: rgba(245, 158, 11, 0.1);
    color: #f59e0b;
  }

  .stat-card-compact.pending .stat-label-compact {
    color: #f59e0b;
  }

  .stat-info-compact {
    display: flex !important;
    flex-direction: column !important;
    justify-content: center !important;
    gap: 2px;
    line-height: 1;
  }

  .stat-value-compact {
    font-size: 1.75rem;
    font-weight: 700;
    color: #ffffff;
    line-height: 1 !important;
    margin: 0 !important;
    padding: 0 !important;
  }

  .stat-label-compact {
    font-size: 0.875rem;
    font-weight: 500;
    line-height: 1 !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  .stat-card {
    background: #1e293b;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    padding: 1.25rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    transition: all 0.3s;
  }
  .stat-card.clickable {
    cursor: pointer;
  }

  .stat-card.clickable:hover {
    border-color: rgba(16, 185, 129, 0.5);
    transform: translateY(-3px);
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
  }

  .stat-card.active {
    border-color: #10b981;
    background: rgba(16, 185, 129, 0.05);
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
  }
  /* Statistics Dashboard - แถวเดียว 4 ตัว */
  .stats-dashboard-single-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.75rem;
    align-items: center;
    margin-bottom: 2rem;
    position: relative;
    z-index: 1; /* เพิ่มบรรทัดนี้ */
  }

  .stat-card-compact {
    display: flex;
    align-items: center; /* จัดให้อยู่กึ่งกลางแนวตั้ง */
    gap: 12px;
    padding: 16px 20px; /* เพิ่ม padding ซ้าย-ขวา */
    background: #1f2937;
    border: 1px solid #374151;
    border-radius: 8px;
  }

  .stat-card-compact.clickable:hover {
    border-color: rgba(16, 185, 129, 0.5);
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
  }

  .stat-card-compact.active {
    border-color: #10b981;
    background: rgba(16, 185, 129, 0.05);
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
  }

  /* ========================================== */
  /* ✅ FIX: Force Grid Layout for Events Selection */
  /* ========================================== */

  .events-selection .grid {
    display: grid !important;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)) !important;
    gap: 1.5rem !important;
    margin-bottom: 2.5rem !important;
    grid-auto-rows: 1fr !important;
    flex-direction: unset !important; /* ยกเลิก flex-direction ถ้ามี */
    flex-wrap: unset !important; /* ยกเลิก flex-wrap ถ้ามี */
  }

  .events-selection .glass-card {
    background: #1e293b;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    overflow: hidden;
    transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    height: 100%;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
    min-height: auto !important; /* ← เพิ่มบรรทัดนี้ */
  }

  .events-selection .glass-card:hover {
    transform: translateY(-8px) scale(1.02);
    border-color: rgba(16, 185, 129, 0.4);
    box-shadow:
      0 20px 40px rgba(0, 0, 0, 0.4),
      0 0 0 1px rgba(16, 185, 129, 0.2);
  }

  .events-selection .card-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.5s ease;
  }

  .events-selection .glass-card:hover .card-img {
    transform: scale(1.1);
  }

  .events-selection .card-img-wrapper {
    position: relative;
    width: 100%;
    height: 200px;
    overflow: hidden;
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  }
  .events-selection .card-body {
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    flex: 1;
    gap: 0.5rem; /* ← ลดจาก 0.75rem */
    min-height: auto !important; /* ← เพิ่มบรรทัดนี้ */
  }

  .events-selection .card-header h3 {
    flex: 1;
    margin: 0;
    font-size: 1.05rem;
    line-height: 1.4;
    color: #fff;
    font-weight: 600;
  }

  .events-selection .action-buttons {
    margin-top: 0.25rem; /* ← เปลี่ยนจาก auto */
    padding-top: 0; /* ← เอา padding ออกเลย */
    display: flex;
    gap: 0.625rem;
  }

  .events-selection .glass-card .card-body .action-buttons {
    margin-top: 0.25rem !important;
    padding-top: 0 !important;
  }
  .events-selection .action-btn {
    flex: 1;
    padding: 0.75rem 1rem;
    border-radius: 12px;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    border: none;
  }

  .events-selection .btn-view {
    background: transparent;
    border: 1px solid rgba(16, 185, 129, 0.4);
    color: #10b981;
    box-shadow: none;
  }

  .events-selection .btn-view:hover {
    background: rgba(16, 185, 129, 0.1);
    border-color: #10b981;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.15);
  }

  /* Empty State */
  .empty-state-custom {
    text-align: center;
    padding: 4rem 2rem;
    background: #1e293b;
    border: 2px dashed rgba(255, 255, 255, 0.1);
    border-radius: 20px;
    animation: fadeIn 0.5s ease;
  }

  .empty-state-custom svg {
    margin: 0 auto 1.5rem;
    opacity: 0.5;
  }

 

  .events-selection .card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
  }

  .events-selection .action-buttons {
    margin-top: auto !important;
  }

  .stat-icon-compact {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .stat-info-compact {
    display: flex;
    flex-direction: column;
    align-items: flex-start; /* จัดซ้าย */
    justify-content: center; /* จัดกลางแนวตั้ง */
  }

  .stat-value-compact {
    font-size: 1.5rem;
    font-weight: 700;
    color: #f8fafc;
    line-height: 1;
  }

  .stat-label-compact {
    font-size: 0.75rem;
    color: #94a3b8;
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Filter Section - ธีมใหม่ */
  .filter-section-logs {
    background: #1e293b;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    padding: 1.25rem;
    margin-bottom: 2rem;
    position: relative;
    z-index: 10; /* เพิ่มบรรทัดนี้ */
  }

  .filter-row-logs {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    flex-wrap: wrap;
    margin-bottom: 0.75rem;
  }

  .filter-row-logs:last-child {
    margin-bottom: 0;
  }

  .search-box-logs {
    flex: 1;
    min-width: 200px;
    display: flex;
    align-items: center;
    background: #0f172a;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 0 1rem;
    gap: 0.75rem;
  }

  .search-box-logs:focus-within {
    border-color: #10b981;
  }

  .search-box-logs input {
    flex: 1;
    background: transparent;
    border: none;
    color: #f8fafc;
    padding: 0.75rem 0;
    font-size: 0.9rem;
    outline: none;
  }

  .search-box-logs input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: rgba(15, 23, 42, 0.5);
  }
  .search-box-logs input::placeholder {
    color: #64748b;
  }

  .nisit-filter-box {
    display: flex;
    align-items: center;
    background: #0f172a;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    padding: 0 0.75rem;
    width: 90px;
    flex-shrink: 0;
  }

  .nisit-filter-box:focus-within {
    border-color: #10b981;
  }

  .nisit-filter-box input {
    width: 100%;
    background: transparent;
    border: none;
    position: relative;
    z-index: 10;
    color: #f8fafc;
    padding: 0.625rem 0;
    font-size: 0.85rem;
    outline: none;
    text-align: center;
    letter-spacing: 1px;
  }

  .nisit-filter-box input::placeholder {
    color: #64748b;
    font-size: 0.75rem;
  }

  .filter-dropdown-logs {
    position: relative;
    z-index: 150; /* เพิ่มบรรทัดนี้ */
  }

  .filter-trigger-logs {
    background: #0f172a;
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #f8fafc;
    padding: 0.625rem 1rem;
    border-radius: 12px;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.2s;
    white-space: nowrap;
    min-width: 160px;
    justify-content: space-between; /* ← เพิ่มบรรทัดนี้ */
  }

  .filter-trigger-logs svg:first-child {
    flex-shrink: 0; /* ← icon แรกไม่ย่อ */
  }

  .filter-trigger-logs span {
    flex: 1; /* ← ข้อความขยายเต็มที่ */
    text-align: left; /* ← จัดข้อความชิดซ้าย */
  }

  .filter-trigger-logs .chevron {
    flex-shrink: 0; /* ← ลูกศรไม่ย่อ */
    margin-left: auto; /* ← ผลักไปท้าย */
  }

  .filter-trigger-logs:hover {
    border-color: #10b981;
  }

  .filter-menu-logs {
    position: absolute;
    top: calc(100% + 0.5rem);
    left: 0;
    background: #1e293b;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 0.5rem;
    min-width: 200px;
    max-height: 300px;
    overflow-y: auto;
    z-index: 200; /* เพิ่มจาก 100 เป็น 200 */
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  }

  .filter-option-logs {
    width: 100%;
    background: transparent;
    border: none;
    color: #94a3b8;
    padding: 0.625rem 0.75rem;
    border-radius: 8px;
    text-align: left;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .filter-option-logs:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #f8fafc;
  }

  .filter-option-logs.selected {
    background: rgba(16, 185, 129, 0.1);
    color: #10b981;
    font-weight: 500;
  }

  .date-input-group-logs {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 0 0 auto;
  }

  .date-input-group-logs label {
    color: #94a3b8;
    font-size: 0.875rem;
    font-weight: 500;
    white-space: nowrap;
  }

  .custom-date-dropdown-logs {
    position: relative;
    z-index: 150;
  }

  .custom-date-trigger-logs {
    background: #0f172a;
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #f8fafc;
    padding: 0.625rem 0.875rem;
    border-radius: 10px;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-size: 0.85rem;
    transition: all 0.2s;
    white-space: nowrap;
    min-width: 140px;
    max-width: 180px;
    justify-content: space-between;
    position: relative;
    z-index: 150;
  }

  .custom-date-trigger-logs svg:first-child {
    flex-shrink: 0;
  }

  .custom-date-trigger-logs span {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: left;
  }

  .custom-date-trigger-logs .chevron {
    flex-shrink: 0;
    margin-left: auto;
  }

  .custom-date-trigger-logs:hover {
    border-color: #10b981;
  }

  .custom-date-menu-logs {
    position: absolute;
    top: calc(100% + 0.5rem);
    left: 0;
    background: #1e293b;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 0.5rem;
    min-width: 220px;
    max-height: 250px;
    overflow-y: auto;
    z-index: 999;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  }

  .date-option-logs {
    width: 100%;
    background: transparent;
    border: none;
    color: #94a3b8;
    padding: 0.625rem 0.75rem;
    border-radius: 8px;
    text-align: left;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.2s;
  }

  .date-option-logs:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #f8fafc;
  }

  .date-option-logs.selected {
    background: rgba(16, 185, 129, 0.1);
    color: #10b981;
    font-weight: 500;
  }

  .btn-apply-logs,
  .btn-reset-logs {
    padding: 0.625rem 1.25rem;
    border-radius: 10px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    border: none;
    white-space: nowrap;
  }

  .btn-apply-logs {
    background: #10b981;
    color: white;
  }

  .btn-apply-logs:hover {
    background: #059669;
  }

  .btn-reset-logs {
    background: transparent;
    border: 1px solid rgba(239, 68, 68, 0.4);
    color: #ef4444;
  }

  .btn-reset-logs:hover {
    background: rgba(239, 68, 68, 0.1);
    border-color: #ef4444;
  }

  .chevron {
    transition: transform 0.2s;
  }

  .chevron.rotated {
    transform: rotate(180deg);
  }

  .dropdown-menu-logs {
    position: absolute;
    top: calc(100% + 0.5rem);
    left: 0;
    background: #1e293b;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 0.5rem;
    min-width: 200px;
    max-height: 300px;
    overflow-y: auto;
    z-index: 100;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  }

  .dropdown-item-logs {
    width: 100%;
    background: transparent;
    border: none;
    color: #94a3b8;
    padding: 0.625rem 0.75rem;
    border-radius: 8px;
    text-align: left;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .dropdown-item-logs:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #f8fafc;
  }

  .dropdown-item-logs.selected {
    background: rgba(16, 185, 129, 0.1);
    color: #10b981;
    font-weight: 500;
  }

  /* Date Range - ธีมใหม่ */
  .date-range-row-logs {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    flex-wrap: wrap;
  }

  .date-input-group-logs {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .date-input-group-logs label {
    color: #94a3b8;
    font-size: 0.875rem;
    font-weight: 500;
    white-space: nowrap;
  }

  .custom-date-trigger-logs {
    background: #0f172a;
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #f8fafc;
    padding: 0.625rem 0.875rem;
    border-radius: 10px;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-size: 0.85rem;
    transition: all 0.2s;
    white-space: nowrap;
    min-width: 180px;
  }

  .custom-date-trigger-logs:hover {
    border-color: #10b981;
  }

  .date-option-logs {
    width: 100%;
    background: transparent;
    border: none;
    color: #94a3b8;
    padding: 0.625rem 0.75rem;
    border-radius: 8px;
    text-align: left;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.2s;
  }

  .date-option-logs:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #f8fafc;
  }

  .date-option-logs.selected {
    background: rgba(16, 185, 129, 0.1);
    color: #10b981;
    font-weight: 500;
  }

  .btn-apply-logs {
    background: #10b981;
    border: none;
    color: white;
    padding: 0.625rem 1.125rem;
    border-radius: 10px;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 600;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .btn-apply-logs:hover {
    background: #059669;
    transform: scale(1.02);
  }

  .btn-reset-logs {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #ef4444;
    padding: 0.625rem 1.125rem;
    border-radius: 10px;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 600;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .btn-reset-logs:hover {
    background: #ef4444;
    color: white;
  }

  /* Logs Grid Cards */
  .logs-grid-container {
    margin-top: 1.5rem;
  }

  .log-grid-card {
    background: #1e293b;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    padding: 1.25rem;
    cursor: pointer;
    transition: all 0.3s;
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }

  .log-grid-card:hover {
    border-color: rgba(16, 185, 129, 0.3);
    transform: translateY(-3px);
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
  }

  .log-grid-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
  }

  .log-action-badge {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.875rem;
    border-radius: 10px;
    border: 1px solid;
    font-size: 0.85rem;
    font-weight: 600;
    flex: 1;
  }

  .log-status-badge {
    padding: 0.375rem 0.75rem;
    border-radius: 20px;
    font-size: 0.75rem;
    font-weight: 600;
    white-space: nowrap;
  }

  .log-grid-user {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 10px;
  }

  .log-user-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 2px solid rgba(16, 185, 129, 0.2);
    flex-shrink: 0;
  }

  .log-user-details {
    flex: 1;
    min-width: 0;
  }

  .log-user-name {
    font-size: 0.9rem;
    font-weight: 600;
    color: #f8fafc;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .log-user-email {
    font-size: 0.8rem;
    color: #94a3b8;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .log-grid-timestamp {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
    color: #94a3b8;
  }

  .log-grid-details {
    background: rgba(0, 0, 0, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 0.75rem;
    font-size: 0.85rem;
    color: #cbd5e1;
    line-height: 1.5;
  }

  /* Responsive */
  @media (max-width: 1024px) {
    .stats-dashboard-single-row {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 768px) {
    .stats-dashboard-single-row {
      grid-template-columns: repeat(2, 1fr);
      gap: 0.625rem;
    }

    .stat-card-compact {
      padding: 0.875rem;
      flex-direction: column;
      text-align: center;
    }

    .stat-icon-compact {
      width: 36px;
      height: 36px;
    }

    .stat-value-compact {
      font-size: 1.25rem;
    }

    .stat-label-compact {
      font-size: 0.7rem;
    }

    .logs-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 1rem;
    }

    .ce-tier-body {
      grid-template-columns: 1fr;
      gap: 10px;
    }
    .logs-action-buttons {
      width: 100%;
      display: grid;
      grid-template-columns: 1fr 1fr; /* 2 columns */
      gap: 0.5rem;
    }

    .realtime-controls {
      grid-column: 1 / 2;
      display: flex;
      gap: 0.5rem;
      justify-content: flex-start;
    }

    .btn-timeline,
    .btn-export {
      grid-column: 2 / 3;
      grid-row: 1;
      width: 100%;
    }

    .timeline-modal-container {
      width: 95%;
      max-height: 90vh;
    }

    .timeline-modal-body {
      padding: 1rem;
    }

    .timeline-item {
      padding-left: 2rem;
      padding-bottom: 1.5rem;
    }

    /* ✅ ปรับขนาดปุ่ม */
    .btn-new-logs,
    .btn-auto-refresh,
    .btn-timeline,
    .btn-export {
      padding: 0.5rem 0.75rem;
      font-size: 0.8rem;
    }

    /* ✅ Fix Timeline Modal z-index */
    .modal-overlay {
      z-index: 99999 !important;
    }

    .timeline-modal-container {
      width: 95%;
      max-height: 90vh;
    }
  }

  @media (max-width: 480px) {
    .stats-dashboard-single-row {
      grid-template-columns: repeat(2, 1fr);
    }

    .stat-value-compact {
      font-size: 1.125rem;
    }

    .stat-label-compact {
      font-size: 0.65rem;
    }

    .logs-action-buttons {
      grid-template-columns: 1fr;
      gap: 0.5rem;
    }

    .realtime-controls,
    .btn-timeline,
    .export-dropdown-wrapper {
      grid-column: 1 / 2;
      width: 100%;
    }

    .realtime-controls {
      justify-content: space-between;
    }

    .btn-new-logs {
      flex: 1;
    }
  }

  /* Logs Detail Header */

  .logs-header {
    background: #1e293b;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    padding: 1.5rem;
    margin-bottom: 2rem;
    display: flex;
    align-items: center;
    gap: 1.5rem;
  }

  .btn-back-logs {
    background: rgba(100, 116, 139, 0.2);
    border: 1px solid rgba(100, 116, 139, 0.3);
    color: #94a3b8;
    padding: 0.625rem 1rem;
    border-radius: 10px;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 600;
    transition: all 0.2s;
    flex-shrink: 0;
  }

  .btn-back-logs:hover {
    background: rgba(100, 116, 139, 0.3);
    border-color: #64748b;
    color: #f8fafc;
    transform: translateX(-2px);
  }

  .selected-event-info {
    flex: 1;
  }

  .selected-event-info h3 {
    font-size: 1.25rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0 0 0.5rem 0;
  }

  .event-meta-small {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    font-size: 0.85rem;
    color: #94a3b8;
    align-items: center;
  }

  .status-dot {
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
    text-transform: uppercase;
  }

  .status-dot.active {
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
  }

  .btn-create-first {
    background: linear-gradient(135deg, #10b981, #059669);
    border: none;
    color: white;
    padding: 0.875rem 1.75rem;
    border-radius: 12px;
    display: inline-flex;
    align-items: center;
    gap: 0.625rem;
    cursor: pointer;
    font-size: 1rem;
    font-weight: 600;
    margin-top: 1.5rem;
    transition: all 0.3s;
    box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
  }

  .btn-create-first:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  @keyframes bounceIn {
    0% {
      opacity: 0;
      transform: translateY(30px) scale(0.95);
    }
    50% {
      transform: translateY(-5px) scale(1.02);
    }
    100% {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  /* ใส่ animation ให้ grid ทั้งก้อน */
  .grid,
  .events-selection .grid {
    animation: bounceIn 0.5s ease-out;
  }

  /* หรือถ้าต้องการนุ่มนวลกว่า */
  @keyframes smoothBounce {
    0% {
      opacity: 0;
      transform: translateY(20px);
    }
    70% {
      transform: translateY(-3px);
    }
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .grid,
  .events-selection .grid {
    animation: smoothBounce 0.4s ease-out;
  }

  /* Statistics Dashboard */
  .stats-dashboard {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .stat-card {
    background: #1e293b;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    padding: 1.25rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    transition: all 0.3s;
  }

  .stat-card:hover {
    border-color: rgba(16, 185, 129, 0.3);
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
  }

  .stat-icon {
    width: 50px;
    height: 50px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .stat-info {
    flex: 1;
  }

  .stat-value {
    font-size: 1.75rem;
    font-weight: 700;
    color: #f8fafc;
    line-height: 1;
    margin-bottom: 0.25rem;
  }

  .stat-label {
    font-size: 0.85rem;
    color: #94a3b8;
  }

  /* Filter Section */
  .filter-section {
    background: #1e293b;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    padding: 1.25rem;
    margin-bottom: 2rem;
  }

  .filter-row {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    flex-wrap: wrap;
    margin-bottom: 1rem;
  }

  .search-box {
    position: relative;
    flex: 1;
    min-width: 250px;
    display: flex;
    align-items: center;
    background: #0f172a;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 0 1rem;
  }

  .search-box:focus-within {
    border-color: #10b981;
  }

  .search-icon {
    width: 18px;
    height: 18px;
    color: #94a3b8;
    margin-right: 0.75rem;
  }

  .filter-dropdown {
    position: relative;
  }

  .filter-trigger {
    background: #0f172a;
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #f8fafc;
    padding: 0.75rem 1rem;
    border-radius: 12px;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-size: 0.9rem;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .filter-trigger:hover {
    border-color: #10b981;
  }

  .chevron {
    transition: transform 0.2s;
  }

  .chevron.rotated {
    transform: rotate(180deg);
  }

  .dropdown-menu {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    width: 100%;
    max-height: 240px;
    overflow-y: auto;
    background: rgba(31, 41, 55, 0.98);
    border: 2px solid #374151;
    border-radius: 12px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
    /* z-index: 100;  <-- ค่าเดิมอาจน้อยไป */
    z-index: 9999; /* <-- เปลี่ยนเป็นค่าที่สูงมากเพื่อให้แน่ใจว่าอยู่บนสุด */
    backdrop-filter: blur(10px);
  }

  .dropdown-item {
    width: 100%;
    background: transparent;
    border: none;
    color: #94a3b8;
    padding: 0.625rem 0.75rem;
    border-radius: 8px;
    text-align: left;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.2s;
  }

  .dropdown-item:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #f8fafc;
  }

  .dropdown-item.selected {
    background: rgba(16, 185, 129, 0.1);
    color: #10b981;
    font-weight: 500;
  }

  .btn-apply {
    background: #10b981;
    border: none;
    color: white;
    padding: 0.75rem 1.25rem;
    border-radius: 12px;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 600;
    transition: all 0.2s;
  }

  .btn-apply:hover {
    background: #059669;
    transform: scale(1.02);
  }

  .btn-reset {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #ef4444;
    padding: 0.75rem 1.25rem;
    border-radius: 12px;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 600;
    transition: all 0.2s;
  }

  .btn-reset:hover {
    background: #ef4444;
    color: white;
  }

  .date-range-row {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .date-input-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .date-input-group :global(label) {
    color: #94a3b8;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .date-input-group :global(input) {
    background: #0f172a;
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #f8fafc;
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
    font-size: 0.875rem;
    outline: none;
  }

  .date-input-group :global(input:focus) {
    border-color: #3b82f6;
    box-shadow: 0 0 0 1px #3b82f6;
  }

  /* Loading & Error States */
  .loading-state,
  .error-state {
    text-align: center;
    padding: 3rem;
    color: #94a3b8;
  }

  .spinner {
    width: 48px;
    height: 48px;
    border: 4px solid rgba(16, 185, 129, 0.1);
    border-top-color: #10b981;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .error-state svg {
    margin: 0 auto 1rem;
  }

  .btn-retry {
    background: #10b981;
    border: none;
    color: white;
    padding: 0.75rem 1.5rem;
    border-radius: 12px;
    cursor: pointer;
    font-weight: 600;
    margin-top: 1rem;
    transition: all 0.2s;
  }

  .btn-retry:hover {
    background: #059669;
  }

  .empty-state {
    text-align: center;
    padding: 4rem 2rem;
    color: #64748b;
  }

  .empty-state svg {
    margin: 0 auto 1rem;
  }

  .empty-state p {
    font-size: 1.25rem;
    font-weight: 600;
    color: #94a3b8;
    margin-bottom: 0.5rem;
  }

  .empty-state span {
    font-size: 0.9rem;
    color: #64748b;
  }

  /* Logs List */
  .logs-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .log-card {
    background: #1e293b;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    padding: 1.25rem;
    cursor: pointer;
    transition: all 0.3s;
    position: relative;
  }

  .log-card:hover {
    border-color: rgba(16, 185, 129, 0.3);
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
  }

  .log-card:hover :global(.log-arrow) {
    opacity: 1;
    transform: translateX(0);
  }

  .log-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .log-action {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .logs-list-container {
    margin-top: 1.5rem;
    position: relative;
    z-index: 1; /* เพิ่มบรรทัดนี้ */
  }
  .logs-grid-2col {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    position: relative;
    z-index: 1; /* เพิ่มบรรทัดนี้ */
  }

  .log-list-card {
    background: #1e293b;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    padding: 1.25rem;
    display: flex;
    gap: 1rem;
    cursor: pointer;
    transition: all 0.3s;
    position: relative;
    z-index: 1; /* เพิ่มบรรทัดนี้ */
  }

  .log-list-card:hover {
    border-color: rgba(16, 185, 129, 0.3);
    transform: translateY(-3px);
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
  }

  /* Avatar Circle */
  .log-avatar-circle {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.125rem;
    font-weight: 700;
    color: white;
    flex-shrink: 0;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  /* Content */
  .log-list-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    min-width: 0;
  }

  /* Header */
  .log-list-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .log-user-info {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    min-width: 0;
  }

  .log-user-name {
    font-size: 1rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .log-user-id {
    font-size: 0.75rem;
    color: #64748b;
    font-weight: 500;
  }

  .log-status-badge-compact {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border: 1.5px solid;
    white-space: nowrap;
    transition: all 0.2s;
  }

  .clickable-badge {
    cursor: pointer;
    user-select: none;
  }

  .clickable-badge:hover {
    transform: scale(1.05) translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    filter: brightness(1.2);
  }

  .clickable-badge:active {
    transform: scale(0.98);
  }
  .log-details-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.625rem;
    padding: 0.75rem;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .log-detail-item {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .log-detail-label {
    font-size: 0.7rem;
    color: #64748b;
    font-weight: 500;
  }

  .log-detail-value {
    font-size: 0.8rem;
    color: #f8fafc;
    font-weight: 500;
  }

  .log-code {
    color: #06b6d4;
    font-weight: 700;
    font-family: "Courier New", monospace;
  }

  /* Proof Link Button */
  .log-proof-link {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #06b6d4;
    font-size: 0.8rem;
    font-weight: 600;
    padding: 0.5rem 0.75rem;
    background: rgba(6, 182, 212, 0.1);
    border: 1px solid rgba(6, 182, 212, 0.3);
    border-radius: 8px;
    width: fit-content;
    cursor: pointer;
    transition: all 0.2s;
  }

  .log-proof-link:hover {
    background: rgba(6, 182, 212, 0.2);
    transform: translateX(2px);
  }

  .log-proof-link svg {
    flex-shrink: 0;
  }

  /* Cancellation Reason */
  .log-cancellation-reason {
    padding: 0.625rem;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
  }

  .log-cancellation-reason strong {
    display: block;
    color: #ef4444;
    font-size: 0.75rem;
    margin-bottom: 0.375rem;
  }

  .log-cancellation-reason p {
    margin: 0;
    color: #fca5a5;
    font-size: 0.8rem;
  }

  /* Footer */
  .log-list-footer {
    padding-top: 0.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
  }

  .log-last-updated {
    font-size: 0.7rem;
    color: #64748b;
  }

  /* ========================================== */
  /* ✅ RESPONSIVE */
  /* ========================================== */

  @media (max-width: 1200px) {
    .stats-dashboard-single-row {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  @media (max-width: 768px) {
    .stats-dashboard-single-row {
      grid-template-columns: repeat(2, 1fr);
    }

    .logs-grid-2col {
      grid-template-columns: 1fr;
    }

    .log-details-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 480px) {
    .stat-value-compact {
      font-size: 1.125rem;
    }

    .stat-label-compact {
      font-size: 0.65rem;
    }

    .log-list-card {
      padding: 1rem;
    }

    .log-avatar-circle {
      width: 44px;
      height: 44px;
      font-size: 1rem;
    }
  }

  @media (max-width: 480px) {
    .log-list-card {
      padding: 1rem;
    }

    .log-avatar-circle {
      width: 44px;
      height: 44px;
      font-size: 1rem;
    }

    .log-user-name {
      font-size: 1rem;
    }

    .log-detail-label {
      font-size: 0.7rem;
    }

    .log-detail-value {
      font-size: 0.8rem;
    }
  }

  .action-icon {
    font-size: 1.25rem;
  }

  .action-label {
    font-size: 0.95rem;
    font-weight: 600;
    color: #f8fafc;
  }

  .log-status {
    padding: 0.375rem 0.75rem;
    border-radius: 20px;
    font-size: 0.75rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .log-body {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .user-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 2px solid rgba(16, 185, 129, 0.2);
  }

  .user-details {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .user-name {
    font-size: 0.9rem;
    font-weight: 600;
    color: #f8fafc;
  }

  .user-email {
    font-size: 0.8rem;
    color: #94a3b8;
  }

  .log-timestamp {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.8rem;
    color: #94a3b8;
  }

  .log-timestamp svg {
    flex-shrink: 0;
  }

  .log-details {
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 0.75rem;
    font-size: 0.85rem;
    color: #94a3b8;
    line-height: 1.5;
  }

  .log-arrow {
    position: absolute;
    right: 1.25rem;
    top: 50%;
    transform: translate(10px, -50%);
    opacity: 0;
    transition: all 0.3s;
    color: #10b981;
  }

  /* Pagination */
  .pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 1.5rem;
    margin-top: 2rem;
  }

  .page-info {
    font-size: 0.9rem;
    color: #94a3b8;
  }

  .page-current,
  .page-total {
    font-weight: 700;
    color: #10b981;
  }

  .page-divider {
    margin: 0 0.5rem;
    color: #475569;
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.85);
    backdrop-filter: blur(10px);
    z-index: 99999 !important;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .modal-container {
    background: #1e293b;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 20px;
    max-width: 600px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .modal-header h3 {
    font-size: 1.25rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .modal-close {
    background: transparent;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 8px;
    transition: all 0.2s;
  }

  .modal-close:hover {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
  }

  .modal-body {
    padding: 1.5rem;
  }

  .detail-section {
    margin-bottom: 1.5rem;
  }

  .detail-section:last-child {
    margin-bottom: 0;
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border: 1px solid;
    white-space: nowrap;
  }

  .status-badge.status-active {
    background: rgba(16, 185, 129, 0.15);
    border-color: rgba(16, 185, 129, 0.4);
    color: #10b981;
  }

  .status-badge.status-closed {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.4);
    color: #ef4444;
  }

  .section-title {
    font-size: 0.95rem;
    font-weight: 600;
    color: #f8fafc;
    margin-bottom: 1rem;
  }

  .detail-grid {
    display: grid;
    gap: 0.75rem;
  }

  .detail-item {
    display: grid;
    grid-template-columns: 140px 1fr;
    gap: 1rem;
    padding: 0.75rem;
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 8px;
  }

  .detail-label {
    font-size: 0.85rem;
    color: #94a3b8;
    font-weight: 500;
  }

  .detail-value {
    font-size: 0.85rem;
    color: #f8fafc;
    word-break: break-word;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .stats-dashboard {
      grid-template-columns: repeat(2, 1fr);
    }

    .filter-row {
      flex-direction: column;
    }

    .search-box {
      width: 100%;
      min-width: 100%;
    }

    .filter-dropdown,
    .btn-apply,
    .btn-reset {
      width: 100%;
    }

    .filter-trigger {
      width: 100%;
      justify-content: space-between;
    }

    .log-card {
      padding: 1rem;
    }

    .log-body {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.75rem;
    }

    .pagination {
      flex-direction: column;
      gap: 1rem;
    }

    .page-btn {
      width: 100%;
      justify-content: center;
    }

    .detail-item {
      grid-template-columns: 1fr;
      gap: 0.5rem;
    }
    .events-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1.5rem;
      margin-top: 1.5rem; /* ให้เท่ากับ .grid */
    }

    .view-title + * {
      margin-top: 0 !important;
    }

    /* หรือเจาะจงแต่ละ class */
    .events-grid {
      margin-top: 0;
    }

    .view-title ~ :global(.grid),
    .view-title ~ :global(.events-grid),
    .view-title ~ :global(.events-selection .grid) {
      margin-top: 1.5rem !important;
    }

    /* ลบ margin-top ของ element แรกหลัง view-title */
    .view-title + *:not(.filter-slide-wrapper) {
      margin-top: 1.5rem;
    }

    .grid {
      margin-top: 0;
    }

    .events-selection {
      margin-top: 0;
    }

    .logs-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 1rem;
    }

    .btn-back-logs {
      width: 100%;
      justify-content: center;
    }

    .stats-dashboard {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 480px) {
    .stats-dashboard {
      grid-template-columns: 1fr;
    }

    .stat-value {
      font-size: 1.5rem;
    }

    .modal-container {
      max-height: 95vh;
    }
  }

  /* ปุ่มปิด (กากบาท) */
  :global(.modal-close-btn) {
    color: #fff !important;
    background: rgba(0, 0, 0, 0.3) !important;
    border-radius: 50%;
    width: 30px !important;
    height: 30px !important;
    display: flex !important;
    align-items: center;
    justify-content: center;
    top: 10px !important;
    right: auto !important;
    left: 10px !important;
  }

  @media (max-width: 1024px) {
    .desktop-only {
      display: none !important;
    }
    .mobile-only {
      display: flex;
    }
    .mobile-controls.mobile-only {
      display: flex !important;
    }
    .mobile-toggle {
      display: block;
    }
    .header-inner {
      padding: 0 1rem;
    }
    .page-content {
      padding: 2rem 1rem;
    }
  }

  @media (max-width: 768px) {
    /* MOBILE FILTER */
    .filter-bar {
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
      padding: 16px;
    }
    .search-input-wrapper {
      width: 100%;
    }
    .filter-actions-wrapper {
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
      width: 100%;
    }
    .filter-group-dropdowns {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .search-apply-btn {
      width: 100%;
    }

    .token-timer {
      font-size: 0.75rem;
      padding: 4px 10px;
    }

    /* MOBILE SWAL ADJUST */
    :global(div:where(.swal2-container) div:where(.swal2-popup)) {
      width: 85% !important;
      font-size: 0.9rem !important;
      padding: 1.5rem !important;
    }

    /* 1. จัดปุ่ม Holidays ให้เรียงลงมาแนวตั้ง (ไม่เบียดกัน) */
    .ce-holiday-buttons {
      grid-template-columns: 1fr; /* เปลี่ยนจาก 1fr 1fr เป็น 1fr */
      gap: 10px;
    }

    /* 2. ลดขนาดข้อความและ padding */
    .ce-check-row {
      padding: 12px; /* ลดจาก 14px */
      gap: 12px;
    }

    /* 3. ปรับขนาด checkbox ให้เล็กลง */
    .ce-check-row input {
      width: 18px;
      height: 18px;
    }

    /* 4. ลดขนาดตัวอักษร */
    .ce-check-title {
      font-size: 0.9rem; /* ลดจาก 0.95rem */
      line-height: 1.3;
    }

    .ce-check-desc {
      font-size: 0.75rem; /* ลดจาก 0.8rem */
      line-height: 1.4;
      margin-top: 3px;
    }

    /* 5. ปรับ Lock Overlay */
    .ce-lock-overlay {
      padding: 0 20px;
      text-align: center;
    }

    .ce-lock-overlay span {
      font-size: 0.85rem;
    }

    .ce-lock-icon-svg {
      width: 40px;
      height: 40px;
    }
  }

  /* ==========================================
   🎁 REWARD PAGE STYLES
   ========================================== */

  .reward-events-section,
  .reward-users-section {
    width: 100%;
  }

  .reward-search-bar {
    display: flex;
    gap: 1rem;
    margin-bottom: 2rem;
    flex-wrap: wrap;
  }

  .search-box-reward {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    background: rgba(15, 23, 42, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 0.75rem 1rem;
    flex: 1;
    min-width: 250px;
  }

  .search-box-reward :global(input) {
    background: transparent;
    border: none;
    outline: none;
    color: #f8fafc;
    font-size: 0.9rem;
    width: 100%;
  }

  .search-box-reward :global(input::placeholder) {
    color: #64748b;
  }

  .search-box-reward svg {
    color: #64748b;
    flex-shrink: 0;
  }

  .filter-dropdown-reward {
    position: relative;
  }

  .filter-trigger-reward {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: rgba(15, 23, 42, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 0.75rem 1rem;
    color: #94a3b8;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s;
    min-width: 120px;
  }

  .filter-trigger-reward:hover {
    border-color: rgba(16, 185, 129, 0.3);
    color: #10b981;
  }

  .filter-menu-reward {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    background: #1e293b;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 0.5rem;
    min-width: 150px;
    max-height: 250px;
    overflow-y: auto;
    z-index: 1000;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
  }

  .filter-option-reward {
    display: block;
    width: 100%;
    padding: 0.6rem 0.75rem;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: #94a3b8;
    font-size: 0.85rem;
    text-align: left;
    cursor: pointer;
    transition: all 0.2s;
  }

  .filter-option-reward:hover,
  .filter-option-reward.active {
    background: rgba(16, 185, 129, 0.1);
    color: #10b981;
  }

  /* Reward Header */
  .reward-header {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    margin-bottom: 2rem;
    flex-wrap: wrap;
  }

  .btn-back-reward {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: rgba(100, 116, 139, 0.1);
    border: 1px solid rgba(100, 116, 139, 0.3);
    border-radius: 10px;
    padding: 0.6rem 1rem;
    color: #94a3b8;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-back-reward:hover {
    background: rgba(100, 116, 139, 0.2);
    color: #f8fafc;
  }

  .reward-event-info :global(h3) {
    font-size: 1.25rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0 0 0.5rem 0;
  }

  .reward-event-meta {
    display: flex;
    gap: 1rem;
    color: #64748b;
    font-size: 0.85rem;
  }

  .reward-event-meta span {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  /* Tier Summary Cards */
  .tier-summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .tier-summary-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: rgba(30, 41, 59, 0.5);
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-radius: 14px;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
  }

  .tier-summary-card:hover {
    transform: translateY(-2px);
  }

  .tier-summary-card.active {
    border-width: 2px;
  }

  .tier-icon {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1rem;
    font-weight: 700;
    color: #1e293b;
    flex-shrink: 0;
  }

  .tier-info {
    flex: 1;
  }

  .tier-name {
    font-size: 0.95rem;
    font-weight: 600;
    margin-bottom: 0.25rem;
  }

  .tier-progress {
    font-size: 0.8rem;
    color: #64748b;
  }

  .tier-requirement {
    font-size: 0.75rem;
    color: #64748b;
  }

  .tier-all {
    background: rgba(100, 116, 139, 0.1);
    border-color: rgba(100, 116, 139, 0.3);
  }

  /* Filter Section */
  .reward-filter-section {
    display: flex;
    gap: 1rem;
    margin-bottom: 2rem;
    flex-wrap: wrap;
  }

  .btn-apply-reward,
  .btn-reset-reward {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem;
    border-radius: 10px;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-apply-reward {
    background: linear-gradient(135deg, #10b981, #059669);
    border: none;
    color: white;
  }

  .btn-apply-reward:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
  }

  .btn-reset-reward {
    background: transparent;
    border: 1px solid rgba(239, 68, 68, 0.5);
    color: #ef4444;
  }

  .btn-reset-reward:hover {
    background: rgba(239, 68, 68, 0.1);
  }

  /* Reward Users Grid */
  .reward-users-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 1.5rem;
  }

  .reward-user-card {
    background: rgba(30, 41, 59, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    padding: 1.5rem;
    position: relative;
    transition: all 0.3s;
  }

  .reward-user-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
    border-color: rgba(16, 185, 129, 0.3);
  }

  .reward-rank-badge {
    position: absolute;
    top: -10px;
    left: 20px;
    padding: 0.35rem 0.75rem;
    border-radius: 20px;
    font-size: 0.8rem;
    font-weight: 700;
    color: #1e293b;
  }

  .reward-user-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.25rem;
    padding-top: 0.5rem;
  }

  .reward-user-avatar {
    width: 50px;
    height: 50px;
    border-radius: 50%;
    overflow: hidden;
    border: 2px solid rgba(255, 255, 255, 0.1);
  }

  .reward-user-avatar :global(img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .reward-user-info {
    flex: 1;
  }

  .reward-user-info :global(h4) {
    font-size: 1rem;
    font-weight: 600;
    color: #f8fafc;
    margin: 0 0 0.25rem 0;
  }

  .reward-user-id {
    font-size: 0.8rem;
    color: #64748b;
  }

  .reward-tier-badge {
    padding: 0.35rem 0.75rem;
    border-radius: 20px;
    font-size: 0.75rem;
    font-weight: 600;
    border: 1px solid;
  }

  /* Progress */
  .reward-progress-section {
    margin-bottom: 1.25rem;
  }

  .reward-progress-label {
    display: flex;
    justify-content: space-between;
    font-size: 0.8rem;
    color: #94a3b8;
    margin-bottom: 0.5rem;
  }

  .reward-progress-bar {
    height: 8px;
    background: rgba(100, 116, 139, 0.2);
    border-radius: 10px;
    overflow: hidden;
  }

  .reward-progress-fill {
    height: 100%;
    border-radius: 10px;
    transition: width 0.5s ease;
  }

  /* Details */
  .reward-details-grid {
    display: grid;
    gap: 0.75rem;
    margin-bottom: 1.25rem;
  }

  .reward-detail-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.6rem 0.75rem;
    background: rgba(15, 23, 42, 0.5);
    border-radius: 8px;
  }

  .reward-detail-label {
    font-size: 0.8rem;
    color: #64748b;
  }

  .reward-detail-value {
    font-size: 0.85rem;
    color: #f8fafc;
    font-weight: 500;
  }

  .reward-status-badge {
    padding: 0.25rem 0.6rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .reward-status-badge.completed {
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
  }

  .reward-status-badge.in-progress {
    background: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
  }

  .reward-status-badge.not-started {
    background: rgba(100, 116, 139, 0.15);
    color: #64748b;
  }

  /* Actions */
  .reward-actions {
    display: flex;
    gap: 0.75rem;
  }

  .btn-message {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.7rem 1rem;
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-radius: 10px;
    color: #3b82f6;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-message:hover {
    background: rgba(59, 130, 246, 0.2);
    transform: translateY(-2px);
  }

  .btn-view-reward {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.75rem;
    background: linear-gradient(135deg, #10b981, #059669);
    border: none;
    border-radius: 10px;
    color: white;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    margin-top: 1rem;
  }

  .btn-view-reward:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
  }

  /* Message Modal */
  .message-modal-container {
    background: #1e293b;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 20px;
    max-width: 500px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }

  .message-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .message-modal-header :global(h3) {
    font-size: 1.1rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .message-modal-body {
    padding: 1.5rem;
  }

  .message-recipient {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: rgba(15, 23, 42, 0.5);
    border-radius: 12px;
    margin-bottom: 1.5rem;
  }

  .message-recipient :global(img) {
    width: 50px;
    height: 50px;
    border-radius: 50%;
  }

  .message-recipient :global(h4) {
    font-size: 1rem;
    font-weight: 600;
    color: #f8fafc;
    margin: 0 0 0.25rem 0;
  }

  .message-recipient span {
    font-size: 0.85rem;
    color: #64748b;
  }

  .message-input-group {
    margin-bottom: 1rem;
  }

  .message-input-group :global(label) {
    display: block;
    font-size: 0.9rem;
    font-weight: 500;
    color: #94a3b8;
    margin-bottom: 0.5rem;
  }

  .message-input-group :global(textarea) {
    width: 100%;
    padding: 1rem;
    background: rgba(15, 23, 42, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    color: #f8fafc;
    font-size: 0.9rem;
    resize: vertical;
    min-height: 120px;
  }

  .message-input-group :global(textarea:focus) {
    outline: none;
    border-color: rgba(16, 185, 129, 0.5);
  }

  .message-input-group :global(textarea::placeholder) {
    color: #64748b;
  }

  .message-modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    padding: 1.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .btn-cancel {
    padding: 0.7rem 1.5rem;
    background: transparent;
    border: 1px solid rgba(100, 116, 139, 0.3);
    border-radius: 10px;
    color: #94a3b8;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-cancel:hover {
    background: rgba(100, 116, 139, 0.1);
  }

  .btn-send {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.7rem 1.5rem;
    background: linear-gradient(135deg, #10b981, #059669);
    border: none;
    border-radius: 10px;
    color: white;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-send:hover:not(:disabled) {
    background: rgba(16, 185, 129, 0.2);
    border-color: #10b981;
    transform: translateY(-2px);
  }

  /* Responsive */
  @media (max-width: 768px) {
    .reward-search-bar {
      flex-direction: column;
    }

    .filter-dropdown-reward {
      width: 100%;
    }

    .filter-trigger-reward {
      width: 100%;
      justify-content: space-between;
    }

    .tier-summary-grid {
      grid-template-columns: 1fr;
    }

    .reward-users-grid {
      grid-template-columns: 1fr;
    }

    .reward-header {
      flex-direction: column;
      align-items: flex-start;
    }

    .reward-filter-section {
      flex-direction: column;
    }

    .btn-apply-reward,
    .btn-reset-reward {
      width: 100%;
      justify-content: center;
    }

    .perf-monitor {
      display: none;
    }
    .perf-graph {
      width: 40px;
      height: 20px;
    }
    .perf-stats {
      gap: 4px;
    }
    .perf-latency {
      font-size: 0.7rem;
      min-width: 36px;
    }
    .perf-status-dot {
      width: 6px;
      height: 6px;
    }
    .perf-tooltip {
      width: 200px;
      right: -20px;
    }
  }

  /* ===== VERIFY PROOF STYLES ===== */

  /* Pending Badge on Event Card */
  .pending-badge-overlay {
    position: absolute;
    top: 12px;
    right: 12px;
    background: #f59e0b;
    color: #000;
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 700;
    z-index: 5;
  }

  .verify-proof-submissions-section {
    margin-top: 1.5rem;
  }

  /* ===== FILTER STYLES ===== */

  .nisit-filter-box.std-id-box {
    width: 100px;
  }

  /* Date Filter Dropdown */
  .date-filter-dropdown {
    position: relative;
    min-width: 140px;
  }

  .date-filter-trigger {
    width: 100%;
    padding: 0.65rem 1rem;
    background: rgba(15, 23, 42, 0.8);
    border: 1px solid rgba(71, 85, 105, 0.5);
    border-radius: 8px;
    color: #f8fafc;
    font-size: 0.85rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    transition: all 0.2s;
  }

  .date-filter-trigger:hover {
    border-color: rgba(71, 85, 105, 0.8);
  }

  .date-filter-trigger:focus {
    outline: none;
    border-color: #22d3ee;
  }

  .date-filter-menu {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    background: #1e293b;
    border: 1px solid rgba(71, 85, 105, 0.5);
    border-radius: 8px;
    padding: 4px;
    z-index: 100;
    max-height: 200px;
    overflow-y: auto;
  }

  .date-filter-option {
    width: 100%;
    padding: 8px 12px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: #94a3b8;
    font-size: 0.85rem;
    text-align: left;
    cursor: pointer;
    transition: all 0.15s;
  }

  .date-filter-option:hover {
    background: rgba(71, 85, 105, 0.3);
    color: #f8fafc;
  }

  .date-filter-option.active {
    background: rgba(34, 211, 238, 0.1);
    color: #22d3ee;
  }

  /* Reset Button */
  .btn-reset-filter {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.65rem 1rem;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    color: #ef4444;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .btn-reset-filter:hover {
    background: rgba(239, 68, 68, 0.2);
  }

  /* ===== PROOF CARD GRID ===== */
  .submissions-grid-new {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: 24px;
    margin-top: 20px;
  }

  /* ===== PROOF CARD ===== */
  .proof-card {
    background: #1e293b !important;
    border: 1px solid rgba(71, 85, 105, 0.4);
    border-radius: 20px;
    overflow: hidden;
    transition: all 0.3s ease;
    padding: 24px;
    position: relative;
  }

  .proof-card:hover {
    border-color: rgba(71, 85, 105, 0.6);
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  }

  /* Rank Circle - สีเขียว */
  .rank-circle {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    font-weight: 700;
    color: white;
    flex-shrink: 0;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    position: absolute;
    top: 24px;
    left: 24px;
  }

  /* User Details */
  .user-details {
    width: 100%;
    padding-top: 60px;
  }

  .user-details .user-name {
    font-size: 18px;
    font-weight: 600;
    color: #f8fafc;
    margin: 0 0 8px 0;
  }

  .user-details .user-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 8px 0;
    font-size: 14px;
    flex-wrap: wrap;
  }

  .user-meta .nisit-id {
    color: #10b981;
    font-family: "SF Mono", "Monaco", "Consolas", monospace;
    font-weight: 500;
  }

  .user-meta .separator {
    color: #475569;
  }

  .user-meta .user-email {
    color: #94a3b8;
  }

  .user-details .status-text {
    font-size: 14px;
    color: #64748b;
    margin: 0;
  }

  /* Proof Image Box */
  .proof-image-box {
    width: 100%;
    height: 220px;
    background: #0f172a;
    position: relative;
    cursor: pointer;
    overflow: hidden;
    border-radius: 12px;
    margin: 20px 0;
  }

  .proof-image-box img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.3s ease;
  }

  .proof-card:hover .proof-image-box img {
    transform: scale(1.05);
  }

  .image-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    opacity: 0;
    transition: opacity 0.3s ease;
    color: white;
    font-size: 14px;
    border-radius: 12px;
  }

  .proof-image-box:hover .image-overlay {
    opacity: 1;
  }

  .no-image-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    color: #475569;
    background: #0f172a;
    border-radius: 12px;
  }

  .no-image-placeholder span {
    font-size: 14px;
  }

  /* Action Buttons */
  .proof-card-actions {
    display: flex;
    gap: 12px;
    padding: 0;
  }

  .btn-reject,
  .btn-approve {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 14px 20px;
    border-radius: 12px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-reject {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.4);
    color: #f87171;
  }

  .btn-reject:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: #ef4444;
    transform: translateY(-2px);
  }

  .btn-approve {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    border: none;
    color: white;
  }

  .btn-approve:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(16, 185, 129, 0.4);
  }

  /* ===== PAGINATION ===== */
  .pagination-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    margin-top: 24px;
    padding-top: 24px;
  }

  .page-indicator-box {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 16px;
    background: rgba(30, 41, 59, 0.8);
    border: 1px solid rgba(71, 85, 105, 0.5);
    border-radius: 10px;
    color: #f8fafc;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .page-indicator-box:hover {
    border-color: rgba(71, 85, 105, 0.8);
  }

  .page-indicator-box .current-page {
    font-weight: 600;
    color: #22d3ee;
  }

  .page-indicator-box .sep {
    color: #475569;
  }

  .page-indicator-box .total-page {
    color: #94a3b8;
  }

  .page-indicator-box .dropdown-arrow {
    color: #64748b;
    transition: transform 0.2s;
  }

  .page-indicator-box .dropdown-arrow.flipped {
    transform: rotate(180deg);
  }

  .page-dropdown-list {
    position: absolute;
    bottom: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
    background: #1e293b;
    border: 1px solid rgba(71, 85, 105, 0.5);
    border-radius: 10px;
    padding: 6px;
    min-width: 120px;
    max-height: 200px;
    overflow-y: auto;
    z-index: 100;
  }

  .page-dropdown-item {
    width: 100%;
    padding: 8px 12px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: #94a3b8;
    font-size: 13px;
    text-align: center;
    cursor: pointer;
    transition: all 0.15s;
  }

  .page-dropdown-item:hover {
    background: rgba(71, 85, 105, 0.3);
    color: #f8fafc;
  }

  .page-dropdown-item.active {
    background: rgba(34, 211, 238, 0.1);
    color: #22d3ee;
  }

  .pagination-info {
    font-size: 13px;
    color: #64748b;
  }

  .click-outside {
    position: fixed;
    inset: 0;
    z-index: 99;
  }

  /* ===== RESPONSIVE ===== */
  @media (max-width: 768px) {
    .submissions-grid-new {
      grid-template-columns: 1fr;
    }

    .proof-card {
      padding: 20px;
    }

    .rank-circle {
      width: 42px;
      height: 42px;
      font-size: 14px;
      top: 20px;
      left: 20px;
    }

    .user-details {
      padding-top: 54px;
    }

    .user-details .user-name {
      font-size: 16px;
    }

    .proof-image-box {
      height: 180px;
    }

    .btn-reject,
    .btn-approve {
      padding: 12px 16px;
      font-size: 14px;
    }
  }

  @media (max-width: 480px) {
    .proof-card {
      padding: 16px;
    }

    .rank-circle {
      width: 36px;
      height: 36px;
      font-size: 12px;
      top: 16px;
      left: 16px;
    }

    .user-details {
      padding-top: 48px;
    }

    .proof-image-box {
      height: 160px;
    }

    .proof-card-actions {
      flex-direction: column;
      gap: 8px;
    }

    .btn-reject,
    .btn-approve {
      width: 100%;
    }
  }
  /* ===== NEW VERIFY FILTER SECTION ===== */ /* ===== NEW VERIFY FILTER SECTION ===== */
  .verify-filter-section-new {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px 20px;
    background: rgba(30, 41, 59, 0.5);
    border: 1px solid rgba(71, 85, 105, 0.3);
    border-radius: 12px;
    margin-bottom: 20px;
  }

  .verify-filter-row-new {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  /* Search Box */
  .verify-search-box-new {
    flex: 1;
    min-width: 280px;
    max-width: 600px;
    position: relative;
    display: flex;
    align-items: center;
  }

  .verify-search-box-new :global(.search-icon) {
    position: absolute;
    left: 14px;
    color: #64748b;
    pointer-events: none;
  }

  .verify-search-box-new :global(input) {
    width: 100%;
    padding: 10px 14px 10px 44px;
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(71, 85, 105, 0.4);
    border-radius: 8px;
    color: #f8fafc;
    font-size: 14px;
    transition: all 0.2s;
  }

  .verify-search-box-new :global(input:focus) {
    outline: none;
    border-color: #22d3ee;
    background: rgba(15, 23, 42, 0.8);
  }

  .verify-search-box-new :global(input::placeholder) {
    color: #64748b;
  }

  /* Filter Buttons (Batch, Std ID) */
  .verify-filter-btn {
    padding: 10px 16px;
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(71, 85, 105, 0.4);
    border-radius: 8px;
    color: #94a3b8;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .verify-filter-btn:hover {
    border-color: rgba(71, 85, 105, 0.6);
    color: #f8fafc;
  }

  .verify-filter-btn.active {
    background: rgba(34, 211, 238, 0.1);
    border-color: #22d3ee;
    color: #22d3ee;
  }

  /* Dropdown */
  .verify-dropdown-new {
    position: relative;
    min-width: 90px;
  }

  .verify-dropdown-new.date-select {
    min-width: 130px;
  }

  .verify-dropdown-trigger-new {
    width: 100%;
    padding: 10px 12px;
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(71, 85, 105, 0.4);
    border-radius: 8px;
    color: #f8fafc;
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.2s;
  }

  .verify-dropdown-trigger-new:hover {
    border-color: rgba(71, 85, 105, 0.6);
  }

  .verify-dropdown-trigger-new:focus {
    outline: none;
    border-color: #22d3ee;
  }

  .verify-dropdown-trigger-new svg {
    color: #64748b;
    flex-shrink: 0;
  }

  .verify-dropdown-trigger-new span {
    flex: 1;
    text-align: left;
  }

  .verify-dropdown-trigger-new :global(.chevron) {
    transition: transform 0.2s;
  }

  .verify-dropdown-menu-new {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    background: #1e293b;
    border: 1px solid rgba(71, 85, 105, 0.5);
    border-radius: 8px;
    padding: 4px;
    z-index: 100;
    max-height: 200px;
    overflow-y: auto;
  }

  .verify-dropdown-option-new {
    width: 100%;
    padding: 10px 12px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: #94a3b8;
    font-size: 14px;
    text-align: left;
    cursor: pointer;
    transition: all 0.15s;
  }

  .verify-dropdown-option-new:hover {
    background: rgba(71, 85, 105, 0.3);
    color: #f8fafc;
  }

  .verify-dropdown-option-new.active {
    background: rgba(34, 211, 238, 0.1);
    color: #22d3ee;
  }

  /* Filter Label */
  .filter-label-new {
    color: #94a3b8;
    font-size: 14px;
    white-space: nowrap;
  }

  /* Apply Button */
  .verify-btn-apply-new {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 16px;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    border: none;
    border-radius: 8px;
    color: white;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .verify-btn-apply-new:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
  }

  /* Reset Button */
  .verify-btn-reset-new {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 16px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    color: #ef4444;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .verify-btn-reset-new:hover {
    background: rgba(239, 68, 68, 0.2);
  }

  /* Responsive */
  @media (max-width: 768px) {
    .verify-filter-row-new {
      flex-direction: column;
      align-items: stretch;
    }

    .verify-search-box-new {
      min-width: 100%;
      max-width: 100%;
    }

    .verify-dropdown-new,
    .verify-dropdown-new.date-select {
      width: 100%;
    }

    .verify-filter-btn {
      width: 100%;
      justify-content: center;
    }

    .filter-label-new {
      display: none;
    }
  }

  .verify-input-box :global(input) {
    width: 100%;
    padding: 12px 10px;
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(71, 85, 105, 0.4);
    border-radius: 8px;
    color: #f8fafc;
    font-size: 14px;
    text-align: center;
    font-family: "Monaco", "Consolas", monospace;
    transition: all 0.2s;
  }

  .verify-input-box :global(input:focus) {
    outline: none;
    border-color: #22d3ee;
    background: rgba(15, 23, 42, 0.8);
  }

  .verify-input-box :global(input::placeholder) {
    color: #64748b;
    font-family: inherit;
  }

  /* Dropdown */
  .verify-dropdown {
    position: relative;
    min-width: 100px;
  }

  .verify-dropdown.date-select {
    min-width: 140px;
  }

  .verify-dropdown-trigger {
    width: 100%;
    padding: 10px 12px;
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(71, 85, 105, 0.4);
    border-radius: 8px;
    color: #f8fafc;
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.2s;
  }

  .verify-dropdown-trigger:hover {
    border-color: rgba(71, 85, 105, 0.6);
  }

  .verify-dropdown-trigger:focus {
    outline: none;
    border-color: #22d3ee;
  }

  .verify-dropdown-trigger svg {
    color: #64748b;
    flex-shrink: 0;
  }

  .verify-dropdown-trigger span {
    flex: 1;
    text-align: left;
  }

  .verify-dropdown-trigger :global(.chevron) {
    transition: transform 0.2s;
  }

  .verify-dropdown-menu {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    background: #1e293b;
    border: 1px solid rgba(71, 85, 105, 0.5);
    border-radius: 8px;
    padding: 4px;
    z-index: 100;
    max-height: 200px;
    overflow-y: auto;
  }

  .verify-dropdown-option {
    width: 100%;
    padding: 10px 12px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: #94a3b8;
    font-size: 14px;
    text-align: left;
    cursor: pointer;
    transition: all 0.15s;
  }

  .verify-dropdown-option:hover {
    background: rgba(71, 85, 105, 0.3);
    color: #f8fafc;
  }

  .verify-dropdown-option.active {
    background: rgba(34, 211, 238, 0.1);
    color: #22d3ee;
  }

  /* Filter Label */
  .filter-label {
    color: #94a3b8;
    font-size: 14px;
    white-space: nowrap;
  }

  /* Buttons */
  .verify-btn-apply {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 16px;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    border: none;
    border-radius: 8px;
    color: white;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .verify-btn-apply:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
  }

  .verify-btn-reset {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 16px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    color: #ef4444;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .verify-btn-reset:hover {
    background: rgba(239, 68, 68, 0.2);
  }

  /* Click outside overlay */
  .click-outside {
    position: fixed;
    inset: 0;
    z-index: 99;
  }

  /* ===== RESPONSIVE ===== */
  @media (max-width: 768px) {
    .verify-filter-row {
      flex-direction: column;
      align-items: stretch;
    }

    .verify-search-box {
      min-width: 100%;
    }

    .verify-input-box,
    .verify-input-box.std-id,
    .verify-dropdown,
    .verify-dropdown.date-select {
      width: 100%;
    }

    .filter-label {
      display: none;
    }

    .verify-btn-apply,
    .verify-btn-reset {
      flex: 1;
      justify-content: center;
    }
  }

  /* ===== RESPONSIVE FOR VERIFY PROOF FILTER ===== */
  @media (max-width: 768px) {
    .verify-proof-filter :global(.filter-row-logs) {
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    /* แถว 1: Search Box (100%) */
    .verify-proof-filter
      :global(.filter-row-logs:first-child .search-box-logs) {
      flex: 1 1 100%;
    }

    /* แถว 1: Batch + Std ID (แถวเดียวกัน 50% + 50%) */
    .verify-proof-filter
      :global(.filter-row-logs:first-child .nisit-filter-box) {
      flex: 1 1 calc(50% - 0.25rem);
    }

    /* แถว 2: Filter (100%) */
    .verify-proof-filter
      :global(.filter-row-logs:last-child .filter-dropdown-logs) {
      flex: 1 1 100%;
      position: relative;
      z-index: 10;
    }

    .verify-proof-filter
      :global(.filter-row-logs:last-child .filter-dropdown-logs.dropdown-open) {
      z-index: 150;
    }

    /* แถว 2: Date From + To (แถวเดียวกัน 50% + 50%) */
    .verify-proof-filter
      :global(.filter-row-logs:last-child .date-input-group-logs) {
      flex: 1 1 calc(50% - 0.25rem);
      position: relative;
      z-index: 10;
    }

    .verify-proof-filter
      :global(
        .filter-row-logs:last-child .date-input-group-logs.dropdown-open
      ) {
      z-index: 150;
    }

    .verify-proof-filter
      :global(.filter-row-logs:last-child .custom-date-trigger-logs) {
      width: 100%;
      min-width: unset;
    }

    .verify-proof-filter
      :global(.filter-row-logs:last-child .custom-date-trigger-logs span) {
      font-size: 0.8rem;
    }

    /* แถว 2: Buttons Apply + Reset (แถวเดียวกัน 50% + 50%) */
    .verify-proof-filter :global(.filter-row-logs:last-child .btn-apply-logs),
    .verify-proof-filter :global(.filter-row-logs:last-child .btn-reset-logs) {
      flex: 1 1 calc(50% - 0.25rem);
      justify-content: center;
    }

    /* ป้องกัน dropdown ถูกซ้อนทับ */
    .verify-proof-filter :global(.filter-menu-logs),
    .verify-proof-filter :global(.custom-date-menu-logs) {
      z-index: 200 !important;
      min-width: 175px;
      max-width: 250px;
    }
  }

  @media (max-width: 768px) {
    .filter-section-logs .filter-row-logs {
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    /* แถวที่ 1 */
    .filter-section-logs .filter-row-logs:first-child .search-box-logs {
      flex: 1 1 100%;
    }

    .filter-section-logs .filter-row-logs:first-child .nisit-filter-box {
      flex: 1 1 calc(50% - 0.25rem);
    }

    /* แถวที่ 2 */
    .filter-section-logs .filter-row-logs:last-child {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .filter-section-logs .filter-row-logs:last-child .filter-dropdown-logs {
      flex: 1 1 100%;
      position: relative;
      z-index: 10;
    }

    .filter-section-logs
      .filter-row-logs:last-child
      .filter-dropdown-logs.dropdown-open {
      z-index: 150;
    }

    /* Date Inputs - อยู่แถวเดียวกัน */
    .filter-section-logs .filter-row-logs:last-child .date-input-group-logs {
      flex: 1 1 calc(50% - 0.25rem);
      position: relative;
      z-index: 10;
    }

    .filter-section-logs
      .filter-row-logs:last-child
      .date-input-group-logs.dropdown-open {
      z-index: 150;
    }

    .filter-section-logs .filter-row-logs:last-child .custom-date-trigger-logs {
      width: 100%;
    }

    /* Buttons - อยู่แถวเดียวกัน */
    .filter-section-logs .filter-row-logs:last-child .btn-apply-logs,
    .filter-section-logs .filter-row-logs:last-child .btn-reset-logs {
      flex: 1 1 calc(50% - 0.25rem);
      justify-content: center;
    }

    /* ป้องกัน dropdown ทับกัน */
    .filter-section-logs .filter-menu-logs,
    .filter-section-logs .custom-date-menu-logs {
      z-index: 200 !important;
    }
  }

  /* ปุ่มลูกศรซ้ายขวา (พื้นหลังเข้ม) */
  .page-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 8px;
    border: 1px solid #374151;
    background-color: #1f2937;
    color: #10b981;
    cursor: pointer;
    transition: all 0.2s;
  }

  /* เพิ่มตรงนี้ */
  .page-btn svg {
    display: block;
    width: 20px;
    height: 20px;
    color: inherit; /* รับค่าสีจากปุ่ม */
  }

  .page-btn:hover:not(:disabled) {
    background-color: #374151;
  }

  .page-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
    color: #333; /* สีเทาเมื่อกดไม่ได้ */
  }

  /* กล่องตัวเลขตรงกลาง */
  .page-select-wrapper {
    position: relative;
  }

  .page-indicator-box {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-width: 80px;
    height: 36px;
    padding: 0 12px;
    border-radius: 8px;
    border: 1px solid #374151;
    background-color: #1f2937; /* พื้นหลังสีเข้ม */
    color: #9ca3af; /* สีตัวอักษรปกติ (เทา) */
    font-size: 0.875rem;
    cursor: pointer;
  }

  /* ตัวเลขหน้าปัจจุบัน -> สีเขียว */
  .current-page {
    color: #10b981 !important; /* เขียว */
    font-weight: 600;
  }

  .sep {
    margin: 0 4px;
    color: #4b5563;
  }

  .dropdown-arrow {
    margin-left: 6px;
    color: #6b7280;
    transition: transform 0.2s;
  }
  .dropdown-arrow.flipped {
    transform: rotate(180deg);
  }

  /* Dropdown List (พื้นหลังเข้ม) */
  .page-dropdown-list {
    position: absolute;
    bottom: 100%; /* ให้เด้งขึ้นด้านบน */
    left: 50%;
    transform: translateX(-50%);
    margin-bottom: 8px;
    width: 100%;
    min-width: 100px;
    background-color: #1f2937;
    border: 1px solid #374151;
    border-radius: 8px;
    padding: 4px;
    z-index: 50;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
  }

  .page-dropdown-item {
    width: 100%;
    padding: 6px 0;
    text-align: center;
    color: #d1d5db; /* สีตัวหนังสือใน dropdown */
    background: transparent;
    border: none;
    cursor: pointer;
    border-radius: 4px;
    font-size: 0.875rem;
  }

  .page-dropdown-item:hover {
    background-color: #374151;
  }

  /* รายการที่เลือกอยู่ -> สีเขียว */
  .page-dropdown-item.active {
    color: #10b981; /* เขียว */
    font-weight: bold;
    background-color: rgba(16, 185, 129, 0.1); /* พื้นหลังเขียวจางๆ */
  }

  .click-outside {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 40;
  }

  /* Wrapper เพื่อ scope ทุกอย่าง */
  .unlock-user-component {
    width: 100%;
    max-width: 460px;
    margin: 0 auto;
  }

  .unlock-card {
    background: #1e293b;
    border: 1px solid rgba(71, 85, 105, 0.5);
    border-radius: 20px;
    padding: 40px 32px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
  }

  .unlock-card-header {
    text-align: center;
    margin-bottom: 36px;
  }

  .unlock-icon-circle {
    width: 80px;
    height: 80px;
    margin: 0 auto 24px;
    background: rgba(16, 185, 129, 0.1);
    border: 2px solid #10b981;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #10b981;
    position: relative;
  }

  /* ส่วนนี้สำคัญ - สร้างวงขยับๆ */
  .unlock-icon-circle::before {
    content: "";
    position: absolute;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    border: 2px solid #10b981;
    opacity: 0.3;
    animation: unlock-ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
  }

  @keyframes unlock-ping {
    75%,
    100% {
      transform: scale(1.3);
      opacity: 0;
    }
  }

  .unlock-main-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #ffffff;
    margin: 0 0 12px 0;
    letter-spacing: -0.02em;
  }

  .unlock-sub-title {
    font-size: 0.9rem;
    color: #94a3b8;
    line-height: 1.5;
    max-width: 340px;
    margin: 0 auto;
  }

  .unlock-form-section {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .unlock-form-group {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .unlock-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: #cbd5e1;
    text-align: left;
  }

  .unlock-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    background: rgba(15, 23, 42, 0.5);
    border: 1px solid rgba(71, 85, 105, 0.6);
    border-radius: 10px;
    transition: all 0.2s;
    height: 50px;
    overflow: hidden;
  }

  .unlock-input-wrapper:focus-within {
    border-color: #10b981;
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
    background: rgba(15, 23, 42, 0.8);
  }

  .unlock-input-wrapper.unlock-error {
    border-color: #ef4444 !important;
    box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1) !important;
  }

  .unlock-input-wrapper input {
    width: 100%;
    height: 100%;
    border: none;
    background: transparent;
    color: #e2e8f0;
    font-size: 14px;
    padding: 0 16px;
    outline: none;
  }

  .unlock-input-wrapper input::placeholder {
    color: #64748b;
  }

  .unlock-input-wrapper input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .unlock-notification {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 14px 16px;
    border-radius: 10px;
    font-size: 14px;
    text-align: center;
    line-height: 1.4;
    font-weight: 500;
  }

  .unlock-notification.unlock-error {
    background: rgba(239, 68, 68, 0.15);
    color: #fca5a5;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .unlock-notification.unlock-success {
    background: rgba(16, 185, 129, 0.15);
    color: #6ee7b7;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .unlock-notif-icon {
    flex-shrink: 0;
    margin-top: 1px;
  }

  .unlock-submit-btn {
    width: 100%;
    height: 50px;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 10px;
    background: #10b981;
    color: #ffffff;
    font-weight: 600;
    font-size: 15px;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 4px 14px rgba(16, 185, 129, 0.3);
    margin-top: 4px;
  }

  .unlock-submit-btn:hover:not(:disabled) {
    background: #059669;
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(16, 185, 129, 0.4);
  }

  .unlock-submit-btn:active:not(:disabled) {
    transform: translateY(0);
  }

  .unlock-submit-btn:disabled {
    background: #475569;
    color: #94a3b8;
    cursor: not-allowed;
    box-shadow: none;
  }

  .unlock-spinner {
    width: 18px;
    height: 18px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top: 2px solid #fff;
    border-radius: 50%;
    animation: unlock-spin 0.8s linear infinite;
  }

  @keyframes unlock-spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  /* SweetAlert Dark Theme */
  :global(.unlock-swal-popup) {
    background: #1e293b !important;
    border: 1px solid rgba(71, 85, 105, 0.5) !important;
    border-radius: 20px !important;
    color: #ffffff !important;
  }

  :global(.unlock-swal-popup .swal2-title) {
    color: #ffffff !important;
  }

  :global(.unlock-swal-popup .swal2-html-container) {
    color: #cbd5e1 !important;
  }

  :global(.my-swal-popup) {
    background: #1e293b !important;
    border: 1px solid rgba(71, 85, 105, 0.5) !important;
    color: #ffffff !important;
  }

  :global(.my-swal-popup .swal2-title) {
    color: #ffffff !important;
  }

  :global(.my-swal-popup .swal2-html-container) {
    color: #cbd5e1 !important;
  }

  :global(.swal2-icon.swal2-success) {
    border-color: #10b981 !important;
  }

  :global(.swal2-icon.swal2-success [class^="swal2-success-line"]) {
    background-color: #10b981 !important;
  }

  :global(.swal2-icon.swal2-success .swal2-success-ring) {
    border: 0.25em solid rgba(16, 185, 129, 0.3) !important;
  }

  * {
    font-family: "Inter", sans-serif;
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  .settings-container {
    width: 100%;
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
  }

  /* Loading State */
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    gap: 20px;
    color: #9ca3af;
  }

  .loader {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(16, 185, 129, 0.2);
    border-top-color: #10b981;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Settings Content */
  .settings-content {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  /* Header Section */
  .header-section {
    display: flex;
    align-items: center;
    gap: 16px;
    padding-bottom: 24px;
    border-bottom: 2px solid rgba(16, 185, 129, 0.2);
  }

  .icon-wrapper {
    width: 56px;
    height: 56px;
    border-radius: 16px;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    box-shadow: 0 8px 16px rgba(16, 185, 129, 0.3);
  }

  .header-text h1 {
    font-size: 28px;
    font-weight: 700;
    color: #f3f4f6;
    margin: 0;
  }

  .header-text p {
    font-size: 14px;
    color: #9ca3af;
    margin: 4px 0 0 0;
  }

  /* Info Card */
  .info-card {
    background: rgba(31, 41, 55, 0.5);
    border: 1px solid rgba(55, 65, 81, 0.8);
    border-radius: 16px;

    backdrop-filter: blur(10px);
  }

  .card-headerr {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 12px;
    padding: 20px 24px;
    background: rgba(16, 185, 129, 0.05);
    border-bottom: 1px solid rgba(55, 65, 81, 0.5);
  }

  .card-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: rgba(16, 185, 129, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #10b981;
  }

  .card-header :global(h2) {
    font-size: 18px;
    font-weight: 600;
    color: #f3f4f6;
    margin: 0;
  }

  .card-content {
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  /* Form Fields */
  .field-row {
    display: flex;
    gap: 12px;
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .form-field label {
    font-size: 13px;
    font-weight: 600;
    color: #d1d5db;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .input-wrapper {
    height: 48px;
    padding: 0 16px;
    background: rgba(17, 24, 39, 0.8);
    border: 2px solid #374151;
    border-radius: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.2s ease;
  }

  .input-wrapper:focus-within {
    border-color: #10b981;
    background: rgba(17, 24, 39, 0.95);
    box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.1);
  }

  .input-wrapper.error {
    border-color: #ef4444;
    box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.15);
    animation: shake 0.4s ease;
  }

  @keyframes shake {
    0%,
    100% {
      transform: translateX(0);
    }
    25% {
      transform: translateX(-5px);
    }
    75% {
      transform: translateX(5px);
    }
  }

  .input-wrapper input {
    flex: 1;
    border: none;
    background: transparent;
    color: #f3f4f6;
    font-size: 15px;
    outline: none;
  }

  .input-wrapper input::placeholder {
    color: #6b7280;
  }

  .input-wrapper.locked {
    background: rgba(17, 24, 39, 0.4);
    border-color: #2d3748;
    opacity: 0.6;
    cursor: not-allowed;
  }

  .input-wrapper.locked input {
    color: #9ca3af;
    cursor: not-allowed;
  }

  .input-wrapper svg {
    flex-shrink: 0;
    opacity: 0.5;
  }

  /* Custom Select */
  .custom-select {
    position: relative;
    width: 100%;
  }

  .custom-select.disabled {
    opacity: 0.5;
    pointer-events: none;
  }

  .select-btn {
    width: 100%;
    height: 48px;
    padding: 0 16px;
    background: rgba(17, 24, 39, 0.8);
    border: 2px solid #374151;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: #f3f4f6;
    font-size: 15px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .select-btn:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .select-btn.active {
    border-color: #10b981;
    background: rgba(17, 24, 39, 0.95);
    box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.1);
  }

  .select-btn.error {
    border-color: #ef4444;
    box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.15);
    animation: shake 0.4s ease;
  }

  .select-btn span.placeholder {
    color: #6b7280;
  }

  .select-btn .arrow {
    color: #9ca3af;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .select-btn .arrow.rotate {
    transform: rotate(180deg);
    color: #10b981;
  }

  .dropdown-menu {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    width: 100%;
    max-height: 240px;
    overflow-y: auto;
    background: rgba(31, 41, 55, 0.98);
    border: 2px solid #374151;
    border-radius: 12px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
    z-index: 100;
    backdrop-filter: blur(10px);
  }

  .dropdown-menu::-webkit-scrollbar {
    width: 6px;
  }

  .dropdown-menu::-webkit-scrollbar-track {
    background: transparent;
  }

  .dropdown-menu::-webkit-scrollbar-thumb {
    background: #4b5563;
    border-radius: 3px;
  }

  .dropdown-item {
    width: 100%;
    padding: 12px 16px;
    background: transparent;
    border: none;
    border-bottom: 1px solid rgba(55, 65, 81, 0.3);
    color: #f3f4f6;
    font-size: 14px;
    text-align: left;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .dropdown-item:last-child {
    border-bottom: none;
  }

  .dropdown-item:hover {
    background: rgba(16, 185, 129, 0.1);
    color: #10b981;
  }

  /* Password Row */
  .password-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .change-link {
    font-size: 12px;
    font-weight: 700;
    color: #10b981;
    text-decoration: none;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    transition: all 0.2s ease;
  }

  .change-link:hover {
    color: #059669;
    text-decoration: underline;
  }

  /* Feedback Toast */
  .feedback-toast {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 20px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 500;
  }

  .feedback-toast.error {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #ef4444;
  }

  .feedback-toast.success {
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.3);
    color: #10b981;
  }

  .toast-icon {
    flex-shrink: 0;
  }

  /* Action Section */
  .action-section {
    position: sticky;
    bottom: 0;
    padding: 20px 0 0 0;
    background: linear-gradient(to top, rgba(15, 23, 42, 1) 70%, transparent);
  }

  .save-btn {
    width: 100%;
    height: 56px;
    padding: 0 24px;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    border: none;
    border-radius: 14px;
    color: white;
    font-size: 16px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    transition: all 0.3s ease;
    box-shadow: 0 8px 16px rgba(16, 185, 129, 0.3);
  }

  .save-btn:hover:not(.disabled) {
    transform: translateY(-2px);
    box-shadow: 0 12px 24px rgba(16, 185, 129, 0.4);
  }

  .save-btn:active:not(.disabled) {
    transform: translateY(0);
  }

  .save-btn.disabled {
    background: #374151;
    color: #6b7280;
    cursor: not-allowed;
    box-shadow: none;
  }

  .btn-loader {
    width: 18px;
    height: 18px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  /* Responsive */
  @media (max-width: 640px) {
    .settings-container {
      padding: 16px;
    }

    .header-section {
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
    }

    .icon-wrapper {
      width: 48px;
      height: 48px;
    }

    .header-text h1 {
      font-size: 24px;
    }

    .card-content {
      padding: 20px 16px;
    }

    .field-row {
      flex-direction: column;
    }

    .form-field {
      width: 100%;
    }
  }

  .ce-unit-label {
    font-size: 0.85rem;
    color: #10b981;
    font-weight: 600;
    margin-left: 4px;
    margin-right: 8px;
    pointer-events: none;
  }

  /* Language Toggle Button - Simple TH/EN */
  .lang-toggle-btn {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 8px 14px;
    background: linear-gradient(
      135deg,
      rgba(30, 41, 59, 0.95),
      rgba(15, 23, 42, 0.95)
    );
    border: 1px solid rgba(100, 116, 139, 0.3);
    border-radius: 10px;
    cursor: pointer;
    margin-right: 12px;
    transition: all 0.3s ease;
  }

  .lang-toggle-btn:hover {
    border-color: #10b981;
    background: linear-gradient(
      135deg,
      rgba(16, 185, 129, 0.1),
      rgba(15, 23, 42, 0.95)
    );
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
  }

  .lang-option {
    font-size: 13px;
    font-weight: 700;
    color: #64748b;
    transition: all 0.3s ease;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .lang-option.active {
    color: #10b981;
    background: rgba(16, 185, 129, 0.15);
  }

  .lang-divider {
    color: #475569;
    font-weight: 400;
    font-size: 13px;
  }

  /* Mobile Language Toggle */
  .lang-drawer-item {
    background: linear-gradient(
      135deg,
      rgba(16, 185, 129, 0.1),
      rgba(6, 95, 70, 0.05)
    ) !important;
    border: 1px solid rgba(16, 185, 129, 0.2) !important;
    margin-bottom: 8px;
    border-radius: 12px !important;
  }

  .lang-drawer-item:hover {
    background: linear-gradient(
      135deg,
      rgba(16, 185, 129, 0.2),
      rgba(6, 95, 70, 0.1)
    ) !important;
    border-color: #10b981 !important;
  }

  .lang-icon-mobile {
    color: #10b981;
    flex-shrink: 0;
  }

  .mobile-lang-option {
    font-weight: 700;
    color: #64748b;
    transition: all 0.3s ease;
  }

  .mobile-lang-option.active {
    color: #10b981;
  }

  .mobile-lang-divider {
    color: #475569;
    margin: 0 2px;
  }

  .drawer-divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.1);
    margin: 8px 0 16px 0;
  }

  @media (max-width: 768px) {
    .lang-toggle-btn {
      margin-right: 8px;
    }

    .lang-toggle-inner {
      padding: 6px 10px;
      gap: 4px;
    }

    .lang-flag {
      font-size: 16px;
    }

    .lang-text {
      font-size: 11px;
    }

    .lang-arrow {
      width: 10px;
      height: 10px;
    }
  }
</style>
