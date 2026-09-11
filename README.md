# حارس المحتوى | Haris Al-Muhtawa 🛡️✨

<div align="center">

![حارس المحتوى](./public/icon/128.png)

**فلتر يوتيوب الشخصي لتصفح نظيف، هادف، وبدون تشتيت الخوارزميات**  
*A clean, distraction-free personal YouTube content filter to take back control of your feed.*

[![Built with WXT](https://img.shields.io/badge/Built%20with-WXT-red.svg)](https://wxt.dev)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

[العربية](#عن-المشروع-العربية) • [English](#about-the-project-english)

</div>

---

## عن المشروع (العربية)

### السالفة باختصار.. ليه سويت هذا المشروع؟ 🤔
اليوتيوب كنز مليان علم ودورات ومحتوى مفيد، بس كلنا عارفين وش مشكلته: **الخوارزميات والشورتس!**  
تدخل ناوي تشوف شرح برمجة أو درس معين، وتتفاجأ بعد نص ساعة إنك جالس تشوف مقاطع مقالب أو فيديوهات ما لها أي فايدة، وفوق هذا كله مقاطع فيها موسيقى أو مشاهد ما ترضي الله وتكسبك سيئات جارية بدون ما تحس، والله المستعان.

عشان كذا سويت **«حارس المحتوى»**.. إضافة بسيطة للمتصفح ترجع لك التحكم، وتخليك أنت اللي تقرر وش تشوف، مو خوارزمية يوتيوب اللي تفرض عليك!

---

### وش تسوي الإضافة بالضبط؟ (أهم المميزات) ✨

* **🛡️ القائمة المعتمدة (الوايت ليست):**  
  تضيف فقط القنوات النظيفة والمفيدة اللي راجعتها بنفسك وتثق بمحتواها، عشان تتابعهم باطمئنان.

* **🚫 حظر القنوات بنقرة زر:**  
  قناة مزعجة أو محتواها غير لائق؟ احظرها بضغطة واحدة، ومستحيل تطلع لك في الصفحة الرئيسية أو الفيديوهات المقترحة مرة ثانية.

* **📁 رتّب فيديوهاتك بمجلدات:**  
  تقدر تسوي مجلدات وتصنيفات داخل الإضافة وترتب فيها الفيديوهات المعتمدة براحتك (مثلاً: *برمجة، بودكاست، دروس، طبخ.. إلخ*).

* **🛑 وداعاً للشورتس (Hide Shorts):**  
  زر تفعله من الإعدادات ويخفي لك كل مقاطع Shorts من الموقع تماماً، عشان تقطع دوامة التمرير اللانهائي اللي تضيع الوقت.

* **🌐 إيقاف ترجمة العناوين التلقائية الغبية:**  
  يوتيوب أحياناً يترجم عناوين الفيديوهات الإنجليزية لترجمة عربية مضحكة وغريبة؛ فعلنا لك خيار يعرض لك العنوان بلغته الأصلية مثل ما كتبه صاحب الفيديو.

* **🔔 متابعة جديد القنوات بدون دوشة إشعارات:**  
  الإضافة تفحص القنوات المعتمدة بالخلفية وتوريك الجديد في مكان هادي ومنظم بدون ما يزعجك اليوتيوب.

* **💾 استيراد وتصدير بياناتك (JSON Backup):**  
  قوائمك ومجلداتك ما تضيع، بنقرة زر نزل نسختك الاحتياطية وانقلها لأي متصفح أو جهاز ثاني.

* **🔒 خصوصيتك في أمان 100%:**  
  ما في أي خادم (Server) خارجي، ولا تسجيل دخول، ولا إعلانات، ولا نجمع أي معلومة عنك. كل بياناتك مخزنة محلياً في متصفحك فقط (`Local Storage`).

* **🌍 تدعم أكثر من 40 لغة:**  
  مع دعم كامل وتلقائي للغة العربية والاتجاه من اليمين لليسار (RTL).

---

### كيف تجرب وتشغل الإضافة عندك؟ (للمطورين والمهتمين) 🚀

#### المتطلبات الأولية:
* مثبت عندك [Node.js](https://nodejs.org/) (إصدار 18 أو أحدث).
* أي متصفح مبني على كروم (Google Chrome, Brave, Edge) أو متصفح Firefox.

#### خطوات التثبيت:

1. **حمّل المستودع عندك:**
   ```bash
   git clone https://github.com/Hossam-Majrashi/haris-al-muhtawa.git
   cd haris-al-muhtawa
   ```

2. **ثبّت الاعتماديات (Dependencies):**
   ```bash
   npm install
   ```

3. **لتشغيل وضع التطوير الحي (Live Reload):**
   ```bash
   # لمتصفحات كروم ومبنياتها
   npm run dev

   # أو لمتصفح فايرفوكس
   npm run dev:firefox
   ```

4. **لبناء النسخة النهائية (Production Build):**
   ```bash
   npm run build
   ```

#### كيف تركبها في متصفحك يدويًا (Load Unpacked)؟
1. افتح صفحة الإضافات في متصفحك: `chrome://extensions/`
2. فعّل خيار **وضع المطور (Developer mode)** في الزاوية العلوية.
3. اضغط على زر **تحميل إضافة لم يتم حزمها (Load unpacked)**.
4. اختر المجلد الناتج من البناء: `.output/chrome-mv3`.
5. مبروك! بتشوف أيقونة «حارس المحتوى» في شريط أدوات المتصفح.

---

### شاركنا برأيك ومساهمتك 🤝
المشروع سويته لوجه الله وأتمنى يفيد أكبر عدد من الناس.  
لو عندك فكرة، أو شفت خطأ برمجياً، أو حاب تضيف ميزة جديدة:
- افتح [Issue](https://github.com/Hossam-Majrashi/haris-al-muhtawa/issues) واكتب لنا رأيك.
- أو ارفع [Pull Request](https://github.com/Hossam-Majrashi/haris-al-muhtawa/pulls) ويسعدني جداً دمج شغلك.
- وإذا عجبك المشروع، لا تنسى تعطيه نجمة ⭐ للمستودع وتدعوا لنا بظهر الغيب!

---

<br/>

## About The Project (English)

### The Story: Why I Built This? 🤔
YouTube is a goldmine for knowledge and entertainment, but its business model relies on keeping your eyes glued to the screen through addictive algorithms and endless Shorts. It's way too easy to search for a coding tutorial and find yourself 40 minutes later trapped in random distraction.

I built **Haris Al-Muhtawa (Content Guardian)** as a personal shield. It puts you back in the driver's seat: you choose what deserves your time, free from noise and algorithmic traps.

---

### Key Features ✨

* **🛡️ Vetted Whitelist (Approved Channels):** Subscribe only to channels you have personally reviewed and approved.
* **🚫 One-Click Channel Blocker:** Block undesirable or toxic channels instantly so they never appear on your home feed or search suggestions.
* **📁 Smart Video Folders:** Organize your favorite approved videos into custom categories (e.g., *Dev, Tutorials, Podcasts, Cooking*).
* **🛑 Hide YouTube Shorts:** Toggle a single switch to wipe Shorts off your YouTube UI completely.
* **🌐 Disable Auto-Translated Titles:** Stop YouTube from forcing awkward AI translations on foreign video titles—view them as originally written.
* **🔔 Clean Notification Feed:** Keep up with your approved creators in a dedicated, peaceful popup tab without notification fatigue.
* **💾 Import / Export (JSON):** Full control over your data. Easily export your lists and import them into another browser.
* **🔒 100% Local & Privacy-Friendly:** Zero external servers, zero tracking scripts, zero login needed. Everything stays in your browser's local storage.
* **🌍 Multi-Language Support:** Ready out of the box with 40+ languages and full RTL support.

---

### Getting Started & Local Development 💻

#### Prerequisites:
* [Node.js](https://nodejs.org/) (v18 or higher recommended)
* A modern Chromium browser (Chrome, Brave, Edge) or Firefox

#### Setup:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Hossam-Majrashi/haris-al-muhtawa.git
   cd haris-al-muhtawa
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start development mode:**
   ```bash
   # For Chrome / Chromium
   npm run dev

   # For Firefox
   npm run dev:firefox
   ```

4. **Build production package:**
   ```bash
   npm run build
   ```

#### How to load the unpacked extension in Chrome:
1. Navigate to `chrome://extensions/`.
2. Enable **Developer mode** toggle in the top-right corner.
3. Click **Load unpacked**.
4. Select the `.output/chrome-mv3` folder.

---

### Tech Stack 🛠️
- **Framework:** [WXT](https://wxt.dev/) (Next-gen Web Extension Framework)
- **Bundler:** [Vite](https://vitejs.dev/)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **UI & Styling:** Vanilla HTML5 & CSS3 with CSS variables & responsive design.

---

### Contributing & Feedback 🌟
Contributions, bug reports, and feature suggestions are more than welcome!
Feel free to open an issue or submit a pull request.

If this project helps you maintain your focus, consider giving this repo a **Star ⭐**!
