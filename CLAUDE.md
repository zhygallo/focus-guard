# FocusGuard - Chrome Extension

## Project Overview
A Chrome extension (Manifest V3) that blocks distracting websites with smart anti-cheat features. The key differentiator is a **delayed unblock mechanism** that creates friction for impulsive unblocking.

## Tech Stack
- Pure JavaScript (no frameworks, no TypeScript)
- Chrome Extension Manifest V3
- Chrome APIs: storage, alarms, tabs, scripting
- No external dependencies
- No build step required

## Project Structure
```
focus-guard/
├── manifest.json        # Extension configuration (Manifest V3)
├── background.js        # Service worker - core blocking logic
├── popup/               # Extension popup UI
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── blocked/             # Block page (shown when site is blocked)
│   ├── blocked.html
│   ├── blocked.js
│   └── blocked.css
├── lib/                 # Shared utilities
│   └── storage.js
├── data/
│   └── quotes.json      # Motivational quotes for block page
├── icons/               # Extension icons (16, 48, 128 px)
├── docs/
│   └── TECH_SPEC.md     # Detailed technical specification
├── CLAUDE.md            # This file
├── README.md
└── LICENSE
```

## Key Features (MVP)
1. **Quick-block current site** - One-click blocking with duration presets (15min - 8hrs)
2. **Custom domain blocking** - Add any domain manually
3. **Scheduled blocks** - Auto-block during specified hours (e.g., 9-5 weekdays)
4. **Delayed unblock (CORE FEATURE)** - 5-15 min wait before unblocking to discourage impulsive behavior
5. **Block page** - Beautiful page with countdown and motivational quote
6. **Basic statistics** - Track blocked attempts

## Data Storage

### chrome.storage.sync (synced across devices):
```javascript
{
  activeBlocks: {
    "youtube.com": { until: timestamp, blockedAt: timestamp, reason: "manual" }
  },
  schedules: [
    { id, domains: [], startTime: "09:00", endTime: "17:00", days: [1,2,3,4,5], enabled: true }
  ],
  settings: {
    defaultBlockDuration: 60,
    unblockDelayBase: 5,
    showMotivationalQuotes: true
  }
}
```

### chrome.storage.local (device only):
```javascript
{
  stats: {
    totalBlocksCreated: number,
    blockedAttempts: { "2024-11-26": count },
    siteAttempts: { "youtube.com": count }
  },
  pendingUnblocks: {
    "youtube.com": { requestedAt: timestamp, unlocksAt: timestamp, attemptNumber: 1 }
  }
}
```

## Code Style
- Use async/await for all Chrome API calls
- Use ES6+ features (const/let, arrow functions, template literals)
- Descriptive function and variable names
- Comments for complex logic only
- Consistent formatting (2 spaces indentation)

## Key Code Patterns

### Message passing (popup ↔ background):
```javascript
// Popup sending message
chrome.runtime.sendMessage({ action: "addBlock", domain, minutes }, (response) => {
  if (response.success) { /* handle */ }
})

// Background receiving message
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "addBlock") {
    handleAddBlock(message.domain, message.minutes).then(sendResponse)
    return true // Required for async response
  }
})
```

### Storage operations:
```javascript
// Read
const { activeBlocks = {} } = await chrome.storage.sync.get('activeBlocks')

// Write
await chrome.storage.sync.set({ activeBlocks })
```

### Domain extraction:
```javascript
function extractDomain(url) {
  try {
    const hostname = new URL(url).hostname
    return hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}
```

## Message Actions (API)
| Action | Direction | Payload | Response |
|--------|-----------|---------|----------|
| addBlock | popup→bg | { domain, minutes } | { success } |
| requestUnblock | popup→bg | { domain } | { success, waitTime } |
| cancelUnblock | popup→bg | { domain } | { success } |
| confirmUnblock | popup→bg | { domain } | { success } |
| getBlocks | popup→bg | - | { blocks } |
| getPendingUnblocks | popup→bg | - | { pending } |
| getStats | popup→bg | - | { stats } |
| addSchedule | popup→bg | { schedule } | { success, id } |
| deleteSchedule | popup→bg | { id } | { success } |
| getSchedules | popup→bg | - | { schedules } |

## Testing
1. Load unpacked extension at `chrome://extensions/`
2. Enable Developer mode
3. Click "Load unpacked" and select project folder
4. After changes, click refresh icon on extension card

## Current Status
MVP in development.

## Important Notes
- No external API calls - everything works offline
- No analytics or tracking
- All user data stays in Chrome storage
- Block page must work without external resources

## Commands
No build commands needed. Pure JS, edit and reload extension.

## Documentation
See `docs/TECH_SPEC.md` for detailed feature specifications, data models, and UI designs.
