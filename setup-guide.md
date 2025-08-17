# Step-by-Step Setup Guide

## 🎯 Goal
Set up a universal API for writing data to Google Sheets with automatic field mapping.

## 📋 What you'll need
- Google account
- Cloudflare account
- Google Sheets for data recording

## 🔧 Step 1: Creating Google Service Account

### 1.1 Creating a project in Google Cloud

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **"Select a project"** → **"New Project"**
3. Enter project name (e.g., `sheets-api-bot`)
4. Click **"Create"**

### 1.2 Enabling Google Sheets API

1. In the left navigation: **APIs & Services** → **Library**
2. Search for **"Google Sheets API"**
3. Click **"Enable"**

### 1.3 Creating Service Account

1. **APIs & Services** → **Credentials**
2. **"Create Credentials"** → **"Service Account"**
3. Fill out the form:
   - **Service account name**: `sheets-bot`
   - **Service account ID**: `sheets-bot` (automatic)
   - **Description**: optional
4. Click **"Create and Continue"**
5. **Role**: you can skip (click **"Continue"**)
6. **Grant users access**: skip → **"Done"**

### 1.4 Creating a key

1. In the Service Accounts list, click on the created account
2. **"Keys"** tab
3. **"Add Key"** → **"Create new key"**
4. Select **JSON** → **"Create"**
5. **Save the file** — it contains the private key

---

## 📊 Step 2: Preparing Google Sheets

### 2.1 Creating/opening a spreadsheet

1. Open [Google Sheets](https://sheets.google.com/)
2. Create a new spreadsheet or open an existing one
3. **Copy the sheet ID** from the URL:
   ```
   https://docs.google.com/spreadsheets/d/1AbC...XyZ.../edit
                                        This is SHEET_ID
   ```

### 2.2 Setting up headers (recommended)

Add column headers in the first row of the sheet:
```
| timestamp | name | email | phone | source | message |
```

### 2.3 Granting access to Service Account

1. In Google Sheets click **"Share"**
2. In the email field, paste **your Service Account email**:
   ```
   sheets-bot@your-project.iam.gserviceaccount.com
   ```
   (find it in the downloaded JSON file in the `client_email` field)
3. Set permissions to **"Editor"**
4. **Uncheck** "Notify people"
5. Click **"Share"**

---

## ☁️ Step 3: Setting up Cloudflare Worker

### 3.1 Project installation

```bash
# Clone the repository
git clone <repository-url>
cd sheets-api

# Install dependencies
pnpm install

# Login to Cloudflare
npx wrangler login
```

### 3.2 Configuration setup

Edit `wrangler.toml`:

```toml
name = "my-sheets-api"  # Change to unique name
```

```toml
SA_EMAIL = "sheets-bot@your-project.iam.gserviceaccount.com"
SHEET_ID = "1AbC...XyZ..."  # Your sheet ID
RANGE = "Sheet1!A:Z"       # Cell range
```

### 3.3 Adding private key

From the downloaded JSON file, copy the value of the `private_key` field:

```bash
npx wrangler secret put SA_PRIVATE_KEY
```

Paste the **full key** including headers:
```
-----BEGIN PRIVATE KEY-----
...long string...
-----END PRIVATE KEY-----
```

### 3.4 Deploy

```bash
# Development (local)
pnpm dev

# Production
pnpm deploy
```

After deployment you'll get your API URL:
```
https://my-sheets-api.your-subdomain.workers.dev
```

---

## 🧪 Step 4: Testing

### 4.1 Test via curl

```bash
curl -X POST https://my-sheets-api.your-subdomain.workers.dev/motobarn/leads \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890"
    }
  }'
```

### 4.2 Check Google Sheets

Open your spreadsheet and make sure the data was written to the correct columns.

### 4.3 Check headers

```bash
curl https://my-sheets-api.your-subdomain.workers.dev/
```

Should return the list of headers from the first row.

---

## 🌐 Step 5: Frontend Integration

### 5.1 Simple HTML

Use `examples/frontend.html` as a base, replacing:
- API URL with your Worker URL
- Project/list names as needed

### 5.2 React Hook

Copy `examples/react-hook.tsx` and configure:
- API URL
- Project/list names

### 5.3 CORS Setup (important!)

In `src/index.ts` replace:
```typescript
ALLOWED_ORIGINS = "*"
```

with your domain:
```typescript
ALLOWED_ORIGINS = "https://yourdomain.com"
```

---

## ✅ Readiness Checklist

- [ ] Google Cloud project created
- [ ] Google Sheets API enabled
- [ ] Service Account created and JSON key downloaded
- [ ] Google spreadsheet shared with Service Account
- [ ] Headers in first row configured
- [ ] `wrangler.toml` configured with correct variables
- [ ] `SA_PRIVATE_KEY` added via secrets
- [ ] Worker deployed to Cloudflare
- [ ] API tested via curl
- [ ] CORS configured for your domain
- [ ] Frontend integrated and tested

---

## 🚨 Possible Issues

### Access denied
- Check that Service Account is added to sheet sharing
- Make sure SHEET_ID is correct

### Authentication error
- Check private key format (should include `-----BEGIN/END-----`)
- Make sure SA_EMAIL exactly matches email from JSON

### Sheet not found
- Check sheet name in RANGE (default "Sheet1")
- Use English sheet name

### CORS errors
- Configure correct domain in Access-Control-Allow-Origin
- Check that OPTIONS requests are handled

### API errors
- Make sure Google Sheets API is enabled in your project

---

## 🎉 Done!

Now you have a universal API for writing to Google Sheets with automatic field mapping. Any forms on your website can send data directly to spreadsheets without additional Apps Script setup.

### What's next?

1. **Add validation** for data in Worker (use Zod)
2. **Set up monitoring** via Cloudflare Analytics
3. **Add rate limiting** for spam protection
4. **Create webhooks** for new submission notifications
5. **Set up automatic reports** from Google Sheets
