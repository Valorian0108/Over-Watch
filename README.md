# OverWatch

A focused market observatory that presents live crypto and Real World Asset (RWA) data through an approachable interface designed for clarity rather than complexity.

---

## Project Overview

OverWatch is a single-page web application built for the CoinMarketCap API Hackathon (September 9-30, 2026). The project addresses a common issue in cryptocurrency data presentation: traditional market tools often feature dense numerical interfaces, dark terminal-style designs, and complex metrics that can overwhelm users who prefer simpler, more intuitive data consumption.

The application provides live market data from CoinMarketCap through a clean, accessible interface that prioritizes user experience over feature density. It demonstrates effective use of multiple CMC API endpoints including market overview, asset listings, RWA data, and search functionality.

## Architecture and Implementation

### Technical Stack
- Frontend: React with TypeScript
- Build Tool: Vite
- Styling: Tailwind CSS v4
- Data Source: CoinMarketCap Pro API
- Deployment: Vercel (serverless functions)
- API Integration: Multiple CMC endpoints for comprehensive market data

### Core Features
- Live market overview with global metrics
- Cryptocurrency and RWA asset listings
- Asset search and filtering capabilities
- Individual asset detail views
- Automatic data refresh
- Plain-language market explanations
- Public deployment with live API integration

### API Endpoints Utilized
- `/v1/global-metrics/quotes/latest` - Global market metrics
- `/v1/cryptocurrency/listings/latest` - Crypto asset data
- `/v5/real-world-assets/map` - RWA asset metadata
- `/v2/cryptocurrency/info` - Asset details and logo information
- `/v5/real-world-assets/info` - RWA specific information

## Problem Statement

Cryptocurrency market data interfaces traditionally follow similar patterns: dark backgrounds, dense numerical displays, complex charts, and technical terminology. While these interfaces serve experienced traders well, they create barriers for users who prefer simpler data consumption or find numerical complexity overwhelming.

## Solution Approach

OverWatch addresses this challenge through:

1. **Clean Visual Design**: Light, approachable interface with controlled color usage and clear information hierarchy
2. **Focused Scope**: Single-page experience that presents essential information without overwhelming users
3. **Live Data Integration**: Real-time market data from CoinMarketCap API
4. **Plain Language Explanations**: Market data presented in accessible language when AI functionality is available, with fallback to rule-based responses when AI services are unavailable
5. **Comprehensive Coverage**: Both cryptocurrency and Real World Asset data from CMC endpoints

## Development Approach

The project was developed with emphasis on:
- Clean, maintainable code structure
- Effective API integration patterns
- User experience prioritization
- Production-ready deployment
- Comprehensive error handling and fallback mechanisms

## Deployment and Architecture

- **Frontend**: React application deployed via Vercel
- **Backend**: Vercel serverless functions for API proxying
- **Environment Variables**: CMC API key configured for both production and preview environments
- **Git Workflow**: Feature branch development with preview deployments
- **Public Repository**: Clean commit history without sensitive credentials

## Current Capabilities

### Market Data
- Real-time global market metrics (market cap, volume, BTC dominance)
- Live cryptocurrency listings with price and performance data
- Real World Asset metadata and information
- Asset search functionality across both crypto and RWA datasets
- Individual asset detail views with comprehensive information

### User Interface
- Responsive design for multiple screen sizes
- Asset filtering by type (All, Crypto, RWA)
- Clear visual hierarchy and information density
- Accessible color scheme and typography
- Smooth data refresh intervals

### API Integration
- Robust error handling for API failures
- Fallback mechanisms for service unavailability
- Rate limit awareness and conservative refresh intervals
- Comprehensive logging for debugging and monitoring

## Known Limitations

### RWA Data Coverage
- Many RWA assets lack live pricing data through CMC endpoints
- RWA logo coverage is inconsistent due to CMC API limitations
- Current implementation relies on metadata rather than live pricing for most RWA assets

### AI Integration
- AI explanations default to rule-based responses when AI services are unavailable
- AI service integration planned for future enhancement
- Current fallback responses are grounded in real market data and provide functional value

## Future Enhancement Opportunities

### Enhanced RWA Integration
- Investigation of alternative RWA data sources for improved coverage
- Enhanced logo and metadata acquisition for RWA assets
- Potential integration of stock market data if CMC expands coverage

### AI Service Integration
- Implementation of reliable AI service for enhanced plain-language explanations
- Exploration of multiple AI providers for redundancy and cost optimization
- Fine-tuning of AI prompts for specific market explanation use cases

### Advanced Features
- Historical data visualization
- Comparative asset analysis
- Custom watchlist functionality
- Enhanced filtering and sorting options

## CoinMarketCap API Usage

The application demonstrates comprehensive use of CoinMarketCap API capabilities:
- Global market metrics endpoint for overall market health
- Cryptocurrency listings for individual asset data
- RWA endpoints for real-world asset coverage
- Info endpoints for detailed asset information and logo acquisition
- Search functionality across multiple asset types

## Development Philosophy

The project prioritizes:
- User experience over feature quantity
- Clean, maintainable code over quick solutions
- Honest data presentation over exaggerated capabilities
- Production readiness over experimental features
- Comprehensive error handling over assumed success

## Conclusion

OverWatch represents a focused approach to market data presentation that prioritizes accessibility and clarity. The application successfully integrates multiple CoinMarketCap API endpoints into a cohesive user experience while maintaining clean architecture and production-ready deployment standards.

Built for the CoinMarketCap API Hackathon.
