# OverWatch

A focused market observatory that presents live crypto and Real World Asset (RWA) data through an approachable interface designed for clarity rather than complexity.

---

## The Idea

Most market tools feel dense, number-heavy, and intimidating especially for people who do not enjoy complex metrics or math. OverWatch addresses this by taking real live data from CoinMarketCap (crypto prices plus Real World Assets) and presenting it in a way that feels alive and human instead of technical.

The central approach:

- Take live data from CoinMarketCap for both cryptocurrency and RWA assets
- Present it through an interface that feels like a living thing, not a traditional terminal-style tool
- Use smooth visual transitions and motion so the "live" feeling comes from the page itself, not just ticking numbers
- Apply a playful, doodle-inspired visual style instead of the standard dark terminal aesthetic
- Include an AI layer that explains the raw CMC numbers in plain, everyday language so people who normally avoid heavy market data can still understand what is happening

---

## What OverWatch Does

OverWatch is a single-page web application built for the CoinMarketCap API Hackathon (September 9-30, 2026). It provides:

**Live Market Data**
- Real-time global market metrics including total market cap, volume, and BTC dominance
- Live cryptocurrency listings with prices and performance data
- Real World Asset live pricing data with market cap and volume
- Asset search functionality across both crypto and RWA datasets
- Individual asset detail views

**Interface Design**
- Light, approachable visual design with controlled color usage
- Smooth animations and transitions for a living, responsive feel
- Asset filtering by type (All, Crypto, RWA)
- Clear information hierarchy that prioritizes readability over data density
- Auto-refresh functionality at 60-second intervals with conservative API credit usage

**Plain Language Explanations**
- AI integration that explains market data in accessible language
- Dual AI setup with automatic fallback between providers
- Rule-based fallback responses when AI services are unavailable
- Responses grounded in real market data without invented values

---

## Technical Implementation

### Stack
- Frontend: React with TypeScript
- Build Tool: Vite
- Styling: Tailwind CSS v4
- Data Source: CoinMarketCap Pro API
- Deployment: Vercel (serverless functions)
- AI Providers: Experiential Labs API (primary), Qwen (fallback)

### CoinMarketCap API Endpoints Used
- `/v1/global-metrics/quotes/latest` - Global market metrics
- `/v1/cryptocurrency/listings/latest` - Crypto asset data
- `/v5/real-world-assets/assets/list` - RWA live pricing data
- `/v2/cryptocurrency/info` - Asset details and logo information
- `/v5/real-world-assets/info` - RWA specific information

### Architecture
- Frontend: React application deployed via Vercel
- Backend: Vercel serverless functions for API proxying
- Environment Variables: CMC API key, AI provider keys configured for production and preview environments
- Git Workflow: Feature branch development with preview deployments before production merge
- Public Repository: Clean commit history without sensitive credentials

---

## Current State and Limitations

### What Works
- Live data retrieval from all configured CMC endpoints
- Reliable display of crypto and RWA market data
- AI explanations with automatic provider fallback
- Smooth UI transitions and responsive design
- Public deployment with live API integration

### Known Limitations
- RWA logo coverage is inconsistent because CoinMarketCap does not provide logos for all RWA assets. The application uses colored placeholders with initials when logos are unavailable.
- RWA 24-hour change data is not available in the current CMC endpoint, so RWA assets display live pricing but not percentage changes.
- AI explanations fall back to rule-based responses when AI providers are unavailable or return errors. This is intentional to ensure the application remains functional during service outages.
- The AI dataset currently includes the top 100 crypto assets and 20 RWA assets. Questions about assets outside this set may not be recognized.

### RWA Logo Handling
CoinMarketCap API documentation confirms that many RWA assets legitimately return null for logo fields. The application gracefully handles this by using colored placeholders with asset initials instead of failing or displaying broken images.

---

## Development Approach

The project was developed with emphasis on:

- Clean, maintainable code structure
- Effective API integration patterns
- User experience prioritization over feature density
- Production-ready deployment with comprehensive error handling
- Honest data presentation without exaggerated capabilities
- Comprehensive fallback mechanisms for service unavailability

---

## Deployment

- Production: https://overwatch-teal.vercel.app
- Repository: https://github.com/Valorian0108/Over-Watch
- Branch: main (stable), feature branches for experimental work

---

## CoinMarketCap API Usage

OverWatch demonstrates practical use of multiple CoinMarketCap API endpoints:

- Global market metrics for overall market health assessment
- Cryptocurrency listings for individual asset data
- RWA live pricing endpoints for real-world asset coverage
- Info endpoints for detailed asset information and logo acquisition
- Search functionality across multiple asset types

All API calls include error handling and fallback mechanisms to ensure the application remains functional during service interruptions.

---

Built for the CoinMarketCap API Hackathon.
