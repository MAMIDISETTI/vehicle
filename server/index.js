const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const FormData = require('form-data');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/vehicle-inspection', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// MongoDB Schema
const inspectionSchema = new mongoose.Schema({
  videoUrl: String,
  cloudinaryPublicId: String,
  vehicleInfo: {
    make: String,
    model: String,
    year: Number,
    mileage: Number,
    vin: String,
  },
  damages: [{
    panelId: String,
    panelName: String,
    damageType: String,
    severity: String,
    location: {
      x: Number,
      y: Number,
      width: Number,
      height: Number,
    },
    imageUrl: String,
    description: String,
    estimatedCost: Number,
  }],
  blueprint: {
    exterior: {
      frontBumper: String,
      rearBumper: String,
      hood: String,
      roof: String,
      leftSide: String,
      rightSide: String,
      leftFender: String,
      rightFender: String,
      trunk: String,
    },
    interior: {
      frontSeats: String,
      rearSeats: String,
      dashboard: String,
      doors: String,
    },
  },
  summary: {
    totalDamages: Number,
    estimatedRepairCost: Number,
    conditionRating: Number,
    adjustedValue: Number,
  },
  analysisResult: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now },
});

const Inspection = mongoose.model('Inspection', inspectionSchema);

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// DeepSeek API configuration
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE_URL = "https://DeepSeek-R1-oplms.eastus2.models.ai.azure.com/chat/completions";

// Helper function to call DeepSeek API
async function analyzeVideoWithDeepSeek(videoUrl, videoFrames) {
  try {
    const prompt = `Analyze this vehicle inspection video and provide a detailed damage assessment. 
    
    Video URL: ${videoUrl}
    Number of frames extracted: ${videoFrames.length}
    
    Please analyze the video and provide:
    1. Vehicle identification (make, model, year if visible)
    2. List of all damages found with:
       - Panel/area affected (front_bumper, rear_bumper, hood, roof, left_side, right_side, left_fender, right_fender, trunk, front_seats, rear_seats, dashboard, doors)
       - Damage type (scratch, dent, paint_damage, crack, replace, deform, excess_wear)
       - Severity (minor, moderate, severe)
       - Location coordinates (x, y, width, height) if possible
       - Description
       - Estimated repair cost
    3. Blueprint mapping showing damage locations:
       - Exterior view with color coding (yellow: paint/worn, orange: deform/excess, red: replace)
       - Interior view if applicable
    4. Overall summary:
       - Total number of damages
       - Estimated total repair cost
       - Condition rating (1-5 scale)
       - Adjusted vehicle value
    
    Return the response in JSON format with this structure:
    {
      "vehicleInfo": {
        "make": "string",
        "model": "string",
        "year": number,
        "mileage": number,
        "vin": "string"
      },
      "damages": [
        {
          "panelId": "string",
          "panelName": "string",
          "damageType": "string",
          "severity": "string",
          "location": { "x": number, "y": number, "width": number, "height": number },
          "description": "string",
          "estimatedCost": number
        }
      ],
      "blueprint": {
        "exterior": {
          "frontBumper": "none|yellow|orange|red",
          "rearBumper": "none|yellow|orange|red",
          "hood": "none|yellow|orange|red",
          "roof": "none|yellow|orange|red",
          "leftSide": "none|yellow|orange|red",
          "rightSide": "none|yellow|orange|red",
          "leftFender": "none|yellow|orange|red",
          "rightFender": "none|yellow|orange|red",
          "trunk": "none|yellow|orange|red"
        },
        "interior": {
          "frontSeats": "none|yellow|orange|red",
          "rearSeats": "none|yellow|orange|red",
          "dashboard": "none|yellow|orange|red",
          "doors": "none|yellow|orange|red"
        }
      },
      "summary": {
        "totalDamages": number,
        "estimatedRepairCost": number,
        "conditionRating": number,
        "adjustedValue": number
      }
    }`;

    const response = await axios.post(
      DEEPSEEK_BASE_URL,
      {
        model: "deepseek-chat",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 4000
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${DEEPSEEK_API_KEY}`
        }
      }
    );

    // Extract JSON from response
    const content = response.data.choices[0].message.content;
    let analysisResult;
    
    // Try to parse JSON from the response
    try {
      // Extract JSON if wrapped in markdown code blocks
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```([\s\S]*?)```/);
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[1]);
      } else {
        analysisResult = JSON.parse(content);
      }
    } catch (parseError) {
      // If direct parse fails, try to extract JSON object
      const jsonStart = content.indexOf('{');
      const jsonEnd = content.lastIndexOf('}') + 1;
      if (jsonStart !== -1 && jsonEnd > jsonStart) {
        analysisResult = JSON.parse(content.substring(jsonStart, jsonEnd));
      } else {
        throw new Error('Could not parse JSON from DeepSeek response');
      }
    }

    return analysisResult;
  } catch (error) {
    console.error('DeepSeek API Error:', error.response?.data || error.message);
    throw error;
  }
}

// Extract frames from video (simplified - in production, use ffmpeg)
async function extractVideoFrames(videoBuffer) {
  // This is a placeholder - in production, use ffmpeg to extract frames
  // For now, we'll pass the video URL to DeepSeek and let it analyze
  return [];
}

// Main video processing endpoint
app.post('/api/process-video', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    // Upload video to Cloudinary
    console.log('Uploading video to Cloudinary...');
    const videoBuffer = req.file.buffer;
    
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'video',
          folder: 'vehicle-inspections',
          format: 'webm',
        },
        async (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            return reject(error);
          }

          try {
            const videoUrl = result.secure_url;
            const cloudinaryPublicId = result.public_id;

            console.log('Video uploaded to Cloudinary:', videoUrl);

            // Extract frames (simplified)
            const frames = await extractVideoFrames(videoBuffer);

            // Analyze video with DeepSeek
            console.log('Analyzing video with DeepSeek...');
            const analysisResult = await analyzeVideoWithDeepSeek(videoUrl, frames);

            // Create inspection document
            const inspection = new Inspection({
              videoUrl,
              cloudinaryPublicId,
              vehicleInfo: analysisResult.vehicleInfo || {},
              damages: analysisResult.damages || [],
              blueprint: analysisResult.blueprint || {
                exterior: {},
                interior: {}
              },
              summary: analysisResult.summary || {
                totalDamages: 0,
                estimatedRepairCost: 0,
                conditionRating: 5,
                adjustedValue: 0
              },
              analysisResult,
            });

            // Save to MongoDB
            await inspection.save();
            console.log('Inspection saved to MongoDB:', inspection._id);

            // Return formatted response for frontend
            resolve(res.json({
              id: inspection._id,
              videoUrl,
              vehicleInfo: inspection.vehicleInfo,
              damages: inspection.damages,
              blueprint: inspection.blueprint,
              summary: inspection.summary,
              vehicleImageUrl: videoUrl, // Use video thumbnail or first frame
            }));
          } catch (analysisError) {
            console.error('Analysis error:', analysisError);
            reject(analysisError);
          }
        }
      );

      uploadStream.end(videoBuffer);
    });
  } catch (error) {
    console.error('Video processing error:', error);
    res.status(500).json({ 
      error: 'Failed to process video',
      message: error.message 
    });
  }
});

// Get inspection by ID
app.get('/api/inspection/:id', async (req, res) => {
  try {
    const inspection = await Inspection.findById(req.params.id);
    if (!inspection) {
      return res.status(404).json({ error: 'Inspection not found' });
    }
    res.json(inspection);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch inspection' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

