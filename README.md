# श्री राम जानकी मंदिर वेबसाइट

यह existing temple website का premium final project है। मूल Hindi design, bell intro, bell audio, animations, supplied photos, QR code, gallery, event poster और location सुरक्षित रखते हुए आज के दर्शन, सुप्रभात, आज का संदेश, live state और donation display जोड़े गए हैं। Secure Admin backend भी इसी project में शामिल है।

## Node.js requirement

यह project **Node.js v24.18.0** पर तैयार किया गया है। SQLite के लिए Node 24 का built-in `node:sqlite` इस्तेमाल होता है। इसलिए:

- `better-sqlite3` install नहीं होता।
- Node 20, NVM, Visual Studio या C++ Build Tools की जरूरत नहीं है।
- Node.js v24.18.0 में ही `node:sqlite` उपलब्ध है।

## ZIP extract करें

ZIP extract करने के बाद exact project folder खोलें:

```text
shree-ram-janki-mandir-project/
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
shree-ram-janki-mandir-project/.env
```

`.env` में `OWNER_PASSWORD` और `SESSION_SECRET` जरूर बदलें:

```env
NODE_ENV=development
PORT=5500
SESSION_SECRET=कम-से-कम-32-characters-का-random-secret
OWNER_NAME=Ankur Chauhan
OWNER_IDENTIFIER=7266802908
OWNER_PASSWORD=कम-से-कम-12-characters-का-strong-password
```

`OWNER_IDENTIFIER=7266802908` Main Admin का private login identifier है। यह public website, public API या public content में नहीं दिखता और password नहीं है। इसे `.env` या किसी password manager में private रखें।

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

- Private Login ID: `7266802908`
- Password: `.env` में रखा आपका `OWNER_PASSWORD`

## Admin permissions

- `Ankur Chauhan` वाला account Main Admin / Owner है।
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
- `Site content`: आज के दर्शन photo/message, सुप्रभात photo/message, आज का संदेश, donation total और बाबा LIVE settings
- `❤️ सहयोग करने वाले`: donor names add/edit/publish/delete; individual donation amounts कभी public नहीं होतीं

Gallery photo edit करते समय नई image चुनना optional है। केवल caption/category बदलने के लिए पुरानी image बनी रहती है।

## Data और upload paths

पहली successful `npm start` पर ये exact paths automatically बनेंगे:

```text
shree-ram-janki-mandir-project/data/temple.sqlite
shree-ram-janki-mandir-project/data/temple.sqlite-wal
shree-ram-janki-mandir-project/data/temple.sqlite-shm
shree-ram-janki-mandir-project/uploads/
```

Original supplied images और audio यहां हैं:

```text
shree-ram-janki-mandir-project/assets/
```

Database और `uploads/` का नियमित backup लें। `assets/` की original files delete या rename न करें। Upload limit 5MB है; केवल valid JPG, PNG और WebP images स्वीकार होती हैं। Site settings और donor names SQLite database में रहते हैं।

## Production deployment

इस environment से persistent Node.js server, SQLite और uploads वाला external host deploy नहीं किया जा सकता। Static page publish करना Admin backend को live नहीं बनाता, इसलिए यहां से broken live URL नहीं दिया गया है। नीचे free Oracle Cloud Always Free VM पर exact deployment path है।

### 1. Free VM

Oracle Cloud Always Free में Ubuntu VM बनाएं और उसका public IP note करें। DuckDNS में free subdomain बनाकर उस IP पर point करें, जैसे:

```text
shree-ram-janki-mandir.duckdns.org
```

### 2. Node.js v24 और Nginx

VM में SSH करके चलाएं:

```bash
sudo apt update
sudo apt install -y curl nginx
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version
npm --version
```

`node --version` में `v24` आना चाहिए।

### 3. Project upload और install

Extracted project को VM पर इस exact path में रखें:

```text
/var/www/shree-ram-janki-mandir-project/
```

फिर:

```bash
cd /var/www/shree-ram-janki-mandir-project
npm install --omit=dev
cp .env.example .env
nano .env
```

Production `.env`:

```env
NODE_ENV=production
PORT=5500
SESSION_SECRET=कम-से-कम-32-characters-का-long-random-secret
OWNER_NAME=Ankur Chauhan
OWNER_IDENTIFIER=7266802908
OWNER_PASSWORD=आपका-strong-private-password
```

### 4. Node process चालू रखें

```bash
sudo npm install --global pm2
pm2 start server.js --name shree-ram-janki-mandir
pm2 save
pm2 startup
```

`pm2 startup` जो command दिखाए, उसे भी एक बार चलाएं।

### 5. Nginx reverse proxy

```bash
sudo nano /etc/nginx/sites-available/shree-ram-janki-mandir
```

इस file में domain को अपने DuckDNS domain से बदलकर रखें:

```nginx
server {
    listen 80;
    server_name shree-ram-janki-mandir.duckdns.org;

    location / {
        proxy_pass http://127.0.0.1:5500;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

फिर:

```bash
sudo ln -s /etc/nginx/sites-available/shree-ram-janki-mandir /etc/nginx/sites-enabled/shree-ram-janki-mandir
sudo nginx -t
sudo systemctl restart nginx
```

### 6. Free HTTPS

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d shree-ram-janki-mandir.duckdns.org
```

HTTPS चालू होने के बाद:

```text
Live website: https://shree-ram-janki-mandir.duckdns.org/
Admin URL:    https://shree-ram-janki-mandir.duckdns.org/admin.html
```

Live होने के बाद Admin login में वही private identifier `7266802908` और `.env` वाला password इस्तेमाल होगा।

## Backup और troubleshooting

```bash
cd /var/www/shree-ram-janki-mandir-project
tar -czf temple-backup-$(date +%F).tar.gz data uploads
pm2 logs shree-ram-janki-mandir
```

- `Cannot find module 'node:sqlite'`: Node version v24 नहीं है; `node --version` जांचें।
- `OWNER_IDENTIFIER...` error: `.env` missing है या placeholder values बची हैं।
- Admin API काम नहीं करती: `npm run serve:static` नहीं, केवल `npm start` चलाएं।
- Image upload error: file JPG/PNG/WebP और 5MB से छोटी होनी चाहिए।
