import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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

    // Call Anthropic API
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-5',
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
              text: `Carefully analyze this entire menu and identify ALL notable dishes AND special ingredients from ANY cuisine visible in the image.

CRITICAL INSTRUCTIONS FOR ROTATED/UNCLEAR IMAGES:
- If the image is rotated 90 degrees, READ IT ANYWAY by mentally rotating it
- Even if text is blurry, unclear, or partially obscured, provide your BEST GUESS
- It's BETTER to provide an uncertain identification than to return no results
- You do NOT need to be 100% certain - 60-70% confidence is ENOUGH
- If you can make out even part of a dish name, include it
- Do NOT give up just because the image is rotated or low quality
- Your goal is to be HELPFUL, not perfect

For EACH dish or special ingredient you find, provide:
1. The name (exactly as it appears on the menu, including any non-English characters)
2. A specific, sensory definition describing what it actually IS (texture, ingredients, taste) - be vivid but concise (10-15 words)

CRITICAL - What to Include/Exclude:

FOR MENUS IN ENGLISH:
- INCLUDE dishes that are culturally specific or have special preparation methods
- SKIP common well-known dishes like "Caesar Salad", "Margherita Pizza", "Spaghetti Carbonara"
- SKIP generic items like "Grilled Chicken", "Steamed Rice", "Garden Salad"
- When a dish has familiar + unfamiliar words, extract ONLY the unfamiliar term:
  * "Chicken Karaage" → just identify "Karaage"
  * "Pork Belly Yakisoba" → just identify "Yakisoba"

FOR MENUS IN FOREIGN LANGUAGES (Italian, French, Japanese, Chinese, etc.):
- BE GENEROUS - include ALL dishes written in the foreign language
- Include the original text with English translation in parentheses
- Even common dishes like "Risotto" or "Tiramisu" should be included when written in Italian
- The goal is to help users understand what they're ordering

ALWAYS INCLUDE:
- Special/notable ingredients: Furikake, Uni, Truffle, Nduja, Burrata, Bottarga, Ikura, A5 Wagyu
- Dishes with unfamiliar preparation methods or regional specialties
- Any term a typical American diner might not recognize

Examples of what to identify:
- Italian: Risotto, Osso Buco, Tiramisu, Carbonara, Margherita Pizza, Bruschetta, Panna Cotta, Burrata, Nduja, Bottarga
- Chinese: 麻婆豆腐 (Mapo Tofu), 宫保鸡丁 (Kung Pao Chicken), 小笼包 (Xiaolongbao), 北京烤鸭 (Peking Duck)
- Japanese: Sushi, Ramen, Tempura, Tonkatsu, Miso Soup, Furikake, Uni, Ikura, Shiso
- French: Coq au Vin, Bouillabaisse, Ratatouille, Crème Brûlée
- Mexican: Tacos, Enchiladas, Mole, Ceviche
- Indian: Biryani, Tikka Masala, Samosas, Naan
- Thai: Pad Thai, Tom Yum, Green Curry, Mango Sticky Rice
- American: BBQ Ribs, Buffalo Wings, Clam Chowder, Apple Pie
- Special Ingredients: Mazara Shrimp, Furikake, Uni (Sea Urchin), Truffle, Burrata, Nduja, Bottarga, Ikura, Shiso, A5 Wagyu

Return your response as a JSON array of objects with this structure:
[
  {"name": "Mille-Feuille", "definition": "Layers of crisp, flaky puff pastry with silky vanilla pastry cream"},
  {"name": "Osso Buco", "definition": "Fork-tender braised veal shanks in white wine with gremolata"},
  {"name": "Nduja", "definition": "Fiery, spreadable Calabrian pork salami with smoky chili heat"},
  {"name": "Uni", "definition": "Creamy, briny sea urchin roe with a delicate ocean sweetness"}
]

Guidelines:
- Definitions should be SPECIFIC and SENSORY (10-15 words) - describe texture, taste, key ingredients
- For foreign language menus: be generous, include most dishes with original text + translation
- For English menus: be selective, focus on unfamiliar or notable items
- Focus on what makes each dish special or notable

If no identifiable dishes are found, return an empty array: []`
            }
          ]
        }
      ]
    });

    console.log('Successfully received response from Claude API');

    // Parse dishes and fetch images
    const responseText = message.content[0].text;
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);

    if (jsonMatch) {
      try {
        const dishes = JSON.parse(jsonMatch[0]);

        // Fetch images for each dish from Wikipedia
        console.log(`Fetching images for ${dishes.length} dishes...`);

        // Helper function to search Wikipedia and get image
        async function getWikipediaImage(dishName) {
          // Try multiple search strategies
          const searchTerms = [
            dishName,
            dishName + ' food',
            dishName + ' dish',
            dishName.replace(/[()]/g, '').trim()
          ];

          for (const term of searchTerms) {
            try {
              // Use Wikipedia's search API to find the correct page title
              const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(term)}&format=json&origin=*&srlimit=3`;
              const searchResponse = await fetch(searchUrl);

              if (!searchResponse.ok) continue;
              const searchData = await searchResponse.json();

              if (!searchData.query?.search?.length) continue;

              // Try each search result
              for (const result of searchData.query.search) {
                const pageTitle = result.title;
                const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`;
                const summaryResponse = await fetch(summaryUrl);

                if (summaryResponse.ok) {
                  const summaryData = await summaryResponse.json();
                  if (summaryData.thumbnail?.source) {
                    return summaryData.thumbnail.source;
                  }
                }
              }
            } catch (e) {
              // Continue to next search term
            }
          }
          return null;
        }

        const dishesWithImages = await Promise.all(
          dishes.map(async (dish) => {
            try {
              const imageUrl = await getWikipediaImage(dish.name);
              if (imageUrl) {
                console.log(`✓ Found image for ${dish.name}`);
                return { ...dish, imageUrl };
              }
              console.log(`✗ No image for ${dish.name}`);
            } catch (imgError) {
              console.log(`✗ Error fetching image for ${dish.name}:`, imgError.message);
            }
            return dish;
          })
        );
        console.log('Image fetching complete');

        // Replace parsed dishes in the response
        message.content[0].text = JSON.stringify(dishesWithImages);
      } catch (parseError) {
        console.log('Could not parse dishes for image fetching');
      }
    }

    // Return the response
    res.json({
      success: true,
      response: message
    });

  } catch (error) {
    console.error('Error calling Anthropic API:', error);

    // Handle specific error types
    if (error.status === 401) {
      return res.status(401).json({
        error: 'Invalid API key. Check your environment variables.'
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
}
