const BACKEND_URL = "https://your-backend-name.onrender.com"; // replace later

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const form = document.getElementById("eventForm");

// Access camera
navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } })
  .then(stream => video.srcObject = stream)
  .catch(err => alert("Camera access denied! Please allow camera access."));

async function getLocation() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      err => reject(err)
    );
  });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  // Take selfie
  const context = canvas.getContext("2d");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const selfie = canvas.toDataURL("image/jpeg");

  // Get location
  const geo = await getLocation().catch(() => null);

  // Collect form data
  const data = {
    name: document.getElementById("name").value,
    email: document.getElementById("email").value,
    phone: document.getElementById("phone").value,
    geo,
    selfie
  };

  // Send to backend
  const res = await fetch(`${BACKEND_URL}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

  const result = await res.json();
  if (result.ok) {
    alert("✅ Submitted successfully!");
    form.reset();
  } else {
    alert("❌ Something went wrong!");
  }
});
