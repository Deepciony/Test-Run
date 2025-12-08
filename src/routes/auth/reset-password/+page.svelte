<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { slide, scale } from "svelte/transition";

  const API_BASE = import.meta.env.VITE_API_BASE_URL;


  let currentStep = 1;
  let isLoading = false;
  let token: string | null = null;

  let message: string = "";
  let messageType: "error" | "success" = "error";
  let messageTimeout: any;
  let errorField: string = "";


  onMount(() => {
    token = $page.url.searchParams.get("token");
    if (!token) {
      showMessage(
        "Invalid or missing token. Please request a new link.",
        "error"
      );
    }
  });

  function showMessage(
    msg: string,
    type: "error" | "success" = "error",
    field: string = ""
  ) {
    if (messageTimeout) clearTimeout(messageTimeout);
    message = msg;
    messageType = type;
    if (field) errorField = field;
    messageTimeout = setTimeout(() => {
      message = "";
      errorField = "";
    }, 3000);
  }

  function clearMessage() {
    if (message) {
      message = "";
      errorField = "";
      if (messageTimeout) clearTimeout(messageTimeout);
    }
  }

  let password = "";
  let confirmPassword = "";
  let showPassword1 = false;
  let showPassword2 = false;

  function validatePassword(value: string): boolean {
    return /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/.test(value);
  }

  async function handleSetNewPassword(): Promise<void> {
    clearMessage();
    if (!token) return showMessage("Missing token.", "error");

    if (!password)
      return showMessage("Please enter a new password.", "error", "password");
    if (!validatePassword(password))
      return showMessage(
        "Password must be 8+ chars & include a number.",
        "error",
        "password"
      );
    if (!confirmPassword)
      return showMessage(
        "Please confirm your password.",
        "error",
        "confirmPassword"
      );
    if (password !== confirmPassword)
      return showMessage("Passwords do not match.", "error", "confirmPassword");

    isLoading = true;
    try {
      const res = await fetch(`${API_BASE}/api/users/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token, new_password: password }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        currentStep = 2; // Success
      } else {
        const msg = data.detail || "Failed to reset password.";
        showMessage(msg, "error");
      }
    } catch (error) {
      showMessage("Cannot connect to server.", "error");
    } finally {
      isLoading = false;
    }
  }

  function handleFinish() {
    goto("/auth/login");
  }
</script>

<div class="app-screen">
  {#if currentStep === 1}
    <div class="glass-header">
      <button
        class="back-btn"
        on:click={() => goto("/auth/login")}
        disabled={isLoading}
        aria-label="Back to login"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          ><line x1="19" y1="12" x2="5" y2="12"></line><polyline
            points="12 19 5 12 12 5"
          ></polyline></svg
        >
      </button>
    </div>
  {/if}

  <div class="scroll-container" class:pt-120={currentStep === 2}>
    <div class="content-wrapper">
      <div class={currentStep === 2 ? "success-card" : "form-card"}>
        {#if currentStep === 1}
          <div class="title-section" in:slide>
            <h1 class="main-title">SET NEW PASSWORD</h1>
            <p class="sub-title">
              Create a new password. Ensure it differs from previous ones for
              security.
            </p>
          </div>
          <div class="form-section" in:slide>
            <div class="form-group">
              <label class="label" for="new-password">Password</label>
              <div
                class="input-field {errorField === 'password'
                  ? 'error-border'
                  : ''}"
              >
                <input
                  id="new-password"
                  type={showPassword1 ? "text" : "password"}
                  placeholder="Enter new password"
                  bind:value={password}
                  on:input={clearMessage}
                  disabled={isLoading}
                />

                <button
                  type="button"
                  class="toggle-password"
                  on:click={() => (showPassword1 = !showPassword1)}
                  aria-label={showPassword1 ? "Hide password" : "Show password"}
                >
                  {#if showPassword1}
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      ><path
                        d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
                      ></path><line x1="1" y1="1" x2="23" y2="23"></line></svg
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
                      ><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
                      ></path><circle cx="12" cy="12" r="3"></circle></svg
                    >
                  {/if}
                </button>
              </div>
            </div>

            <div class="form-group">
              <label class="label" for="confirm-password"
                >Confirm Password</label
              >
              <div
                class="input-field {errorField === 'confirmPassword'
                  ? 'error-border'
                  : ''}"
              >
                <input
                  id="confirm-password"
                  type={showPassword2 ? "text" : "password"}
                  placeholder="Confirm new password"
                  bind:value={confirmPassword}
                  on:input={clearMessage}
                  disabled={isLoading}
                />

                <button
                  type="button"
                  class="toggle-password"
                  on:click={() => (showPassword2 = !showPassword2)}
                  aria-label={showPassword2 ? "Hide password" : "Show password"}
                >
                  {#if showPassword2}
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      ><path
                        d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
                      ></path><line x1="1" y1="1" x2="23" y2="23"></line></svg
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
                      ><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
                      ></path><circle cx="12" cy="12" r="3"></circle></svg
                    >
                  {/if}
                </button>
              </div>
            </div>

            {#if message}
              <div
                class="message-container {messageType}"
                transition:slide={{ duration: 200 }}
              >
                <span>{message}</span>
              </div>
            {/if}

            <button
              class="primary-btn"
              on:click={handleSetNewPassword}
              disabled={isLoading}
            >
              {#if isLoading}
                UPDATING...
              {:else}
                RESET PASSWORD
              {/if}
            </button>
          </div>
        {/if}

        {#if currentStep === 2}
          <div class="icon-wrapper" in:scale={{ duration: 400, start: 0.5 }}>
            <div class="success-circle">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><polyline points="20 6 9 17 4 12"></polyline></svg
              >
            </div>
          </div>
          <div class="title-section" style="text-align: center;">
            <h1 class="main-title">PASSWORD RESET</h1>
            <p class="sub-title">
              Your password has been successfully reset.<br />Click confirm to
              login.
            </p>
          </div>
          <button class="primary-btn" type="button" on:click={handleFinish}
            >CONFIRM</button
          >
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
  :global(::placeholder) {
    font-family: "Inter", sans-serif !important;
    color: #6b7280;
  }

  input::-ms-reveal,
  input::-ms-clear {
    display: none;
  }
  input::-webkit-password-reveal-button {
    display: none;
    -webkit-appearance: none;
  }

  .app-screen {
    height: 100vh;
    display: flex;
    flex-direction: column;
    position: relative;
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
    padding: 0;
  }
  .back-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }
  .scroll-container {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
    padding-top: 100px;
    padding-bottom: 40px;
  }
  .scroll-container.pt-120 {
    padding-top: 120px;
  }
  .scroll-container::-webkit-scrollbar {
    display: none;
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
  .success-card {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  .title-section {
    text-align: left;
    margin-bottom: 32px;
  }
  .success-card .title-section {
    text-align: center;
    margin-bottom: 40px;
  }
  .main-title {
    color: #f3f4f6;
    font-size: 28px;
    font-weight: 700;
    line-height: 1.2;
    margin: 0 0 12px 0;
  }
  .success-card .main-title {
    font-size: 24px;
    letter-spacing: 0.5px;
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
  }
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 24px;
  }
  .label {
    color: #f3f4f6;
    font-size: 18px;
    font-weight: 600;
  }
  .input-field {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 54px;
    padding: 0 16px;
    background: #1f2937;
    border: 2px solid #374151;
    border-radius: 12px;
    transition: all 0.2s;
  }
  .input-field:focus-within {
    border-color: #10b981;
    background: #111827;
  }
  .input-field input {
    flex: 1;
    border: none;
    background: transparent;
    color: #f3f4f6;
    font-size: 16px;
    outline: none;
    height: 100%;
    padding: 0;
  }
  .error-border {
    border-color: #ef4444 !important;
    box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.25) !important;
  }
  .toggle-password {
    background: none;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    display: flex;
    padding: 0;
    transition: color 0.2s;
  }
  .toggle-password:hover {
    color: #f3f4f6;
  }
  .message-container {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px 14px;
    border-radius: 8px;
    margin-bottom: 24px;
    font-size: 13px;
    font-weight: 600;
    gap: 10px;
    text-align: center;
    width: 100%;
    box-sizing: border-box;
  }
  .message-container.error {
    background-color: #fef2f2;
    border: 1px solid #fecaca;
    color: #b91c1c;
  }
  .message-container.success {
    background-color: #ecfdf5;
    border: 1px solid #a7f3d0;
    color: #047857;
  }
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
    transition: background 0.2s;
    text-transform: uppercase;
    box-shadow: 0 4px 6px rgba(16, 185, 129, 0.2);
  }
  .primary-btn:hover {
    background: #059669;
  }
  .primary-btn:active {
    transform: scale(0.98);
  }
  .icon-wrapper {
    margin-bottom: 32px;
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
</style>
