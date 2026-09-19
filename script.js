import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
    getFirestore,
    collection,
    addDoc,
    serverTimestamp,
    query,
    orderBy,
    limit,
    onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
/*
  ==========================================================
  1. TẠO FIREBASE PROJECT
  ==========================================================
  Firebase Console -> Create project
  -> Build -> Firestore Database -> Create database
  -> Project settings -> Your apps -> Web app
  -> copy firebaseConfig vào bên dưới.

  2. FIRESTORE COLLECTION
  Không cần tạo collection trước.
  Khi submit form, collection "guest_messages" sẽ tự tạo.
*/
const firebaseConfig = {
    apiKey: "AIzaSyBSMraGR1sngBT8iPZrybZIh0GDsYETj-8",
    authDomain: "gradurationchinh.firebaseapp.com",
    projectId: "gradurationchinh",
    storageBucket: "gradurationchinh.firebasestorage.app",
    messagingSenderId: "128054782671",
    appId: "1:128054782671:web:be10dc3ea50334428525ba",
    measurementId: "G-1DB4VTZ08H"
};

let db = null;

try {
    // Chỉ khởi tạo nếu người dùng đã thay config mẫu.
    if (!firebaseConfig.apiKey.startsWith("YOUR_")) {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
    }
} catch (error) {
    console.error("Firebase init error:", error);
}

async function saveGuestMessage(payload) {
    if (!db) {
        throw new Error(
            "Firebase chưa được cấu hình. Hãy thay firebaseConfig trong file script.js."
        );
    }

    return await addDoc(collection(db, "guest_messages"), {
        ...payload,
        createdAt: serverTimestamp(),
        userAgent: navigator.userAgent,
    });
}

// ==========================
// COUNTDOWN
// ==========================
// Đổi ngày giờ tại đây nếu cần.
const graduationDate = new Date("2026-09-26T13:30:00+07:00");

function updateCountdown() {
    const now = new Date();
    const diff = graduationDate.getTime() - now.getTime();

    const days = Math.max(0, Math.floor(diff / 86400000));
    const hours = Math.max(0, Math.floor((diff / 3600000) % 24));
    const minutes = Math.max(0, Math.floor((diff / 60000) % 60));
    const seconds = Math.max(0, Math.floor((diff / 1000) % 60));

    document.getElementById("days").textContent = String(days).padStart(2, "0");
    document.getElementById("hours").textContent = String(hours).padStart(2, "0");
    document.getElementById("minutes").textContent = String(minutes).padStart(2, "0");
    document.getElementById("seconds").textContent = String(seconds).padStart(2, "0");
}

updateCountdown();
setInterval(updateCountdown, 1000);

// ==========================
// FIRESTORE FORM
// ==========================
const form = document.getElementById("guestForm");
const button = document.getElementById("submitButton");
const status = document.getElementById("formStatus");

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = document.getElementById("guestName").value.trim();
    const message = document.getElementById("guestMessage").value.trim();
    const attendance = document.getElementById("attendance").value;

    if (!name || !message || !attendance) {
        status.className = "form-status error";
        status.textContent = "Vui lòng điền đầy đủ thông tin.";
        return;
    }

    button.disabled = true;
    button.textContent = "ĐANG GỬI...";
    status.className = "form-status";
    status.textContent = "";

    try {
        await saveGuestMessage({
            name,
            message,
            attendance,
            event: "graduation_2025",
        });

        status.className = "form-status success";
        status.textContent = "Cảm ơn bạn! Lời nhắn đã được lưu lại ❤️";

        form.reset();
    } catch (error) {
        console.error(error);
        status.className = "form-status error";
        status.textContent = error.message || "Có lỗi xảy ra. Vui lòng thử lại.";
    } finally {
        button.disabled = false;
        button.textContent = "GỬI LỜI NHẮN & XÁC NHẬN";
    }
});
// ==========================
// TƯỜNG LỜI NHẮN (rơi ngẫu nhiên, không chồng nhau)
// ==========================
const wall = document.getElementById("messageWall");
const wallEmpty = document.getElementById("wallEmpty");
const AVATAR_COLORS = ["#b8954d", "#526b55", "#a4463f", "#5b6f8f", "#8a6d9b", "#c0774d"];

const SPEED = 45; // px/giây, mọi thẻ dùng chung một tốc độ
const GAP = 14; // khoảng cách tối thiểu giữa các thẻ (px)
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const wallItems = new Map(); // id -> phần tử
const waiting = []; // thẻ đang chờ được thả
const falling = []; // thẻ đang rơi: { el, x, y, w, h }
let paused = false;
let spawnIn = 0;
let lastTs = 0;

function rand(min, max) {
    return Math.random() * (max - min) + min;
}

function avatarInfo(name) {
    const words = name.trim().split(/\s+/);
    const last = words[words.length - 1] || "?";
    const letter = Array.from(last)[0].toUpperCase();
    let hash = 0;
    for (const ch of name) hash = (hash * 31 + ch.codePointAt(0)) >>> 0;
    return { letter, color: AVATAR_COLORS[hash % AVATAR_COLORS.length] };
}

function formatTime(ts) {
    const date = ts && ts.toDate ? ts.toDate() : new Date();
    return date.toLocaleString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
}

function buildItem(data) {
    const name = data.name || "Ẩn danh";
    const { letter, color } = avatarInfo(name);

    const avatar = document.createElement("div");
    avatar.className = "wall-avatar";
    avatar.textContent = letter;
    avatar.style.background = color;

    const nameEl = document.createElement("div");
    nameEl.className = "wall-name";
    nameEl.textContent = name;

    const timeEl = document.createElement("div");
    timeEl.className = "wall-time";
    timeEl.textContent = formatTime(data.createdAt);

    const meta = document.createElement("div");
    meta.className = "wall-meta";
    meta.append(nameEl, timeEl);

    const head = document.createElement("div");
    head.className = "wall-head";
    head.append(avatar, meta);

    const msg = document.createElement("p");
    msg.className = "wall-msg";
    msg.textContent = data.message || "";

    const el = document.createElement("article");
    el.className = "wall-item";
    el.append(head, msg);
    return el;
}

// Thả 1 thẻ mới ở vị trí ngang ngẫu nhiên nếu chỗ đó còn trống
function trySpawn() {
    const el = waiting[0];
    el.style.display = "block";
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const maxX = Math.max(0, wall.clientWidth - w);

    for (let i = 0; i < 15; i++) {
        const x = rand(0, maxX);
        const free = falling.every(
            (f) => x + w + GAP <= f.x || f.x + f.w + GAP <= x || f.y >= GAP
        );
        if (free) {
            waiting.shift();
            falling.push({ el, x, y: -h, w, h });
            el.style.transform = `translate(${x}px, ${-h}px)`;
            return true;
        }
    }
    el.style.display = "none";
    return false;
}

function tick(ts) {
    const dt = Math.min((ts - lastTs) / 1000, 0.1);
    lastTs = ts;

    if (!paused) {
        for (let i = falling.length - 1; i >= 0; i--) {
            const f = falling[i];
            f.y += SPEED * dt;
            f.el.style.transform = `translate(${f.x}px, ${f.y}px)`;
            if (f.y > wall.clientHeight) {
                f.el.style.display = "none";
                falling.splice(i, 1);
                waiting.push(f.el); // rơi xong thì quay lại hàng chờ
            }
        }

        spawnIn -= dt;
        if (spawnIn <= 0 && waiting.length && trySpawn()) {
            spawnIn = rand(0.6, 1.6);
        }
    }
    requestAnimationFrame(tick);
}

function addWallItem(id, data, isNew) {
    const el = buildItem(data);
    wall.appendChild(el);
    wallItems.set(id, el);
    if (reduceMotion) return;
    el.style.display = "none";
    if (isNew) waiting.unshift(el); // lời nhắn mới được thả trước
    else waiting.push(el);
}

function removeWallItem(id) {
    const el = wallItems.get(id);
    if (!el) return;
    const w = waiting.indexOf(el);
    if (w > -1) waiting.splice(w, 1);
    const f = falling.findIndex((item) => item.el === el);
    if (f > -1) falling.splice(f, 1);
    el.remove();
    wallItems.delete(id);
}

// Rê chuột hoặc chạm vào để dừng lại đọc
wall.addEventListener("mouseenter", () => (paused = true));
wall.addEventListener("mouseleave", () => (paused = false));
wall.addEventListener("touchstart", () => (paused = true), { passive: true });
wall.addEventListener("touchend", () => (paused = false));

if (!reduceMotion) requestAnimationFrame(tick);

let wallFirstLoad = true;

if (db) {
    const q = query(
        collection(db, "guest_messages"),
        orderBy("createdAt", "desc"),
        limit(40)
    );

    onSnapshot(
        q,
        (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    addWallItem(change.doc.id, change.doc.data(), !wallFirstLoad);
                }
                if (change.type === "removed") removeWallItem(change.doc.id);
            });
            wallFirstLoad = false;
            wallEmpty.hidden = wallItems.size > 0;
        },
        (error) => {
            console.error(error);
            wallEmpty.textContent =
                "Không tải được lời nhắn. Hãy kiểm tra quy tắc đọc trong Firestore.";
            wallEmpty.hidden = false;
        }
    );
} else {
    wallEmpty.textContent = "Chưa cấu hình Firebase nên chưa có lời nhắn nào.";
}