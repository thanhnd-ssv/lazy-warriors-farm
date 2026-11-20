(function (global) {
  "use strict";

  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyBTy82Yu5YLGn8R2Tyufu2CV8E2E0-ze2A",
    databaseURL: "https://web-workflow-utility-chat-default-rtdb.firebaseio.com",
  };
  const AUTH_STORAGE_KEY = "web-workflow-utility.guild-chat.auth";
  const PROFILE_STORAGE_KEY = "web-workflow-utility.guild-chat.profile";
  const SOUND_STORAGE_KEY = "web-workflow-utility.guild-chat.sound";
  const MAX_HISTORY = 150;
  const MAX_MESSAGE_LENGTH = 500;
  const MIN_NICKNAME_LENGTH = 2;
  const MAX_NICKNAME_LENGTH = 24;
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

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function mount({ container, getValue, setValue, request }) {
    if (typeof request !== "function") {
      throw new Error("Tampermonkey request API chưa được cấu hình.");
    }
    const launchButton = createElement("button", "guild-chat-launch", "Guild Chat");
    launchButton.type = "button";
    launchButton.setAttribute("aria-label", "Mở Guild Chat");
    Object.assign(launchButton.style, {
      width: "100%",
      minHeight: "30px",
      padding: "6px 8px",
      border: "1px solid #27513b",
      borderRadius: "8px",
      color: "#e9f8ee",
      background: "#183b2b",
      font: "700 12px system-ui, sans-serif",
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
        :host { color-scheme: dark; font: 13px/1.4 system-ui, sans-serif; }
        * { box-sizing: border-box; }
        .panel {
          display: flex; flex-direction: column; width: min(360px, calc(100vw - 24px));
          height: min(500px, calc(100vh - 24px)); overflow: hidden;
          color: #e9f3ec; background: #101914; border: 1px solid #345342;
          border-radius: 12px; box-shadow: 0 12px 36px #0009;
        }
        .panel[hidden] { display: none; }
        .header {
          display: flex; align-items: center; justify-content: space-between;
          gap: 8px; padding: 10px 12px; background: #17271d;
          border-bottom: 1px solid #345342;
        }
        .heading { display: grid; gap: 2px; min-width: 0; }
        .heading strong { color: #b8f0c7; font-size: 14px; }
        .connection { color: #a7b9ac; font-size: 11px; }
        .header-actions { display: flex; gap: 5px; }
        button, input { font: inherit; }
        button {
          min-height: 30px; padding: 5px 9px; color: #e9f3ec;
          background: #24392b; border: 1px solid #45664e;
          border-radius: 7px; cursor: pointer;
        }
        button:hover:not(:disabled) { background: #31503a; }
        button:disabled { opacity: .6; cursor: wait; }
        .content { display: flex; flex: 1; min-height: 0; flex-direction: column; }
        .panel.collapsed .content { display: none; }
        .join, .chat { display: flex; flex: 1; min-height: 0; flex-direction: column; gap: 9px; padding: 12px; }
        .join[hidden], .chat[hidden] { display: none; }
        label { display: grid; gap: 4px; color: #c6d8cb; font-size: 12px; }
        input {
          width: 100%; min-height: 36px; padding: 7px 9px;
          color: #f3fff5; background: #0a110d; border: 1px solid #3c5644;
          border-radius: 7px; outline: none;
        }
        input:focus { border-color: #69c27f; }
        .primary { color: #09210f; background: #75d38c; border-color: #75d38c; font-weight: 700; }
        .notice { min-height: 18px; color: #ffcb82; font-size: 11px; overflow-wrap: anywhere; }
        .messages {
          display: flex; flex: 1; min-height: 0; flex-direction: column; gap: 7px;
          overflow-y: auto; margin: 0; padding: 2px; list-style: none;
        }
        .message {
          max-width: 92%; align-self: flex-start; padding: 7px 9px;
          background: #1b2b20; border: 1px solid #2d4635; border-radius: 9px;
          overflow-wrap: anywhere;
        }
        .message.self { align-self: flex-end; background: #1c3b28; }
        .message-meta { display: flex; justify-content: space-between; gap: 10px; color: #a9d8b3; font-size: 10px; }
        .message-meta time { flex: 0 0 auto; color: #9eafa3; }
        .message-text { margin: 3px 0 0; white-space: pre-wrap; }
        .send { display: flex; gap: 6px; }
        .send input { flex: 1; min-width: 0; }
        .chat-tools { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
        .unread { min-height: 16px; color: #9fe2ad; font-size: 11px; }
        .toast {
          position: absolute; right: 0; bottom: calc(100% + 8px);
          max-width: min(340px, calc(100vw - 24px)); padding: 8px 11px;
          color: #e9f3ec; background: #183b2b; border: 1px solid #69c27f;
          border-radius: 8px; box-shadow: 0 6px 18px #0008;
        }
        .toast[hidden] { display: none; }
        @media (max-width: 480px) {
          :host { right: 6px !important; bottom: 6px !important; }
          .panel { height: min(440px, calc(100vh - 12px)); }
        }
      </style>
      <div class="toast" role="status" hidden></div>
      <section class="panel" aria-label="Guild Chat" hidden>
        <header class="header">
          <div class="heading">
            <strong>Guild Chat</strong>
            <span class="connection">Chưa kết nối</span>
          </div>
          <div class="header-actions">
            <button type="button" class="collapse" aria-label="Thu gọn">−</button>
            <button type="button" class="close" aria-label="Đóng chat">×</button>
          </div>
        </header>
        <div class="content">
          <form class="join">
            <label>Nickname
              <input class="nickname" maxlength="24" autocomplete="nickname" required>
            </label>
            <label>Guild Invite Code
              <input class="invite-code" maxlength="64" autocomplete="off" required>
            </label>
            <button type="submit" class="primary join-button">Join Guild</button>
            <button type="button" class="retry">Kết nối lại</button>
            <div class="join-notice notice" role="status"></div>
          </form>
          <section class="chat" hidden>
            <ol class="messages" aria-live="polite" aria-label="Tin nhắn"></ol>
            <div class="unread"></div>
            <div class="chat-tools">
              <span class="guild-label"></span>
              <button type="button" class="sound"></button>
            </div>
            <form class="send">
              <input class="message-input" maxlength="500" autocomplete="off" placeholder="Nhập tin nhắn..." aria-label="Tin nhắn" required>
              <button type="submit" class="primary send-button">Gửi</button>
            </form>
            <div class="chat-notice notice" role="status"></div>
          </section>
        </div>
      </section>
    `;
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
    const guildLabel = shadow.querySelector(".guild-label");
    const soundButton = shadow.querySelector(".sound");
    const messageInput = shadow.querySelector(".message-input");
    const sendButton = shadow.querySelector(".send-button");
    const chatNotice = shadow.querySelector(".chat-notice");
    const toast = shadow.querySelector(".toast");

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
    let soundEnabled = readValue(SOUND_STORAGE_KEY, true) !== false;
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
      if (
        !result ||
        typeof result.id_token !== "string" ||
        typeof result.refresh_token !== "string" ||
        !Number.isFinite(Number(result.expires_in))
      ) {
        throw new Error("Firebase Authentication returned an incomplete token response.");
      }

      const sessionUid = result.localId || result.user_id || uid;
      if (typeof sessionUid !== "string" || !sessionUid) {
        throw new Error("Firebase Authentication did not return a user ID.");
      }

      authSession = {
        uid: sessionUid,
        refreshToken: result.refresh_token,
      };
      currentIdToken = result.id_token;
      idTokenExpiresAt =
        Date.now() + Math.max(Number(result.expires_in), 1) * 1000;
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
        ? `Guild Chat (${unreadCount})`
        : "Guild Chat";
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
      return !panel.hidden && !panel.classList.contains("collapsed");
    }

    function updateSoundButton() {
      soundButton.textContent = soundEnabled ? "Âm thanh: bật" : "Âm thanh: tắt";
      soundButton.setAttribute("aria-pressed", String(soundEnabled));
    }

    function playSound() {
      if (!soundEnabled) return;
      const AudioContextConstructor =
        global.AudioContext || global.webkitAudioContext;
      if (!AudioContextConstructor) return;

      try {
        const audio = new AudioContextConstructor();
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.frequency.value = 740;
        gain.gain.value = 0.045;
        oscillator.connect(gain);
        gain.connect(audio.destination);
        oscillator.start();
        oscillator.stop(audio.currentTime + 0.12);
        oscillator.onended = () => void audio.close();
      } catch (error) {
        console.warn("[Web Workflow Utility] Guild Chat sound failed.", error);
      }
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
      guildLabel.textContent = `Hội: ${profile.guildId}`;
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

      const meta = createElement("div", "message-meta");
      const identity = createElement(
        "span",
        "message-author",
        `${data.nickname} · ${data.uid.slice(0, 6)}`,
      );
      const time = createElement("time", "", new Date(data.createdAt).toLocaleTimeString(
        "vi-VN",
        { hour: "2-digit", minute: "2-digit" },
      ));
      meta.append(identity, time);
      const text = createElement("p", "message-text", data.text);
      item.append(meta, text);
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
          playSound();
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
    shadow.querySelector(".collapse").addEventListener("click", (event) => {
      const collapsed = panel.classList.toggle("collapsed");
      event.currentTarget.textContent = collapsed ? "+" : "−";
      event.currentTarget.setAttribute(
        "aria-label",
        collapsed ? "Mở rộng" : "Thu gọn",
      );
      if (!collapsed) {
        unreadCount = 0;
        updateUnread();
        messagesList.scrollTop = messagesList.scrollHeight;
      }
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
    soundButton.addEventListener("click", () => {
      soundEnabled = !soundEnabled;
      writeValue(SOUND_STORAGE_KEY, soundEnabled);
      updateSoundButton();
      if (soundEnabled) playSound();
    });

    updateUnread();
    updateSoundButton();
  }

  global.GuildChatModule = Object.freeze({ mount });
})(globalThis);
