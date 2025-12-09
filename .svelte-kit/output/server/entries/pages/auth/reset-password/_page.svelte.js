import { e as store_get, a as attr, b as attr_class, u as unsubscribe_stores, f as clsx, c as stringify } from "../../../../chunks/index2.js";
import { V as getContext, W as escape_html } from "../../../../chunks/context.js";
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../../chunks/state.svelte.js";
const getStores = () => {
  const stores$1 = getContext("__svelte__");
  return {
    /** @type {typeof page} */
    page: {
      subscribe: stores$1.page.subscribe
    },
    /** @type {typeof navigating} */
    navigating: {
      subscribe: stores$1.navigating.subscribe
    },
    /** @type {typeof updated} */
    updated: stores$1.updated
  };
};
const page = {
  subscribe(fn) {
    const store = getStores().page;
    return store.subscribe(fn);
  }
};
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let token, mode;
    const API_BASE = "http://158.108.102.14:8001";
    let currentStep = 1;
    let isLoading = false;
    let isVerifyingToken = false;
    let isTokenValid = false;
    async function verifyToken(t) {
      isVerifyingToken = true;
      currentStep = 1;
      clearMessage();
      await new Promise((r) => setTimeout(r, 800));
      try {
        if (!t || t.length < 5) {
          throw new Error("Invalid Token format");
        }
        isTokenValid = true;
      } catch (error) {
        isTokenValid = false;
        showMessage("This password reset link is invalid or has expired.", "error");
      } finally {
        isVerifyingToken = false;
      }
    }
    let message = "";
    let messageType = "error";
    let messageTimeout;
    let errorField = "";
    let email = "";
    let password = "";
    let confirmPassword = "";
    function showMessage(msg, type = "error", field = "") {
      if (messageTimeout) clearTimeout(messageTimeout);
      message = msg;
      messageType = type;
      if (field) errorField = field;
      messageTimeout = setTimeout(
        () => {
          message = "";
          errorField = "";
        },
        5e3
      );
    }
    function clearMessage() {
      if (message) {
        message = "";
        errorField = "";
        if (messageTimeout) clearTimeout(messageTimeout);
      }
    }
    console.log("API_BASE =", API_BASE);
    token = store_get($$store_subs ??= {}, "$page", page).url.searchParams.get("token");
    mode = token ? "reset" : "request";
    if (mode === "reset" && token) {
      verifyToken(token);
    } else {
      isVerifyingToken = false;
    }
    $$renderer2.push(`<div class="app-screen svelte-654myr">`);
    if (
      // --- 🔒 ฟังก์ชันตรวจสอบ Token (Verify Logic) ---
      // จำลองการโหลดนิดหน่อย เพื่อให้ UX ดูสมจริง (เหมือนกำลังเช็ค Server)
      // -------------------------------------------------------------
      // 💡 จุดนี้ถ้า Backend คุณมี API ให้เช็ค Token (GET) ให้ใช้ตรงนี้
      // const res = await fetch(`${API_BASE}/api/users/check-token?token=${t}`);
      // if (!res.ok) throw new Error("Invalid Token");
      // -------------------------------------------------------------
      // (เนื่องจากไม่แก้ Backend เราจะเช็คแค่ว่า Token มีค่าส่งมาจริงไหม)
      // ถ้าผ่าน:
      // --- Message System ---
      // --- Inputs ---
      // --- Helper Functions ---
      // เพิ่มเวลาอ่าน Error นานขึ้นหน่อย
      // --- API Handlers ---
      // Re-check token again just in case
      // ถ้า Backend บอกว่า Token หมดอายุ ให้ปิดการกรอกรหัสทันที
      !(mode === "reset" && currentStep === 2)
    ) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<div class="glass-header svelte-654myr"><button class="back-btn svelte-654myr" aria-label="Back"${attr("disabled", isVerifyingToken, true)}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg></button></div>`);
    } else {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--> <div${attr_class("scroll-container svelte-654myr", void 0, { "pt-120": mode === "reset" && currentStep === 2 })}><div class="content-wrapper svelte-654myr"><div${attr_class(clsx(currentStep === 2 ? "success-card" : "form-card"), "svelte-654myr")}>`);
    if (mode === "request") {
      $$renderer2.push("<!--[-->");
      if (currentStep === 1) {
        $$renderer2.push("<!--[-->");
        $$renderer2.push(`<div class="title-section svelte-654myr"><h1 class="main-title svelte-654myr">FORGOT PASSWORD</h1> <p class="sub-title svelte-654myr">Please enter your email to reset the password</p></div> <div class="form-section svelte-654myr"><div class="form-group svelte-654myr"><label class="label svelte-654myr" for="email">Email</label> <div${attr_class(`input-field ${stringify(errorField === "email" ? "error-border" : "")}`, "svelte-654myr")}><input id="email" type="email" placeholder="Enter your email"${attr("value", email)}${attr("disabled", isLoading, true)} class="svelte-654myr"/></div></div> `);
        if (message) {
          $$renderer2.push("<!--[-->");
          $$renderer2.push(`<div${attr_class(`message-container ${stringify(messageType)}`, "svelte-654myr")}><span>${escape_html(message)}</span></div>`);
        } else {
          $$renderer2.push("<!--[!-->");
        }
        $$renderer2.push(`<!--]--> <button class="primary-btn svelte-654myr"${attr("disabled", isLoading, true)}>`);
        {
          $$renderer2.push("<!--[!-->");
          $$renderer2.push(`SEND LINK`);
        }
        $$renderer2.push(`<!--]--></button></div>`);
      } else {
        $$renderer2.push("<!--[!-->");
        if (currentStep === 2) {
          $$renderer2.push("<!--[-->");
          $$renderer2.push(`<div class="icon-wrapper svelte-654myr"><div class="success-circle svelte-654myr"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg></div></div> <div class="title-section svelte-654myr" style="text-align: center;"><h1 class="main-title svelte-654myr">CHECK YOUR EMAIL</h1> <p class="sub-title svelte-654myr">We sent a reset link to <span style="color: white; font-weight: 600;">${escape_html(email)}</span><br/>Please click the link in that email.</p></div> <div class="footer-text svelte-654myr">Haven’t got the email yet? <button class="resend-link svelte-654myr"${attr("disabled", isLoading, true)}>Resend email</button></div>`);
        } else {
          $$renderer2.push("<!--[!-->");
        }
        $$renderer2.push(`<!--]-->`);
      }
      $$renderer2.push(`<!--]-->`);
    } else {
      $$renderer2.push("<!--[!-->");
      if (isVerifyingToken) {
        $$renderer2.push("<!--[-->");
        $$renderer2.push(`<div class="loading-state svelte-654myr"><div class="spinner svelte-654myr"></div> <p>Verifying link...</p></div>`);
      } else {
        $$renderer2.push("<!--[!-->");
        if (!isTokenValid) {
          $$renderer2.push("<!--[-->");
          $$renderer2.push(`<div class="error-state svelte-654myr"><div class="error-icon svelte-654myr">!</div> <h2 class="main-title svelte-654myr" style="text-align:center; font-size: 22px;">Invalid Link</h2> <p class="sub-title svelte-654myr" style="text-align:center; margin-bottom:24px;">This password reset link is invalid or has expired.</p> `);
          if (message) {
            $$renderer2.push("<!--[-->");
            $$renderer2.push(`<div class="message-container error svelte-654myr"><span>${escape_html(message)}</span></div>`);
          } else {
            $$renderer2.push("<!--[!-->");
          }
          $$renderer2.push(`<!--]--> <button class="primary-btn svelte-654myr">GO TO LOGIN</button> <div style="margin-top:16px; text-align:center;"><button class="resend-link svelte-654myr">Request new link</button></div></div>`);
        } else {
          $$renderer2.push("<!--[!-->");
          if (currentStep === 1) {
            $$renderer2.push("<!--[-->");
            $$renderer2.push(`<div class="title-section svelte-654myr"><h1 class="main-title svelte-654myr">SET NEW PASSWORD</h1> <p class="sub-title svelte-654myr">Create a new password. Ensure it differs from previous ones.</p></div> <div class="form-section svelte-654myr"><div class="form-group svelte-654myr"><label class="label svelte-654myr" for="new-password">Password</label> <div${attr_class(`input-field ${stringify(errorField === "password" ? "error-border" : "")}`, "svelte-654myr")}><input id="new-password"${attr("type", "password")} placeholder="Enter new password"${attr("value", password)}${attr("disabled", isLoading, true)} class="svelte-654myr"/> <button type="button" class="toggle-password svelte-654myr"${attr("aria-label", "Show password")}>`);
            {
              $$renderer2.push("<!--[!-->");
              $$renderer2.push(`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`);
            }
            $$renderer2.push(`<!--]--></button></div></div> <div class="form-group svelte-654myr"><label class="label svelte-654myr" for="confirm-password">Confirm Password</label> <div${attr_class(`input-field ${stringify(errorField === "confirmPassword" ? "error-border" : "")}`, "svelte-654myr")}><input id="confirm-password"${attr("type", "password")} placeholder="Confirm new password"${attr("value", confirmPassword)}${attr("disabled", isLoading, true)} class="svelte-654myr"/> <button type="button" class="toggle-password svelte-654myr"${attr("aria-label", "Show password")}>`);
            {
              $$renderer2.push("<!--[!-->");
              $$renderer2.push(`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`);
            }
            $$renderer2.push(`<!--]--></button></div></div> `);
            if (message) {
              $$renderer2.push("<!--[-->");
              $$renderer2.push(`<div${attr_class(`message-container ${stringify(messageType)}`, "svelte-654myr")}><span>${escape_html(message)}</span></div>`);
            } else {
              $$renderer2.push("<!--[!-->");
            }
            $$renderer2.push(`<!--]--> <button class="primary-btn svelte-654myr"${attr("disabled", isLoading, true)}>`);
            {
              $$renderer2.push("<!--[!-->");
              $$renderer2.push(`RESET PASSWORD`);
            }
            $$renderer2.push(`<!--]--></button></div>`);
          } else {
            $$renderer2.push("<!--[!-->");
            if (currentStep === 2) {
              $$renderer2.push("<!--[-->");
              $$renderer2.push(`<div class="icon-wrapper svelte-654myr"><div class="success-circle svelte-654myr"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></div></div> <div class="title-section svelte-654myr" style="text-align: center;"><h1 class="main-title svelte-654myr">PASSWORD RESET</h1> <p class="sub-title svelte-654myr">Your password has been successfully reset.<br/>Click confirm to login.</p></div> <button class="primary-btn svelte-654myr" type="button">CONFIRM</button>`);
            } else {
              $$renderer2.push("<!--[!-->");
            }
            $$renderer2.push(`<!--]-->`);
          }
          $$renderer2.push(`<!--]-->`);
        }
        $$renderer2.push(`<!--]-->`);
      }
      $$renderer2.push(`<!--]-->`);
    }
    $$renderer2.push(`<!--]--></div></div></div></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _page as default
};
