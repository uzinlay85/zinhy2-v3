import os
import subprocess
import yaml
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

app = FastAPI(title="Hysteria2 Installer Web UI")

# Path to the actual config on Linux is usually /etc/hysteria/config.yaml
# We will use a fallback for local testing if running on Windows
CONFIG_PATH = "/etc/hysteria/config.yaml"
if os.name == 'nt':  # Windows fallback for testing
    CONFIG_PATH = "test_config.yaml"

# Serve static files
os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

class ModifyConfig(BaseModel):
    port: int
    password: str
    obfs_enabled: bool
    obfs_password: str = ""

def read_config():
    if not os.path.exists(CONFIG_PATH):
        return None
    with open(CONFIG_PATH, "r") as f:
        return yaml.safe_load(f)

def write_config(data):
    with open(CONFIG_PATH, "w") as f:
        yaml.dump(data, f, default_flow_style=False, sort_keys=False)

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
    data = read_config()
    if not data:
        raise HTTPException(status_code=404, detail="Config not found. Is Hysteria installed?")
        
    port = int(str(data.get("listen", ":443")).replace(":", ""))
    password = data.get("auth", {}).get("password", "")
    cert = data.get("tls", {}).get("cert", "")
    domain = cert.split("/")[-2] if "/live/" in cert else "example.com"
    
    obfs_enabled = "obfs" in data
    obfs_password = data.get("obfs", {}).get("salamander", {}).get("password", "") if obfs_enabled else ""
    
    return {
        "port": port,
        "password": password,
        "domain": domain,
        "obfs_enabled": obfs_enabled,
        "obfs_password": obfs_password
    }

@app.post("/api/modify")
def modify_config(config_update: ModifyConfig):
    data = read_config()
    if not data:
        raise HTTPException(status_code=404, detail="Config not found.")
        
    data["listen"] = f":{config_update.port}"
    data["auth"]["password"] = config_update.password
    
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
    
    if os.name != 'nt':
        subprocess.run(["systemctl", "restart", "hysteria-server"])
        
    return {"success": True, "message": "Configuration updated and service restarted."}

@app.post("/api/update")
def update_hysteria():
    if os.name != 'nt':
        try:
            subprocess.run("bash <(curl -fsSL https://get.hy2.sh/)", shell=True, check=True)
            subprocess.run(["systemctl", "restart", "hysteria-server"])
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
