import os
import time
import datetime
import asyncio
import sqlite3
import subprocess
import urllib.request
import json
import yaml
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional

app = FastAPI(title="Hysteria2 Installer Web UI")

CONFIG_PATH = "/etc/hysteria/config.yaml"
DB_PATH = "/opt/hysteria-webui/users_db.db"
if os.name == 'nt':  # Windows fallback for testing
    CONFIG_PATH = "test_config.yaml"
    DB_PATH = "test_users_db.db"

TRAFFIC_API_URL = "http://127.0.0.1:8080"

# Serve static files
os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

class ModifyConfig(BaseModel):
    port: int
    obfs_enabled: bool
    obfs_password: str = ""

class UserCreate(BaseModel):
    username: str
    password: str
    data_limit_gb: float = 0.0
    expire_date: str = ""  # YYYY-MM-DD format or empty

class UserUpdate(BaseModel):
    password: str
    data_limit_gb: float = 0.0
    expire_date: str = ""
    is_active: bool = True

def get_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            username TEXT PRIMARY KEY,
            password TEXT NOT NULL,
            data_limit_gb REAL DEFAULT 0,
            data_used_bytes INTEGER DEFAULT 0,
            expire_date TEXT DEFAULT '',
            is_active INTEGER DEFAULT 1,
            last_seen INTEGER DEFAULT 0
        )
    ''')
    conn.commit()
    conn.close()

init_db()

def read_yaml_config():
    if not os.path.exists(CONFIG_PATH):
        return None
    with open(CONFIG_PATH, "r") as f:
        return yaml.safe_load(f)

def write_yaml_config(data):
    with open(CONFIG_PATH, "w") as f:
        yaml.dump(data, f, default_flow_style=False, sort_keys=False)

def restart_service():
    if os.name != 'nt':
        subprocess.run(["systemctl", "restart", "hysteria-server"])

def sync_db_to_yaml():
    """Sync active users from DB to config.yaml (auth.userpass) and ensure trafficStats is enabled."""
    data = read_yaml_config()
    if not data:
        return
        
    config_changed = False
    
    # Ensure trafficStats is configured
    if "trafficStats" not in data or not isinstance(data.get("trafficStats"), dict):
        data["trafficStats"] = {"listen": "127.0.0.1:8080"}
        config_changed = True
        
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT username, password, data_limit_gb, data_used_bytes, expire_date, is_active FROM users")
    db_users = c.fetchall()
    
    active_userpass = {}
    today_str = datetime.date.today().isoformat()
    
    for u in db_users:
        username = u["username"]
        password = u["password"]
        data_limit_gb = u["data_limit_gb"]
        data_used_bytes = u["data_used_bytes"]
        expire_date = u["expire_date"]
        is_active = u["is_active"]
        
        # Check active state
        if is_active != 1:
            continue
            
        # Check data limit
        if data_limit_gb > 0:
            limit_bytes = int(data_limit_gb * 1024 * 1024 * 1024)
            if data_used_bytes >= limit_bytes:
                continue
                
        # Check expiration date
        if expire_date and expire_date < today_str:
            continue
            
        active_userpass[username] = password
        
    conn.close()
    
    new_auth = {
        "type": "userpass",
        "userpass": active_userpass
    }
    
    if data.get("auth") != new_auth:
        data["auth"] = new_auth
        config_changed = True
        
    if config_changed:
        write_yaml_config(data)
        restart_service()

def sync_yaml_to_db():
    """Initial import if YAML has users not yet in DB."""
    data = read_yaml_config()
    if not data:
        return
        
    auth = data.get("auth", {})
    auth_type = auth.get("type", "password")
    
    userpass = {}
    if auth_type == "password":
        pwd = auth.get("password", "secret123")
        userpass = {"user1": pwd}
    elif auth_type == "userpass":
        userpass = auth.get("userpass", {})
        
    conn = get_db()
    c = conn.cursor()
    
    for username, password in userpass.items():
        c.execute("SELECT username FROM users WHERE username=?", (username,))
        if not c.fetchone():
            c.execute("""
                INSERT INTO users (username, password, data_limit_gb, data_used_bytes, expire_date, is_active, last_seen)
                VALUES (?, ?, 0, 0, '', 1, 0)
            """, (username, password))
            
    conn.commit()
    conn.close()
    sync_db_to_yaml()

sync_yaml_to_db()

# --- Traffic & Online Background Poller ---
online_users_set = set()

async def traffic_poller():
    global online_users_set
    no_proxy_opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    
    while True:
        try:
            if os.name != 'nt':
                # 1. Fetch traffic stats and clear counter
                try:
                    req = urllib.request.Request(f"{TRAFFIC_API_URL}/traffic?clear=1")
                    with no_proxy_opener.open(req, timeout=3) as resp:
                        if resp.status == 200:
                            traffic_data = json.loads(resp.read().decode('utf-8'))
                            if isinstance(traffic_data, dict) and traffic_data:
                                conn = get_db()
                                c = conn.cursor()
                                for u, stats in traffic_data.items():
                                    total_bytes = 0
                                    if isinstance(stats, dict):
                                        total_bytes = stats.get("tx", 0) + stats.get("rx", 0)
                                    elif isinstance(stats, (int, float)):
                                        total_bytes = int(stats)
                                        
                                    if total_bytes > 0:
                                        c.execute("UPDATE users SET data_used_bytes = data_used_bytes + ? WHERE username = ?", (total_bytes, u))
                                conn.commit()
                                conn.close()
                except Exception as err:
                    pass

                # 2. Fetch online users & update last_seen
                try:
                    req = urllib.request.Request(f"{TRAFFIC_API_URL}/online")
                    with no_proxy_opener.open(req, timeout=3) as resp:
                        if resp.status == 200:
                            online_resp_data = json.loads(resp.read().decode('utf-8'))
                            current_online = set()
                            if isinstance(online_resp_data, dict):
                                current_online = set(online_resp_data.keys())
                            elif isinstance(online_resp_data, list):
                                current_online = set(online_resp_data)
                                
                            went_offline = online_users_set - current_online
                            now_ts = int(time.time())
                            if went_offline:
                                conn = get_db()
                                c = conn.cursor()
                                for u in went_offline:
                                    c.execute("UPDATE users SET last_seen = ? WHERE username = ?", (now_ts, u))
                                conn.commit()
                                conn.close()
                            online_users_set = current_online
                except Exception as err:
                    pass

                # 3. Check for exceeded limits & sync YAML if needed
                sync_db_to_yaml()

        except Exception as e:
            print("Traffic poller error:", e)

        await asyncio.sleep(5)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(traffic_poller())

# --- Helper Format Functions ---
def format_bytes(size):
    if size < 1024 * 1024:
        return f"{round(size / 1024, 1)} KB"
    elif size < 1024 * 1024 * 1024:
        return f"{round(size / (1024 * 1024), 2)} MB"
    else:
        return f"{round(size / (1024 * 1024 * 1024), 2)} GB"

def calculate_days_left(expire_date_str):
    if not expire_date_str:
        return "Unlimited"
    try:
        exp_date = datetime.date.fromisoformat(expire_date_str)
        today = datetime.date.today()
        delta = (exp_date - today).days
        if delta < 0:
            return "Expired"
        elif delta == 0:
            return "Expires Today"
        elif delta == 1:
            return "1 day left"
        else:
            return f"{delta} days left"
    except Exception:
        return "Unlimited"

def format_last_seen(username, last_seen_ts):
    if username in online_users_set:
        return "Online Now"
    if not last_seen_ts or last_seen_ts == 0:
        return "Never"
    diff = int(time.time()) - last_seen_ts
    if diff < 60:
        return "Just now"
    elif diff < 3600:
        return f"{diff // 60}m ago"
    elif diff < 86400:
        return f"{diff // 3600}h ago"
    else:
        return f"{diff // 86400}d ago"

@app.get("/api/status")
def get_status():
    installed = os.path.exists(CONFIG_PATH)
    status_text = "Stopped"
    
    if installed and os.name != 'nt':
        try:
            result = subprocess.run(["systemctl", "is-active", "hysteria-server"], capture_output=True, text=True)
            if result.stdout.strip() == "active":
                status_text = "Running"
        except Exception:
            pass
            
    return {"installed": installed, "status": status_text}

@app.get("/api/config")
def get_config():
    data = read_yaml_config()
    if not data:
        raise HTTPException(status_code=404, detail="Config not found. Is Hysteria installed?")
        
    port = int(str(data.get("listen", ":443")).replace(":", ""))
    cert = data.get("tls", {}).get("cert", "")
    domain = cert.split("/")[-2] if "/live/" in cert else "example.com"
    
    obfs_enabled = "obfs" in data
    obfs_password = data.get("obfs", {}).get("salamander", {}).get("password", "") if obfs_enabled else ""
    
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT username, password, data_limit_gb, data_used_bytes, expire_date, is_active, last_seen FROM users")
    rows = c.fetchall()
    conn.close()
    
    today_str = datetime.date.today().isoformat()
    users = []
    
    for r in rows:
        u_dict = dict(r)
        limit_gb = u_dict["data_limit_gb"]
        used_bytes = u_dict["data_used_bytes"]
        exp_date = u_dict["expire_date"]
        is_act = bool(u_dict["is_active"])
        username = u_dict["username"]
        
        # Calculate status
        is_online = username in online_users_set
        is_expired = bool(exp_date and exp_date < today_str)
        is_data_exceeded = bool(limit_gb > 0 and used_bytes >= limit_gb * 1024 * 1024 * 1024)
        
        status_label = "Active"
        if not is_act:
            status_label = "Disabled"
        elif is_expired:
            status_label = "Expired"
        elif is_data_exceeded:
            status_label = "Data Exceeded"
        elif is_online:
            status_label = "Online"

        users.append({
            "username": username,
            "password": u_dict["password"],
            "data_limit_gb": limit_gb,
            "data_used_bytes": used_bytes,
            "data_used_formatted": format_bytes(used_bytes),
            "data_limit_formatted": f"{limit_gb} GB" if limit_gb > 0 else "Unlimited",
            "usage_percent": round((used_bytes / (limit_gb * 1024 * 1024 * 1024)) * 100, 1) if limit_gb > 0 else 0,
            "expire_date": exp_date,
            "days_left": calculate_days_left(exp_date),
            "is_active": is_act,
            "is_online": is_online,
            "status_label": status_label,
            "last_seen_str": format_last_seen(username, u_dict["last_seen"])
        })
    
    return {
        "port": port,
        "domain": domain,
        "obfs_enabled": obfs_enabled,
        "obfs_password": obfs_password,
        "users": users
    }

@app.get("/api/logs/{service}")
def get_service_logs(service: str, lines: int = 50):
    if service not in ["hysteria", "webui"]:
        raise HTTPException(status_code=400, detail="Invalid service. Must be 'hysteria' or 'webui'")
    
    unit_name = "hysteria-server" if service == "hysteria" else "hysteria-webui"
    
    if os.name != 'nt':
        try:
            res = subprocess.run(
                ["journalctl", "-u", unit_name, "-n", str(lines), "--no-pager"],
                capture_output=True,
                text=True,
                timeout=5
            )
            logs = res.stdout if res.stdout else "No logs found or service has no output yet."
            return {"service": service, "logs": logs}
        except Exception as e:
            return {"service": service, "logs": f"Error fetching logs: {str(e)}"}
    else:
        return {"service": service, "logs": f"[Windows Simulation Environment]\nSample log stream for {unit_name}.\nService active and running normally."}

@app.get("/api/system/resources")
def get_system_resources():
    if os.name != 'nt':
        try:
            # Memory
            free_res = subprocess.run(["free", "-m"], capture_output=True, text=True)
            mem_used_mb, mem_total_mb = 0, 1
            for line in free_res.stdout.splitlines():
                if line.startswith("Mem:"):
                    parts = line.split()
                    mem_total_mb = int(parts[1])
                    mem_used_mb = int(parts[2])
                    break
            
            # Disk
            df_res = subprocess.run(["df", "-h", "/"], capture_output=True, text=True)
            disk_used, disk_total, disk_percent = "0G", "0G", "0%"
            lines = df_res.stdout.splitlines()
            if len(lines) >= 2:
                parts = lines[1].split()
                disk_total = parts[1]
                disk_used = parts[2]
                disk_percent = parts[4]

            # Uptime & Load
            uptime_res = subprocess.run(["uptime"], capture_output=True, text=True)
            uptime_str = uptime_res.stdout.strip()
            
            return {
                "ram": {
                    "used_mb": mem_used_mb,
                    "total_mb": mem_total_mb,
                    "percent": round((mem_used_mb / mem_total_mb) * 100, 1) if mem_total_mb > 0 else 0
                },
                "disk": {
                    "used": disk_used,
                    "total": disk_total,
                    "percent": disk_percent
                },
                "uptime": uptime_str
            }
        except Exception as e:
            return {"error": str(e)}
    else:
        return {
            "ram": {"used_mb": 512, "total_mb": 2048, "percent": 25.0},
            "disk": {"used": "4.5G", "total": "20G", "percent": "23%"},
            "uptime": "Windows dev environment"
        }

@app.post("/api/users")
def add_user(user: UserCreate):
    username = user.username.strip()
    password = user.password.strip()
    
    if not username or not password:
        raise HTTPException(status_code=400, detail="Username and password are required.")
        
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT username FROM users WHERE username=?", (username,))
    if c.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail=f"User '{username}' already exists.")
        
    c.execute("""
        INSERT INTO users (username, password, data_limit_gb, data_used_bytes, expire_date, is_active, last_seen)
        VALUES (?, ?, ?, 0, ?, 1, 0)
    """, (username, password, user.data_limit_gb, user.expire_date))
    conn.commit()
    conn.close()
    
    sync_db_to_yaml()
    restart_service()
    
    return {"success": True, "message": f"User '{username}' added successfully."}

@app.put("/api/users/{username}")
def update_user(username: str, user_update: UserUpdate):
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT username FROM users WHERE username=?", (username,))
    if not c.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail=f"User '{username}' not found.")
        
    password = user_update.password.strip()
    if not password:
        conn.close()
        raise HTTPException(status_code=400, detail="Password cannot be empty.")
        
    c.execute("""
        UPDATE users SET password=?, data_limit_gb=?, expire_date=?, is_active=?
        WHERE username=?
    """, (password, user_update.data_limit_gb, user_update.expire_date, 1 if user_update.is_active else 0, username))
    conn.commit()
    conn.close()
    
    sync_db_to_yaml()
    restart_service()
    
    return {"success": True, "message": f"User '{username}' updated successfully."}

@app.post("/api/users/{username}/reset_data")
def reset_user_data(username: str):
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT username FROM users WHERE username=?", (username,))
    if not c.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail=f"User '{username}' not found.")
        
    c.execute("UPDATE users SET data_used_bytes=0 WHERE username=?", (username,))
    conn.commit()
    conn.close()
    
    sync_db_to_yaml()
    restart_service()
    
    return {"success": True, "message": f"Data usage reset for '{username}'."}

@app.delete("/api/users/{username}")
def delete_user(username: str):
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT username FROM users WHERE username=?", (username,))
    if not c.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail=f"User '{username}' not found.")
        
    c.execute("SELECT COUNT(*) as cnt FROM users")
    cnt = c.fetchone()["cnt"]
    if cnt <= 1:
        conn.close()
        raise HTTPException(status_code=400, detail="Cannot delete the last remaining user.")
        
    c.execute("DELETE FROM users WHERE username=?", (username,))
    conn.commit()
    conn.close()
    
    sync_db_to_yaml()
    restart_service()
    
    return {"success": True, "message": f"User '{username}' deleted successfully."}

@app.post("/api/modify")
def modify_config(config_update: ModifyConfig):
    data = read_yaml_config()
    if not data:
        raise HTTPException(status_code=404, detail="Config not found.")
        
    data["listen"] = f":{config_update.port}"
    
    if config_update.obfs_enabled and config_update.obfs_password:
        data["obfs"] = {
            "type": "salamander",
            "salamander": {
                "password": config_update.obfs_password
            }
        }
    else:
        if "obfs" in data:
            del data["obfs"]
            
    write_yaml_config(data)
    sync_db_to_yaml()
    restart_service()
        
    return {"success": True, "message": "Configuration updated and service restarted."}

@app.post("/api/update")
def update_hysteria():
    if os.name != 'nt':
        try:
            subprocess.run("bash <(curl -fsSL https://get.hy2.sh/)", shell=True, check=True)
            restart_service()
            return {"success": True, "message": "Hysteria updated successfully!"}
        except subprocess.CalledProcessError as e:
            raise HTTPException(status_code=500, detail=f"Update failed: {str(e)}")
    return {"success": True, "message": "Update simulated on Windows."}

@app.get("/")
def serve_index():
    return FileResponse("static/index.html")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
