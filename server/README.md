# Vehicle Inspection Backend Server

This backend server handles video processing, AI analysis, and data storage for the vehicle inspection application.

## Setup

1. Install dependencies:
```bash
cd server
npm install
```

2. Create a `.env` file in the `server` directory with the following variables:
```
DEEPSEEK_API_KEY=your_deepseek_api_key_here
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
MONGODB_URI=mongodb://localhost:27017/vehicle-inspection
PORT=3001
```

3. Start MongoDB (if using local MongoDB):
```bash
# Make sure MongoDB is running on your system
```

4. Start the server:
```bash
npm start
# or for development with auto-reload:
npm run dev
```

## API Endpoints

### POST /api/process-video
Uploads a video file, stores it in Cloudinary, analyzes it with DeepSeek AI, and saves the results to MongoDB.

**Request:**
- Method: POST
- Content-Type: multipart/form-data
- Body: `video` (file)

**Response:**
```json
{
  "id": "inspection_id",
  "videoUrl": "https://...",
  "vehicleInfo": {...},
  "damages": [...],
  "blueprint": {...},
  "summary": {...}
}
```

### GET /api/inspection/:id
Retrieves an inspection by ID.

**Response:**
```json
{
  "id": "...",
  "videoUrl": "...",
  ...
}
```

## Environment Variables

- `DEEPSEEK_API_KEY`: Your DeepSeek API key
- `CLOUDINARY_CLOUD_NAME`: Your Cloudinary cloud name
- `CLOUDINARY_API_KEY`: Your Cloudinary API key
- `CLOUDINARY_API_SECRET`: Your Cloudinary API secret
- `MONGODB_URI`: MongoDB connection string
- `PORT`: Server port (default: 3001)

