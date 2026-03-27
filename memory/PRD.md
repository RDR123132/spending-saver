# CoolDown Cart - Product Requirements Document

## Overview
CoolDown Cart is a mobile-first app that helps users resist impulse purchases by introducing AI-powered cooling-off periods. When users feel tempted to buy something, they log the item and cost. The AI generates a smart waiting period based on the price and nature of the item, and provides a conversational financial advisor to talk users out of unnecessary spending.

## Core Features

### 1. Impulse Purchase Logging
- Users enter item name and cost
- AI (Gemini 3 Flash) analyzes the purchase and generates a custom waiting period
- Waiting period is based on cost brackets and item type
- Local notification is scheduled for when the waiting period expires

### 2. AI-Generated Waiting Periods
- $1-$20: 1-6 hours
- $20-$100: 6-24 hours
- $100-$500: 24-72 hours
- $500+: 72-168 hours
- AI considers item necessity (necessities get shorter periods)

### 3. AI Financial Advisor Chat
- Per-purchase AI chat sessions
- AI adapts personality based on context
- Uses strategies: cost perspective, alternatives, thought-provoking questions, humor
- Powered by Gemini 3 Flash via Emergent LLM Key

### 4. Dashboard with Countdown Timers
- Active purchases displayed as cards with live countdown timers
- Progress bar showing waiting period progress
- "Talk me out of it" button to open AI chat
- Decision buttons appear when timer expires (Skip It / Bought It)

### 5. Purchase History & Statistics
- Track skipped vs bought items
- Running totals: money saved, money spent, items resisted
- Visual status badges (skipped = green, bought = red)

### 6. Notifications
- Local push notifications when waiting periods expire
- Scheduled via expo-notifications

### 7. Settings
- Dark/Light mode toggle (persisted in AsyncStorage)
- User profile display (from Google account)
- Sign out functionality

## Tech Stack
- **Frontend**: Expo React Native (SDK 54), Expo Router (file-based routing)
- **Backend**: FastAPI, Motor (async MongoDB)
- **Database**: MongoDB
- **AI**: Gemini 3 Flash via emergentintegrations (Emergent LLM Key)
- **Auth**: Emergent-managed Google OAuth
- **Notifications**: expo-notifications (local scheduling)
- **State Management**: React Context (Theme + Auth)

## API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/session | Exchange OAuth session_id for token |
| GET | /api/auth/me | Get current user |
| POST | /api/auth/logout | Logout |
| POST | /api/purchases | Create purchase with AI waiting period |
| GET | /api/purchases | List active (waiting) purchases |
| GET | /api/purchases/history | List completed purchases |
| PATCH | /api/purchases/{id}/decide | Mark as bought/skipped |
| DELETE | /api/purchases/{id} | Delete purchase |
| POST | /api/chat/{id} | Send chat message, get AI response |
| GET | /api/chat/{id} | Get chat history |
| POST | /api/push-token | Register push notification token |
| GET | /api/user/settings | Get user settings |
| PUT | /api/user/settings | Update user settings |

## Design
- Neo-Brutalist Pastel aesthetic
- Hard borders (2px), offset shadows, bold typography (900 weight)
- Colors: Pink (#FF90E8), Blue (#90A8ED), Yellow (#FFC900)
- Light bg: #FDFBF7, Dark bg: #0F0F0F
