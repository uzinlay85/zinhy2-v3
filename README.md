# Hysteria2 Installer with Web UI 🚀

ဒီ Repository မှာ Hysteria2 ကို အလွယ်တကူ Install လုပ်နိုင်မယ့် Bash script နဲ့အတူ Web-based UI panel တစ်ခုပါဝင်ပါတယ်။ Hysteria2 Server ကို Terminal ကနေသာမကဘဲ Web UI ကနေပါ လွယ်လွယ်ကူကူ စီမံခန့်ခွဲနိုင်ဖို့ ပြုလုပ်ပေးထားတာဖြစ်ပါတယ်။

## ပါဝင်တဲ့ Features များ 🌟

- **လွယ်ကူမြန်ဆန်သော Installer (`hysteria2-installer.sh`)**: Hysteria2 ကို ချက်ချင်း Install/Uninstall/Update လုပ်ပေးနိုင်ခြင်း။
- **Let's Encrypt SSL အလိုအလျောက် ရယူပေးခြင်း**: Domain ကိုထည့်ပေးရုံနဲ့ SSL Certificate ကို Auto လုပ်ပေးပါတယ်။
- **Salamander Obfuscation**: ဖုံးကွယ်ချိတ်ဆက်မှုအတွက် Obfuscation ထည့်သွင်းနိုင်ခြင်း။
- **Web UI Panel**: Python FastAPI ကိုအသုံးပြုထားပြီး ခေတ်မီလှပတဲ့ Web Interface (Glassmorphism design) ပါဝင်ပါတယ်။
- **Client Link Generation**: v2rayN, NekoBox/NekoRay တို့အတွက် Client Config တွေကို အလိုအလျောက် ထုတ်ပေးပါတယ်။

---

## 🛠️ တပ်ဆင်နည်း အဆင့်ဆင့် (Setup Guide)

### အဆင့် ၁: Hysteria2 ကို Install လုပ်ခြင်း

Server (Ubuntu/Debian) ကို ဝင်ပြီး အောက်ပါ command တွေကို အသုံးပြုကာ Installer ကို Run ပါ။

```bash
# Repo ကို Clone လုပ်ပါ
git clone https://github.com/uzinlay85/zinhy2-v3.git
cd zinhy2-v3

# Installer ကို Run ပါ (Root permission လိုအပ်ပါတယ်)
sudo bash hysteria2-installer.sh
```

**မှတ်ချက်:**
- Domain တစ်ခုလိုအပ်ပါတယ်။ (ဥပမာ - `vpn.yourdomain.com`)
- သင့် Domain ရဲ့ DNS A Record ကို သင့် VPS ရဲ့ IP address နဲ့ ချိန်ထားပေးရပါမယ်။
- Port 80 ကို ဖွင့်ထားပေးဖို့ လိုအပ်ပါတယ်။ (Let's Encrypt SSL ရယူဖို့အတွက်)

Installer ကမေးတဲ့ Port, Password, Obfuscation အစရှိတာတွေကို မိမိစိတ်ကြိုက် ဖြည့်သွင်းပေးပါ။

### အဆင့် ၂: Web UI ကို Run ခြင်း

Web UI ဟာ Python FastAPI ကို အသုံးပြုထားတာဖြစ်တဲ့အတွက် Python 3 နဲ့လိုအပ်တဲ့ Libraries တွေကို Install လုပ်ပေးရပါမယ်။

```bash
# Web UI folder ထဲကို ဝင်ပါ
cd webui

# လိုအပ်တဲ့ Python Packages တွေကို Install လုပ်ပါ
sudo apt update
sudo apt install python3-pip -y
pip3 install -r requirements.txt

# Web UI ကို Run ပါ (Root ဖြင့် Run မှသာ Config ကို ပြင်ဆင်ခွင့်ရပါမည်)
sudo python3 backend.py
```

အထက်ပါအတိုင်း Run ပြီးပါက၊ သင့် Browser မှတစ်ဆင့် `http://<Your_Server_IP>:8000` သို့ဝင်ရောက်ပြီး Web UI ကို အသုံးပြုနိုင်ပါပြီ။

### အဆင့် ၃: Web UI ကို Background မှာ အမြဲ Run ထားရန် (Optional)

Web UI ကို Terminal ပိတ်လိုက်ရင်တောင် အမြဲအလုပ်လုပ်နေအောင် Systemd Service ဖန်တီးနိုင်ပါတယ်။

```bash
# Service ဖန်တီးရန်
sudo nano /etc/systemd/system/hysteria-webui.service
```
အောက်ပါစာကြောင်းများကို ထည့်ပါ (မိမိရဲ့ Path အမှန်ကို ပြောင်းလဲပေးရန်)
```ini
[Unit]
Description=Hysteria2 Web UI
After=network.target

[Service]
User=root
WorkingDirectory=/root/zinhy2-v3/webui
ExecStart=/usr/bin/python3 backend.py
Restart=always

[Install]
WantedBy=multi-user.target
```
သိမ်းပြီးထွက်ပါ။ ထို့နောက် Service ကို စတင်ပါ။
```bash
sudo systemctl daemon-reload
sudo systemctl enable hysteria-webui
sudo systemctl start hysteria-webui
```

---

## 🔒 လုံခြုံရေး အကြံပြုချက်များ
- Web UI Port `8000` ကို အများပြည်သူ ဝင်ခွင့်မပြုဘဲ Firewall (UFW/Iptables) ဖြင့် ပိတ်ထားကာ၊ လိုအပ်မှသာ ဖွင့်သုံးခြင်း သို့မဟုတ် Nginx Reverse Proxy (with Basic Auth) ခံပြီး သုံးစွဲရန် အကြံပြုအပ်ပါသည်။

## 📝 အကူအညီ
အဆင်မပြေမှုများရှိပါက Issues တွင် ဝင်ရောက်မေးမြန်းနိုင်ပါသည်။
