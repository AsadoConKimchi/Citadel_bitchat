import { DiscordSDK } from "@discord/embedded-app-sdk";
import { SimplePool, finalizeEvent, generateSecretKey, getPublicKey } from "nostr-tools";

const DEFAULT_GEOHASH = "wy";
const RELAYS = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.nostr.band",
];
const EVENT_KIND_GEO = 20000;

const discordSdk = new DiscordSDK(import.meta.env.VITE_DISCORD_CLIENT_ID);

let currentGeohash = DEFAULT_GEOHASH;
let pool = null;
let subscription = null;
let secretKey = null;
let publicKey = null;
let username = "anon";
let messages = [];

function initNostrIdentity() {
  const stored = localStorage.getItem("bitchat_nostr_profile");
  if (stored) {
    const profile = JSON.parse(stored);
    secretKey = new Uint8Array(profile.secretKey);
    publicKey = profile.publicKey;
    username = profile.username;
  } else {
    secretKey = generateSecretKey();
    publicKey = getPublicKey(secretKey);
    username = "discord_" + publicKey.slice(0, 8);
    localStorage.setItem(
      "bitchat_nostr_profile",
      JSON.stringify({
        secretKey: Array.from(secretKey),
        publicKey,
        username,
      })
    );
  }
}

function colorForPubkey(pubkey) {
  const hash = parseInt(pubkey.slice(0, 8), 16);
  const hue = hash % 360;
  return `hsl(${hue}, 70%, 65%)`;
}

function formatTime(timestamp) {
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

async function setup() {
  await discordSdk.ready();

  const { code } = await discordSdk.commands.authorize({
    client_id: import.meta.env.VITE_DISCORD_CLIENT_ID,
    response_type: "code",
    state: "",
    prompt: "none",
    scope: ["identify"],
  });

  const tokenResponse = await fetch("/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });

  const { access_token } = await tokenResponse.json();
  await discordSdk.commands.authenticate({ access_token });

  initNostrIdentity();
  pool = new SimplePool();
  renderApp();
  subscribeToGeohash(currentGeohash);
}

function subscribeToGeohash(geohash) {
  if (subscription) {
    subscription.close();
  }
  messages = [];
  renderMessages();

  const since = Math.floor(Date.now() / 1000) - 3600; // last 1 hour

  subscription = pool.subscribeMany(
    RELAYS,
    [{ kinds: [EVENT_KIND_GEO], "#g": [geohash], since }],
    {
      onevent(event) {
        const nameTag = event.tags.find((t) => t[0] === "n");
        const displayName = nameTag ? nameTag[1] : event.pubkey.slice(0, 8);

        const msg = {
          id: event.id,
          pubkey: event.pubkey,
          content: event.content,
          name: displayName,
          timestamp: event.created_at,
        };

        if (!messages.some((m) => m.id === msg.id)) {
          messages.push(msg);
          messages.sort((a, b) => a.timestamp - b.timestamp);
          renderMessages();
        }
      },
      oneose() {
        console.log("Initial events loaded for #" + geohash);
      },
    }
  );
}

async function sendMessage(content) {
  if (!content.trim() || !pool) return;

  const event = finalizeEvent(
    {
      kind: EVENT_KIND_GEO,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ["n", username],
        ["client", "bitchat.land"],
        ["g", currentGeohash],
      ],
      content: content.trim(),
    },
    secretKey
  );

  await Promise.any(pool.publish(RELAYS, event));
}

function renderMessages() {
  const container = document.getElementById("chat-messages");
  if (!container) return;

  const wasAtBottom =
    container.scrollHeight - container.scrollTop - container.clientHeight < 50;

  container.innerHTML = messages
    .map(
      (msg) => `
    <div class="chat-message">
      <span class="msg-time">${formatTime(msg.timestamp)}</span>
      <span class="msg-name" style="color:${colorForPubkey(msg.pubkey)}">${escapeHtml(msg.name)}</span>
      <span class="msg-content">${escapeHtml(msg.content)}</span>
    </div>
  `
    )
    .join("");

  if (wasAtBottom) {
    container.scrollTop = container.scrollHeight;
  }
}

function renderApp() {
  const app = document.getElementById("app");
  app.innerHTML = "";

  // Header
  const header = document.createElement("div");
  header.id = "header";
  header.innerHTML = `
    <span class="header-label">채널:</span>
    <span id="current-geohash" class="geohash-badge">#${currentGeohash}</span>
    <button id="change-btn" class="change-btn">변경</button>
    <div id="geohash-input-group" class="geohash-input-group hidden">
      <input id="geohash-input" type="text" class="geohash-input"
        placeholder="지오해시 (예: wydm)" maxlength="12" />
      <button id="go-btn" class="go-btn">이동</button>
      <button id="cancel-btn" class="cancel-btn">취소</button>
    </div>
    <span class="header-user">${escapeHtml(username)}</span>
  `;
  app.appendChild(header);

  // Chat area
  const chatArea = document.createElement("div");
  chatArea.id = "chat-area";
  chatArea.innerHTML = `
    <div id="chat-messages"></div>
    <div id="chat-input-bar">
      <input id="chat-input" type="text" placeholder="#${currentGeohash} 에 메시지 보내기..."
        autocomplete="off" />
      <button id="send-btn">전송</button>
    </div>
  `;
  app.appendChild(chatArea);

  bindEvents();
}

function bindEvents() {
  const changeBtn = document.getElementById("change-btn");
  const cancelBtn = document.getElementById("cancel-btn");
  const goBtn = document.getElementById("go-btn");
  const geohashInput = document.getElementById("geohash-input");
  const inputGroup = document.getElementById("geohash-input-group");
  const chatInput = document.getElementById("chat-input");
  const sendBtn = document.getElementById("send-btn");

  changeBtn.addEventListener("click", () => {
    inputGroup.classList.remove("hidden");
    changeBtn.classList.add("hidden");
    geohashInput.value = currentGeohash;
    geohashInput.focus();
    geohashInput.select();
  });

  cancelBtn.addEventListener("click", () => {
    inputGroup.classList.add("hidden");
    changeBtn.classList.remove("hidden");
  });

  goBtn.addEventListener("click", () => navigateToGeohash());

  geohashInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") navigateToGeohash();
    if (e.key === "Escape") {
      inputGroup.classList.add("hidden");
      changeBtn.classList.remove("hidden");
    }
  });

  geohashInput.addEventListener("input", () => {
    geohashInput.value = geohashInput.value
      .toLowerCase()
      .replace(/[^0-9b-hjkmnp-z]/g, "");
  });

  sendBtn.addEventListener("click", () => {
    const content = chatInput.value;
    if (content.trim()) {
      sendMessage(content);
      chatInput.value = "";
    }
  });

  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const content = chatInput.value;
      if (content.trim()) {
        sendMessage(content);
        chatInput.value = "";
      }
    }
  });
}

function navigateToGeohash() {
  const geohashInput = document.getElementById("geohash-input");
  const inputGroup = document.getElementById("geohash-input-group");
  const changeBtn = document.getElementById("change-btn");
  const geohashBadge = document.getElementById("current-geohash");
  const chatInput = document.getElementById("chat-input");

  const newGeohash = geohashInput.value.trim();
  if (!newGeohash) return;

  currentGeohash = newGeohash;
  geohashBadge.textContent = `#${currentGeohash}`;
  chatInput.placeholder = `#${currentGeohash} 에 메시지 보내기...`;

  inputGroup.classList.add("hidden");
  changeBtn.classList.remove("hidden");

  subscribeToGeohash(currentGeohash);
}

setup().catch((err) => {
  console.error("Setup failed:", err);
  const app = document.getElementById("app");
  const errorMsg = document.createElement("div");
  errorMsg.id = "error";
  const p1 = document.createElement("p");
  p1.textContent = "연결에 실패했습니다.";
  const p2 = document.createElement("p");
  p2.className = "error-detail";
  p2.textContent = err.message || "알 수 없는 오류가 발생했습니다.";
  const btn = document.createElement("button");
  btn.textContent = "다시 시도";
  btn.addEventListener("click", () => location.reload());
  errorMsg.appendChild(p1);
  errorMsg.appendChild(p2);
  errorMsg.appendChild(btn);
  app.innerHTML = "";
  app.appendChild(errorMsg);
});
