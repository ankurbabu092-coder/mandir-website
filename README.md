# श्री राम जानकी मंदिर वेबसाइट

यह existing temple website का premium final project है। मूल Hindi design, supplied real temple photographs, bell intro, QR code, gallery, event poster और location सुरक्षित रखते हुए clear real-temple hero, Shiva-family दर्शन, शांत one-minute meditation, welcome-based भक्त परिवार, randomized devotional quiz, WhatsApp group और verified donation display जोड़े गए हैं। Secure Admin backend भी इसी project में शामिल है।

## Node.js requirement

यह project **Node.js v24.18.0** पर तैयार किया गया है। SQLite के लिए Node 24 का built-in `node:sqlite` इस्तेमाल होता है। इसलिए:

- `better-sqlite3` install नहीं होता।
- Node 20, NVM, Visual Studio या C++ Build Tools की जरूरत नहीं है।
- Node.js v24.18.0 में ही `node:sqlite` उपलब्ध है।

## ZIP extract करें

ZIP extract करने के बाद exact project folder खोलें:

```text
shree-ram-janki-mandir-premium-upgraded/
```

इस folder के अंदर `index.html`, `server.js`, `package.json`, `admin.html` और `assets/` दिखाई देने चाहिए। इसी folder को VS Code में खोलें।

## Windows setup

VS Code में **Terminal → New Terminal** खोलकर project folder में चलाएं:

```powershell
Copy-Item .env.example .env
npm install
npm start
```

अगर PowerShell policy copy command रोकती है, तो `.env.example` की copy बनाकर उसी folder में नाम `.env` कर दें।

## `.env` configuration

Exact path:

```text
shree-ram-janki-mandir-premium-upgraded/.env
```

`.env` में `OWNER_PASSWORD` और `SESSION_SECRET` जरूर बदलें:

```env
NODE_ENV=development
PORT=5500
SESSION_SECRET=कम-से-कम-32-characters-का-random-secret
OWNER_NAME=Ankur Chauhan
OWNER_IDENTIFIER=your-private-phone-or-email
OWNER_PASSWORD=कम-से-कम-12-characters-का-strong-password
```

`OWNER_IDENTIFIER` Main Admin का private login identifier है। इसे अपनी private phone number या email से बदलें। यह public website, public API या public content में नहीं दिखता और password नहीं है।

## Local URLs

Public website:

```text
http://localhost:5500
```

Admin panel:

```text
http://localhost:5500/admin.html
```

Login में:

- Private Login ID: `.env` में रखा आपका `OWNER_IDENTIFIER`
- Password: `.env` में रखा आपका `OWNER_PASSWORD`

## Admin permissions

- `.env` में configured owner account Main Admin / Owner है।
- Main Admin नए Admin बना और remove कर सकता है।
- Main Admin को कोई remove नहीं कर सकता।
- सभी authorized Admin notices, companions और gallery photos add/edit/delete कर सकते हैं।
- `यह Admin नए Admin manage कर सकता है` permission देने पर वह Admin नए Admin add/remove कर सकता है।
- सामान्य visitor कोई management API नहीं चला सकता।
- Login rate-limited है, passwords bcrypt hash में store होते हैं, session `httpOnly` cookie में रहता है और write requests CSRF token मांगती हैं।

## Admin में क्या manage होगा

- `सूचना`: add, edit, publish/unpublish और delete
- `हमारे साथी`: नाम, role, परिचय और photo add/edit/remove
- `Photos`: JPG/PNG/WebP upload, caption/category publish, edit और delete
- `Admins`: trusted login IDs, strong passwords और admin-management permission
- `Site content`: आज के दर्शन photo/message, सुप्रभात photo/message, आज का संदेश और बाबा LIVE settings
- `सत्यापित दान`: committee द्वारा verified SUCCESS/PENDING/FAILED records; public site पर केवल SUCCESS का कुल योग और count
- `भक्ति संगीत`: direct audio, YouTube/video links, publish state और single active track
- `आरती समय`: committee-entered label, time, note, order और publish state
- `Quiz`: question, line-separated options, correct answer और explanation
- `Engagement`: deity like counts और community reports का private moderation view
- `भक्त परिवार`: `community.html` पर public profiles, posts, likes, comments, connect requests, block और report basics
- `भक्ति ज्ञान क्विज`: 50+ प्रश्नों में से हर session के लिए अलग random 5 प्रश्न
- `एक मिनट मंदिर में`: वास्तविक night temple photo, optional bell, Admin-controlled active bhakti track, शांत 60-second timer और browser autoplay fallback button
- Dedicated pages: `features.html`, `darshan.html`, `timings.html`, `music.html`, `notices.html` और `memories.html`
- `भगवान दर्शन`: supplied deity gallery, one-per-session like toggle और Admin engagement counts
- `मंदिर सहायक`: official `@google/genai` SDK के server-side Gemini text, Hindi speech input और browser speech output
- `📜 मंदिर की पुरानी यादें`: supplied original memory photographs, बिना अनुमानित dates या history के
- Public community/darshan pages पर Admin names, roles और private login details नहीं दिखते। Login IDs, phone numbers और credentials private admin area/database में रहते हैं।
- `❤️ सहयोग करने वाले`: donor names add/edit/publish/delete; individual donation amounts कभी public नहीं होतीं

Gallery photo edit करते समय नई image चुनना optional है। केवल caption/category बदलने के लिए पुरानी image बनी रहती है।

## Data और upload paths

पहली successful `npm start` पर ये exact paths automatically बनेंगे:

```text
shree-ram-janki-mandir-premium-upgraded/data/temple.sqlite
shree-ram-janki-mandir-premium-upgraded/data/temple.sqlite-wal
shree-ram-janki-mandir-premium-upgraded/data/temple.sqlite-shm
shree-ram-janki-mandir-premium-upgraded/uploads/
```

Original supplied images और audio यहां हैं:

```text
shree-ram-janki-mandir-premium-upgraded/assets/
```

Database और `uploads/` का नियमित backup लें। `assets/` की original files delete या rename न करें। Upload limit 5MB है; केवल valid JPG, PNG और WebP images स्वीकार होती हैं। Site settings और donor names SQLite database में रहते हैं।

## Local-only scope

यह ZIP deploy या publish नहीं किया गया है। Project केवल local VS Code use के लिए तैयार है। `npm start` चलाकर local server खोलें; किसी hosting service से कोई connection नहीं है।

## Backup और troubleshooting

Project बंद करके `data/` और `uploads/` folders की copy सुरक्षित रखें।

- `Cannot find module 'node:sqlite'`: Node version v24 नहीं है; `node --version` जांचें।
- `OWNER_IDENTIFIER...` error: `.env` missing है या placeholder values बची हैं।
- Admin API काम नहीं करती: `npm run serve:static` नहीं, केवल `npm start` चलाएं।
- Image upload error: file JPG/PNG/WebP और 5MB से छोटी होनी चाहिए।
- Gemini नहीं चल रहा: `GEMINI_API_KEY` खाली होने पर local fallback उत्तर सामान्य व्यवहार है।
