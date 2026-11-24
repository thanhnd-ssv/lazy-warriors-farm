// ==UserScript==
// @name         Web Workflow Utility
// @namespace    local.at-sp.notification-monitor
// @version      2.78.42
// @description  Guild Chat for SSV Farm.
// @match        https://at-sp.ssvhue.work/*
// @require      https://raw.githubusercontent.com/thanhnd-ssv/lazy-warriors-farm/refs/heads/main/guild-chat.js?v=2.78.42
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

  const gmGetValue =
    typeof globalThis.GM_getValue === "function"
      ? globalThis.GM_getValue.bind(globalThis)
      : typeof globalThis.GM?.getValue === "function"
        ? (key, fallback) => globalThis.GM.getValue(key, fallback)
        : (key, fallback) => {
            try {
              const raw = localStorage.getItem(String(key));
              return raw === null ? fallback : JSON.parse(raw);
            } catch (_error) {
              return fallback;
            }
          };

  const gmSetValue =
    typeof globalThis.GM_setValue === "function"
      ? globalThis.GM_setValue.bind(globalThis)
      : typeof globalThis.GM?.setValue === "function"
        ? (key, value) => globalThis.GM.setValue(key, value)
        : (key, value) => {
            try {
              localStorage.setItem(String(key), JSON.stringify(value));
            } catch (_error) {}
          };

  const gmRequest =
    typeof globalThis.GM_xmlhttpRequest === "function"
      ? globalThis.GM_xmlhttpRequest.bind(globalThis)
      : typeof globalThis.GM?.xmlHttpRequest === "function"
        ? (details) => globalThis.GM.xmlHttpRequest(details)
        : typeof globalThis.GM_xmlHttpRequest === "function"
          ? globalThis.GM_xmlHttpRequest.bind(globalThis)
          : null;

  if (!globalThis.GuildChatModule) {
    console.error("[Web Workflow Utility] Guild Chat module did not load.");
    return;
  }

  if (typeof gmRequest !== "function") {
    console.error("[Web Workflow Utility] GM_xmlhttpRequest is unavailable.");
    return;
  }

  try {
    globalThis.GuildChatModule.mount({
      getValue: (key, fallback) => gmGetValue(key, fallback),
      setValue: (key, value) => gmSetValue(key, value),
      request: (options) => gmRequest(options),
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
