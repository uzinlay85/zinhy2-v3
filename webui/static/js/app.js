let currentServerConfig = {};

document.addEventListener('DOMContentLoaded', () => {
    checkStatus();
});

function showToast(msg) {
    const toast = document.getElementById('toast');
    document.getElementById('toastMsg').innerText = msg;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

async function checkStatus() {
    try {
        const res = await fetch('/api/status');
        const data = await res.json();
        
        document.getElementById('sysStatus').innerText = data.installed ? "Installed" : "Not Installed";
        document.getElementById('svcStatus').innerText = data.status;
        
        if (data.status === "Running") {
            document.getElementById('svcStatus').style.color = "var(--success)";
        } else {
            document.getElementById('svcStatus').style.color = "var(--danger)";
        }

        if (data.installed) {
            document.getElementById('configSection').style.display = 'block';
            document.getElementById('installPrompt').style.display = 'none';
            loadConfig();
        } else {
            document.getElementById('configSection').style.display = 'none';
            document.getElementById('installPrompt').style.display = 'block';
        }
    } catch (e) {
        console.error("Failed to check status", e);
    }
}

async function loadConfig() {
    try {
        const res = await fetch('/api/config');
        if (!res.ok) throw new Error("Failed to load config");
        const data = await res.json();
        currentServerConfig = data;
        
        document.getElementById('confDomain').innerText = data.domain;
        document.getElementById('confPort').innerText = data.port;
        document.getElementById('confObfs').innerText = data.obfs_enabled ? `Enabled (Pass: ${data.obfs_password})` : "Disabled";
        document.getElementById('userCount').innerText = data.users ? data.users.length : 0;

        // Pre-fill Server Config Modal
        document.getElementById('editPort').value = data.port;
        document.getElementById('editObfsEnabled').checked = data.obfs_enabled;
        document.getElementById('editObfsPassword').value = data.obfs_password;
        toggleObfsPassword();

        // Render Users Grid
        renderUsersGrid(data.users || []);

    } catch (e) {
        console.error(e);
    }
}

function renderUsersGrid(users) {
    const grid = document.getElementById('usersGrid');
    grid.innerHTML = '';

    if (users.length === 0) {
        grid.innerHTML = '<p style="color: var(--text-muted); text-align: center; grid-column: 1/-1;">No users configured yet.</p>';
        return;
    }

    const { domain, port, obfs_enabled, obfs_password } = currentServerConfig;

    users.forEach(user => {
        const authString = `${user.username}:${user.password}`;
        const randomId = Math.floor(Math.random() * 9000) + 1000;
        
        // Generate NekoBox Link
        let nekoUrl = `hysteria2://${authString}@${domain}:${port}/?insecure=0&sni=${domain}`;
        if (obfs_enabled && obfs_password) {
            nekoUrl += `&obfs=salamander&obfs-password=${obfs_password}`;
        }
        nekoUrl += `#${user.username}-Hysteria2-${randomId}`;

        // Generate v2rayN Config
        let v2Config = `server: ${domain}:${port}\nauth: ${authString}\n`;
        if (obfs_enabled && obfs_password) {
            v2Config += `obfs:\n  type: salamander\n  salamander:\n    password: ${obfs_password}\n`;
        }
        v2Config += `tls:\n  sni: ${domain}\n  insecure: false\nfastOpen: true\nsocks5:\n  listen: 127.0.0.1:10808\nhttp:\n  listen: 127.0.0.1:10809`;

        const card = document.createElement('div');
        card.className = 'user-card';
        const initial = user.username.charAt(0).toUpperCase();

        card.innerHTML = `
            <div class="user-card-header">
                <div class="user-badge">
                    <div class="user-avatar">${initial}</div>
                    <div class="user-name">${escapeHtml(user.username)}</div>
                </div>
                <div class="user-actions">
                    <button class="btn btn-ghost btn-icon btn-sm" onclick="openEditUserModal('${escapeHtml(user.username)}', '${escapeHtml(user.password)}')" title="Edit Password">
                        <i data-lucide="edit-3" class="lucide-icon icon-16"></i>
                    </button>
                    <button class="btn btn-danger btn-icon btn-sm" onclick="deleteUser('${escapeHtml(user.username)}')" title="Delete User">
                        <i data-lucide="trash-2" class="lucide-icon icon-16"></i>
                    </button>
                </div>
            </div>
            <div class="user-card-body">
                <div class="user-field">
                    <label>Password</label>
                    <div class="password-display">
                        <div class="password-text" id="pwd-${escapeHtml(user.username)}">••••••••••••</div>
                        <button class="btn btn-ghost btn-icon btn-sm" onclick="togglePasswordVisibility('${escapeHtml(user.username)}', '${escapeHtml(user.password)}')">
                            <i data-lucide="eye" id="eye-${escapeHtml(user.username)}" class="lucide-icon icon-16"></i>
                        </button>
                    </div>
                </div>
            </div>
            <div class="user-card-footer">
                <button class="btn btn-primary btn-sm" style="flex:1;" onclick="copyTextToClipboard('${escapeJsString(nekoUrl)}')">
                    <i data-lucide="copy" class="lucide-icon icon-14"></i> NekoBox Link
                </button>
                <button class="btn btn-ghost btn-sm" style="flex:1;" onclick="openV2rayModal('${escapeHtml(user.username)}', '${escapeJsString(v2Config)}')">
                    <i data-lucide="file-text" class="lucide-icon icon-14"></i> v2rayN Config
                </button>
            </div>
        `;
        grid.appendChild(card);
    });

    if (window.lucide) {
        lucide.createIcons();
    }
}

function togglePasswordVisibility(username, password) {
    const el = document.getElementById(`pwd-${username}`);
    const eye = document.getElementById(`eye-${username}`);
    if (!el) return;
    
    if (el.innerText === '••••••••••••') {
        el.innerText = password;
        if (eye) eye.setAttribute('data-lucide', 'eye-off');
    } else {
        el.innerText = '••••••••••••';
        if (eye) eye.setAttribute('data-lucide', 'eye');
    }
    if (window.lucide) lucide.createIcons();
}

function copyTextToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast("Copied to clipboard!");
    }).catch(err => {
        alert("Copy failed: " + err);
    });
}

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function escapeJsString(str) {
    return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
}

// Add User Modal
function openAddUserModal() {
    document.getElementById('addUsername').value = '';
    generateRandomAddPassword();
    document.getElementById('addUserModal').classList.add('active');
}

function closeAddUserModal() {
    document.getElementById('addUserModal').classList.remove('active');
}

function generateRandomAddPassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let res = '';
    for (let i = 0; i < 16; i++) {
        res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    document.getElementById('addPassword').value = res;
}

async function saveAddUser(e) {
    e.preventDefault();
    const username = document.getElementById('addUsername').value.trim();
    const password = document.getElementById('addPassword').value.trim();

    try {
        const res = await fetch('/api/users', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (data.success) {
            showToast(`User '${username}' created!`);
            closeAddUserModal();
            loadConfig();
        } else {
            alert("Error: " + (data.detail || "Failed to create user"));
        }
    } catch (err) {
        alert("Failed to create user.");
    }
}

// Edit User Modal
function openEditUserModal(username, currentPassword) {
    document.getElementById('editTargetUsername').value = username;
    document.getElementById('editDisplayUsername').value = username;
    document.getElementById('editUserPassword').value = currentPassword;
    document.getElementById('editUserModal').classList.add('active');
}

function closeEditUserModal() {
    document.getElementById('editUserModal').classList.remove('active');
}

function generateRandomEditPassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let res = '';
    for (let i = 0; i < 16; i++) {
        res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    document.getElementById('editUserPassword').value = res;
}

async function saveEditUser(e) {
    e.preventDefault();
    const username = document.getElementById('editTargetUsername').value;
    const password = document.getElementById('editUserPassword').value.trim();

    try {
        const res = await fetch(`/api/users/${encodeURIComponent(username)}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ password })
        });
        const data = await res.json();
        if (data.success) {
            showToast(`User '${username}' password updated!`);
            closeEditUserModal();
            loadConfig();
        } else {
            alert("Error: " + (data.detail || "Failed to update user"));
        }
    } catch (err) {
        alert("Failed to update user.");
    }
}

// Delete User
async function deleteUser(username) {
    if (!confirm(`Are you sure you want to delete user '${username}'?`)) return;

    try {
        const res = await fetch(`/api/users/${encodeURIComponent(username)}`, {
            method: 'DELETE'
        });
        const data = await res.json();
        if (data.success) {
            showToast(`User '${username}' deleted!`);
            loadConfig();
        } else {
            alert("Error: " + (data.detail || "Failed to delete user"));
        }
    } catch (err) {
        alert("Failed to delete user.");
    }
}

// v2rayN Modal
function openV2rayModal(username, configText) {
    document.getElementById('v2rayUsernameDisplay').innerText = username;
    document.getElementById('v2rayTextarea').value = configText;
    document.getElementById('v2rayModal').classList.add('active');
}

function closeV2rayModal() {
    document.getElementById('v2rayModal').classList.remove('active');
}

function copyV2rayConfigFromModal() {
    const text = document.getElementById('v2rayTextarea').value;
    copyTextToClipboard(text);
    closeV2rayModal();
}

// Server Config Modal
function openConfigModal() {
    document.getElementById('configModal').classList.add('active');
}

function closeConfigModal() {
    document.getElementById('configModal').classList.remove('active');
}

function toggleObfsPassword() {
    const checked = document.getElementById('editObfsEnabled').checked;
    document.getElementById('obfsPasswordGroup').style.display = checked ? 'block' : 'none';
}

async function saveConfig(e) {
    e.preventDefault();
    const port = document.getElementById('editPort').value;
    const obfs_enabled = document.getElementById('editObfsEnabled').checked;
    const obfs_password = document.getElementById('editObfsPassword').value;

    const payload = {
        port: parseInt(port),
        obfs_enabled: obfs_enabled,
        obfs_password: obfs_password
    };

    try {
        const res = await fetch('/api/modify', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            showToast("Settings saved and service restarted!");
            closeConfigModal();
            checkStatus();
        } else {
            alert("Error: " + (data.detail || "Failed to save settings"));
        }
    } catch (err) {
        alert("Failed to save settings.");
    }
}

async function updateHysteria() {
    if (!confirm("Are you sure you want to update Hysteria? This will restart the service.")) return;
    
    const btn = document.getElementById('updateBtn');
    const oldHtml = btn.innerHTML;
    btn.innerHTML = `<span><i data-lucide="loader" class="lucide-icon icon-16 lucide-spin"></i></span><span>Updating...</span>`;
    if (window.lucide) lucide.createIcons();
    btn.disabled = true;

    try {
        const res = await fetch('/api/update', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            showToast("Hysteria Core Updated!");
        } else {
            alert("Update failed!");
        }
    } catch (e) {
        alert("Request failed.");
    } finally {
        btn.innerHTML = oldHtml;
        if (window.lucide) lucide.createIcons();
        btn.disabled = false;
        checkStatus();
    }
}
