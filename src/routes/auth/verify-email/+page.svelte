<script lang="ts">
  import { goto } from "$app/navigation";
  import { base } from "$app/paths"; // ✅ ใช้ base path
  import { slide, scale } from "svelte/transition";
  import { onMount } from "svelte";

  const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

  let verifyStatus: "loading" | "success" | "error" = "loading";
  let message: string = "Verifying your email...";

  onMount(async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");

    if (!token) {
      verifyStatus = "error";
      message = "Invalid verification link (No token found).";
      return;
    }

    try {
      // จัดการ URL และลบ / ท้ายสุดออกป้องกัน path ซ้อน
      const cleanBase = API_BASE.replace(/\/$/, "");
      const res = await fetch(
        `${cleanBase}/api/users/verify-email?token=${token}`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        }
      );
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        verifyStatus = "success";
        message = "Email verified successfully.";
        // บันทึกสถานะว่า verify แล้ว (เผื่อใช้เช็คฝั่ง client)
        localStorage.setItem("register_verified", Date.now().toString());
        const channel = new BroadcastChannel("auth-sync");
        channel.postMessage("register-verified");
        channel.close();
      } else {
        verifyStatus = "error";
        message = data.detail || data.message || "Link expired or invalid.";
      }
    } catch (error) {
      verifyStatus = "error";
      message = "Cannot connect to server. Please try again later.";
    }
  });

  function handleBackToHome() {
    goto(`${base}/`);
  }

  // ✅ ฟังก์ชันไปหน้า Forgot Password (เพื่อขอ Link ใหม่)
  function handleRequestNewLink() {
    goto(`${base}/auth/forgot-password`);
  }
</script>

<div class="app-screen">
  <div class="scroll-container">
    <div class="content-wrapper">
      <div class="form-card">
        
        {#if verifyStatus === "loading"}
          <div class="icon-wrapper" in:scale={{ duration: 400 }}>
            <div class="loader"></div>
          </div>
          <div class="title-section" style="text-align: center;" in:slide>
            <h1 class="main-title">VERIFYING...</h1>
            <p class="sub-title">Please wait while we verify your email.</p>
          </div>
        {/if}

        {#if verifyStatus === "success"}
          <div class="icon-wrapper" in:scale={{ duration: 400, start: 0.5 }}>
            <div class="success-circle">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            </div>
          </div>
          <div class="title-section" style="text-align: center;" in:slide>
            <h1 class="main-title">VERIFICATION SUCCESS</h1>
            <p class="sub-title">{message}</p>
            <p class="sub-title" style="margin-top: 16px; color: #9ca3af; font-weight: 600;">
              You can close this window now.
            </p>
          </div>
          <div class="form-section" in:slide>
            <button class="primary-btn" on:click={handleBackToHome}>
                GO TO HOME
            </button>
          </div>
        {/if}

        {#if verifyStatus === "error"}
          <div class="icon-wrapper" in:scale={{ duration: 400, start: 0.5 }}>
            <div class="error-circle">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
            </div>
          </div>
          
          <div class="title-section" style="text-align: center;" in:slide>
            <h1 class="main-title" style="color: #ef4444;">VERIFICATION FAILED</h1>
            <p class="sub-title">{message}</p>
          </div>

          <div class="form-section" in:slide style="gap: 12px;">
            <p class="sub-title" style="text-align:center; font-size:13px; margin-bottom:4px;">
                Link expired or invalid?
            </p>
            
            <button class="primary-btn" on:click={handleRequestNewLink}>
                REQUEST NEW LINK
            </button>

            <button class="secondary-btn" on:click={handleBackToHome}>
              BACK TO HOME
            </button>
          </div>
        {/if}

      </div>
    </div>
  </div>
</div>

<style>
  @import url("https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap");

  :global(body) {
    margin: 0;
    padding: 0;
    background-color: #111827;
    color: white;
    font-family: "Inter", sans-serif;
    overflow: hidden;
  }
  :global(*) {
    font-family: "Inter", sans-serif !important;
  }

  .app-screen {
    height: 100vh;
    display: flex;
    flex-direction: column;
    position: relative;
  }

  .scroll-container {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding-top: 80px;
    padding-bottom: 40px;
    display: flex;
    align-items: flex-start;
  }

  .content-wrapper {
    width: 100%;
    max-width: 400px;
    margin: 0 auto;
    padding: 0 20px;
    box-sizing: border-box;
  }
  .form-card {
    width: 100%;
    display: flex;
    flex-direction: column;
  }
  .title-section {
    text-align: left;
    margin-bottom: 24px;
  }
  .main-title {
    color: #f3f4f6;
    font-size: 28px;
    font-weight: 700;
    line-height: 1.2;
    margin: 0 0 12px 0;
  }
  .sub-title {
    color: #9ca3af;
    font-size: 14px;
    margin: 0;
    line-height: 1.5;
  }
  .form-section {
    display: flex;
    flex-direction: column;
    margin-top: 10px;
  }

  /* Buttons */
  .primary-btn {
    width: 100%;
    padding: 14px 16px;
    background: #10b981;
    color: #111827;
    font-size: 16px;
    font-weight: 700;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
    text-transform: uppercase;
    box-shadow: 0 4px 6px rgba(16, 185, 129, 0.2);
  }
  .primary-btn:hover {
    background: #059669;
  }
  
  .secondary-btn {
    width: 100%;
    padding: 14px 16px;
    background: rgba(255, 255, 255, 0.1);
    color: #f3f4f6;
    font-size: 14px;
    font-weight: 600;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
    text-transform: uppercase;
  }
  .secondary-btn:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  /* Icons */
  .icon-wrapper {
    margin-bottom: 32px;
    display: flex;
    justify-content: center;
  }
  .success-circle {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    background: rgba(16, 185, 129, 0.1);
    border: 2px solid #10b981;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #10b981;
    box-shadow: 0 0 20px rgba(16, 185, 129, 0.2);
  }
  .error-circle {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    background: rgba(239, 68, 68, 0.1);
    border: 2px solid #ef4444;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #ef4444;
    box-shadow: 0 0 20px rgba(239, 68, 68, 0.2);
  }

  .loader {
    border: 4px solid rgba(255, 255, 255, 0.1);
    border-top: 4px solid #10b981;
    border-radius: 50%;
    width: 60px;
    height: 60px;
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
</style>