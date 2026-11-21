// ==UserScript==
// @name         Web Workflow Utility
// @namespace    local.at-sp.notification-monitor
// @version      2.78.35
// @description  Guild Chat for SSV Farm.
// @match        https://at-sp.ssvhue.work/*
// @require      https://raw.githubusercontent.com/thanhnd-ssv/lazy-warriors-farm/refs/heads/main/guild-chat.js
// @updateURL    https://raw.githubusercontent.com/thanhnd-ssv/lazy-warriors-farm/refs/heads/main/script.meta.js
// @downloadURL  https://raw.githubusercontent.com/thanhnd-ssv/lazy-warriors-farm/refs/heads/main/script.user.js
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      gstatic.com
// @connect      server.wallpaperalchemy.com
// @connect      cdn-media.sforum.vn
// @connect      raw.githubusercontent.com
// @connect      firebaseio.com
// @connect      firebasedatabase.app
// @connect      identitytoolkit.googleapis.com
// @connect      securetoken.googleapis.com
// ==/UserScript==

(function () {
  "use strict";

  if (window.top !== window.self) return;
  if (!globalThis.GuildChatModule) {
    console.error("[Web Workflow Utility] Guild Chat module did not load.");
    return;
  }

  try {
    globalThis.GuildChatModule.mount({
      getValue: (key, fallback) => GM_getValue(key, fallback),
      setValue: (key, value) => GM_setValue(key, value),
      request: (options) => GM_xmlhttpRequest(options),
      updateUrl:
        "https://raw.githubusercontent.com/thanhnd-ssv/lazy-warriors-farm/refs/heads/main/script.user.js",
    });
  } catch (error) {
    console.error(
      "[Web Workflow Utility] Guild Chat module initialization failed.",
      error,
    );
  }
})();
