#!/bin/bash
export LANG=C.UTF-8
export LC_ALL=C.UTF-8

# Color Definitions
RED='\033[1;31m'
GREEN='\033[1;32m'
YELLOW='\033[1;33m'
CYAN='\033[1;36m'
MAGENTA='\033[1;35m'
NC='\033[0m' # No Color

show_banner() {
    echo -e "\n${CYAN}========================================================${NC}"
    echo -e "${CYAN}🔍 Hysteria 2 & Web UI Diagnostic & Status Checker${NC}"
    echo -e "${CYAN}========================================================${NC}"
}

check_hysteria() {
    echo -e "\n${YELLOW}=== 1. Hysteria 2 Config (/etc/hysteria/config.yaml) ===${NC}"
    if [ -f /etc/hysteria/config.yaml ]; then
        cat /etc/hysteria/config.yaml
    else
        echo -e "${RED}Config file not found at /etc/hysteria/config.yaml${NC}"
    fi

    echo -e "\n${YELLOW}=== 2. Hysteria 2 Service & TrafficStats API Status ===${NC}"
    systemctl status hysteria-server --no-pager 2>/dev/null || echo -e "${RED}Hysteria Service not found.${NC}"
    
    echo -e "\n${YELLOW}--- TrafficStats REST API (127.0.0.1:8080) Test ---${NC}"
    if curl -s http://127.0.0.1:8080/online > /dev/null; then
        echo -e "${GREEN}✓ TrafficStats API is UP and responding (127.0.0.1:8080)${NC}"
        echo -e "Online status response: $(curl -s http://127.0.0.1:8080/online)"
    else
        echo -e "${RED}✗ TrafficStats API is NOT responding on http://127.0.0.1:8080${NC}"
    fi
}

check_webui() {
    echo -e "\n${YELLOW}=== 3. Web UI Service Status (hysteria-webui) ===${NC}"
    systemctl status hysteria-webui --no-pager 2>/dev/null || echo -e "${RED}Web UI Service not found.${NC}"
}

check_logs() {
    echo -e "\n${YELLOW}=== 4. Hysteria 2 Logs (Recent 15 lines) ===${NC}"
    journalctl -u hysteria-server -n 15 --no-pager 2>/dev/null || echo -e "${RED}No Hysteria logs found.${NC}"
    
    echo -e "\n${YELLOW}=== Web UI Logs (Recent 15 lines) ===${NC}"
    journalctl -u hysteria-webui -n 15 --no-pager 2>/dev/null || echo -e "${RED}No Web UI logs found.${NC}"
}

check_ssl() {
    echo -e "\n${YELLOW}=== 5. SSL Certificates (Certbot) ===${NC}"
    certbot certificates 2>/dev/null || echo -e "${RED}Certbot not found or no certificates registered.${NC}"
}

check_system_resources() {
    echo -e "\n${YELLOW}=== 6. System Resources Summary (CPU / RAM / Disk) ===${NC}"
    echo -e "${GREEN}--- System Load Average ---${NC}"
    uptime | awk -F'load average:' '{printf "  Load Average:%s\n", $2}' 2>/dev/null
    
    echo -e "\n${GREEN}--- RAM (Memory) Usage ---${NC}"
    free -m | awk '/Mem:/ {printf "  RAM Used: %d MB / %d MB (%.1f%% used)\n", $3, $2, $3/$2*100}' 2>/dev/null
    
    echo -e "\n${GREEN}--- Disk Storage Usage ---${NC}"
    df -h / | awk 'NR==2 {printf "  Disk Used: %s / %s (%s used)\n", $3, $2, $5}' 2>/dev/null
    
    echo -e "\n${GREEN}--- Process Resource Usage ---${NC}"
    ps aux | grep -E "hysteria|python3" | grep -v grep | awk '{printf "  • %-15s (PID: %-6s | CPU: %-4s%% | RAM: %d MB)\n", $11, $2, $3, int($6/1024)}' 2>/dev/null
}

show_btop() {
    if command -v btop &> /dev/null; then
        btop
    elif command -v htop &> /dev/null; then
        htop
    else
        echo -e "\n${YELLOW}=== Installing btop monitor... ===${NC}"
        apt-get update && apt-get install btop -y
        btop 2>/dev/null || htop
    fi
}

full_diagnostic() {
    show_banner
    check_hysteria
    check_webui
    check_logs
    check_ssl
    check_system_resources
    echo -e "\n${GREEN}========================================================${NC}"
    echo -e "${GREEN}✅ Diagnostic Completed Successfully${NC}"
    echo -e "${GREEN}========================================================${NC}\n"
}

# If non-interactive or passed --all / -a
if [ ! -t 0 ] && [ ! -c /dev/tty ] || [ "$1" == "--all" ] || [ "$1" == "-a" ]; then
    full_diagnostic
    exit 0
fi

# Interactive Menu Mode
while true; do
    show_banner
    echo -e "${GREEN}1)${NC} Full System Diagnostic (Run All Checks)"
    echo -e "${GREEN}2)${NC} Hysteria 2 Config & Service Status"
    echo -e "${GREEN}3)${NC} Web UI Service Status"
    echo -e "${GREEN}4)${NC} System Logs (Hysteria & Web UI)"
    echo -e "${GREEN}5)${NC} SSL Certificate Status"
    echo -e "${GREEN}6)${NC} System Resources (CPU / RAM / Disk)"
    echo -e "${GREEN}7)${NC} Live Resource Monitor (btop / htop)"
    echo -e "${GREEN}8)${NC} Exit"
    echo -e "${CYAN}========================================================${NC}"
    
    read -p "Choose option [1-8]: " choice < /dev/tty
    
    case $choice in
        1) full_diagnostic ;;
        2) check_hysteria ;;
        3) check_webui ;;
        4) check_logs ;;
        5) check_ssl ;;
        6) check_system_resources ;;
        7) show_btop ;;
        8) echo -e "\n${GREEN}Bye!${NC}\n"; exit 0 ;;
        *) echo -e "\n${RED}Invalid option!${NC}" ;;
    esac
done
