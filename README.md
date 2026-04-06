# 🔒 Digital Evidence Lockbox
### Next-Gen FIR Evidence Management System | India Justice Tech

---

## 🚀 Quick Start (No Installation Needed)

### Frontend (Pure HTML – Open Directly)
1. Open `frontend/index.html` in any browser
2. Enter any name, email, password
3. Select your role and click **Enter Vault**

> ✅ Works 100% offline using browser LocalStorage

---

## 🖥️ Pages

| Page | File | Description |
|------|------|-------------|
| Login | `index.html` | Role-based login |
| Dashboard | `pages/dashboard.html` | Stats, recent activity, access level |
| Upload Evidence | `pages/upload.html` | Drag & drop + SHA-256 hash + tamper verify |
| My Evidence | `pages/evidence.html` | Grid/list view, filter, share, verify |
| FIR Cases | `pages/fir.html` | Create & link FIR cases |
| Access Control | `pages/access.html` | RBAC management, secure links |
| Audit Logs | `pages/audit.html` | Full timeline, export CSV |
| Settings | `pages/settings.html` | Profile, privacy toggles |

---

## 👥 Roles & Permissions

| Role | Upload | View | Download | Comment | Grant Access |
|------|--------|------|----------|---------|--------------|
| 👤 Victim | ✅ | ✅ | ❌ | ❌ | ✅ |
| 👮 Police | ❌ | ✅ | ❌ | ✅ | ❌ |
| ⚖️ Lawyer | ❌ | ✅ | ✅ | ❌ | ❌ |
| 🏛️ Court | ❌ | ✅ | ✅ | ✅ | ✅ |

---

## 🔐 How Evidence Integrity Works

1. User uploads file → browser computes **SHA-256 hash** via Web Crypto API
2. Hash + timestamp + device fingerprint stored immediately
3. File is **locked** (immutable)
4. To verify: re-upload same file → hashes compared automatically
5. Any byte change = **⚠️ TAMPERED** alert

---

## 🧰 Backend Setup (Optional – Needs Node.js)

```bash
cd backend
npm install
# Edit .env with your MongoDB URI
npm run dev
```

### API Endpoints
```
POST /api/auth/register    – Register user
POST /api/auth/login       – Login
POST /api/evidence/upload  – Upload evidence (victim only)
GET  /api/evidence         – List all evidence
GET  /api/evidence/:id     – Get single evidence
POST /api/evidence/verify/:id – Verify file hash
GET  /api/evidence/download/:id – Download (lawyer/court)
GET  /api/audit            – Get audit logs
POST /api/fir              – Create FIR case
```

---

## 🏗️ Tech Stack

- **Frontend**: Pure HTML5 + CSS3 + Vanilla JS (Web Crypto API for SHA-256)
- **Backend**: Node.js + Express.js
- **Database**: MongoDB + Mongoose
- **Auth**: JWT + bcrypt
- **File Upload**: Multer
- **Hashing**: SHA-256 (crypto module server-side, Web Crypto API client-side)

---

## 🎯 Hackathon Demo Flow

1. Login as **Victim** → Upload a file → See hash + timestamp
2. Go to Upload page → Re-upload same file → **✅ Verified**
3. Modify the file slightly → Re-upload → **⚠️ Tampered detected!**
4. Login as **Police** → Can view but not upload/download
5. Login as **Lawyer** → Can download evidence
6. Check **Audit Logs** → Every action recorded

---

## 🇮🇳 Built for India Justice Tech Hackathon
*"Evidence uploaded once → locked forever → verified always"*
