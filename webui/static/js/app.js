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
        
        document.getElementById('confDomain').innerText = data.domain;
        document.getElementById('confPort').innerText = data.port;
        document.getElementById('confPassword').innerText = data.password;
        document.getElementById('confObfs').innerText = data.obfs_enabled ? `Enabled (Pass: ${data.obfs_password})` : "Disabled";

        // Generate Links
        generateLinks(data.domain, data.port, data.password, data.obfs_enabled, data.obfs_password);

        // Pre-fill Modal
        document.getElementById('editPort').value = data.port;
        document.getElementById('editPassword').value = data.password;
        document.getElementById('editObfsEnabled').checked = data.obfs_enabled;
        document.getElementById('editObfsPassword').value = data.obfs_password;
        toggleObfsPassword();

    } catch (e) {
        console.error(e);
    }
}

function generateLinks(domain, port, password, obfs, obfsPass) {
    const randomId = Math.floor(Math.random() * 9000) + 1000;
    
    // NekoBox
    let nekoUrl = `hysteria2://${password}@${domain}:${port}/?insecure=0&sni=${domain}`;
    if (obfs && obfsPass) {
        nekoUrl += `&obfs=salamander&obfs-password=${obfsPass}`;
    }
    nekoUrl += `#Hysteria2-${randomId}`;
    document.getElementById('nekoboxUrl').value = nekoUrl;

    // v2rayN
    let v2Config = `server: ${domain}:${port}\nauth: ${password}\n`;
    if (obfs && obfsPass) {
        v2Config += `obfs:\n  type: salamander\n  salamander:\n    password: ${obfsPass}\n`;
    }
    v2Config += `tls:\n  sni: ${domain}\n  insecure: false\nfastOpen: true\nsocks5:\n  listen: 127.0.0.1:10808\nhttp:\n  listen: 127.0.0.1:10809`;
    document.getElementById('v2rayNConfig').value = v2Config;
}

function copyToClipboard(elementId) {
    const el = document.getElementById(elementId);
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.select();
        el.setSelectionRange(0, 99999);
        navigator.clipboard.writeText(el.value);
        showToast("Copied to clipboard!");
    }
}

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
    const password = document.getElementById('editPassword').value;
    const obfs_enabled = document.getElementById('editObfsEnabled').checked;
    const obfs_password = document.getElementById('editObfsPassword').value;

    const payload = {
        port: parseInt(port),
        password: password,
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
            showToast("Config saved and service restarted!");
            closeConfigModal();
            checkStatus(); // Reload config
        } else {
            alert("Error: " + data.detail);
        }
    } catch (err) {
        alert("Failed to save config.");
    }
}

async function updateHysteria() {
    if (!confirm("Are you sure you want to update Hysteria? This will restart the service.")) return;
    
    const btn = document.getElementById('updateBtn');
    const oldHtml = btn.innerHTML;
    btn.innerHTML = `<span><i data-lucide="loader" class="lucide-icon icon-16 lucide-spin"></i></span><span>Updating...</span>`;
    lucide.createIcons();
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
        lucide.createIcons();
        btn.disabled = false;
        checkStatus();
    }
}
