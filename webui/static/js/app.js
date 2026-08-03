let currentServerConfig = {};
let userLinksMap = {};
let activeLogTab = 'hysteria';

document.addEventListener('DOMContentLoaded', () => {
    checkStatus();
    fetchSystemResources();
    fetchLogs(activeLogTab);
    
    // Auto-refresh stats and config every 3s for realtime data usage & online status
    setInterval(() => {
        if (document.getElementById('configSection').style.display !== 'none') {
            fetchSystemResources();
            loadConfig();
        }
    }, 3000);
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

async function fetchSystemResources() {
    try {
        const res = await fetch('/api/system/resources');
        if (!res.ok) return;
        const data = await res.json();
        
        if (data.ram) {
            document.getElementById('ramUsage').innerText = `${data.ram.percent}% (${data.ram.used_mb}MB / ${data.ram.total_mb}MB)`;
        }
        if (data.disk) {
            document.getElementById('diskUsage').innerText = `${data.disk.used} / ${data.disk.total} (${data.disk.percent})`;
        }
        if (data.uptime) {
            document.getElementById('serverUptime').innerText = data.uptime;
        }
    } catch (e) {
        console.error("Failed to fetch system resources", e);
    }
}

async function fetchLogs(service) {
    const container = document.getElementById('logsContainer');
    if (!container) return;
    
    try {
        const res = await fetch(`/api/logs/${service}?lines=60`);
        if (!res.ok) throw new Error("Failed to fetch logs");
        const data = await res.json();
        container.innerText = data.logs || "No logs available.";
        container.scrollTop = container.scrollHeight;
    } catch (e) {
        container.innerText = "Error fetching logs: " + e.message;
    }
}

function switchLogTab(service) {
    activeLogTab = service;
    const tabHysteria = document.getElementById('tabHysteriaLogs');
    const tabWebui = document.getElementById('tabWebuiLogs');
    
    if (service === 'hysteria') {
        tabHysteria.className = 'btn btn-primary btn-sm';
        tabWebui.className = 'btn btn-ghost btn-sm';
    } else {
        tabHysteria.className = 'btn btn-ghost btn-sm';
        tabWebui.className = 'btn btn-primary btn-sm';
    }
    
    fetchLogs(service);
}

function refreshCurrentLogs() {
    fetchLogs(activeLogTab);
    showToast("Logs refreshed!");
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
        
        const totalUsers = data.users ? data.users.length : 0;
        const onlineCount = data.online_count || 0;
        document.getElementById('userCount').innerText = `${totalUsers} (${onlineCount} Online)`;

        if (document.getElementById('totalDataUsage')) {
            document.getElementById('totalDataUsage').innerText = data.total_data_formatted || "0.0 KB";
        }

        // Pre-fill Server Config Modal only if not actively being edited
        if (!document.getElementById('configModal').classList.contains('active')) {
            document.getElementById('editPort').value = data.port;
            document.getElementById('editObfsEnabled').checked = data.obfs_enabled;
            document.getElementById('editObfsPassword').value = data.obfs_password;
            toggleObfsPassword();
        }

        // Render Users Grid
        renderUsersGrid(data.users || []);

    } catch (e) {
        console.error(e);
    }
}

function renderUsersGrid(users) {
    userLinksMap = {};
    const grid = document.getElementById('usersGrid');
    
    // Preserve existing password toggle state before re-render
    const existingPwdStates = {};
    users.forEach(u => {
        const pwdEl = document.getElementById(`pwd-${u.username}`);
        if (pwdEl && pwdEl.innerText !== '••••••••••••') {
            existingPwdStates[u.username] = true;
        }
    });

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

        userLinksMap[user.username] = {
            nekoUrl: nekoUrl,
            v2Config: v2Config
        };

        const card = document.createElement('div');
        card.className = `user-card ${user.is_online ? 'online-card' : ''}`;
        const initial = user.username.charAt(0).toUpperCase();
        const safeUser = escapeHtml(user.username);

        // Status Dot & Label
        let dotClass = "active";
        if (user.is_online) dotClass = "online";
        else if (user.status_label === "Expired") dotClass = "expired";
        else if (user.status_label === "Disabled" || user.status_label === "Data Exceeded") dotClass = "disabled";

        const percent = Math.min(user.usage_percent || 0, 100);
        
        const statusBadgeHtml = user.is_online ? 
            `<div class="badge-online"><i data-lucide="wifi" class="lucide-icon icon-12"></i> Online Now</div>` :
            `<div class="user-status-text">${user.status_label} • ${user.last_seen_str}</div>`;

        const isPwdRevealed = existingPwdStates[user.username];
        const pwdDisplayStr = isPwdRevealed ? escapeHtml(user.password) : '••••••••••••';
        const eyeIcon = isPwdRevealed ? 'eye-off' : 'eye';

        card.innerHTML = `
            <div class="user-card-header">
                <div class="user-badge">
                    <div class="user-avatar-wrapper">
                        <div class="user-avatar">${initial}</div>
                        <div class="status-dot ${dotClass}" title="${user.status_label}"></div>
                    </div>
                    <div class="user-name-group">
                        <div class="user-name">${safeUser}</div>
                        ${statusBadgeHtml}
                    </div>
                </div>
                <div class="user-actions">
                    <button class="btn btn-ghost btn-icon btn-sm" onclick="resetUserData('${safeUser}')" title="Reset Traffic Usage">
                        <i data-lucide="rotate-ccw" class="lucide-icon icon-16"></i>
                    </button>
                    <button class="btn btn-ghost btn-icon btn-sm" onclick="openEditUserModal('${safeUser}', '${escapeHtml(user.password)}', ${user.data_limit_gb}, '${user.expire_date || ''}', ${user.is_active})" title="Edit User Settings">
                        <i data-lucide="edit-3" class="lucide-icon icon-16"></i>
                    </button>
                    <button class="btn btn-danger btn-icon btn-sm" onclick="deleteUser('${safeUser}')" title="Delete User">
                        <i data-lucide="trash-2" class="lucide-icon icon-16"></i>
                    </button>
                </div>
            </div>
            <div class="user-card-body">
                <div class="user-field">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <label>Data Usage</label>
                        <span style="font-size:12px; font-weight:600;">${user.data_used_formatted} / ${user.data_limit_formatted}</span>
                    </div>
                    <div class="progress-bar-bg">
                        <div class="progress-bar-fill ${percent >= 100 ? 'exceeded' : ''}" style="width: ${percent}%;"></div>
                    </div>
                </div>
                
                <div class="user-stats-row">
                    <div class="stat-pill"><i data-lucide="calendar" class="lucide-icon icon-14"></i> ${user.days_left}</div>
                    <div class="stat-pill"><i data-lucide="clock" class="lucide-icon icon-14"></i> ${user.last_seen_str}</div>
                </div>

                <div class="user-field">
                    <label>Password</label>
                    <div class="password-display">
                        <div class="password-text" id="pwd-${safeUser}">${pwdDisplayStr}</div>
                        <button class="btn btn-ghost btn-icon btn-sm" onclick="togglePasswordVisibility('${safeUser}', '${escapeHtml(user.password)}')">
                            <i data-lucide="${eyeIcon}" id="eye-${safeUser}" class="lucide-icon icon-16"></i>
                        </button>
                    </div>
                </div>
            </div>
            <div class="user-card-footer">
                <button class="btn btn-primary btn-sm" style="flex:1;" onclick="copyNekoLink('${safeUser}')">
                    <i data-lucide="copy" class="lucide-icon icon-14"></i> NekoBox Link
                </button>
                <button class="btn btn-ghost btn-sm" style="flex:1;" onclick="openV2rayModal('${safeUser}')">
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

function copyNekoLink(username) {
    if (userLinksMap[username] && userLinksMap[username].nekoUrl) {
        copyTextToClipboard(userLinksMap[username].nekoUrl);
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
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
            showToast("Copied to clipboard!");
        }).catch(() => {
            fallbackCopyTextToClipboard(text);
        });
    } else {
        fallbackCopyTextToClipboard(text);
    }
}

function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showToast("Copied to clipboard!");
        } else {
            prompt("Copy to clipboard manually (Ctrl+C, Enter):", text);
        }
    } catch (err) {
        prompt("Copy to clipboard manually (Ctrl+C, Enter):", text);
    }
    document.body.removeChild(textArea);
}

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// Add User Modal Date Presets
function setAddDatePreset(days) {
    const dateInput = document.getElementById('addExpireDate');
    if (days === 0) {
        dateInput.value = '';
        return;
    }
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days);
    dateInput.value = targetDate.toISOString().split('T')[0];
}

function setEditDatePreset(days) {
    const dateInput = document.getElementById('editExpireDate');
    if (days === 0) {
        dateInput.value = '';
        return;
    }
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days);
    dateInput.value = targetDate.toISOString().split('T')[0];
}

// Add User Modal
function openAddUserModal() {
    document.getElementById('addUsername').value = '';
    document.getElementById('addDataLimit').value = '0';
    document.getElementById('addExpireDate').value = '';
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
    const data_limit_gb = parseFloat(document.getElementById('addDataLimit').value) || 0;
    const expire_date = document.getElementById('addExpireDate').value;

    try {
        const res = await fetch('/api/users', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ username, password, data_limit_gb, expire_date })
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
function openEditUserModal(username, currentPassword, dataLimitGb, expireDate, isActive) {
    document.getElementById('editTargetUsername').value = username;
    document.getElementById('editDisplayUsername').value = username;
    document.getElementById('editUserPassword').value = currentPassword;
    document.getElementById('editDataLimit').value = dataLimitGb || 0;
    document.getElementById('editExpireDate').value = expireDate || '';
    document.getElementById('editIsActive').checked = isActive !== false;
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
    const data_limit_gb = parseFloat(document.getElementById('editDataLimit').value) || 0;
    const expire_date = document.getElementById('editExpireDate').value;
    const is_active = document.getElementById('editIsActive').checked;

    try {
        const res = await fetch(`/api/users/${encodeURIComponent(username)}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ password, data_limit_gb, expire_date, is_active })
        });
        const data = await res.json();
        if (data.success) {
            showToast(`User '${username}' updated!`);
            closeEditUserModal();
            loadConfig();
        } else {
            alert("Error: " + (data.detail || "Failed to update user"));
        }
    } catch (err) {
        alert("Failed to update user.");
    }
}

// Reset Data Usage
async function resetUserData(username) {
    if (!confirm(`Are you sure you want to reset traffic usage for '${username}'?`)) return;

    try {
        const res = await fetch(`/api/users/${encodeURIComponent(username)}/reset_data`, {
            method: 'POST'
        });
        const data = await res.json();
        if (data.success) {
            showToast(`Traffic reset for '${username}'!`);
            loadConfig();
        } else {
            alert("Error: " + (data.detail || "Failed to reset traffic"));
        }
    } catch (err) {
        alert("Failed to reset traffic.");
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
function openV2rayModal(username) {
    if (userLinksMap[username] && userLinksMap[username].v2Config) {
        document.getElementById('v2rayUsernameDisplay').innerText = username;
        document.getElementById('v2rayTextarea').value = userLinksMap[username].v2Config;
        document.getElementById('v2rayModal').classList.add('active');
    }
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
