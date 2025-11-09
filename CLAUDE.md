# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mobile-first web app that uses OCR to identify Sicilian dishes from menu photos. Built with Svelte + Vite, runs entirely client-side (no backend).

## Development Commands

```bash
npm run dev      # Start dev server on localhost:5173 with host:true for mobile testing
npm run build    # Production build → dist/
npm run preview  # Preview production build
```

**Mobile testing:** After `npm run dev`, use the Network URL (e.g., `http://192.168.1.xxx:5173`) on phones connected to same WiFi.

## Architecture

### Single Component Design

All application logic lives in **[src/App.svelte](src/App.svelte)** (374 lines):
- 7 state variables managed through Svelte reactivity
- 5 functions: `handleImageUpload`, `processImage`, `findMatchingTerms`, `toggleTerm`, `reset`
- Complete UI with conditional rendering (upload → processing → results)
- All styling inline (500 lines CSS)

**Why single component?** MVP scope - no need for component hierarchy yet. If extending beyond 15 dishes or adding features (favorites, history, settings), consider splitting into:
- `ImageUploader.svelte`
- `ResultsList.svelte`
- `TermCard.svelte`
- Shared state store

### State Management

```javascript
let imageFile = null;       // File object from input
let imagePreview = null;    // Base64 string for preview
let isProcessing = false;   // Loading state during OCR
let ocrText = '';          // Raw OCR output (logged to console)
let matchedTerms = [];     // Filtered dictionary entries
let expandedTerms = {};    // {termName: boolean} for UI toggles
let error = null;          // Error message string
```

All state is local to App.svelte. Svelte's reactivity handles UI updates automatically when these variables change.

### OCR Processing Flow

1. **File input** → `handleImageUpload(event)` triggered
2. **FileReader** converts File to base64 → sets `imagePreview`
   - FileReader.readAsDataURL() creates base64 string (e.g., `data:image/jpeg;base64,...`)
   - Used directly in `<img src={imagePreview}>` - no server upload needed
   - Enables instant preview while OCR processes
3. **Tesseract.js** worker initialized with 'eng' language
   - First run downloads 4MB WASM binary (cached after)
   - Runs in Web Worker (separate thread - prevents UI freezing)
   - `worker.recognize(file)` returns `{ data: { text } }`
   - Takes 5-10 seconds on mobile, 2-3 seconds on desktop, ~85-90% accuracy
4. **Text matching** → `findMatchingTerms(text)` filters dictionary
5. **Cleanup** → `worker.terminate()` frees memory

#### How Tesseract.js Works Internally

- **WASM (WebAssembly):** C++ OCR engine compiled to run at near-native speed in browser
- **Web Workers:** OCR runs in separate thread - can process multiple images without blocking UI
- **Language data:** Downloads `eng.traineddata.gz` (~4MB), cached after first load
- **Recognition process:** Image → grayscale → edge detection → character segmentation → pattern matching
- Returns text + confidence scores per word (we ignore confidence in MVP)

**Critical: Substring matching, not exact word matching**
```javascript
normalizedText.includes(term.name.toLowerCase())
```
This is intentional - OCR often captures surrounding text. More forgiving than word boundary matching.

### Dictionary Structure

**[src/dictionary.js](src/dictionary.js)** exports array of objects:
```javascript
{
  name: "Arancini",
  definition: "Deep-fried rice balls...",
  alternates: ["arancino", "arancine"]  // Plurals, misspellings, OCR variations
}
```

**To add new dishes:**
1. Add object to array in dictionary.js
2. Follow alphabetical order (optional but cleaner)
3. Include `alternates` for common variations - OCR often gets plurals/diacritics wrong
4. Test with actual menu photos to verify matching works

**Matching logic deduplicates:** Uses `Set` to ensure each term appears once even if multiple alternates match.

### Svelte Reactivity Quirk

The `toggleTerm()` function has an important pattern:

```javascript
function toggleTerm(termName) {
  expandedTerms[termName] = !expandedTerms[termName];
  expandedTerms = expandedTerms;  // ← Critical reassignment!
}
```

**Why the self-reassignment?**
- Svelte only detects changes to the variable itself, not object properties
- Modifying `expandedTerms[termName]` doesn't trigger reactivity
- Reassigning `expandedTerms = expandedTerms` forces Svelte to re-render
- Alternative: Use `expandedTerms = {...expandedTerms}` (spread operator)

### Mobile Camera Integration

```html
<input type="file" accept="image/*" capture="environment">
```

- `capture="environment"` opens rear camera on mobile
- Desktop ignores attribute (file picker instead)
- No real-time camera preview - user takes photo, then uploads
- This is simpler than `getUserMedia()` and works across browsers

### Vite Configuration

**[vite.config.js](vite.config.js)** has `server: { host: true }`:
- Exposes dev server to local network
- Critical for mobile testing - allows phone access via Network URL
- Port 5173 by default

## Key Design Decisions

**Client-side only:** Tesseract.js runs in browser (no server costs, privacy-friendly)

**Single file upload:** Not continuous camera feed (simpler, better OCR accuracy)

**Substring matching:** OCR text is messy - `includes()` more forgiving than exact matches

**15 curated dishes:** Quality over quantity - these are the most common Sicilian menu items

**No image optimization:** Letting browser/Tesseract handle it (could compress before OCR to speed up)

**Why Svelte over React?**
- **Bundle size:** Svelte ~3KB (compiled away) vs React ~40KB (runtime library)
- **Syntax:** Svelte `let count = 0; count++` vs React `const [count, setCount] = useState(0); setCount(count + 1)`
- **Performance:** Svelte compiles to vanilla JS (no virtual DOM) vs React runtime reconciliation
- **Perfect for MVP:** Smaller, simpler, faster for this use case

## Extending the Dictionary

Current 15 dishes are classics, but menus vary by region:

- **Trapani region:** Add `cous cous trapanese`, `pesto trapanese`
- **Catania region:** Add `carne di cavallo`, `cipollina`
- **Palermo region:** Add `panino con panelle`, `stigghiola`

Alternates are critical - OCR mistakes:
- Accents: `caciocavallo` vs `cacìocavallo`
- Plurals: `cannoli` vs `cannolo`
- Spaces: `pasta alla norma` vs `pastaallanorma`
- Case variations handled by `.toLowerCase()`

## Testing OCR Accuracy

Console logs OCR output: `console.log('OCR Text extracted:', text)`

To debug matching issues:
1. Check console for raw OCR text
2. Compare against dictionary names/alternates
3. Add missing variations to `alternates` array
4. Consider lighting/focus if OCR text is garbled

Typical OCR accuracy:
- Clear, well-lit photos: ~90%
- Low light: ~70%
- Cursive/decorative fonts: ~60%

## Browser Compatibility

**Minimum versions:**
- Chrome/Edge 90+
- Safari 14+ (iOS 14+)
- Firefox 88+
- Chrome Android 90+

**Mobile camera requirements:**
- HTTPS or localhost (camera API security requirement)
- Browser permissions for camera access granted
- iOS: Safari or Chrome (uses Safari engine)

## Performance Considerations

- **Image preview:** Limited to 800px width in CSS (reduces processing time)
- **Dictionary size:** Keep under 50 terms for fast matching
- **First load:** 4MB WASM download (one-time cost)
- **Processing:** 5-10 seconds on mobile, 2-3 seconds on desktop
- **Memory:** Tesseract worker terminated after each image to free resources

## Testing Strategy

### Manual Testing Checklist

**Mobile (iOS Safari):**
- [ ] Camera opens (not file picker)
- [ ] Photo captures clearly
- [ ] OCR completes without errors
- [ ] Terms display correctly
- [ ] Expand/collapse animations smooth
- [ ] "Analyze Another Photo" resets properly

**Mobile (Android Chrome):**
- [ ] Camera permission flow works
- [ ] Same functionality as iOS

**Desktop:**
- [ ] File picker opens
- [ ] Accepts PNG/JPG files
- [ ] OCR processes uploaded images
- [ ] Responsive design looks good

**Edge Cases:**
- [ ] No matches message displays
- [ ] Error message shows on OCR failure
- [ ] Duplicate terms only show once
- [ ] Long definitions don't break layout

### Test Images

Create test images with:
- Clear, well-lit menu photos
- Different fonts (serif, sans-serif, decorative)
- Various lighting conditions
- Angled/perspective shots
- Multiple dishes per image

## Known Limitations

- **No word boundaries:** `"granita"` matches `"granitatrap"` - acceptable tradeoff
- **English OCR model:** Using 'eng' for Italian text (good enough for MVP)
- **No offline support:** Requires internet to download Tesseract WASM
- **No image preprocessing:** Large images may slow processing
- **Single language output:** Only English definitions (could add multilingual support)
- **OCR accuracy:** ~85-90% on clear photos, degrades with poor lighting/fancy fonts

## Common Questions

**Q: Can I expand the dictionary?**
A: Yes! Add objects to `src/dictionary.js` array. Include `alternates` for plurals/variations.

**Q: Why not use Google Vision API?**
A: Tesseract is free, private (no data sent to servers), works offline after first load.

**Q: How do I improve OCR accuracy?**
A: Change `createWorker('eng')` to `createWorker('ita')` for Italian language model. Or add more alternates to handle common OCR mistakes.

**Q: Can this work offline?**
A: Mostly - after first load, Tesseract is cached. But initial load requires internet.

**Q: Why is processing so slow?**
A: JavaScript OCR in-browser is slower than native code. Could use cloud API (Google Vision ~1 second) but loses privacy/offline benefits.

**Q: How do I deploy this?**
A: Run `npm run build`, then upload `dist/` to any static host (Vercel, Netlify, GitHub Pages, etc.).
