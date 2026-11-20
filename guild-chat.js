(function (global) {
  "use strict";

  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyBTy82Yu5YLGn8R2Tyufu2CV8E2E0-ze2A",
    authDomain: "web-workflow-utility-chat.firebaseapp.com",
    databaseURL: "https://web-workflow-utility-chat-default-rtdb.firebaseio.com",
    projectId: "web-workflow-utility-chat",
    appId: "1:114790224911:web:ad0b9dd5c4d0c96c307f7a",
  };
  const APP_NAME = "web-workflow-utility-guild-chat";
  const PROFILE_STORAGE_KEY = "web-workflow-utility.guild-chat.profile";
  const SOUND_STORAGE_KEY = "web-workflow-utility.guild-chat.sound";
  const MAX_HISTORY = 150;
  const MAX_MESSAGE_LENGTH = 500;
  const MIN_NICKNAME_LENGTH = 2;
  const MAX_NICKNAME_LENGTH = 24;
  const MESSAGE_COOLDOWN_MS = 1_500;

  function createFirebaseApp(firebase) {
    const existingApp = firebase.apps.find((app) => app.name === APP_NAME);
    return existingApp || firebase.initializeApp(FIREBASE_CONFIG, APP_NAME);
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function mount({ container, getValue, setValue }) {
    const firebase = global.firebase;
    if (!firebase || !firebase.auth || !firebase.database) {
      throw new Error("Firebase SDK chưa được tải.");
    }

    const app = createFirebaseApp(firebase);
    const auth = app.auth();
    const database = app.database();
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
    let messageQuery = null;
    let connectionListener = null;
    let connectionPromise = null;
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

    function memberRef(guildId, uid) {
      return database.ref(`guilds/${guildId}/members/${uid}`);
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

    function startMessageListener() {
      if (!membership || !user || messageQuery) return;
      const messagesRef = database
        .ref(`guilds/${membership.guildId}/messages`)
        .orderByChild("createdAt")
        .limitToLast(MAX_HISTORY);
      messageQuery = messagesRef;
      messageQuery.on(
        "child_added",
        (snapshot) => appendMessage(snapshot.key, snapshot.val()),
        (error) => {
          setNotice(chatNotice, `Không tải được tin nhắn: ${error.message}`);
          console.error("[Web Workflow Utility] Guild Chat listener failed.", error);
        },
      );
      messageQuery.on(
        "value",
        () => {
          initialMessagesLoaded = true;
          messagesList.scrollTop = messagesList.scrollHeight;
        },
        (error) => {
          setNotice(chatNotice, `Không đồng bộ được lịch sử: ${error.message}`);
          console.error("[Web Workflow Utility] Guild Chat history sync failed.", error);
        },
      );
    }

    async function signIn() {
      await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      if (auth.currentUser) return auth.currentUser;

      const credential = await auth.signInAnonymously();
      return credential.user;
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

      const snapshot = await memberRef(saved.guildId, user.uid).once("value");
      const data = snapshot.val();
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
      user = auth.currentUser;
      if (!user) throw new Error("Firebase Authentication chưa cấp UID.");

      if (!connectionListener) {
        connectionListener = database.ref(".info/connected");
        connectionListener.on("value", (snapshot) => {
          connectionLabel.textContent = snapshot.val()
            ? "Đã kết nối"
            : "Mất kết nối — đang thử lại...";
        });
      }

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
        const inviteSnapshot = await database
          .ref(`guildInvites/${inviteCode}`)
          .once("value");
        const invite = inviteSnapshot.val();
        if (
          !invite ||
          invite.enabled !== true ||
          !validGuildId(invite.guildId)
        ) {
          throw new Error("Mã hội không hợp lệ hoặc đã bị thu hồi.");
        }

        const ref = memberRef(invite.guildId, user.uid);
        const existingMember = await ref.once("value");
        let member = existingMember.val();
        if (!member) {
          member = {
            nickname,
            inviteCode,
            createdAt: firebase.database.ServerValue.TIMESTAMP,
          };
          await ref.set(member);
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
        const ref = database.ref(`guilds/${membership.guildId}/messages`).push();
        await ref.set({
          uid: user.uid,
          nickname: membership.nickname,
          text,
          createdAt: firebase.database.ServerValue.TIMESTAMP,
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
