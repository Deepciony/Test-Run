import { a as attr, b as attr_class, c as stringify } from "../../../../chunks/index2.js";
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../../chunks/state.svelte.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let isLoading = false;
    let email = "";
    $$renderer2.push(`<div class="app-screen svelte-14gk0mt"><div class="glass-header svelte-14gk0mt"><button class="back-btn svelte-14gk0mt" aria-label="Back"${attr("disabled", isLoading, true)}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg></button></div> <div class="scroll-container svelte-14gk0mt"><div class="content-wrapper svelte-14gk0mt"><div class="form-card svelte-14gk0mt">`);
    {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<div class="title-section svelte-14gk0mt"><h1 class="main-title svelte-14gk0mt">FORGOT PASSWORD</h1> <p class="sub-title svelte-14gk0mt">Please enter your email to reset the password</p></div> <div class="form-section svelte-14gk0mt"><div class="form-group svelte-14gk0mt"><label class="label svelte-14gk0mt" for="email">Email</label> <div${attr_class(`input-field ${stringify("")}`, "svelte-14gk0mt")}><input id="email" type="email" placeholder="Enter your email"${attr("value", email)}${attr("disabled", isLoading, true)} class="svelte-14gk0mt"/></div></div> `);
      {
        $$renderer2.push("<!--[!-->");
      }
      $$renderer2.push(`<!--]--> <button class="primary-btn svelte-14gk0mt"${attr("disabled", isLoading, true)}>`);
      {
        $$renderer2.push("<!--[!-->");
        $$renderer2.push(`SEND LINK`);
      }
      $$renderer2.push(`<!--]--></button></div>`);
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--></div></div></div></div>`);
  });
}
export {
  _page as default
};
