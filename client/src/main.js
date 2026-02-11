import { DiscordSDK } from "@discord/embedded-app-sdk";

const DEFAULT_GEOHASH = "wy";
const BITCHAT_BASE_URL = "https://bitchat.land";

const discordSdk = new DiscordSDK(import.meta.env.VITE_DISCORD_CLIENT_ID);

let currentGeohash = DEFAULT_GEOHASH;

async function setup() {
  // Wait for Discord client to be ready
  await discordSdk.ready();

  // Authorize with Discord
  const { code } = await discordSdk.commands.authorize({
    client_id: import.meta.env.VITE_DISCORD_CLIENT_ID,
    response_type: "code",
    state: "",
    prompt: "none",
    scope: ["identify"],
  });

  // Exchange code for access token via our server
  const tokenResponse = await fetch("/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });

  const { access_token } = await tokenResponse.json();

  // Authenticate with Discord
  await discordSdk.commands.authenticate({ access_token });

  // SDK is authenticated, render the app
  renderApp();
}

function getBitchatUrl(geohash) {
  return `${BITCHAT_BASE_URL}/#${geohash}`;
}

function renderApp() {
  const app = document.getElementById("app");
  app.innerHTML = "";

  // Header bar with geohash controls
  const header = document.createElement("div");
  header.id = "header";
  header.innerHTML = `
    <span class="header-label">현재 채널:</span>
    <span id="current-geohash" class="geohash-badge">#${currentGeohash}</span>
    <button id="change-btn" class="change-btn" title="지오해시 변경">변경</button>
    <div id="geohash-input-group" class="geohash-input-group hidden">
      <input
        id="geohash-input"
        type="text"
        class="geohash-input"
        placeholder="지오해시 입력 (예: wydm)"
        maxlength="12"
      />
      <button id="go-btn" class="go-btn">이동</button>
      <button id="cancel-btn" class="cancel-btn">취소</button>
    </div>
  `;
  app.appendChild(header);

  // Bitchat iframe container
  const iframeContainer = document.createElement("div");
  iframeContainer.id = "iframe-container";

  const iframe = document.createElement("iframe");
  iframe.id = "bitchat-iframe";
  iframe.src = getBitchatUrl(currentGeohash);
  iframe.allow = "clipboard-write";
  iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-popups allow-forms");
  iframeContainer.appendChild(iframe);
  app.appendChild(iframeContainer);

  // Bind event handlers
  bindEvents();
}

function bindEvents() {
  const changeBtn = document.getElementById("change-btn");
  const cancelBtn = document.getElementById("cancel-btn");
  const goBtn = document.getElementById("go-btn");
  const geohashInput = document.getElementById("geohash-input");
  const inputGroup = document.getElementById("geohash-input-group");

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

  goBtn.addEventListener("click", () => {
    navigateToGeohash();
  });

  geohashInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      navigateToGeohash();
    }
    if (e.key === "Escape") {
      inputGroup.classList.add("hidden");
      changeBtn.classList.remove("hidden");
    }
  });

  // Only allow valid geohash characters (base32: 0-9, b-h, j, k, m, n, p-z)
  geohashInput.addEventListener("input", () => {
    geohashInput.value = geohashInput.value.toLowerCase().replace(/[^0-9b-hjkmnp-z]/g, "");
  });
}

function navigateToGeohash() {
  const geohashInput = document.getElementById("geohash-input");
  const inputGroup = document.getElementById("geohash-input-group");
  const changeBtn = document.getElementById("change-btn");
  const geohashBadge = document.getElementById("current-geohash");
  const iframe = document.getElementById("bitchat-iframe");

  const newGeohash = geohashInput.value.trim();

  if (!newGeohash) return;

  currentGeohash = newGeohash;
  geohashBadge.textContent = `#${currentGeohash}`;
  iframe.src = getBitchatUrl(currentGeohash);

  inputGroup.classList.add("hidden");
  changeBtn.classList.remove("hidden");
}

// Initialize
setup().catch((err) => {
  console.error("Discord SDK setup failed:", err);
  const app = document.getElementById("app");
  app.innerHTML = `
    <div id="error">
      <p>연결에 실패했습니다.</p>
      <p class="error-detail">${err.message || "알 수 없는 오류가 발생했습니다."}</p>
      <button onclick="location.reload()">다시 시도</button>
    </div>
  `;
});
