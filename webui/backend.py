import os
import subprocess
import yaml
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional

app = FastAPI(title="Hysteria2 Installer Web UI")

CONFIG_PATH = "/etc/hysteria/config.yaml"
if os.name == 'nt':  # Windows fallback for testing
    CONFIG_PATH = "test_config.yaml"

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

class UserUpdate(BaseModel):
    password: str

def read_config():
    if not os.path.exists(CONFIG_PATH):
        return None
    with open(CONFIG_PATH, "r") as f:
        return yaml.safe_load(f)

def write_config(data):
    with open(CONFIG_PATH, "w") as f:
        yaml.dump(data, f, default_flow_style=False, sort_keys=False)

def restart_service():
    if os.name != 'nt':
        subprocess.run(["systemctl", "restart", "hysteria-server"])

def get_normalized_config():
    data = read_config()
    if not data:
        return None
        
    auth = data.get("auth", {})
    auth_type = auth.get("type", "password")
    
    # Auto-migrate single password auth to userpass auth
    if auth_type == "password":
        pwd = auth.get("password", "secret123")
        data["auth"] = {
            "type": "userpass",
            "userpass": {
                "user1": pwd
            }
        }
        write_config(data)
    elif auth_type == "userpass":
        if "userpass" not in data["auth"] or not isinstance(data["auth"]["userpass"], dict):
            data["auth"]["userpass"] = {}
            write_config(data)
            
    return data

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
    data = get_normalized_config()
    if not data:
        raise HTTPException(status_code=404, detail="Config not found. Is Hysteria installed?")
        
    port = int(str(data.get("listen", ":443")).replace(":", ""))
    cert = data.get("tls", {}).get("cert", "")
    domain = cert.split("/")[-2] if "/live/" in cert else "example.com"
    
    obfs_enabled = "obfs" in data
    obfs_password = data.get("obfs", {}).get("salamander", {}).get("password", "") if obfs_enabled else ""
    
    userpass = data.get("auth", {}).get("userpass", {})
    users = [{"username": k, "password": v} for k, v in userpass.items()]
    
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
    data = get_normalized_config()
    if not data:
        raise HTTPException(status_code=404, detail="Config not found.")
        
    username = user.username.strip()
    password = user.password.strip()
    
    if not username or not password:
        raise HTTPException(status_code=400, detail="Username and password are required.")
        
    userpass = data.get("auth", {}).get("userpass", {})
    if username in userpass:
        raise HTTPException(status_code=400, detail=f"User '{username}' already exists.")
        
    userpass[username] = password
    data["auth"]["userpass"] = userpass
    write_config(data)
    restart_service()
    
    return {"success": True, "message": f"User '{username}' added successfully."}

@app.put("/api/users/{username}")
def update_user(username: str, user_update: UserUpdate):
    data = get_normalized_config()
    if not data:
        raise HTTPException(status_code=404, detail="Config not found.")
        
    userpass = data.get("auth", {}).get("userpass", {})
    if username not in userpass:
        raise HTTPException(status_code=404, detail=f"User '{username}' not found.")
        
    password = user_update.password.strip()
    if not password:
        raise HTTPException(status_code=400, detail="Password cannot be empty.")
        
    userpass[username] = password
    data["auth"]["userpass"] = userpass
    write_config(data)
    restart_service()
    
    return {"success": True, "message": f"User '{username}' updated successfully."}

@app.delete("/api/users/{username}")
def delete_user(username: str):
    data = get_normalized_config()
    if not data:
        raise HTTPException(status_code=404, detail="Config not found.")
        
    userpass = data.get("auth", {}).get("userpass", {})
    if username not in userpass:
        raise HTTPException(status_code=404, detail=f"User '{username}' not found.")
        
    if len(userpass) <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete the last remaining user.")
        
    del userpass[username]
    data["auth"]["userpass"] = userpass
    write_config(data)
    restart_service()
    
    return {"success": True, "message": f"User '{username}' deleted successfully."}

@app.post("/api/modify")
def modify_config(config_update: ModifyConfig):
    data = get_normalized_config()
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
            
    write_config(data)
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
