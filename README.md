1# 🍝 Sicilian Menu Translator

A mobile-first web app that identifies Sicilian culinary terms from menu photos and provides English definitions.

## Features

- 📷 Mobile camera capture or desktop file upload
- 🔍 OCR-powered text extraction using Tesseract.js
- 📖 Dictionary of 15 classic Sicilian dishes
- ✨ Clean, expandable term definitions
- 📱 Responsive design for mobile and desktop

## Quick Start

### Prerequisites
- Node.js 18+ and npm installed
- Modern web browser (Chrome, Safari, Firefox, Edge)

### Installation

1. Extract this ZIP file to a folder
2. Open terminal/command prompt in that folder
3. Install dependencies:
```bash
npm install
```

4. Start development server:
```bash
npm run dev
```

5. Open browser to `http://localhost:5173`

### Testing the App

#### On Mobile:
1. Open the localhost URL on your phone (make sure phone is on same WiFi)
2. Tap "Analyze Menu Photo"
3. Device camera will open
4. Take photo of a Sicilian menu
5. Wait 5-10 seconds for OCR processing
6. Tap matched terms to see definitions

#### On Desktop:
1. Open the localhost URL in your browser
2. Click "Analyze Menu Photo"
3. Select a screenshot or photo of a menu
4. Same processing and results as mobile

### Building for Production

```bash
npm run build
```

This creates an optimized build in the `dist/` folder that you can deploy to any static hosting service (Netlify, Vercel, GitHub Pages, etc.).

## Supported Sicilian Dishes

The MVP includes 15 classic Sicilian terms:
- Arancini
- Caponata
- Sfincione
- Cannoli
- Pasta alla Norma
- Granita
- Cassata
- Involtini
- Panelle
- Sarde a Beccafico
- Pasta con le Sarde
- Caciocavallo
- Pani ca Meusa
- Busiate
- Brioche col Gelato

## Technical Stack

- **Frontend:** Svelte 4
- **Build Tool:** Vite
- **OCR:** Tesseract.js v5
- **Styling:** Vanilla CSS

## Project Structure

```
sicilian-menu-translator/
├── src/
│   ├── App.svelte        # Main component
│   ├── dictionary.js     # Sicilian terms database
│   └── main.js          # App bootstrap
├── index.html           # HTML entry point
├── package.json         # Dependencies
├── vite.config.js       # Vite configuration
├── IMPLEMENTATION.md    # Technical documentation
└── README.md           # This file
```

## How It Works

1. **Image Upload:** User selects image via file input (triggers camera on mobile)
2. **OCR Processing:** Tesseract.js extracts text from image (~5-10 seconds)
3. **Dictionary Matching:** Extracted text is matched against dictionary terms (case-insensitive)
4. **Display Results:** Matched terms shown as expandable cards with definitions

## Known Limitations

- OCR accuracy ~85-90% on clear photos
- Processing time 5-10 seconds on mobile devices
- Requires internet connection to load Tesseract WASM library
- Only supports 15 Sicilian dishes in MVP
- No image quality optimization

## Future Enhancements

- Word-level coordinate overlays on image
- Real-time camera preview
- Browser extension for desktop
- Offline PWA support
- Expanded dictionary (100+ terms)
- Multiple language support
- User-submitted term database

## Troubleshooting

**Camera not opening on mobile:**
- Ensure HTTPS or localhost
- Check browser permissions for camera access
- Try in Safari (Chrome on iOS uses Safari engine)

**OCR not working:**
- Check browser console for errors
- Ensure stable internet connection (to download Tesseract)
- Try a clearer, well-lit photo

**Terms not matching:**
- Ensure menu has Sicilian dishes (not just Italian)
- Check spelling in OCR console log
- Photo may need better lighting/focus

## License

MIT - Free to use and modify

## Support

For technical details and development guide, see [CLAUDE.md](CLAUDE.md)
