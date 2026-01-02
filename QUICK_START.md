# Quick Start Guide

## 🚀 Getting Started

### 1. Start the Backend Server

Open a **new terminal window** and run:

```bash
cd server
npm install
```

Create a `.env` file in the `server` directory:

```env
DEEPSEEK_API_KEY=your_key_here
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
MONGODB_URI=mongodb://localhost:27017/vehicle-inspection
PORT=3001
```

Then start the server:

```bash
npm start
```

You should see: `Server running on port 3001`

### 2. Start the Frontend

Open a **new terminal window** and run:

```bash
npm install
```

Create a `.env` file in the root directory:

```env
VITE_API_URL=http://localhost:3001
```

Then start the frontend:

```bash
npm run dev
```

### 3. Test the Connection

1. Open your browser to the frontend URL (usually `http://localhost:5173`)
2. Try clicking "Start 360° Video Inspection"
3. The backend should be accessible

## ⚠️ Common Issues

### "Connection Refused" Error

**Problem:** Backend server is not running

**Solution:**
1. Make sure you started the backend server in a separate terminal
2. Check that the server is running on port 3001
3. Verify your `.env` file in the frontend has `VITE_API_URL=http://localhost:3001`

### MongoDB Connection Error

**Problem:** Cannot connect to MongoDB

**Solution:**
- **Option 1:** Install and run MongoDB locally
- **Option 2:** Use MongoDB Atlas (free cloud database)
  - Sign up at https://www.mongodb.com/cloud/atlas
  - Create a free cluster
  - Get your connection string
  - Update `MONGODB_URI` in server `.env`

### Missing API Keys

**Problem:** Need DeepSeek and Cloudinary credentials

**Solution:**
- **DeepSeek API:** Get your API key from your DeepSeek provider
- **Cloudinary:** 
  - Sign up at https://cloudinary.com (free tier available)
  - Get your credentials from the dashboard
  - Add them to server `.env`

## 📝 Notes

- The backend server must be running before using the app
- Both servers can run simultaneously in different terminal windows
- Frontend runs on port 5173 (Vite default)
- Backend runs on port 3001

