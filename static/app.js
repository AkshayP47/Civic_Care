// app.js - fixed version
let currentUser = null;
let currentView = "main";

const feed = document.getElementById("feed");
const profileCard = document.getElementById("profileCard");
const issueText = document.getElementById("issueText");
const issueCategory = document.getElementById("issueCategory");
const visibility = document.getElementById("visibility");
const openFormBtn = document.getElementById("openFormBtn");
const modal = document.getElementById("modal");
const cancelBtn = document.getElementById("cancelBtn");
const reportForm = document.getElementById("reportForm");

const mainBtn = document.getElementById("mainBtn");
const myBtn = document.getElementById("myBtn");
const resolvedBtn = document.getElementById("resolvedBtn");
const profileBtn = document.getElementById("profileBtn");

// --- Login ---
const loginModal = document.getElementById("loginModal");
const usernameInput = document.getElementById("usernameInput");
const loginBtn = document.getElementById("loginBtn");

const API_ROOT = window.location.origin; // relative origin -> works across devices

loginBtn.addEventListener("click", () => {
    const username = usernameInput.value.trim();
    if (!username) return alert("Enter username");
    currentUser = username;
    document.getElementById("profileUser").textContent = currentUser;
    // hide login modal
    loginModal.style.display = "none";
    // show primary controls (if they are hidden by CSS)
    openFormBtn.classList.remove("hidden");
    switchView("main");
});

// --- Navigation ---
function switchView(view) {
    currentView = view;
    [mainBtn, myBtn, resolvedBtn, profileBtn].forEach((btn) =>
        btn.classList.remove("text-blue-600", "font-semibold")
    );
    if (view === "main")
        mainBtn.classList.add("text-blue-600", "font-semibold");
    if (view === "my") myBtn.classList.add("text-blue-600", "font-semibold");
    if (view === "resolved")
        resolvedBtn.classList.add("text-blue-600", "font-semibold");
    if (view === "profile")
        profileBtn.classList.add("text-blue-600", "font-semibold");
    loadIssues(view);
}

mainBtn.addEventListener("click", () => switchView("main"));
myBtn.addEventListener("click", () => switchView("my"));
resolvedBtn.addEventListener("click", () => switchView("resolved"));
profileBtn.addEventListener("click", () => switchView("profile"));

// --- Report Modal ---
openFormBtn.addEventListener("click", () => {
    if (!currentUser) return alert("Please login first");
    modal.classList.remove("hidden");
});
cancelBtn.addEventListener("click", () => modal.classList.add("hidden"));

// --- Submit report ---
reportForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentUser) return alert("Please login first");
    const text = issueText.value.trim();
    if (!text) return alert("Enter issue");
    try {
        const res = await fetch(`${API_ROOT}/issues`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                user: currentUser,
                text,
                category: issueCategory.value,
                visibility: visibility.value,
            }),
        });
        if (!res.ok) {
            const err = await res.text();
            throw new Error(err || `Server returned ${res.status}`);
        }
        issueText.value = "";
        modal.classList.add("hidden");
        await loadIssues(currentView); // refresh view so the new issue shows up
    } catch (err) {
        console.error("Submit error:", err);
        alert("Failed to submit issue. See console for details.");
    }
});

// --- Load Issues ---
async function loadIssues(view) {
    if (!currentUser) return;
    if (view === "profile") {
        profileCard.classList.remove("hidden");
        await updateProfileStats();
        return;
    } else {
        profileCard.classList.add("hidden");
    }

    try {
        const res = await fetch(
            `${API_ROOT}/issues?username=${encodeURIComponent(
                currentUser
            )}&view=${encodeURIComponent(view)}`
        );
        if (!res.ok) {
            const txt = await res.text();
            throw new Error(txt || `Server returned ${res.status}`);
        }
        const issues = await res.json();
        renderIssues(issues);
    } catch (err) {
        console.error("Load issues error:", err);
        feed.innerHTML =
            '<div class="text-center text-red-500">Failed to load issues. Check server.</div>';
    }
}

function renderIssues(issues) {
    feed.innerHTML = "";
    if (!Array.isArray(issues) || issues.length === 0) {
        feed.innerHTML =
            '<div class="text-center text-gray-500">No issues to show.</div>';
        return;
    }

    issues.forEach((it) => {
        const div = document.createElement("div");
        div.className =
            "bg-white shadow rounded-lg p-4 hover:shadow-md transition";

        // resolved badge or resolve button (if owner)
        const resolvedBadge =
            it.resolved === true
                ? `<span class="ml-2 text-sm text-green-700 font-semibold">Resolved</span>`
                : "";

        // resolve button only for item's owner and if not resolved
        const resolveButtonHTML =
            !it.resolved && it.user === currentUser
                ? `<button class="resolveBtn ml-auto px-3 py-1 rounded bg-green-200 hover:bg-green-300 text-sm">Resolve</button>`
                : it.resolved
                ? `<span class="ml-auto text-green-700 font-semibold text-sm">Resolved</span>`
                : "";

        div.innerHTML = `
      <div class="flex justify-between items-center">
        <div class="flex items-center">
          <img src="https://i.pravatar.cc/40?u=${encodeURIComponent(
              it.user
          )}" class="w-8 h-8 rounded-full mr-2"/>
          <span class="font-semibold">@${escapeHtml(it.user)}</span>
          ${resolvedBadge}
        </div>
        <span class="text-xs text-gray-500">${escapeHtml(it.time)}</span>
      </div>
      <p class="mt-2 text-gray-800">${escapeHtml(it.text)}</p>
      <div class="mt-3 flex items-center gap-3 text-sm">
        <span class="px-2 py-1 rounded bg-gray-100">#${escapeHtml(
            it.category
        )}</span>
        <span class="px-2 py-1 rounded ${
            it.visibility === "public"
                ? "bg-green-100 text-green-700"
                : "bg-yellow-100 text-yellow-700"
        }">${escapeHtml(it.visibility)}</span>
        ${resolveButtonHTML}
      </div>
    `;

        // attach resolve listener if present
        const resolveBtn = div.querySelector(".resolveBtn");
        if (resolveBtn) {
            resolveBtn.addEventListener("click", async () => {
                if (!confirm("Mark this issue as resolved?")) return;
                try {
                    const r = await fetch(
                        `${API_ROOT}/issues/${encodeURIComponent(
                            it.id
                        )}/resolve`,
                        {
                            method: "PUT", // server accepts PUT (and POST in fallback)
                            headers: { "Content-Type": "application/json" },
                        }
                    );
                    if (!r.ok) throw new Error(`Server ${r.status}`);
                    await loadIssues(currentView);
                } catch (err) {
                    console.error("Resolve error:", err);
                    alert("Failed to mark resolved. See console.");
                }
            });
        }

        feed.appendChild(div);
    });
}

// --- Profile Stats ---
async function updateProfileStats() {
    try {
        const res = await fetch(
            `${API_ROOT}/issues?username=${encodeURIComponent(
                currentUser
            )}&view=my`
        );
        if (!res.ok) throw new Error(`Server ${res.status}`);
        const myIssues = await res.json();
        document.getElementById("statTotal").textContent = myIssues.length;
        document.getElementById("statPublic").textContent = myIssues.filter(
            (i) => i.visibility === "public"
        ).length;
        document.getElementById("statPersonal").textContent = myIssues.filter(
            (i) => i.visibility === "personal"
        ).length;
    } catch (err) {
        console.error("Profile stats error:", err);
    }
}

// --- Utils ---
function escapeHtml(str) {
    if (typeof str !== "string") return str;
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
