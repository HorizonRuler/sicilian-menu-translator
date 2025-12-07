# Menu Lexicon

An elegant menu translator that identifies and explains culinary terms from any cuisine using Claude Vision AI. Upload a menu photo and see interactive markers positioned at each dish, with concise definitions on click.

## Features

- 🎯 **Interactive Annotations** - Clickable numbered markers positioned directly on dishes
- 🌍 **Universal Cuisine Support** - Italian, Chinese, Japanese, French, Mexican, Thai, and more
- 🤖 **Claude Vision AI** - Powered by Anthropic's Claude Sonnet 4 for accurate dish identification
- ✨ **Elegant Design** - Minimalist fine-dining aesthetic inspired by high-end restaurant menus
- 📱 **Mobile-First** - Responsive design with camera capture on mobile devices
- 💬 **Concise Definitions** - 3-8 word explanations highlighting what makes each dish special

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- Anthropic API key ([get one here](https://console.anthropic.com/))

### Installation

1. Clone and install dependencies:
```bash
git clone <repository-url>
cd menu-lexicon
npm install
```

2. Create `.env` file with your API key:
```bash
cp .env.example .env
# Edit .env and add: VITE_ANTHROPIC_API_KEY=your_key_here
```

3. Start both frontend and backend servers:
```bash
npm run dev:all
```

4. Open [http://localhost:5173](http://localhost:5173)

## How It Works

1. **Upload** - Click "Analyze Menu Photo" and select/capture a menu image
2. **Analysis** - Claude Vision AI identifies notable dishes and estimates their positions
3. **Interact** - Numbered markers appear on the image; click any marker to see the dish definition
4. **Learn** - Brief explanations highlight cultural significance and key characteristics

## Architecture

**Frontend (Svelte + Vite)**
- Single-page app with Svelte reactivity
- Interactive image overlay with positioned markers
- Elegant serif typography and minimalist design
- Mobile camera integration via HTML5 `capture` attribute

**Backend (Express + Node)**
- Proxies requests to Anthropic API (avoids CORS)
- Claude Sonnet 4 with vision capabilities
- Processes base64-encoded images
- Returns dishes with names, definitions, and position coordinates

**API Integration**
- Frontend → Express Backend (`/api/analyze`)
- Backend → Anthropic Messages API
- Claude analyzes image and returns JSON with position data

## Project Structure

```
menu-lexicon/
├── src/
│   ├── App.svelte       # Main UI component with markers & popups
│   └── main.js          # App bootstrap
├── server.js            # Express backend with Claude API integration
├── vite.config.js       # Dev server with API proxy
├── package.json         # Dependencies and scripts
├── .env.example         # API key template
├── CLAUDE.md            # Development guide
└── README.md            # This file
```

## Key Technologies

- **Frontend:** Svelte 4, Vite 5
- **Backend:** Express 4, Node.js
- **AI:** Anthropic Claude Sonnet 4 (Vision API)
- **Styling:** Vanilla CSS with Georgia serif font
- **Color Palette:** Black (#1a1a1a) and warm white (#fafaf8)

## Intelligent Selection

The app is smart about what it identifies:

✅ **Includes:**
- Culturally specific dishes (Risotto ai Funghi, Mapo Tofu, Yakisoba)
- Regional specialties (Osso Buco, Xiaolongbao, Tempura)
- Dishes with special preparation methods

❌ **Skips:**
- Basic ingredients everyone knows (plain tuna, rice, chicken)
- Generic items without special preparation
- Familiar terms in compound names (extracts "Karaage" from "Chicken Karaage")

## Development

### Available Commands

```bash
npm run dev        # Frontend only (Vite dev server)
npm run server     # Backend only (Express server)
npm run dev:all    # Both servers concurrently
npm run build      # Production build
npm run preview    # Preview production build
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_ANTHROPIC_API_KEY` | Your Anthropic API key |
| `PORT` | Backend server port (default: 3000) |

## Design Philosophy

Inspired by fine dining restaurant menus (Thomas Keller, French Laundry):
- **Typography:** Georgia serif for warmth and sophistication
- **Colors:** Minimal palette - black, white, subtle grays
- **Layout:** Generous whitespace, clean lines, no clutter
- **Interactions:** Subtle hover states, smooth transitions
- **Accessibility:** High contrast, clear labeling, keyboard-friendly

## API Response Format

Claude returns JSON with this structure:

```json
[
  {
    "name": "Osso Buco",
    "definition": "Milanese braised veal shanks",
    "position": {"x": 25, "y": 30}
  }
]
```

- `name`: Dish name as it appears on the menu
- `definition`: 3-8 word explanation
- `position`: Percentages from top-left (x: 0-100, y: 0-100)

## Future Enhancements

- [ ] Multiple language support for definitions
- [ ] Save favorite dishes to local storage
- [ ] Export annotated menu as PDF
- [ ] Browser extension for quick menu translation
- [ ] Offline support with cached translations
- [ ] User feedback to improve position accuracy

## Troubleshooting

**No dishes identified:**
- Restart servers with `npm run dev:all` to ensure updated prompt is loaded
- Check backend logs for Claude's raw response
- Ensure image shows dish names clearly

**Markers in wrong positions:**
- Claude estimates positions - accuracy varies with menu layout
- Works best with clear, well-structured menus
- Position refinement happens over time as prompt improves

**API errors:**
- Verify API key in `.env` file
- Check Anthropic dashboard for rate limits
- Ensure stable internet connection

## License

MIT

## Credits

Built with Claude Code - UI redesign inspired by Thomas Keller's fine dining aesthetic.
