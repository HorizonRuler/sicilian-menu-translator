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
      max_tokens: 2048,
      system: "You are a helpful menu translator assistant. Your primary goal is to identify dishes from menu photos and provide useful information, even when images are rotated, blurry, or low quality. You should make your best attempt to read and interpret menu text rather than declining due to image quality issues. When in doubt, provide your best interpretation with reasonable confidence rather than returning no results. Users prefer helpful attempts over perfect accuracy.",
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
              text: `Carefully analyze this entire menu and identify ALL notable dishes from ANY cuisine visible in the image.

CRITICAL INSTRUCTIONS FOR ROTATED/UNCLEAR IMAGES:
- If the image is rotated 90 degrees, READ IT ANYWAY by mentally rotating it
- Even if text is blurry, unclear, or partially obscured, provide your BEST GUESS
- It's BETTER to provide an uncertain identification than to return no results
- You do NOT need to be 100% certain - 60-70% confidence is ENOUGH
- If you can make out even part of a dish name, include it
- Do NOT give up just because the image is rotated or low quality
- Your goal is to be HELPFUL, not perfect

For EACH dish you find, provide:
1. The dish name (exactly as it appears on the menu, including any non-English characters)
2. A VERY SHORT definition (3-8 words max) highlighting what's notable about the dish

CRITICAL - What to Include/Exclude:
- ONLY include dishes that are culturally specific, regionally notable, or have special preparation
- SKIP basic ingredients or common items everyone knows (e.g., plain "Tuna", "Chicken", "Rice", "Salad")
- When a dish has familiar + unfamiliar words, extract ONLY the unfamiliar term:
  * "Chicken Karaage" → just identify "Karaage"
  * "Pork Belly Yakisoba" → just identify "Yakisoba"
  * "Veggie Tempura" → just identify "Tempura"
- INCLUDE dishes with specific preparation or cultural significance (e.g., "Karaage", "Risotto ai Funghi", "Mapo Tofu")
- If text is in a foreign language, include it in the dish name with translation
- Scan the ENTIRE menu - identify all notable dishes from ANY cuisine

Examples of what to identify:
- Italian: Risotto, Osso Buco, Tiramisu, Carbonara, Margherita Pizza, Bruschetta, Panna Cotta
- Chinese: 麻婆豆腐 (Mapo Tofu), 宫保鸡丁 (Kung Pao Chicken), 小笼包 (Xiaolongbao), 北京烤鸭 (Peking Duck)
- Japanese: Sushi, Ramen, Tempura, Tonkatsu, Miso Soup
- French: Coq au Vin, Bouillabaisse, Ratatouille, Crème Brûlée
- Mexican: Tacos, Enchiladas, Mole, Ceviche
- Indian: Biryani, Tikka Masala, Samosas, Naan
- Thai: Pad Thai, Tom Yum, Green Curry, Mango Sticky Rice
- American: BBQ Ribs, Buffalo Wings, Clam Chowder, Apple Pie

Return your response as a JSON array of objects with this structure:
[
  {
    "name": "Osso Buco",
    "definition": "Milanese braised veal shanks",
    "position": {"x": 25, "y": 30}
  },
  {
    "name": "Risotto ai Funghi",
    "definition": "Creamy rice with mushrooms",
    "position": {"x": 25, "y": 50}
  },
  {
    "name": "宫保鸡丁 (Kung Pao Chicken)",
    "definition": "Sichuan stir-fry with peanuts",
    "position": {"x": 25, "y": 70}
  }
]

CRITICAL - Position Information:
- For EACH dish, estimate where it appears on the menu image
- "position" should contain "x" and "y" as percentages (0-100) from the top-left corner
- x: 0 = far left edge, 50 = horizontal center, 100 = far right edge
- y: 0 = top edge, 50 = vertical center, 100 = bottom edge
- Estimate the position of the dish NAME on the menu (not the description)
- If dishes are in a vertical list, they should have similar x values but different y values
- If dishes are in multiple columns, vary both x and y values accordingly
- Be as accurate as possible - these positions will be used to place clickable markers on the image

Guidelines:
- Definitions must be 3-8 words maximum - be extremely concise
- Only include dishes with cultural significance or special preparation
- Skip basic ingredients everyone knows (plain tuna, rice, chicken, etc.)
- Skip generic items unless specifically prepared (e.g., include "Caesar Salad", skip plain "Salad")
- For foreign language menus, include original text with translation
- Focus on what makes each dish special or notable

If no identifiable dishes are found, return an empty array: []`
            }
          ]
        }
      ]
    });

    console.log('Successfully received response from Claude API');
    console.log('Raw Claude response:', JSON.stringify(message.content[0].text, null, 2));

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
