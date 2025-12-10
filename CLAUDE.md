# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mobile-first web app that uses **Claude Vision API** to identify and explain dishes from restaurant menus. Upload a menu photo from any cuisine, and interactive markers appear on the image showing dish locations with definitions on click. Built with Svelte + Vite frontend and Express backend proxy.

## Development Commands

```bash
npm run dev:all   # Start both servers (backend on :3000, frontend on :5173)
npm run server    # Backend only (Express server)
npm run dev       # Frontend only (Vite dev server)
npm run build     # Production build → dist/
npm run preview   # Preview production build
```

**Mobile testing:** After `npm run dev:all`, use the Network URL (e.g., `http://192.168.1.xxx:5173`) on phones connected to same WiFi.

**Important:** Always use `npm run dev:all` to run both servers concurrently. The frontend depends on the backend proxy for API calls.

## Architecture

### Frontend-Backend Split

**Frontend (Svelte + Vite):**
- Single-page app running on port 5173
- Handles image upload, preview, and interactive UI
- Sends base64-encoded images to backend via `/api/analyze`
- Renders numbered markers at dish positions with popup definitions

**Backend (Express + Node):**
- Proxy server running on port 3000
- Forwards image analysis requests to Anthropic API
- Avoids CORS restrictions (browsers block direct API calls to Anthropic)
- Returns Claude's response with dish names, definitions, and positions

**Why backend proxy?**
- **CORS (Cross-Origin Resource Sharing):** Browsers block requests from `localhost:5173` to `api.anthropic.com` due to Same-Origin Policy
- **Security:** API key stays on server (never exposed to browser)
- **Simplicity:** Express middleware is simpler than SvelteKit SSR or serverless functions for this use case

### Single Component Design

All frontend logic lives in **[src/App.svelte](src/App.svelte)** (~632 lines):

**State Variables:**
```javascript
let imageFile = null;       // File object from input
let imagePreview = null;    // Base64 string for <img> preview
let isProcessing = false;   // Loading state during API call
let matchedTerms = [];      // Array of {name, definition, position: {x, y}}
let selectedTerm = null;    // Currently open popup (null when closed)
let error = null;           // Error message string
```

**Key Functions:**
- `handleImageUpload(event)` - File input handler, converts to base64 for preview
- `processImage(file)` - Sends image to `/api/analyze`, validates response
- `selectTerm(term)` - Toggles popup (open if closed, close if already open)
- `reset()` - Clears all state, returns to upload screen
- `fileToBase64(file)` - Helper converting File to base64 data URL

**UI Structure:**
- Initial state: Upload button with camera capture on mobile
- Processing state: Image preview + spinner overlay
- Results state: Image + numbered markers + popup on click
- Error state: Error message overlay with retry button

### Claude Vision API Integration

**Flow:** Frontend → Express Backend → Anthropic API → Backend → Frontend

**[server.js](server.js)** handles the API call (lines 27-183):

```javascript
app.post('/api/analyze', async (req, res) => {
  const { image, mediaType } = req.body; // base64 string, MIME type

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: "You are a helpful menu translator assistant...",
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
        { type: 'text', text: `...prompt with instructions...` }
      ]
    }]
  });

  res.json({ success: true, response: message });
});
```

**Critical Prompt Engineering:**

1. **Handling Rotated/Unclear Images** (lines 69-76):
   ```
   CRITICAL INSTRUCTIONS FOR ROTATED/UNCLEAR IMAGES:
   - If the image is rotated 90 degrees, READ IT ANYWAY by mentally rotating it
   - Even if text is blurry, unclear, or partially obscured, provide your BEST GUESS
   - It's BETTER to provide an uncertain identification than to return no results
   - You do NOT need to be 100% certain - 60-70% confidence is ENOUGH
   ```
   **Why:** Initial testing showed Claude refusing to process rotated images. Aggressive prompt instructions override this default behavior.

2. **Selective Dish Identification** (lines 82-91):
   ```
   - ONLY include dishes that are culturally specific, regionally notable, or have special preparation
   - SKIP basic ingredients or common items everyone knows (e.g., plain "Tuna", "Chicken", "Rice")
   - When a dish has familiar + unfamiliar words, extract ONLY the unfamiliar term:
     * "Chicken Karaage" → just identify "Karaage"
     * "Pork Belly Yakisoba" → just identify "Yakisoba"
   ```
   **Why:** Users want to learn about unfamiliar dishes, not basic ingredients. This reduces noise and focuses on educational value.

3. **Concise Definitions** (line 80):
   ```
   A VERY SHORT definition (3-8 words max) highlighting what's notable about the dish
   ```
   **Why:** Popups should be scannable. "Milanese braised veal shanks" is better than a paragraph.

4. **Position Data** (lines 122-130):
   ```
   "position" should contain "x" and "y" as percentages (0-100) from the top-left corner
   - x: 0 = far left edge, 50 = horizontal center, 100 = far right edge
   - y: 0 = top edge, 50 = vertical center, 100 = bottom edge
   - Estimate the position of the dish NAME on the menu
   ```
   **Why:** Frontend renders markers at these coordinates. Accuracy varies with menu layout, but Claude's spatial understanding is surprisingly good.

### Interactive Marker System

**Rendering Logic** ([src/App.svelte](src/App.svelte) lines 185-207):

```svelte
{#each matchedTerms as term, index}
  <button
    class="marker"
    class:active={selectedTerm === term}
    style="left: {term.position.x}%; top: {term.position.y}%;"
    on:click={() => selectTerm(term)}
  >
    {index + 1}
  </button>
{/each}

{#if selectedTerm}
  <div
    class="popup"
    style="left: {selectedTerm.position.x}%; top: {selectedTerm.position.y}%;"
  >
    <button class="popup-close" on:click={() => selectedTerm = null}>×</button>
    <h3>{selectedTerm.name}</h3>
    <p>{selectedTerm.definition}</p>
  </div>
{/if}
```

**CSS Positioning:**
- `.marker` uses `position: absolute` with `transform: translate(-50%, -50%)` to center on coordinates
- `.popup` uses `transform: translate(-50%, calc(-100% - 40px))` to appear above the marker
- `.image-container` uses `overflow: visible` to allow popups to extend beyond image bounds

**Why numbered markers instead of inline text?**
- Cleaner visual design (doesn't clutter the menu image)
- Works with any menu layout (vertical lists, multi-column, etc.)
- Popups can show full definitions without overlapping adjacent text

### Svelte Reactivity Patterns

**State Toggle Pattern:**
```javascript
function selectTerm(term) {
  selectedTerm = selectedTerm === term ? null : term;
}
```
- Clicking same marker twice closes popup (toggle behavior)
- Clicking different marker switches to new popup
- Simple assignment triggers Svelte reactivity (no need for setState or forceUpdate)

**Array Validation:**
```javascript
if (Array.isArray(parsed) && parsed.every(item =>
  item.name && item.definition && item.position &&
  typeof item.position.x === 'number' && typeof item.position.y === 'number'
)) {
  matchedTerms = parsed;
} else {
  matchedTerms = [];
}
```
- Validates structure before rendering to prevent runtime errors
- Missing position data shows "No dishes identified" instead of broken UI

### Mobile Camera Integration

```html
<input type="file" accept="image/*" capture="environment">
```

- `capture="environment"` opens rear camera on mobile
- Desktop ignores attribute (file picker instead)
- No real-time camera preview - user takes photo, then uploads
- Simpler than `getUserMedia()` and works across all browsers

### Vite Configuration

**[vite.config.js](vite.config.js)** includes two critical settings:

```javascript
server: {
  port: 5173,
  host: true,  // Expose to local network for mobile testing
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: true
    }
  }
}
```

- `host: true` - Allows phone access via Network URL
- `proxy` - Forwards `/api/*` requests to Express backend, avoiding CORS preflight

## Key Design Decisions

**Backend proxy over direct API calls:**
- Anthropic blocks browser requests via CORS
- Server-to-server calls bypass Same-Origin Policy
- API key never exposed to client

**Claude Vision API over OCR (Tesseract.js):**
- No dictionary maintenance (Claude identifies dishes directly)
- Better accuracy with handwritten/stylized fonts
- Handles multiple cuisines without training data
- ~3-5 seconds processing (faster than client-side OCR)

**Single file upload over continuous camera:**
- Simpler UX (take photo, then analyze)
- Better accuracy (user can review photo quality before processing)
- Reduces API costs (no streaming video frames)

**Position-based markers over side-by-side layout:**
- More intuitive UX (definitions appear where dishes are located)
- Works with any menu layout (vertical, grid, multi-column)
- Cleaner visual design (no splitting screen space)

**Svelte over React:**
- **Bundle size:** Svelte ~3KB (compiled away) vs React ~40KB (runtime library)
- **Syntax:** Simpler state management (`let count = 0; count++` vs `useState`)
- **Performance:** Compiles to vanilla JS (no virtual DOM overhead)

**Universal cuisine support:**
- No hardcoded dictionary - Claude identifies dishes directly from its training data
- Prompt includes examples from 8+ cuisines (Italian, Chinese, Japanese, French, Mexican, Indian, Thai, American)
- Claude's training data covers global culinary terms

## Elegant UI Design

**Design Philosophy (Thomas Keller / Fine Dining Aesthetic):**

- **Typography:** Georgia serif for warmth and sophistication
- **Colors:** Minimal palette - black (#1a1a1a), warm white (#fafaf8), subtle grays
- **Layout:** Generous whitespace, clean lines, no visual clutter
- **Interactions:** Subtle hover states (scale transforms, color inversions)
- **Accessibility:** High contrast, semantic HTML, keyboard-friendly

**Critical CSS Patterns:**

**Circular Markers:**
```css
.marker {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #1a1a1a;
  color: #fafaf8;
  border: 2px solid #fafaf8;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.marker:hover {
  transform: translate(-50%, -50%) scale(1.1);
}

.marker.active {
  background: #fafaf8;
  color: #1a1a1a;
  border-color: #1a1a1a;
}
```

**Popup Cards:**
```css
.popup {
  background: #ffffff;
  border: 1px solid #d4d4d0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  animation: popupAppear 0.2s ease-out;
}

.popup::after {
  /* Triangle pointer pointing to marker */
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 6px solid #ffffff;
}
```

## Universal Cuisine Support

**Supported Cuisines (examples in prompt, lines 93-101):**
- **Italian:** Risotto, Osso Buco, Tiramisu, Carbonara
- **Chinese:** 麻婆豆腐 (Mapo Tofu), 宫保鸡丁 (Kung Pao Chicken), 小笼包 (Xiaolongbao)
- **Japanese:** Sushi, Ramen, Tempura, Tonkatsu
- **French:** Coq au Vin, Bouillabaisse, Ratatouille
- **Mexican:** Tacos, Enchiladas, Mole, Ceviche
- **Indian:** Biryani, Tikka Masala, Samosas
- **Thai:** Pad Thai, Tom Yum, Green Curry
- **American:** BBQ Ribs, Buffalo Wings, Clam Chowder

**How it works:**
- No hardcoded dictionary - Claude uses its training data to identify any cuisine
- Prompt provides examples to guide output format, but doesn't limit scope
- Users can upload menus from any country/region

## Development Workflow

### Starting the App

**Always use `npm run dev:all`** to run both servers:

```bash
npm run dev:all
```

This starts:
1. Express backend on `http://localhost:3000`
2. Vite frontend on `http://localhost:5173`

**Common mistake:** Running `npm run dev` alone won't work - frontend needs backend for API calls.

### Debugging Backend Issues

**If dishes aren't appearing:**

1. **Check backend logs** - Server prints Claude's raw response:
   ```
   Raw Claude response: [{"name": "Osso Buco", ...}]
   ```

2. **Verify server is running** - Look for:
   ```
   🚀 Backend server running on http://localhost:3000
   ```

3. **Kill old server processes** - If code changes don't apply:
   ```bash
   lsof -ti:3000 | xargs kill -9
   npm run dev:all
   ```

### Testing Rotated Images

**Expected behavior:**
- Claude should read rotated images (90°, 180°, 270°)
- System prompt instructs Claude to "READ IT ANYWAY by mentally rotating it"
- 60-70% confidence threshold (not 100% certain)

**If Claude returns empty array `[]`:**
1. Check console for raw response - does it mention image quality?
2. Try enhancing system prompt with more aggressive instructions
3. Test with different image (some menus are genuinely illegible)

### Modifying the Prompt

**Key sections in [server.js](server.js):**

- **System prompt (line 52):** General behavior (helpful, permissive with image quality)
- **User prompt (lines 67-140):** Detailed instructions for dish identification
- **Position guidance (lines 122-130):** How to estimate x/y coordinates

**Testing prompt changes:**
1. Edit server.js
2. Kill server: `lsof -ti:3000 | xargs kill -9`
3. Restart: `npm run dev:all`
4. Upload test image and check console logs

## Browser Compatibility

**Minimum versions:**
- Chrome/Edge 90+
- Safari 14+ (iOS 14+)
- Firefox 88+
- Chrome Android 90+

**Mobile camera requirements:**
- HTTPS or localhost (camera API security requirement)
- Browser permissions for camera access granted
- iOS: Safari or Chrome (both use Safari engine)

## Performance Considerations

- **API latency:** 3-5 seconds for Claude to analyze image (varies with menu complexity)
- **Image size:** No preprocessing - large images take longer to upload and process
- **Max tokens:** 2048 limit in API call (sufficient for ~15-20 dishes)
- **Network:** Requires stable internet for API calls (no offline support)

**Optimization opportunities:**
- Compress images before sending to API (reduce upload time)
- Cache responses for identical images (reduce API costs)
- Stream responses instead of waiting for full completion (reduce perceived latency)

## Testing Strategy

### Manual Testing Checklist

**Mobile (iOS Safari):**
- [ ] Camera opens (not file picker)
- [ ] Photo captures clearly
- [ ] API call completes without errors
- [ ] Markers appear at correct positions
- [ ] Popups display on click with readable text
- [ ] Popups don't get clipped by container edges
- [ ] "Analyze Another Photo" resets properly

**Mobile (Android Chrome):**
- [ ] Camera permission flow works
- [ ] Same functionality as iOS

**Desktop:**
- [ ] File picker opens
- [ ] Accepts JPEG/PNG/GIF/WebP files
- [ ] Images display correctly in preview
- [ ] Markers are clickable and positioned accurately
- [ ] Responsive design adapts to screen size

**Edge Cases:**
- [ ] No matches message displays when no dishes found
- [ ] Error message shows on API failure (invalid key, rate limit, network error)
- [ ] Rotated images (90°, 180°, 270°) are processed correctly
- [ ] Low-quality/blurry images show best-guess results (not empty array)
- [ ] Very long dish names don't break popup layout
- [ ] Menus with 15+ dishes render all markers without overlap

### Test Images

Use menus with:
- **Clear, well-lit photos** (baseline - should work perfectly)
- **Rotated 90 degrees** (tests prompt engineering effectiveness)
- **Low light / blurry** (tests confidence threshold guidance)
- **Multiple cuisines** (Italian, Chinese, Japanese, etc.)
- **Different layouts** (vertical list, grid, multi-column)
- **Handwritten text** (tests Claude's OCR capabilities)
- **Stylized fonts** (cursive, decorative serif, etc.)

## Known Limitations

- **Position accuracy:** Claude estimates dish locations - accuracy varies with menu layout (typically within 5-10% of actual position)
- **Rotated images:** Works but less accurate than upright images
- **API costs:** Each analysis costs ~$0.01-0.02 (based on Claude Sonnet 4 pricing)
- **No offline support:** Requires internet for API calls
- **Language:** Definitions always in English (even for foreign menus)
- **No caching:** Same image analyzed twice costs twice (could add caching layer)
- **Rate limits:** Anthropic API has rate limits (60 requests/minute on free tier)

## Common Questions

**Q: Why not use Claude directly from the browser?**
A: Anthropic blocks browser requests via CORS for security. The Express backend acts as a proxy to bypass this restriction.

**Q: Can I use Claude Opus instead of Sonnet?**
A: Yes! Change `model: 'claude-sonnet-4-20250514'` to `'claude-opus-4-5-20251101'` in [server.js](server.js) line 50. Note: Opus is more expensive but may have better position accuracy.

**Q: How do I improve position accuracy?**
A: Enhance the position guidance in the prompt (lines 122-130 in server.js). You could also post-process coordinates in the frontend to adjust based on observed patterns.

**Q: Can this work offline?**
A: No - requires API calls to Anthropic. You could switch back to Tesseract.js for offline OCR, but would lose universal cuisine support.

**Q: Why are some basic ingredients identified?**
A: Claude sometimes includes items despite prompt instructions. Add more examples to the exclusion list in the prompt (lines 82-91).

**Q: How do I deploy this?**
A: Frontend and backend need separate deployments:
- Frontend: `npm run build`, upload `dist/` to Vercel/Netlify
- Backend: Deploy `server.js` to Heroku/Railway/Fly.io
- Update frontend API calls to use production backend URL

**Q: Can I add more cuisines?**
A: Claude already supports all cuisines in its training data. Add examples to the prompt (lines 93-101) to guide output format, but it's not required.

## Environment Setup

**Required environment variables (`.env` file):**

```bash
VITE_ANTHROPIC_API_KEY=your_api_key_here
PORT=3000  # Optional, defaults to 3000
```

**Getting an API key:**
1. Visit [console.anthropic.com](https://console.anthropic.com/)
2. Create account or sign in
3. Navigate to API Keys section
4. Generate new key (starts with `sk-ant-`)
5. Copy to `.env` file (never commit this file!)

**Cost estimates:**
- Claude Sonnet 4: ~$0.015 per image (varies with menu complexity)
- Free tier: $5 credit (≈330 images)
- Paid tier: Pay as you go

## Git Workflow

**Before committing prompt changes:**

Always restart the server to ensure latest code is running:

```bash
lsof -ti:3000 | xargs kill -9
npm run dev:all
```

**Common mistake:** Committing changes without testing updated code. Backend doesn't hot-reload like frontend.

## Future Enhancements

- [ ] **Position refinement:** User feedback to correct marker positions
- [ ] **Caching layer:** Store responses for identical images (reduce API costs)
- [ ] **Image preprocessing:** Compress/optimize before API call (reduce latency)
- [ ] **Multi-language definitions:** Support Spanish, French, Italian, Chinese outputs
- [ ] **Favorites:** Save dishes to local storage for future reference
- [ ] **Share mode:** Generate shareable link with annotated menu
- [ ] **Batch processing:** Upload multiple menu pages at once
- [ ] **Voice mode:** Text-to-speech for definitions (accessibility)
- [ ] **Dark mode:** Toggle between light/dark theme
- [ ] **Export:** Download annotated menu as PDF or image

## Troubleshooting

**No dishes identified:**
- Restart servers: `npm run dev:all`
- Check backend logs for Claude's raw response
- Ensure image shows dish names clearly (not just photos of food)
- Try rotating image if it's sideways

**Markers in wrong positions:**
- Claude estimates positions - accuracy varies
- Works best with clear, well-structured menus
- Consider post-processing coordinates if patterns emerge

**API errors:**
- Verify API key in `.env` file (no quotes, no spaces)
- Check Anthropic dashboard for rate limits / account status
- Ensure stable internet connection
- Check browser console for network errors

**Popups getting clipped:**
- Verify `.image-container` has `overflow: visible` ([src/App.svelte](src/App.svelte) line 330)
- Check that popup `transform` positions it above marker (line 445)

**Backend not reflecting code changes:**
- Kill old server: `lsof -ti:3000 | xargs kill -9`
- Restart: `npm run dev:all`
- Verify server logs show "Backend server running"
