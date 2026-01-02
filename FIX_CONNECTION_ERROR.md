# Fix: ERR_CONNECTION_REFUSED Error

## The Problem

The error `ERR_CONNECTION_REFUSED` means the backend server is **not running** or cannot be reached.

## Solution: Two Separate .env Files Needed

You need **TWO separate .env files**:

### 1. Backend .env File (in `server/` directory)

Create `server/.env` with backend credentials:

```env
# DeepSeek API
DEEPSEEK_API_KEY=AXTEbTInQYX2mhleHbLd65hB90Bd6a06

# Cloudinary
CLOUDINARY_CLOUD_NAME=dzlwkon9z
CLOUDINARY_API_KEY=115179859334986
CLOUDINARY_API_SECRET=4WDYmFFTnKaw0ePOCYJcSjxobiw

# MongoDB
MONGODB_URI=mongodb+srv://gudalabhavani12_db_user:agwKelzDE@your-cluster.mongodb.net/vehicle-inspection

# Server Port
PORT=3001
```

### 2. Frontend .env File (in root directory)

Create `.env` in the root `vite-project/` directory with:

```env
VITE_API_URL=http://localhost:3001
```

## Step-by-Step Fix

### Step 1: Move/Create Backend .env File

1. Open the `server` folder
2. Create a new file named `.env` (not in root, but in `server/` folder)
3. Copy your backend credentials into it (the ones you have in root .env)

### Step 2: Create Frontend .env File

1. In the root `vite-project/` directory
2. Create `.env` file with just: `VITE_API_URL=http://localhost:3001`

### Step 3: Install Backend Dependencies

Open a terminal and run:

```bash
cd server
npm install
```

### Step 4: Start the Backend Server

In the same terminal (still in `server/` directory):

```bash
npm start
```

You should see:
```
Server running on port 3001
```

**Keep this terminal open!** The server must stay running.

### Step 5: Start the Frontend (in a NEW terminal)

Open a **NEW terminal window** and run:

```bash
npm run dev
```

## Verify It's Working

1. Check backend is running: Visit `http://localhost:3001/api/health`
   - Should return: `{"status":"ok","message":"Server is running",...}`

2. Try the video upload again in your app

## Common Mistakes

❌ **Wrong:** `.env` file only in root directory  
✅ **Correct:** `.env` in `server/` directory for backend, separate `.env` in root for frontend

❌ **Wrong:** Backend server not running  
✅ **Correct:** Backend server must be running in a separate terminal

❌ **Wrong:** Running `npm start` in root directory  
✅ **Correct:** Run `npm start` inside the `server/` directory

## File Structure Should Be:

```
vite-project/
├── .env                    ← Frontend .env (VITE_API_URL only)
├── server/
│   ├── .env               ← Backend .env (all API keys)
│   ├── index.js
│   └── package.json
└── src/
    └── ...
```

