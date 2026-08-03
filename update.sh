#!/bin/bash
echo "Updating Hysteria 2 Web UI..."
WEBUI_DIR="/opt/hysteria-webui"
REPO_URL="https://raw.githubusercontent.com/uzinlay85/zinhy2-v3/main/webui"

mkdir -p "$WEBUI_DIR/static/css" "$WEBUI_DIR/static/js"

curl -sSL "$REPO_URL/backend.py" -o "$WEBUI_DIR/backend.py"
curl -sSL "$REPO_URL/static/index.html" -o "$WEBUI_DIR/static/index.html"
curl -sSL "$REPO_URL/static/css/style.css" -o "$WEBUI_DIR/static/css/style.css"
curl -sSL "$REPO_URL/static/js/app.js" -o "$WEBUI_DIR/static/js/app.js"

systemctl restart hysteria-webui
echo "Hysteria 2 Web UI updated & restarted successfully!"
