# FocusBlock - Technical Specification (MVP)

## 1. Product Overview

### 1.1 Product Name
**FocusBlock** - Website Blocker with Smart Anti-Cheat

### 1.2 Tagline
"The only website blocker your future self can't outsmart."

### 1.3 Problem Statement
Existing website blockers fail because users can easily bypass them. The moment willpower drops, users disable the extension, whitelist sites, or simply uninstall. There's no friction between the impulse to procrastinate and the action.

### 1.4 Solution
A Chrome extension that blocks distracting websites with **intentional friction** for unblocking. The goal isn't to make blocking impossible, but to create enough delay/friction that the procrastination urge passes.

### 1.5 Target Users
- Knowledge workers struggling with focus
- Students during exam periods
- People with ADHD (large, engaged community)
- Remote workers with self-discipline challenges
- Anyone who has tried and failed with other blockers

### 1.6 MVP Scope
**In Scope:**
- Block websites by domain
- Quick-block current site
- Timed blocks (15min - 8hrs)
- Scheduled blocks (e.g., 9am-5pm weekdays)
- Delay-based unblock friction (wait 5-15 minutes)
- Block page with timer and motivational message
- Basic statistics (blocked attempts count)

**Out of Scope (Future Premium):**
- Accountability partner system
- Donation-to-unblock feature
- Cross-device sync
- Advanced analytics
- Nuclear mode (impossible to unblock)
- Browser-level protection (prevent extension disable)

---

## 2. Feature Specifications

### 2.1 Core Features

#### F1: Quick Block Current Site
**Description:** One-click blocking of the currently active tab's domain.

**User Flow:**
1. User is on youtube.com
2. Opens extension popup
3. Sees "youtube.com" displayed
4. Clicks duration button (15min / 30min / 1hr / 4hrs / 8hrs)
5. Site is immediately blocked
6. Current tab redirects to block page
7. Confirmation toast shown

**Acceptance Criteria:**
- [ ] Correctly extracts domain from any URL format
- [ ] Handles subdomains (www.youtube.com → youtube.com)
- [ ] Block activates within 100ms
- [ ] All tabs with blocked domain redirect to block page

#### F2: Custom Domain Block
**Description:** Add any domain to blocklist with custom duration.

**User Flow:**
1. User opens popup
2. Expands "Add Custom Block" section
3. Enters domain (e.g., "twitter.com")
4. Enters duration in minutes or selects preset
5. Clicks "Block"
6. Domain added to active blocks

**Validation Rules:**
- Domain format validation (basic regex)
- No duplicate blocks (update existing if present)
- Minimum duration: 1 minute
- Maximum duration: 480 minutes (8 hours)

**Acceptance Criteria:**
- [ ] Validates domain format
- [ ] Prevents duplicate entries
- [ ] Shows error message for invalid input
- [ ] Clears form after successful addition

#### F3: Scheduled Blocks
**Description:** Automatically block sites during specified time windows.

**User Flow:**
1. User opens popup → "Schedules" tab
2. Clicks "Add Schedule"
3. Selects domain(s) to block
4. Sets time window (e.g., 09:00 - 17:00)
5. Selects days (Mon-Fri checkboxes)
6. Saves schedule

**Data Model:**
```javascript
{
  id: "uuid",
  domains: ["youtube.com", "twitter.com"],
  startTime: "09:00",
  endTime: "17:00",
  days: [1, 2, 3, 4, 5], // 0=Sun, 1=Mon, etc.
  enabled: true,
  createdAt: timestamp
}
```

**Acceptance Criteria:**
- [ ] Schedules activate automatically at start time
- [ ] Schedules deactivate at end time
- [ ] Handles timezone correctly (user's local time)
- [ ] Can enable/disable without deleting
- [ ] Persists across browser restarts

#### F4: Delayed Unblock (Anti-Cheat)
**Description:** When user attempts to unblock, they must wait a specified delay period. This is the KEY differentiator.

**User Flow:**
1. User clicks "Unblock" on a blocked site
2. Modal appears: "Are you sure? You'll need to wait 5 minutes."
3. User confirms
4. Countdown timer starts (5 minutes)
5. User can close modal, but timer continues
6. After 5 minutes, site is unblocked
7. User can cancel during countdown (block remains)

**Delay Tiers:**
- First unblock attempt: 5 minutes
- Second unblock (same day): 10 minutes
- Third+ unblock (same day): 15 minutes

**Acceptance Criteria:**
- [ ] Timer continues even if popup closed
- [ ] Timer persists across browser restart
- [ ] Visual countdown in popup and block page
- [ ] Cancel option available during countdown
- [ ] Escalating delays work correctly
- [ ] Delay counter resets at midnight

#### F5: Block Page
**Description:** Full-page display when user navigates to blocked site.

**Content:**
- Large "Site Blocked" header
- Blocked domain name
- Time remaining (countdown)
- Motivational quote (rotating)
- "I understand, close tab" button
- "Request Unblock" button (triggers delay)

**Design Requirements:**
- Calming color scheme (soft gradients)
- Clean, non-aggressive design
- Mobile-responsive (for mobile Chrome)
- No external requests (works offline)

**Acceptance Criteria:**
- [ ] Displays correct domain and time
- [ ] Countdown updates every second
- [ ] Auto-redirects to site when block expires
- [ ] Quotes rotate on each visit
- [ ] Works without internet connection

#### F6: Statistics Dashboard
**Description:** Basic stats to show user their blocking patterns.

**Metrics Tracked:**
- Total blocks created (all time)
- Active blocks (current)
- Blocked access attempts (today / this week)
- Most blocked sites (top 5)
- Current streak (days with at least one block)

**Display:**
- Simple stats in popup (collapsed by default)
- "Stats" tab or expandable section

**Acceptance Criteria:**
- [ ] Stats persist across sessions
- [ ] Daily/weekly counters reset appropriately
- [ ] Streak calculation is accurate
- [ ] Stats don't impact performance

#### F7: Blocklist Management
**Description:** View and manage all blocked domains.

**Features:**
- List all active blocks with time remaining
- List all scheduled blocks
- Quick unblock button (with delay)
- Edit scheduled blocks
- Delete scheduled blocks

**Acceptance Criteria:**
- [ ] Shows accurate time remaining
- [ ] List updates in real-time
- [ ] Can remove schedules without delay
- [ ] Sorted by time remaining (soonest first)

---

## 3. Technical Architecture

### 3.1 Extension Components

```
focusblock/
├── manifest.json           # Extension configuration (Manifest V3)
├── background.js           # Service worker - core blocking logic
├── popup/
│   ├── popup.html         # Main popup UI
│   ├── popup.js           # Popup logic
│   └── popup.css          # Popup styles
├── blocked/
│   ├── blocked.html       # Block page
│   ├── blocked.js         # Block page logic
│   └── blocked.css        # Block page styles
├── options/
│   ├── options.html       # Settings page (future)
│   ├── options.js
│   └── options.css
├── lib/
│   └── storage.js         # Storage utility functions
├── data/
│   └── quotes.json        # Motivational quotes
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── _locales/              # i18n (future)
    └── en/
        └── messages.json
```

### 3.2 Manifest V3 Configuration

```json
{
  "manifest_version": 3,
  "name": "FocusBlock",
  "version": "1.0.0",
  "description": "Block distracting websites with smart anti-cheat protection",
  
  "permissions": [
    "storage",
    "alarms",
    "tabs",
    "scripting"
  ],
  
  "host_permissions": [
    "<all_urls>"
  ],
  
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  
  "web_accessible_resources": [{
    "resources": ["blocked/blocked.html", "blocked/blocked.css", "blocked/blocked.js", "data/quotes.json"],
    "matches": ["<all_urls>"]
  }]
}
```

### 3.3 Data Models

#### Active Blocks
```javascript
// Stored in chrome.storage.sync
{
  "activeBlocks": {
    "youtube.com": {
      "until": 1699876543210,      // Unix timestamp (ms)
      "blockedAt": 1699872943210,  // When block was created
      "reason": "manual"           // "manual" | "schedule"
    },
    "twitter.com": {
      "until": 1699880143210,
      "blockedAt": 1699872943210,
      "reason": "schedule"
    }
  }
}
```

#### Schedules
```javascript
// Stored in chrome.storage.sync
{
  "schedules": [
    {
      "id": "sch_abc123",
      "domains": ["youtube.com", "twitter.com", "reddit.com"],
      "startTime": "09:00",
      "endTime": "17:00",
      "days": [1, 2, 3, 4, 5],    // Mon-Fri
      "enabled": true,
      "createdAt": 1699872943210
    }
  ]
}
```

#### Pending Unblocks (Delay Queue)
```javascript
// Stored in chrome.storage.local
{
  "pendingUnblocks": {
    "youtube.com": {
      "requestedAt": 1699876543210,
      "unlocksAt": 1699876843210,  // +5 minutes
      "attemptNumber": 1
    }
  }
}
```

#### Statistics
```javascript
// Stored in chrome.storage.local
{
  "stats": {
    "totalBlocksCreated": 47,
    "blockedAttempts": {
      "2024-11-26": 12,
      "2024-11-25": 8
    },
    "siteAttempts": {
      "youtube.com": 23,
      "twitter.com": 15,
      "reddit.com": 9
    },
    "streakStartDate": "2024-11-20",
    "lastActiveDate": "2024-11-26"
  }
}
```

#### User Settings
```javascript
// Stored in chrome.storage.sync
{
  "settings": {
    "defaultBlockDuration": 60,      // minutes
    "unblockDelayBase": 5,           // minutes
    "unblockDelayEscalation": true,  // increase delay on repeated attempts
    "showMotivationalQuotes": true,
    "playSoundOnBlock": false,
    "theme": "auto"                  // "light" | "dark" | "auto"
  }
}
```

### 3.4 Background Service Worker

**Responsibilities:**
1. Monitor tab navigation (onUpdated, onCreated)
2. Check URL against active blocks
3. Redirect blocked URLs to block page
4. Manage alarms for block expiration
5. Handle schedule activation/deactivation
6. Process unblock delay timers
7. Update statistics

**Key Functions:**
```javascript
// Core blocking check
async function shouldBlockUrl(url) → boolean

// Add new block
async function addBlock(domain, minutes, reason) → void

// Remove block (with delay check)
async function requestUnblock(domain) → { success, waitTime }

// Schedule management
async function checkSchedules() → void
async function activateSchedule(scheduleId) → void
async function deactivateSchedule(scheduleId) → void

// Stats
async function recordBlockedAttempt(domain) → void
async function getStats() → StatsObject
```

### 3.5 Storage Strategy

**chrome.storage.sync** (synced across devices, 100KB limit):
- Active blocks
- Schedules
- User settings
- Blocklist (domains)

**chrome.storage.local** (local only, 5MB limit):
- Statistics
- Pending unblocks
- Temporary data

**Why this split:**
- Sync: Small, important data that should follow user
- Local: Larger data, device-specific timers

---

## 4. User Interface Specifications

### 4.1 Popup UI Structure

```
┌─────────────────────────────────┐
│  🎯 FocusBlock            [⚙️]  │  <- Header with settings icon
├─────────────────────────────────┤
│  Block Current Site             │
│  ┌─────────────────────────┐    │
│  │   youtube.com           │    │  <- Current domain
│  └─────────────────────────┘    │
│  [15m] [30m] [1hr] [4hr] [8hr]  │  <- Duration buttons
├─────────────────────────────────┤
│  ▶ Active Blocks (3)            │  <- Collapsible section
│  ┌─────────────────────────┐    │
│  │ youtube.com    47m left │ ✕  │
│  │ twitter.com    2h left  │ ✕  │
│  │ reddit.com     23m left │ ✕  │
│  └─────────────────────────┘    │
├─────────────────────────────────┤
│  ▶ Schedules (1)                │  <- Collapsible section
├─────────────────────────────────┤
│  ▶ Add Custom Block             │  <- Collapsible section
│  ┌─────────────────────────┐    │
│  │ Domain: [             ] │    │
│  │ Minutes: [    ] or      │    │
│  │ [15m] [30m] [1hr] [4hr] │    │
│  │         [Add Block]     │    │
│  └─────────────────────────┘    │
├─────────────────────────────────┤
│  📊 Today: 5 blocks prevented   │  <- Mini stats
└─────────────────────────────────┘
```

### 4.2 Block Page UI

```
┌────────────────────────────────────────────────────┐
│                                                    │
│                   🚫                               │
│                                                    │
│              Site Blocked                          │
│                                                    │
│         ┌──────────────────────┐                   │
│         │    youtube.com       │                   │
│         └──────────────────────┘                   │
│                                                    │
│     "The secret of getting ahead is              │
│      getting started." - Mark Twain               │
│                                                    │
│              ⏱️ 47:23                              │  <- Countdown
│              remaining                             │
│                                                    │
│     [Close Tab]     [Request Unblock]             │
│                                                    │
│                                                    │
└────────────────────────────────────────────────────┘
```

### 4.3 Unblock Delay Modal

```
┌────────────────────────────────────────────────────┐
│                                                    │
│            ⚠️ Unblock Request                      │
│                                                    │
│     Are you sure you want to unblock              │
│     youtube.com?                                   │
│                                                    │
│     You'll need to wait 5 minutes.                │
│     This gives you time to reconsider.            │
│                                                    │
│     ┌────────────────────────┐                    │
│     │       04:32            │                    │  <- Countdown
│     │      remaining         │                    │
│     └────────────────────────┘                    │
│                                                    │
│     [Cancel - Keep Blocked]  [Start Waiting]      │
│                                                    │
└────────────────────────────────────────────────────┘
```

### 4.4 Color Scheme

**Primary Palette:**
```css
--primary: #6366f1;        /* Indigo - main actions */
--primary-hover: #4f46e5;
--success: #10b981;        /* Green - confirmations */
--warning: #f59e0b;        /* Amber - warnings */
--danger: #ef4444;         /* Red - destructive actions */
--neutral-50: #f8fafc;     /* Backgrounds */
--neutral-100: #f1f5f9;
--neutral-200: #e2e8f0;
--neutral-600: #475569;    /* Secondary text */
--neutral-800: #1e293b;    /* Primary text */
--neutral-900: #0f172a;
```

**Block Page Gradient:**
```css
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
```

### 4.5 Typography

```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;

/* Sizes */
--text-xs: 12px;
--text-sm: 14px;
--text-base: 16px;
--text-lg: 18px;
--text-xl: 24px;
--text-2xl: 32px;
```

---

## 5. API & Message Passing

### 5.1 Popup → Background Messages

```javascript
// Add a new block
{ action: "addBlock", domain: "youtube.com", minutes: 60 }
→ { success: true }

// Request unblock (starts delay timer)
{ action: "requestUnblock", domain: "youtube.com" }
→ { success: true, waitTime: 300 } // seconds
→ { success: false, error: "Already pending", remainingTime: 180 }

// Cancel pending unblock
{ action: "cancelUnblock", domain: "youtube.com" }
→ { success: true }

// Force unblock (after delay completed)
{ action: "confirmUnblock", domain: "youtube.com" }
→ { success: true }

// Get all active blocks
{ action: "getBlocks" }
→ { "youtube.com": { until: ..., blockedAt: ... }, ... }

// Get pending unblocks
{ action: "getPendingUnblocks" }
→ { "youtube.com": { unlocksAt: ..., requestedAt: ... } }

// Get statistics
{ action: "getStats" }
→ { totalBlocksCreated: 47, blockedAttempts: {...}, ... }

// Schedule management
{ action: "addSchedule", schedule: {...} }
{ action: "updateSchedule", id: "...", schedule: {...} }
{ action: "deleteSchedule", id: "..." }
{ action: "getSchedules" }
{ action: "toggleSchedule", id: "...", enabled: true }
```

### 5.2 Background → Content/Popup Events

```javascript
// Block status changed
{ event: "blockUpdated", blocks: {...} }

// Pending unblock timer tick
{ event: "unblockTimerTick", domain: "youtube.com", remaining: 180 }

// Unblock ready (delay completed)
{ event: "unblockReady", domain: "youtube.com" }

// Stats updated
{ event: "statsUpdated", stats: {...} }
```

---

## 6. Error Handling

### 6.1 Error Types

```javascript
const ErrorCodes = {
  INVALID_DOMAIN: "invalid_domain",
  DUPLICATE_BLOCK: "duplicate_block",
  BLOCK_NOT_FOUND: "block_not_found",
  UNBLOCK_PENDING: "unblock_pending",
  SCHEDULE_CONFLICT: "schedule_conflict",
  STORAGE_ERROR: "storage_error",
  UNKNOWN_ERROR: "unknown_error"
};
```

### 6.2 User-Facing Error Messages

| Error Code | User Message |
|------------|--------------|
| INVALID_DOMAIN | "Please enter a valid domain (e.g., youtube.com)" |
| DUPLICATE_BLOCK | "This site is already blocked" |
| BLOCK_NOT_FOUND | "This block no longer exists" |
| UNBLOCK_PENDING | "Unblock already requested. X minutes remaining." |
| SCHEDULE_CONFLICT | "This conflicts with an existing schedule" |
| STORAGE_ERROR | "Failed to save. Please try again." |

---

## 7. Performance Requirements

### 7.1 Targets

| Metric | Target |
|--------|--------|
| Popup open time | < 100ms |
| Block detection | < 50ms |
| Redirect to block page | < 100ms |
| Storage operations | < 50ms |
| Memory usage | < 50MB |
| CPU (idle) | < 1% |

### 7.2 Optimization Strategies

1. **Lazy loading:** Only load what's needed
2. **Debounced storage writes:** Batch multiple changes
3. **Efficient URL matching:** Use Map for O(1) lookups
4. **Minimal DOM operations:** Update only changed elements
5. **No external dependencies:** Everything bundled locally

---

## 8. Security Considerations

### 8.1 Data Privacy

- **No data collection:** All data stays local/synced to user's Chrome account
- **No analytics:** No tracking pixels or external requests
- **No external APIs:** Works completely offline
- **Clear data option:** User can clear all data from settings

### 8.2 Manifest Permissions (Minimal)

Only request necessary permissions:
- `storage` - Save blocks and settings
- `alarms` - Schedule timers
- `tabs` - Read current tab URL
- `scripting` - Redirect blocked tabs (Manifest V3)

### 8.3 Content Security

- No `eval()` or dynamic code execution
- No external script loading
- Sanitize all user inputs
- Block page has no external resources

---

## 9. Testing Plan

### 9.1 Unit Tests (Future)

**Core Functions:**
- `shouldBlockUrl()` - Various URL formats
- `addBlock()` - Valid/invalid inputs
- `checkSchedules()` - Time boundary conditions
- Domain extraction logic

### 9.2 Manual Test Cases

**Blocking:**
- [ ] Block current site with each duration
- [ ] Block via custom domain entry
- [ ] Navigate to blocked site → redirects to block page
- [ ] Block with subdomain (www.youtube.com)
- [ ] Block page shows correct countdown
- [ ] Auto-unblock when timer expires

**Unblock Delay:**
- [ ] Request unblock → 5 minute delay starts
- [ ] Close popup → delay continues
- [ ] Delay survives browser restart
- [ ] Cancel during delay → block remains
- [ ] Second attempt same day → 10 minute delay
- [ ] Delay resets after midnight

**Schedules:**
- [ ] Create schedule → activates at start time
- [ ] Schedule deactivates at end time
- [ ] Schedule only active on selected days
- [ ] Disable schedule → stops activating
- [ ] Delete schedule → removes completely

**Edge Cases:**
- [ ] Block during offline mode
- [ ] Very long duration (8 hours)
- [ ] Multiple tabs with same blocked site
- [ ] Unicode domain names
- [ ] IP addresses instead of domains
- [ ] localhost and chrome:// URLs (should not block)

---

## 10. Launch Checklist

### 10.1 Pre-Launch

- [ ] All MVP features implemented
- [ ] Tested on Chrome stable (latest)
- [ ] Tested on Chrome beta
- [ ] Icons created (16, 48, 128, 256 for store)
- [ ] Screenshots captured (1280x800)
- [ ] Description written
- [ ] Privacy policy created (simple, hosted online)
- [ ] Chrome Developer account created ($5 fee paid)

### 10.2 Chrome Web Store Listing

**Required Assets:**
- Name: FocusBlock - Smart Website Blocker
- Short description (132 chars max)
- Full description
- Category: Productivity
- Screenshots (min 1, max 5)
- Icon (128x128)
- Promotional images (optional but recommended)

**Description Template:**
```
FocusBlock helps you stay focused by blocking distracting websites with smart anti-cheat protection.

Unlike other blockers, FocusBlock makes you WAIT before unblocking - giving your willpower time to kick in.

Features:
✓ One-click blocking of current site
✓ Timed blocks (15 min to 8 hours)
✓ Scheduled blocks (e.g., work hours only)
✓ Smart delay before unblocking
✓ Beautiful, calming block page
✓ Track your blocked attempts
✓ 100% private - no data collection

Perfect for:
• Remote workers
• Students
• Anyone who's tried other blockers and failed

Stop procrastinating. Start focusing.
```

### 10.3 Post-Launch

- [ ] Monitor Chrome Web Store reviews
- [ ] Set up feedback collection (simple form)
- [ ] Track install/uninstall metrics
- [ ] Plan v1.1 based on feedback

---

## 11. Future Roadmap (Post-MVP)

### Version 1.1 (Week 2-3)
- Bug fixes from user feedback
- UI polish
- Additional quote sources
- Import/export blocklist

### Version 1.2 - Premium Features (Week 4-6)
- Accountability partner system
- Donation-to-unblock (Stripe integration)
- Advanced statistics
- Cross-browser sync

### Version 2.0 - Premium Tier
- Nuclear mode
- Team features
- API access
- White-label option

---

## 12. Success Metrics

### MVP Success (First Month)
- 500+ inst