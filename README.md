# Vehicle Inspection App

AI-powered 360° vehicle inspection application with damage detection and blueprint visualization.

## Setup

### Frontend

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the root directory:
```
VITE_API_URL=http://localhost:3001
```

For production, set `VITE_API_URL` to your backend server URL.

3. Start the development server:
```bash
npm run dev
```

### Backend

See `server/README.md` for backend setup instructions.

## Environment Variables

- `VITE_API_URL`: Backend API URL (defaults to `http://localhost:3001` in development)

## Deployment

### Frontend (Vercel/Netlify)

1. Set the `VITE_API_URL` environment variable in your deployment platform
2. Deploy the frontend

### Backend

Deploy the backend server separately (e.g., Railway, Render, Heroku) and update `VITE_API_URL` in the frontend environment variables.
