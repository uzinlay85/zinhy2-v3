# Hysteria2 Installer with Multi-User Web UI & Diagnostics 🚀

ဒီ Repository မှာ Hysteria2 ကို အလွယ်တကူ Install လုပ်နိုင်မယ့် **One-Click Bash Script** နဲ့အတူ Multi-User စီမံခန့်ခွဲနိုင်မည့် **Web-based UI panel** နှင့် **Command Line Diagnostic Tool** တို့ ပါဝင်ပါတယ်။

## ပါဝင်တဲ့ Features များ 🌟

- **One-Click Installer (`hysteria2-installer.sh`)**: Hysteria2 နှင့် Web UI ကို တစ်ပြိုင်နက်တည်း Install/Uninstall/Update အလွယ်တကူ လုပ်ပေးနိုင်ခြင်း။
- **Multi-User Support (`auth.type: userpass`)**: Web UI တွင် သုံးစွဲသူ အများအပြားအတွက် Account/Password သီးသန့်ဆီ သတ်မှတ်၍ အသုံးပြုနိုင်ခြင်း။
- **Let's Encrypt SSL အလိုအလျောက် ရယူပေးခြင်း**: Domain ကိုထည့်ပေးရုံနဲ့ SSL Certificate ကို Auto လုပ်ပေးပါတယ်။
- **Salamander Obfuscation**: ဖုံးကွယ်ချိတ်ဆက်မှုအတွက် Obfuscation ထည့်သွင်းနိုင်ခြင်း။
- **Web UI Panel & Log Viewer**: Python FastAPI ကိုအသုံးပြုထားပြီး ခေတ်မီလှပတဲ့ Web Interface (Glassmorphism design) ပါဝင်ပါတယ်။ Web UI မှတဆင့် Hysteria2 Logs နှင့် Web UI Logs များကို တိုက်ရိုက် ကြည့်ရှုနိုင်ပါသည်။
- **System Resource Monitoring**: RAM %, Disk Space နှင့် Server Uptime များကို Web UI တွင် တိုက်ရိုက် စစ်ဆေးနိုင်ခြင်း။
- **Command Line Checker (`status.sh`)**: Terminal ကနေ Hysteria2 & Web UI အခြေအနေ၊ Logs နှင့် System Resources များကို လျင်မြန်စွာ စစ်ဆေးနိုင်သည့် Diagnostic Tool ပါဝင်ခြင်း။

---

## 🛠️ တပ်ဆင်နည်း အဆင့်ဆင့် (One-Click Setup Guide)

### အဆင့် ၁: Hysteria2 နှင့် Web UI ကို Install လုပ်ခြင်း

Server (Ubuntu/Debian) ကို ဝင်ပြီး အောက်ပါ command ကို အသုံးပြုကာ Installer ကို Run ပါ။ (Root permission လိုအပ်ပါတယ်)

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/uzinlay85/zinhy2-v3/main/hysteria2-installer.sh)
```

**မှတ်ချက်:**
- Domain တစ်ခုလိုအပ်ပါတယ်။ (ဥပမာ - `vpn.yourdomain.com`)
- သင့် Domain ရဲ့ DNS A Record ကို သင့် VPS ရဲ့ IP address နဲ့ ချိန်ထားပေးရပါမယ်။
- Port 80 ကို ဖွင့်ထားပေးဖို့ လိုအပ်ပါတယ်။ (Let's Encrypt SSL ရယူဖို့အတွက်)

---

### အဆင့် ၂: Web UI ကို အသုံးပြုခြင်း

Installation ပြီးဆုံးသွားပါက၊ သင့် Browser မှတစ်ဆင့် အောက်ပါလင့်ခ်သို့ ဝင်ရောက်ပြီး Web UI ကို အသုံးပြုနိုင်ပါပြီ။

`http://<Your_Server_IP>:8000`

Web UI မှတဆင့် Multi-User (User ထည့်/ဖျက်/ပြင်) ပြုလုပ်ခြင်း၊ NekoBox / v2rayN Config များ ကူးယူခြင်း၊ System Logs & RAM Usage စစ်ဆေးခြင်းတို့ကို ဆောင်ရွက်နိုင်ပါသည်။

---

## 🔍 Command Line Diagnostic Checker Tool (`status.sh`)

Terminal မှတစ်ဆင့် Hysteria2 Server အခြေအနေ၊ Config များ၊ Error Logs များ နှင့် RAM/CPU Resources များကို လျင်မြန်စွာ စစ်ဆေးလိုပါက အောက်ပါ One-Click Command ကို အသုံးပြုနိုင်ပါသည်-

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/uzinlay85/zinhy2-v3/main/status.sh)
```

**ပါဝင်သော စစ်ဆေးမှုများ:**
1. Full System Diagnostic (အစအဆုံး စစ်ဆေးခြင်း)
2. Hysteria 2 Config & Service အခြေအနေ
3. Web UI Service (FastAPI) အခြေအနေ
4. System Error Logs (Hysteria & Web UI)
5. SSL Certificate သက်တမ်း စစ်ဆေးခြင်း
6. RAM, Disk & CPU Resource Usage
7. Live System Monitor (`btop` / `htop`)

---

## 🔒 လုံခြုံရေး အကြံပြုချက်များ
- Web UI Port `8000` ကို အများပြည်သူ ဝင်ခွင့်မပြုဘဲ Firewall (UFW/Iptables) ဖြင့် ပိတ်ထားကာ၊ မိမိအသုံးပြုမည့် IP မှသာ ဖွင့်သုံးခြင်း သို့မဟုတ် Nginx Reverse Proxy ขံပြီး သုံးစွဲရန် အကြံပြုအပ်ပါသည်။

## 📝 အကူအညီ
အဆင်မပြေမှုများရှိပါက Issues တွင် ဝင်ရောက်မေးမြန်းနိုင်ပါသည်။
