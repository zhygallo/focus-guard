# Icons

This folder should contain the extension icons in PNG format:

- `icon16.png` - 16x16 pixels (toolbar icon, small)
- `icon48.png` - 48x48 pixels (extensions page)
- `icon128.png` - 128x128 pixels (Chrome Web Store, installation)

## Quick Icon Generation

### Option 1: Use an Online Generator
1. Go to https://favicon.io/emoji-favicons/
2. Search for "shield" emoji (🛡️)
3. Download and rename the files

### Option 2: Use Figma/Canva
1. Create a simple shield design
2. Export at 16x16, 48x48, and 128x128

### Option 3: Use this SVG as base
Save this as icon.svg and convert to PNG at different sizes:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea"/>
      <stop offset="100%" style="stop-color:#764ba2"/>
    </linearGradient>
  </defs>
  <path fill="url(#grad)" d="M64 8 L112 24 L112 56 C112 88 88 112 64 120 C40 112 16 88 16 56 L16 24 Z"/>
  <path fill="white" d="M64 28 L92 38 L92 56 C92 78 76 96 64 102 C52 96 36 78 36 56 L36 38 Z"/>
  <circle fill="url(#grad)" cx="64" cy="60" r="16"/>
  <path d="M58 60 L62 64 L72 54" stroke="white" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
```

## Temporary Solution
For testing, the extension will work without icons (Chrome uses a default).
Add proper icons before publishing to the Chrome Web Store.
