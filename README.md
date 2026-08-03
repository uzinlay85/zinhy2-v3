# Hysteria2 Installer with Web UI 🚀

ဒီ Repository မှာ Hysteria2 ကို အလွယ်တကူ Install လုပ်နိုင်မယ့် **One-Click Bash Script** နဲ့အတူ Web-based UI panel တစ်ခုပါဝင်ပါတယ်။ Hysteria2 Server ကို Terminal ကနေသာမကဘဲ Web UI ကနေပါ လွယ်လွယ်ကူကူ စီမံခန့်ခွဲနိုင်ဖို့ ပြုလုပ်ပေးထားတာဖြစ်ပါတယ်။

## ပါဝင်တဲ့ Features များ 🌟

- **One-Click Installer (`hysteria2-installer.sh`)**: Hysteria2 နှင့် Web UI ကို တစ်ပြိုင်နက်တည်း Install/Uninstall/Update အလွယ်တကူ လုပ်ပေးနိုင်ခြင်း။
- **Let's Encrypt SSL အလိုအလျောက် ရယူပေးခြင်း**: Domain ကိုထည့်ပေးရုံနဲ့ SSL Certificate ကို Auto လုပ်ပေးပါတယ်။
- **Salamander Obfuscation**: ဖုံးကွယ်ချိတ်ဆက်မှုအတွက် Obfuscation ထည့်သွင်းနိုင်ခြင်း။
- **Web UI Panel**: Python FastAPI ကိုအသုံးပြုထားပြီး ခေတ်မီလှပတဲ့ Web Interface (Glassmorphism design) ပါဝင်ပါတယ်။ Background တွင် အမြဲ Run နေမည့် `hysteria-webui` Systemd Service ကိုပါ အလိုအလျောက် ဖန်တီးပေးပါတယ်။
- **Client Link Generation**: v2rayN, NekoBox/NekoRay တို့အတွက် Client Config တွေကို အလိုအလျောက် ထုတ်ပေးပါတယ်။

---

## 🛠️ တပ်ဆင်နည်း အဆင့်ဆင့် (One-Click Setup Guide)

### အဆင့် ၁: Hysteria2 နှင့် Web UI ကို Install လုပ်ခြင်း

Server (Ubuntu/Debian) ကို ဝင်ပြီး အောက်ပါ command ကို အသုံးပြုကာ Installer ကို Run ပါ။ (Root permission လိုအပ်ပါတယ်)

```bash
curl -fsSL https://raw.githubusercontent.com/uzinlay85/zinhy2-v3/main/hysteria2-installer.sh | sudo bash
```

**မှတ်ချက်:**
- Domain တစ်ခုလိုအပ်ပါတယ်။ (ဥပမာ - `vpn.yourdomain.com`)
- သင့် Domain ရဲ့ DNS A Record ကို သင့် VPS ရဲ့ IP address နဲ့ ချိန်ထားပေးရပါမယ်။
- Port 80 ကို ဖွင့်ထားပေးဖို့ လိုအပ်ပါတယ်။ (Let's Encrypt SSL ရယူဖို့အတွက်)

Installer ကမေးတဲ့ Port, Password, Obfuscation အစရှိတာတွေကို မိမိစိတ်ကြိုက် ဖြည့်သွင်းပေးပါ။ Installer မှ Hysteria ကို Setup လုပ်ပေးမည့်အပြင် Web UI အတွက်ပါ လိုအပ်သည်များကို (Python 3, Virtual Env, Systemd Service) အလိုအလျောက် လုပ်ဆောင်ပေးသွားမည်ဖြစ်သည်။

### အဆင့် ၂: Web UI ကို အသုံးပြုခြင်း

Installation ပြီးဆုံးသွားပါက၊ သင့် Browser မှတစ်ဆင့် အောက်ပါလင့်ခ်သို့ ဝင်ရောက်ပြီး Web UI ကို အသုံးပြုနိုင်ပါပြီ။

`http://<Your_Server_IP>:8000`

Web UI မှတဆင့် Config များကို (Port, Password, Obfuscation) ပြင်ဆင်ခြင်း၊ Hysteria Core ကို Update ပြုလုပ်ခြင်းတို့ကို အလွယ်တကူ ဆောင်ရွက်နိုင်ပါပြီ။

---

## 🔒 လုံခြုံရေး အကြံပြုချက်များ
- Web UI Port `8000` ကို အများပြည်သူ ဝင်ခွင့်မပြုဘဲ Firewall (UFW/Iptables) ဖြင့် ပိတ်ထားကာ၊ မိမိအသုံးပြုမည့် IP မှသာ ဖွင့်သုံးခြင်း သို့မဟုတ် Nginx Reverse Proxy (with Basic Auth) ခံပြီး သုံးစွဲရန် အကြံပြုအပ်ပါသည်။

## 📝 အကူအညီ
အဆင်မပြေမှုများရှိပါက Issues တွင် ဝင်ရောက်မေးမြန်းနိုင်ပါသည်။
