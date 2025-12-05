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
2. A brief, informative explanation that includes:
   - What the dish is and its key ingredients
   - Its cultural/culinary origin and significance
   - Any interesting preparation methods or traditions

IMPORTANT:
- Scan the ENTIRE menu - identify ALL dishes you can see
- Include dishes from ANY cuisine: Italian, Chinese, Japanese, French, Mexican, Indian, Thai, American, etc.
- If text is in a foreign language or script (Chinese characters, Italian, French, etc.), include it in the dish name
- Include both the original name and English translation/transliteration when applicable

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
    "definition": "A Milanese specialty of braised veal shanks cooked with vegetables, white wine, and broth. The marrow in the bone center is considered a delicacy."
  },
  {
    "name": "Risotto ai Funghi",
    "definition": "A creamy Northern Italian rice dish made with arborio rice and mushrooms, slowly cooked with broth, white wine, butter, and Parmesan cheese."
  },
  {
    "name": "宫保鸡丁 (Kung Pao Chicken)",
    "definition": "A Sichuan dish featuring diced chicken stir-fried with peanuts, vegetables, and chili peppers in a savory-sweet sauce."
  }
]

Guidelines:
- Focus on complete dishes/menu items, not individual ingredients
- Skip generic items like "Salad" or "Bread" unless they have a specific preparation (e.g., "Caesar Salad", "Garlic Bread")
- For foreign language menus, include the original text and translation
- Provide cultural context when relevant (e.g., "a traditional Sicilian dish", "popular Cantonese dim sum")
- If you're unsure about a dish's origin, still include it with your best explanation

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
