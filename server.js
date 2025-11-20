import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Anthropic client (server-side, no CORS issues!)
const anthropic = new Anthropic({
  apiKey: process.env.VITE_ANTHROPIC_API_KEY, // API key stays on server
});

// Middleware
app.use(cors()); // Allow requests from frontend
app.use(express.json({ limit: '10mb' })); // Parse JSON bodies (increase limit for images)

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend server is running' });
});

// Main API endpoint - proxies to Anthropic
app.post('/api/analyze', async (req, res) => {
  try {
    const { image, mediaType } = req.body;

    // Validate request
    if (!image || !mediaType) {
      return res.status(400).json({
        error: 'Missing required fields: image and mediaType'
      });
    }

    // Validate media type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(mediaType)) {
      return res.status(400).json({
        error: 'Invalid media type. Must be JPEG, PNG, GIF, or WebP'
      });
    }

    console.log('Processing image analysis request...');

    // Call Anthropic API (server-to-server, no CORS restrictions!)
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: image
              }
            },
            {
              type: 'text',
              text: `Analyze this menu and identify any Sicilian dishes. For each Sicilian dish found, provide:
1. The dish name (exactly as it appears on the menu)
2. A brief explanation of what it is and its significance in Sicilian cuisine

Return your response as a JSON array of objects with this structure:
[
  {
    "name": "Dish Name",
    "definition": "Explanation of the dish"
  }
]

Only include dishes that are actually Sicilian or have strong Sicilian connections. Do not include generic Italian dishes or individual ingredients unless they are presented as a complete Sicilian dish on the menu. Focus on actual menu items, not ingredients listed in descriptions.

If no Sicilian dishes are found, return an empty array: []`
            }
          ]
        }
      ]
    });

    console.log('Successfully received response from Claude API');

    // Return the response to frontend
    res.json({
      success: true,
      response: message
    });

  } catch (error) {
    console.error('Error calling Anthropic API:', error);

    // Handle specific error types
    if (error.status === 401) {
      return res.status(401).json({
        error: 'Invalid API key. Check your .env file.'
      });
    }

    if (error.status === 429) {
      return res.status(429).json({
        error: 'Rate limited. Please try again in a moment.'
      });
    }

    if (error.status >= 500) {
      return res.status(502).json({
        error: 'Anthropic API is experiencing issues. Please try again later.'
      });
    }

    // Generic error
    res.status(500).json({
      error: error.message || 'Failed to process image'
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`📡 API endpoint: http://localhost:${PORT}/api/analyze`);
  console.log(`💚 Health check: http://localhost:${PORT}/health`);
});
