(function (global) {
  "use strict";

  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyBTy82Yu5YLGn8R2Tyufu2CV8E2E0-ze2A",
    databaseURL: "https://web-workflow-utility-chat-default-rtdb.firebaseio.com",
  };
  const CHAT_BACKGROUND_URLS = {
    morning:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR4EiZLl_gbVaIcNMU4SfslA0wWnTwWujRL6joCZOUb33pJsvNaj_L4n0m0&s=10",
    afternoon:
      "https://server.wallpaperalchemy.com/storage/wallpapers/2487/anime-cat-napping-on-green-grass-wallpaper.jpg",
    evening:
      "https://cdn-media.sforum.vn/storage/app/media/ctvseo_maihue/hinh-nen-ghibli/hinh-nen-ghibli-49.jpg",
  };
  const CHAT_BACKGROUND_CHANGE_MINUTES = [60, 12 * 60, 17 * 60 + 30];
  const AUTH_STORAGE_KEY = "web-workflow-utility.guild-chat.auth";
  const PROFILE_STORAGE_KEY = "web-workflow-utility.guild-chat.profile";
  const CHAT_TITLE = "😴 Lazy Farm 🌾";
  const EMOJI_CATEGORIES = [
    {
      label: "Biểu cảm",
      icon: "😀",
      emojis: [
        "😀", "😃", "😄", "😁", "😆", "😂", "🤣", "😊", "😍", "🥰", "😘",
        "😎", "🤔", "😴", "🥱", "😭", "😢", "😡", "🤬", "🤪", "😜", "🥳",
        "🥶", "🥵",
      ],
    },
    {
      label: "Tương tác",
      icon: "👍",
      emojis: [
        "👍", "👎", "👌", "✌️", "🤝", "👏", "🙌", "💪", "🙏", "👀",
        "👉", "👈", "👋", "🤟", "❤️",
      ],
    },
    {
      label: "Cây, trái cây",
      icon: "🌷",
      emojis: [
        "🌷", "🌴", "🍎", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🍑", "🥭",
        "🍍", "🥥", "🌽", "🥕", "🍄",
      ],
    },
    {
      label: "Động vật",
      icon: "🐯",
      emojis: [
        "🐯", "🐼", "🦄", "🦚", "🦜", "🦢", "🐟", "🦐", "🦀", "🦈", "🐮",
        "🐄", "🐷", "🐔", "🐑", "🐰", "🦆",
      ],
    },
    {
      label: "Vật phẩm",
      icon: "🎁",
      emojis: [
        "💰", "💵", "💎", "🎁", "🎀", "🏆", "🥇", "⭐", "🔥", "💯", "🎉",
        "🎊", "🎯",
      ],
    },
  ];
  const MAX_HISTORY = 150;
  const MAX_MESSAGE_LENGTH = 500;
  const MIN_NICKNAME_LENGTH = 2;
  const MAX_NICKNAME_LENGTH = 12;
  const MESSAGE_COOLDOWN_MS = 1_500;
  const MESSAGE_POLL_INTERVAL_MS = 3_000;
  const AUTH_TOKEN_REFRESH_BUFFER_MS = 60_000;
  const AUTH_SIGN_UP_URL =
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_CONFIG.apiKey}`;
  const AUTH_REFRESH_URL =
    `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_CONFIG.apiKey}`;

  function requestJson(request, method, url, data, headers) {
    return new Promise((resolve, reject) => {
      try {
        request({
          method,
          url,
          timeout: 20_000,
          headers:
            headers ||
            (data === undefined ? {} : { "Content-Type": "application/json" }),
          data:
            data === undefined
              ? undefined
              : typeof data === "string"
                ? data
                : JSON.stringify(data),
          onload(response) {
            const status = Number(response.status) || 0;
            const responseText = response.responseText || "";
            let result = null;
            if (responseText) {
              try {
                result = JSON.parse(responseText);
              } catch (error) {
                reject(new Error("Firebase returned an invalid JSON response."));
                return;
              }
            }

            if (status < 200 || status >= 300) {
              const details = result && result.error;
              const message =
                typeof details === "string"
                  ? details
                  : details && (details.message || details.status) ||
                    (typeof result === "string" ? result : null);
              const requestError = new Error(
                message || `Firebase request failed (HTTP ${status}).`,
              );
              requestError.status = status;
              requestError.code =
                details && (details.message || details.status);
              reject(requestError);
              return;
            }

            resolve(result);
          },
          onerror() {
            reject(new Error("Tampermonkey could not reach Firebase."));
          },
          ontimeout() {
            reject(new Error("Firebase request timed out."));
          },
          onabort() {
            reject(new Error("Firebase request was aborted."));
          },
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  function getChatBackgroundUrl(date) {
    const minuteOfDay = date.getHours() * 60 + date.getMinutes();
    if (minuteOfDay >= 60 && minuteOfDay < 12 * 60) {
      return CHAT_BACKGROUND_URLS.morning;
    }
    if (minuteOfDay >= 12 * 60 && minuteOfDay < 17 * 60 + 30) {
      return CHAT_BACKGROUND_URLS.afternoon;
    }
    return CHAT_BACKGROUND_URLS.evening;
  }

  function millisecondsUntilNextBackgroundChange(date) {
    const minuteOfDay = date.getHours() * 60 + date.getMinutes();
    const nextChange = CHAT_BACKGROUND_CHANGE_MINUTES.find(
      (minute) => minute > minuteOfDay,
    );
    const minutesUntilChange =
      nextChange === undefined
        ? 24 * 60 - minuteOfDay + CHAT_BACKGROUND_CHANGE_MINUTES[0]
        : nextChange - minuteOfDay;
    return (
      minutesUntilChange * 60_000 -
      date.getSeconds() * 1_000 -
      date.getMilliseconds()
    );
  }

  function loadChatBackground(request, url) {
    return new Promise((resolve, reject) => {
      try {
        request({
          method: "GET",
          url,
          timeout: 20_000,
          responseType: "arraybuffer",
          onload(response) {
            const status = Number(response.status) || 0;
            if (status < 200 || status >= 300) {
              reject(new Error(`Chat background request failed (HTTP ${status}).`));
              return;
            }
            if (
              !response.response ||
              typeof response.response.byteLength !== "number"
            ) {
              reject(new Error("Chat background response was not binary."));
              return;
            }

            try {
              const bytes = new Uint8Array(response.response);
              let binary = "";
              const chunkSize = 0x8000;
              for (let offset = 0; offset < bytes.length; offset += chunkSize) {
                binary += String.fromCharCode(
                  ...bytes.subarray(offset, offset + chunkSize),
                );
              }
              resolve(`data:image/jpeg;base64,${global.btoa(binary)}`);
            } catch (error) {
              reject(error);
            }
          },
          onerror() {
            reject(new Error("Unable to download the chat background image."));
          },
          ontimeout() {
            reject(new Error("Chat background image request timed out."));
          },
          onabort() {
            reject(new Error("Chat background image request was aborted."));
          },
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function capitalizeFirstCharacter(value) {
    const firstCharacter = Array.from(value)[0];
    return firstCharacter
      ? firstCharacter.toLocaleUpperCase("vi-VN") + value.slice(firstCharacter.length)
      : value;
  }

  function mount({ container, getValue, setValue, request }) {
    if (typeof request !== "function") {
      throw new Error("Tampermonkey request API chưa được cấu hình.");
    }
    const launchButton = createElement("button", "guild-chat-launch", CHAT_TITLE);
    launchButton.type = "button";
    launchButton.setAttribute("aria-label", `Mở ${CHAT_TITLE}`);
    Object.assign(launchButton.style, {
      width: "100%",
      minHeight: "34px",
      padding: "7px 10px",
      border: "2px solid #b9dba8",
      borderRadius: "12px",
      color: "#587047",
      background: "linear-gradient(135deg, #fffdf5, #edf7dc)",
      boxShadow: "0 3px 10px #59714324",
      font: "800 12px system-ui, sans-serif",
      cursor: "pointer",
    });
    container.append(launchButton);

    const host = document.createElement("div");
    Object.assign(host.style, {
      position: "fixed",
      right: "12px",
      bottom: "12px",
      zIndex: "2147483646",
    });
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host { color-scheme: light; font: 13px/1.45 "Trebuchet MS", system-ui, sans-serif; }
        * { box-sizing: border-box; }
        .panel {
          display: flex; flex-direction: column; width: min(280px, calc(100vw - 24px));
          height: min(370px, calc(100vh - 24px));
          min-height: min(340px, calc(100vh - 24px)); overflow: hidden;
          color: #4d5d43; background-color: #e6efd9;
          background-position: center; background-size: cover; background-repeat: no-repeat;
          border: 3px solid #fffdf4; border-radius: 22px;
          box-shadow: 0 14px 38px #4e694a45, 0 3px 0 #b5d69e;
        }
        .panel[hidden] { display: none; }
        .header {
          display: flex; align-items: center; justify-content: space-between;
          gap: 8px; padding: 2px 10px 2px 10px;
          background: rgba(255, 254, 250, .12);
          border-bottom: 2px solid #dfe9c8;
        }
        .heading { display: grid; gap: 2px; min-width: 0; }
        .heading strong { color: #5f754f; font-size: 15px; letter-spacing: .1px; }
        .connection { display: none; }
        .header-actions { display: flex; gap: 5px; }
        button, input { font: inherit; }
        button {
          min-height: 32px; padding: 5px 10px; color: #617153;
          background: #fffdf4; border: 1.5px solid #ccdbaa;
          border-radius: 10px; cursor: pointer;
        }
        button:hover:not(:disabled) { background: #f2f8df; }
        button:disabled { opacity: .6; cursor: wait; }
        .content { display: flex; flex: 1; min-height: 0; flex-direction: column; }
        .join, .chat { display: flex; flex: 1; min-height: 0; flex-direction: column; gap: 9px; padding: 12px; }
        .join[hidden], .chat[hidden] { display: none; }
        .join {
          justify-content: center; overflow-y: auto;
          padding: 18px;
          background:
            radial-gradient(circle at 88% 14%, #fff9c9 0 22px, transparent 23px),
            radial-gradient(ellipse at 12% 100%, #92bd72 0 19%, transparent 20%),
            radial-gradient(ellipse at 92% 104%, #a8cc7f 0 24%, transparent 25%),
            linear-gradient(180deg, #d5edf0 0 38%, #e8f2d1 72%, #d5e7ad 100%);
        }
        .join-card {
          display: flex; flex-direction: column; gap: 12px;
          width: 100%; padding: 20px 17px 15px;
          background: #fffdf4ed; border: 1px solid #fff;
          border-radius: 20px; box-shadow: 0 8px 24px #647b4c24;
        }
        .join-intro { display: grid; gap: 3px; margin-bottom: 2px; text-align: center; }
        .join-intro strong { color: #5e754d; font-size: 18px; }
        .join-intro span { color: #89957b; font-size: 11px; }
        .join label {
          display: flex; flex-direction: column; width: 100%; gap: 5px;
          color: #65745b; font-size: 11px; font-weight: 700;
        }
        input {
          display: block; width: 100%; min-height: 40px; padding: 8px 11px;
          color: #4f6045; background: #fffef9; border: 1.5px solid #cbdba9;
          border-radius: 12px; outline: none;
        }
        input:focus { border-color: #92b66d; box-shadow: 0 0 0 3px #a4c87525; }
        .primary { color: #526945; background: #dceea7; border-color: #b7d486; font-weight: 800; }
        .join-button, .retry { width: 100%; min-height: 38px; }
        .retry { background: #fff; }
        .notice { min-height: 18px; color: #a96f58; font-size: 11px; overflow-wrap: anywhere; }
        .chat {
          position: relative;
          isolation: isolate;
          gap: 6px;
          padding: 8px 8px 4px;
          background: transparent;
        }
        .messages {
          display: flex; flex: 1; min-height: 0; flex-direction: column; gap: 7px;
          overflow-y: auto; margin: 0; padding: 5px 5px 12px; list-style: none;
          border-radius: 14px;
          background: transparent;
        }
        .message {
          display: flex; align-items: flex-end; gap: 5px;
          max-width: 88%; align-self: flex-start;
          overflow-wrap: anywhere;
        }
        .message-bubble {
          min-width: 42px; padding: 7px 9px;
          background: #fffdf1; border: 1.5px solid #e1dca9;
          border-radius: 13px 13px 13px 4px;
          box-shadow: 0 2px 7px #6f795c18;
          color: #536148;
        }
        .message.self { align-self: flex-end; }
        .message.self .message-bubble {
          background: #d7e9af; border-color: #bdd68e;
          border-radius: 13px 13px 4px 13px;
        }
        .message-avatar {
          flex: 0 0 auto; width: 28px; height: 28px;
          display: grid; place-items: center;
          background: #fffaf0; border: 2px solid #fff;
          border-radius: 50%; box-shadow: 0 2px 6px #65734f24;
          font-size: 16px;
        }
        .message.self .message-avatar { order: 2; }
        .message-meta { display: flex; justify-content: space-between; gap: 8px; min-width: 0; color: #859270; font-size: 9px; }
        .message-author { overflow: hidden; min-width: 0; text-overflow: ellipsis; white-space: nowrap; }
        .message-meta time { flex: 0 0 auto; color: #9aa48e; }
        .message-text { margin: 2px 0 0; white-space: pre-wrap; }
        .unread {
          min-height: 16px; padding: 0 4px;
          color: #6f8b58; font-size: 10px; text-align: center;
        }
        .composer { position: relative; flex: 0 0 auto; margin-top: auto; }
        .emoji-picker {
          position: absolute; right: 0; bottom: calc(100% + 8px); z-index: 3;
          width: min(260px, calc(100vw - 32px));
          padding: 7px; background: #fffdf6; border: 1px solid #e4dcae;
          border-radius: 13px; box-shadow: 0 6px 20px #53614835;
        }
        .emoji-picker[hidden] { display: none; }
        .emoji-tabs {
          display: flex; gap: 3px; overflow-x: auto; padding: 0 0 6px;
          border-bottom: 1px solid #ece7cf;
        }
        .emoji-tab {
          flex: 0 0 29px; width: 29px; min-height: 29px; padding: 0;
          border: 0; background: transparent; font-size: 16px;
        }
        .emoji-tab[aria-selected="true"] { background: #e8f0d2; }
        .emoji-category-title {
          display: block; margin: 6px 2px 3px; color: #788667;
          font-size: 10px; font-weight: 700; white-space: nowrap;
        }
        .emoji-grid {
          display: grid; grid-template-columns: repeat(6, 1fr); gap: 2px;
          max-height: 178px; overflow-y: auto;
        }
        .emoji-option {
          display: grid; place-items: center; width: 100%; min-height: 30px;
          padding: 0; border: 0; background: transparent; font-size: 18px;
        }
        .emoji-option:hover { background: #f3edcf; }
        .send {
          display: flex; gap: 5px; padding: 6px;
          background: rgba(255, 253, 242, .42); border: 1.5px solid #dde8c2;
          border-radius: 15px; box-shadow: 0 3px 10px #6c7d5520;
        }
        .chat-notice:empty { display: none; }
        .send input {
          flex: 1; min-width: 0; border: 0; background: transparent;
          min-height: 34px;
        }
        .send input:focus { box-shadow: none; }
        .emoji-button {
          display: grid; place-items: center;
          width: 34px; min-width: 34px; min-height: 34px; padding: 0;
          border-color: transparent; background: transparent; font-size: 19px;
        }
        .send-button {
          display: grid; place-items: center;
          width: 42px; min-width: 42px; padding: 5px;
          border-radius: 11px;
          background: #b9d98e; border-color: #a7c97c;
        }
        .send-button svg { width: 18px; height: 18px; }
        .toast {
          position: absolute; right: 0; bottom: calc(100% + 8px);
          max-width: min(340px, calc(100vw - 24px)); padding: 8px 11px;
          color: #617153; background: #fffdf4; border: 1.5px solid #b9d69a;
          border-radius: 12px; box-shadow: 0 6px 18px #0002;
        }
        .toast[hidden] { display: none; }
        @media (max-width: 480px) {
          :host { right: 6px !important; bottom: 6px !important; }
          .panel {
            width: min(345px, calc(100vw - 12px));
            height: min(450px, calc(100vh - 12px));
            min-height: min(340px, calc(100vh - 12px));
          }
        }
      </style>
      <div class="toast" role="status" hidden></div>
      <section class="panel" aria-label="${CHAT_TITLE}" hidden>
        <header class="header">
          <div class="heading">
            <strong>${CHAT_TITLE}</strong>
            <span class="connection">Chưa kết nối</span>
          </div>
          <div class="header-actions">
            <button type="button" class="close" aria-label="Đóng chat">×</button>
          </div>
        </header>
        <div class="content">
          <form class="join">
            <div class="join-card">
              <div class="join-intro">
                <strong>Chào bạn! 🌼</strong>
                <span>Nhập thông tin để vào trò chuyện cùng hội nhé.</span>
              </div>
              <label>Nickname
                <input class="nickname" minlength="2" maxlength="12" autocomplete="nickname" required>
              </label>
              <label>Mã mời hội
                <input class="invite-code" maxlength="64" autocomplete="off" required>
              </label>
              <button type="submit" class="primary join-button">Vào hội</button>
              <button type="button" class="retry">Thử kết nối lại</button>
              <div class="join-notice notice" role="status"></div>
            </div>
          </form>
          <section class="chat" hidden>
            <ol class="messages" aria-live="polite" aria-label="Tin nhắn"></ol>
            <div class="chat-notice notice" role="status"></div>
            <div class="composer">
              <div class="emoji-picker" role="dialog" aria-label="Chọn emoji" hidden>
                <div class="emoji-tabs" role="tablist" aria-label="Nhóm emoji"></div>
                <strong class="emoji-category-title"></strong>
                <div class="emoji-grid" id="emoji-options" role="tabpanel"></div>
              </div>
              <form class="send">
                <input class="message-input" maxlength="500" autocomplete="off" placeholder="Nhập tin nhắn..." aria-label="Tin nhắn" required>
                <button type="button" class="emoji-button" aria-label="Mở bảng emoji" aria-haspopup="dialog" aria-expanded="false" title="Chọn emoji">🙂</button>
                <button type="submit" class="primary send-button" aria-label="Gửi tin nhắn" title="Gửi tin nhắn">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M22 2 11 13"></path>
                    <path d="m22 2-7 20-4-9-9-4 20-7Z"></path>
                  </svg>
                </button>
              </form>
            </div>
          </section>
        </div>
      </section>
    `;
    const inlineStyle = shadow.querySelector("style");
    if (
      typeof global.CSSStyleSheet === "function" &&
      "adoptedStyleSheets" in shadow
    ) {
      const stylesheet = new global.CSSStyleSheet();
      stylesheet.replaceSync(inlineStyle.textContent);
      shadow.adoptedStyleSheets = [...shadow.adoptedStyleSheets, stylesheet];
      inlineStyle.remove();
    }
    document.body.append(host);

    const panel = shadow.querySelector(".panel");
    const connectionLabel = shadow.querySelector(".connection");
    const joinForm = shadow.querySelector(".join");
    const nicknameInput = shadow.querySelector(".nickname");
    const inviteCodeInput = shadow.querySelector(".invite-code");
    const joinButton = shadow.querySelector(".join-button");
    const joinNotice = shadow.querySelector(".join-notice");
    const retryButton = shadow.querySelector(".retry");
    const chatView = shadow.querySelector(".chat");
    const messagesList = shadow.querySelector(".messages");
    const unreadLabel = shadow.querySelector(".unread");
    const messageInput = shadow.querySelector(".message-input");
    const emojiButton = shadow.querySelector(".emoji-button");
    const emojiPicker = shadow.querySelector(".emoji-picker");
    const emojiTabs = shadow.querySelector(".emoji-tabs");
    const emojiCategoryTitle = shadow.querySelector(".emoji-category-title");
    const emojiGrid = shadow.querySelector(".emoji-grid");
    const sendButton = shadow.querySelector(".send-button");
    const chatNotice = shadow.querySelector(".chat-notice");
    const toast = shadow.querySelector(".toast");

    populateEmojiPicker();
    const backgroundCache = new Map();
    let backgroundRequestVersion = 0;
    const backgroundOverlay =
      "linear-gradient(rgba(255, 255, 255, .08), rgba(255, 255, 255, .08))";
    function updateChatBackground() {
      const url = getChatBackgroundUrl(new Date());
      const requestVersion = ++backgroundRequestVersion;
      const cachedImage = backgroundCache.get(url);
      panel.style.backgroundImage = backgroundOverlay;

      const imagePromise = cachedImage
        ? Promise.resolve(cachedImage)
        : loadChatBackground(request, url);
      imagePromise
        .then((imageDataUrl) => {
          backgroundCache.set(url, imageDataUrl);
          if (
            requestVersion !== backgroundRequestVersion ||
            getChatBackgroundUrl(new Date()) !== url
          ) {
            return;
          }
          panel.style.backgroundImage =
            `${backgroundOverlay}, url("${imageDataUrl}")`;
        })
        .catch((error) => {
          console.error(
            "[Web Workflow Utility] Guild Chat background failed.",
            error,
          );
        });
    }
    function scheduleNextBackgroundChange() {
      const delay = millisecondsUntilNextBackgroundChange(new Date());
      global.setTimeout(() => {
        updateChatBackground();
        scheduleNextBackgroundChange();
      }, delay);
    }
    updateChatBackground();
    scheduleNextBackgroundChange();

    let user = null;
    let membership = null;
    let messagePolling = false;
    let connectionPromise = null;
    let authSession = null;
    let currentIdToken = null;
    let idTokenExpiresAt = 0;
    let tokenRefreshPromise = null;
    let initialMessagesLoaded = false;
    let unreadCount = 0;
    let lastSentAt = 0;
    let toastTimer = null;
    const renderedMessageKeys = new Set();

    function readValue(key, fallback) {
      try {
        const value = getValue(key, fallback);
        return value === undefined ? fallback : value;
      } catch (error) {
        console.error("[Web Workflow Utility] Guild Chat storage read failed.", error);
        return fallback;
      }
    }

    function writeValue(key, value) {
      try {
        const result = setValue(key, value);
        if (result && typeof result.catch === "function") {
          result.catch((error) =>
            console.error("[Web Workflow Utility] Guild Chat storage write failed.", error),
          );
        }
      } catch (error) {
        console.error("[Web Workflow Utility] Guild Chat storage write failed.", error);
      }
    }

    function saveAuthTokens(result, uid) {
      const idToken = result && (result.id_token || result.idToken);
      const refreshToken = result && (result.refresh_token || result.refreshToken);
      const expiresIn = result && (result.expires_in || result.expiresIn);
      if (
        typeof idToken !== "string" ||
        typeof refreshToken !== "string" ||
        !Number.isFinite(Number(expiresIn))
      ) {
        throw new Error("Firebase Authentication returned an incomplete token response.");
      }

      const sessionUid = result.localId || result.user_id || uid;
      if (typeof sessionUid !== "string" || !sessionUid) {
        throw new Error("Firebase Authentication did not return a user ID.");
      }

      authSession = {
        uid: sessionUid,
        refreshToken,
      };
      currentIdToken = idToken;
      idTokenExpiresAt =
        Date.now() + Math.max(Number(expiresIn), 1) * 1000;
      user = { uid: sessionUid };
      writeValue(AUTH_STORAGE_KEY, authSession);
    }

    async function refreshAuthToken(forceRefresh) {
      if (!authSession || typeof authSession.refreshToken !== "string") {
        throw new Error("Firebase Authentication session is missing its refresh token.");
      }
      if (
        !forceRefresh &&
        currentIdToken &&
        idTokenExpiresAt - Date.now() > AUTH_TOKEN_REFRESH_BUFFER_MS
      ) {
        return currentIdToken;
      }
      if (tokenRefreshPromise) return tokenRefreshPromise;

      const refreshToken = authSession.refreshToken;
      const body = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }).toString();
      tokenRefreshPromise = requestJson(
        request,
        "POST",
        AUTH_REFRESH_URL,
        body,
        { "Content-Type": "application/x-www-form-urlencoded" },
      )
        .then((result) => {
          saveAuthTokens(
            {
              id_token: result && result.id_token,
              refresh_token: result && result.refresh_token,
              expires_in: result && result.expires_in,
              user_id: result && result.user_id,
            },
            authSession.uid,
          );
          return currentIdToken;
        })
        .finally(() => {
          tokenRefreshPromise = null;
        });
      return tokenRefreshPromise;
    }

    async function databaseRequest(method, path, data, query) {
      let idToken = await refreshAuthToken(false);
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const parameters = new URLSearchParams(query || {});
        parameters.set("auth", idToken);
        const encodedPath = path
          .split("/")
          .map((segment) => encodeURIComponent(segment))
          .join("/");
        const url =
          `${FIREBASE_CONFIG.databaseURL}/${encodedPath}.json?${parameters.toString()}`;
        try {
          return await requestJson(request, method, url, data);
        } catch (error) {
          if (
            attempt === 0 &&
            error.status === 401 &&
            /expired/i.test(error.message)
          ) {
            idToken = await refreshAuthToken(true);
            continue;
          }
          throw error;
        }
      }
      throw new Error("Firebase request could not be completed.");
    }

    function databaseGet(path, query) {
      return databaseRequest("GET", path, undefined, query);
    }

    function databaseSet(path, value) {
      return databaseRequest("PUT", path, value);
    }

    function databasePush(path, value) {
      return databaseRequest("POST", path, value);
    }

    function setNotice(element, message) {
      element.textContent = message;
    }

    function updateUnread() {
      unreadLabel.textContent = unreadCount
        ? `${unreadCount} tin nhắn chưa đọc`
        : "";
      launchButton.textContent = unreadCount
        ? `${CHAT_TITLE} (${unreadCount})`
        : CHAT_TITLE;
    }

    function showToast(message) {
      toast.textContent = message;
      toast.hidden = false;
      if (toastTimer !== null) global.clearTimeout(toastTimer);
      toastTimer = global.setTimeout(() => {
        toast.hidden = true;
        toastTimer = null;
      }, 4_000);
    }

    function isChatVisible() {
      return !panel.hidden;
    }

    function insertEmoji(emoji) {
      const start = Number.isInteger(messageInput.selectionStart)
        ? messageInput.selectionStart
        : messageInput.value.length;
      const end = Number.isInteger(messageInput.selectionEnd)
        ? messageInput.selectionEnd
        : start;
      messageInput.setRangeText(emoji, start, end, "end");
      messageInput.focus();
    }

    function populateEmojiPicker() {
      for (const [index, category] of EMOJI_CATEGORIES.entries()) {
        const tab = createElement("button", "emoji-tab", category.icon);
        tab.type = "button";
        tab.id = `emoji-tab-${index}`;
        tab.dataset.categoryIndex = String(index);
        tab.setAttribute("role", "tab");
        tab.setAttribute("aria-label", category.label);
        tab.setAttribute("aria-controls", "emoji-options");
        tab.setAttribute("aria-selected", "false");
        tab.title = category.label;
        tab.tabIndex = index === 0 ? 0 : -1;
        emojiTabs.append(tab);
      }
      selectEmojiCategory(0);
    }

    function selectEmojiCategory(index) {
      const category = EMOJI_CATEGORIES[index];
      if (!category) return;

      emojiCategoryTitle.textContent = category.label;
      emojiGrid.replaceChildren();
      emojiGrid.setAttribute("aria-label", category.label);
      for (const emoji of category.emojis) {
        const option = createElement("button", "emoji-option", emoji);
        option.type = "button";
        option.dataset.emoji = emoji;
        option.setAttribute("aria-label", emoji);
        emojiGrid.append(option);
      }

      for (const [tabIndex, tab] of Array.from(emojiTabs.children).entries()) {
        const selected = tabIndex === index;
        tab.setAttribute("aria-selected", String(selected));
        tab.tabIndex = selected ? 0 : -1;
      }
      emojiGrid.setAttribute("aria-labelledby", `emoji-tab-${index}`);
    }

    function validGuildId(value) {
      return typeof value === "string" && /^[A-Za-z0-9_-]{1,48}$/.test(value);
    }

    function memberPath(guildId, uid) {
      return `guilds/${guildId}/members/${uid}`;
    }

    function showChat(profile) {
      membership = profile;
      joinForm.hidden = true;
      chatView.hidden = false;
      setNotice(joinNotice, "");
      startMessageListener();
    }

    function appendMessage(key, data) {
      if (
        !data ||
        typeof data.uid !== "string" ||
        typeof data.nickname !== "string" ||
        typeof data.text !== "string" ||
        !Number.isFinite(data.createdAt)
      ) {
        console.warn("[Web Workflow Utility] Ignored malformed Guild Chat message.", key);
        return;
      }

      if (renderedMessageKeys.has(key)) return;
      renderedMessageKeys.add(key);

      const item = createElement("li", "message");
      item.dataset.messageKey = key;
      if (user && data.uid === user.uid) item.classList.add("self");

      const avatar = createElement(
        "span",
        "message-avatar",
        user && data.uid === user.uid ? "🐻" : "🐰",
      );
      avatar.setAttribute("aria-hidden", "true");

      const bubble = createElement("div", "message-bubble");
      const meta = createElement("div", "message-meta");
      const identity = createElement(
        "span",
        "message-author",
        capitalizeFirstCharacter(data.nickname),
      );
      const time = createElement("time", "", new Date(data.createdAt).toLocaleTimeString(
        "vi-VN",
        { hour: "2-digit", minute: "2-digit" },
      ));
      meta.append(identity, time);
      const text = createElement("p", "message-text", data.text);
      bubble.append(meta, text);
      item.append(avatar, bubble);
      messagesList.append(item);

      while (messagesList.children.length > MAX_HISTORY) {
        const oldestMessage = messagesList.firstElementChild;
        renderedMessageKeys.delete(oldestMessage.dataset.messageKey);
        oldestMessage.remove();
      }

      if (initialMessagesLoaded && user && data.uid !== user.uid) {
        if (isChatVisible()) {
          messagesList.scrollTop = messagesList.scrollHeight;
        } else {
          unreadCount += 1;
          updateUnread();
          showToast(`Tin nhắn mới từ ${identity.textContent}`);
        }
      } else {
        messagesList.scrollTop = messagesList.scrollHeight;
      }
    }

    let lastMessagePollError = null;

    async function pollMessages() {
      if (!messagePolling || !membership || !user) return;
      try {
        const messages = await databaseGet(
          `guilds/${membership.guildId}/messages`,
          {
            orderBy: JSON.stringify("createdAt"),
            limitToLast: String(MAX_HISTORY),
          },
        );
        if (messages && typeof messages === "object" && !Array.isArray(messages)) {
          const entries = Object.entries(messages).sort((first, second) => {
            const firstTime = Number(first[1] && first[1].createdAt) || 0;
            const secondTime = Number(second[1] && second[1].createdAt) || 0;
            return firstTime - secondTime || first[0].localeCompare(second[0]);
          });
          for (const [key, message] of entries) {
            appendMessage(key, message);
          }
        }
        if (!initialMessagesLoaded) {
          initialMessagesLoaded = true;
          messagesList.scrollTop = messagesList.scrollHeight;
        }
        connectionLabel.textContent = "Đã kết nối · làm mới mỗi 3 giây";
        if (lastMessagePollError) {
          setNotice(chatNotice, "");
          lastMessagePollError = null;
        }
      } catch (error) {
        connectionLabel.textContent = "Mất kết nối · sẽ thử lại...";
        setNotice(chatNotice, `Không tải được tin nhắn: ${error.message}`);
        if (lastMessagePollError !== error.message) {
          console.error("[Web Workflow Utility] Guild Chat polling failed.", error);
          lastMessagePollError = error.message;
        }
      }

      if (messagePolling) {
        global.setTimeout(() => void pollMessages(), MESSAGE_POLL_INTERVAL_MS);
      }
    }

    function startMessageListener() {
      if (!membership || !user || messagePolling) return;
      messagePolling = true;
      connectionLabel.textContent = "Đã kết nối · làm mới mỗi 3 giây";
      void pollMessages();
    }

    async function signIn() {
      const savedSession = readValue(AUTH_STORAGE_KEY, null);
      if (
        savedSession &&
        typeof savedSession.uid === "string" &&
        typeof savedSession.refreshToken === "string"
      ) {
        authSession = savedSession;
        try {
          await refreshAuthToken(true);
          return user;
        } catch (error) {
          if (
            !/INVALID_REFRESH_TOKEN|TOKEN_EXPIRED|USER_NOT_FOUND|USER_DISABLED/i.test(
              `${error.code || ""} ${error.message}`,
            )
          ) {
            throw error;
          }
          authSession = null;
          currentIdToken = null;
          idTokenExpiresAt = 0;
          writeValue(AUTH_STORAGE_KEY, null);
          writeValue(PROFILE_STORAGE_KEY, null);
        }
      }

      const result = await requestJson(request, "POST", AUTH_SIGN_UP_URL, {
        returnSecureToken: true,
      });
      saveAuthTokens(result);
      writeValue(PROFILE_STORAGE_KEY, null);
      return user;
    }

    async function loadSavedMembership() {
      const saved = readValue(PROFILE_STORAGE_KEY, null);
      if (
        !saved ||
        typeof saved !== "object" ||
        saved.uid !== user.uid ||
        !validGuildId(saved.guildId)
      ) {
        return false;
      }

      const data = await databaseGet(memberPath(saved.guildId, user.uid));
      if (!data || typeof data.nickname !== "string") {
        writeValue(PROFILE_STORAGE_KEY, null);
        return false;
      }

      showChat({
        guildId: saved.guildId,
        nickname: data.nickname,
        inviteCode: data.inviteCode,
      });
      return true;
    }

    async function initializeConnection() {
      connectionLabel.textContent = "Đang kết nối...";
      await signIn();
      if (!user) throw new Error("Firebase Authentication chưa cấp UID.");
      connectionLabel.textContent = "Đã xác thực";

      const hasMembership = await loadSavedMembership();
      if (!hasMembership) {
        joinForm.hidden = false;
        chatView.hidden = true;
        setNotice(joinNotice, "Nhập nickname và mã hội để tham gia.");
      }
    }

    function requestConnection() {
      if (connectionPromise) return connectionPromise;
      connectionPromise = initializeConnection().catch((error) => {
        connectionPromise = null;
        connectionLabel.textContent = "Lỗi kết nối";
        setNotice(joinNotice, `Không kết nối được Firebase: ${error.message}`);
        console.error("[Web Workflow Utility] Guild Chat connection failed.", error);
        throw error;
      });
      return connectionPromise;
    }

    async function joinGuild(event) {
      event.preventDefault();
      setNotice(joinNotice, "");
      const nickname = nicknameInput.value.trim();
      const inviteCode = inviteCodeInput.value.trim().toUpperCase();

      if (
        nickname.length < MIN_NICKNAME_LENGTH ||
        nickname.length > MAX_NICKNAME_LENGTH
      ) {
        setNotice(
          joinNotice,
          `Nickname cần từ ${MIN_NICKNAME_LENGTH} đến ${MAX_NICKNAME_LENGTH} ký tự.`,
        );
        return;
      }
      if (!/^[A-Z0-9]{16,64}$/.test(inviteCode)) {
        setNotice(joinNotice, "Mã hội phải có từ 16 đến 64 ký tự chữ hoặc số.");
        return;
      }
      if (!user) {
        setNotice(joinNotice, "Đang xác thực; vui lòng thử lại.");
        return;
      }

      joinButton.disabled = true;
      setNotice(joinNotice, "Đang kiểm tra mã hội...");
      try {
        const invite = await databaseGet(`guildInvites/${inviteCode}`);
        if (
          !invite ||
          invite.enabled !== true ||
          !validGuildId(invite.guildId)
        ) {
          throw new Error("Mã hội không hợp lệ hoặc đã bị thu hồi.");
        }

        const path = memberPath(invite.guildId, user.uid);
        let member = await databaseGet(path);
        if (!member) {
          member = {
            nickname,
            inviteCode,
            createdAt: { ".sv": "timestamp" },
          };
          await databaseSet(path, member);
          member.nickname = nickname;
        } else {
          setNotice(joinNotice, `Đã tham gia trước đó với nickname "${member.nickname}".`);
        }

        const profile = {
          uid: user.uid,
          guildId: invite.guildId,
          nickname: member.nickname,
        };
        writeValue(PROFILE_STORAGE_KEY, profile);
        nicknameInput.value = "";
        inviteCodeInput.value = "";
        showChat(profile);
      } catch (error) {
        setNotice(joinNotice, `Không tham gia được: ${error.message}`);
        console.error("[Web Workflow Utility] Guild Chat join failed.", error);
      } finally {
        joinButton.disabled = false;
      }
    }

    async function sendMessage(event) {
      event.preventDefault();
      setNotice(chatNotice, "");
      const text = messageInput.value.trim();
      if (!text) {
        setNotice(chatNotice, "Tin nhắn không được để trống.");
        return;
      }
      if (text.length > MAX_MESSAGE_LENGTH) {
        setNotice(chatNotice, `Tin nhắn tối đa ${MAX_MESSAGE_LENGTH} ký tự.`);
        return;
      }
      if (!membership || !user) {
        setNotice(chatNotice, "Bạn chưa tham gia hội.");
        return;
      }
      const remaining = MESSAGE_COOLDOWN_MS - (Date.now() - lastSentAt);
      if (remaining > 0) {
        setNotice(chatNotice, `Vui lòng đợi ${Math.ceil(remaining / 1000)} giây.`);
        return;
      }

      sendButton.disabled = true;
      lastSentAt = Date.now();
      try {
        await databasePush(`guilds/${membership.guildId}/messages`, {
          uid: user.uid,
          nickname: membership.nickname,
          text,
          createdAt: { ".sv": "timestamp" },
        });
        messageInput.value = "";
        messageInput.focus();
      } catch (error) {
        setNotice(chatNotice, `Gửi tin nhắn thất bại: ${error.message}`);
        console.error("[Web Workflow Utility] Guild Chat send failed.", error);
      } finally {
        sendButton.disabled = false;
      }
    }

    launchButton.addEventListener("click", () => {
      panel.hidden = !panel.hidden;
      if (!panel.hidden) {
        unreadCount = 0;
        updateUnread();
        requestConnection().catch(() => {});
      }
    });
    shadow.querySelector(".close").addEventListener("click", () => {
      panel.hidden = true;
    });
    retryButton.addEventListener("click", () => {
      requestConnection().catch(() => {});
    });
    joinForm.addEventListener("submit", (event) => {
      void joinGuild(event);
    });
    shadow.querySelector(".send").addEventListener("submit", (event) => {
      void sendMessage(event);
    });
    emojiButton.addEventListener("click", () => {
      emojiPicker.hidden = !emojiPicker.hidden;
      emojiButton.setAttribute("aria-expanded", String(!emojiPicker.hidden));
    });
    emojiTabs.addEventListener("click", (event) => {
      const tab = event.target.closest(".emoji-tab");
      if (tab) selectEmojiCategory(Number(tab.dataset.categoryIndex));
    });
    emojiTabs.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const tab = event.target.closest(".emoji-tab");
      if (!tab) return;
      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const currentIndex = Number(tab.dataset.categoryIndex);
      const nextIndex =
        (currentIndex + direction + EMOJI_CATEGORIES.length) %
        EMOJI_CATEGORIES.length;
      selectEmojiCategory(nextIndex);
      emojiTabs.children[nextIndex].focus();
    });
    emojiPicker.addEventListener("click", (event) => {
      const option = event.target.closest(".emoji-option");
      if (!option) return;
      insertEmoji(option.dataset.emoji);
      emojiPicker.hidden = true;
      emojiButton.setAttribute("aria-expanded", "false");
    });
    shadow.addEventListener("click", (event) => {
      if (
        !emojiPicker.hidden &&
        !emojiPicker.contains(event.target) &&
        event.target !== emojiButton
      ) {
        emojiPicker.hidden = true;
        emojiButton.setAttribute("aria-expanded", "false");
      }
    });
    updateUnread();
  }

  global.GuildChatModule = Object.freeze({ mount });
})(globalThis);
