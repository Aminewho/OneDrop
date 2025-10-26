# One Drop Music App - Design Guidelines

## Design Approach: Reference-Based (Professional Audio + Streaming Media)

**Primary References:**
- **YouTube** - Video grid layout, thumbnail cards, metadata display
- **Professional Audio Software** (Splice, iZotope RX, FL Studio) - Waveform visualization, stem separation interface
- **Spotify/Apple Music** - Music player controls, playlist management

**Justification:** This is an experience-focused, visual-rich application combining video streaming with professional audio tools. Users expect familiar patterns from both entertainment and production software.

## Core Design Elements

### A. Color Palette

**Dark Mode Primary (Audio Production Standard):**
- Background: 220 15% 8% (deep charcoal, reduces eye strain)
- Surface: 220 12% 12% (elevated panels)
- Surface Elevated: 220 10% 16% (cards, modals)
- Border: 220 8% 22% (subtle separation)

**Brand Colors:**
- Primary (One Drop Blue): 200 85% 55% (vibrant, music-focused)
- Primary Hover: 200 85% 48%
- Accent (Waveform Green): 145 70% 55% (audio visualization)

**Functional Colors:**
- Text Primary: 0 0% 95%
- Text Secondary: 0 0% 65%
- Muted: 220 8% 35%
- Success (Active Track): 145 70% 50%
- Destructive: 0 70% 55%

### B. Typography

**Font Stack:**
- Primary: 'Inter' (Google Fonts) - Clean, professional, excellent readability
- Monospace: 'JetBrains Mono' (Google Fonts) - Timecodes, technical data

**Scale:**
- Hero/Display: text-4xl to text-6xl, font-bold
- Page Headers: text-3xl, font-semibold
- Section Titles: text-xl, font-semibold
- Body: text-base, font-normal
- Captions/Metadata: text-sm, text-muted-foreground
- Technical Labels: text-xs, font-mono

### C. Layout System

**Spacing Primitives:** Use Tailwind units of 2, 4, 6, 8, 12, 16, 20 for consistent rhythm
- Component padding: p-4 to p-6
- Section spacing: py-8 to py-12
- Page margins: px-6 to px-8
- Grid gaps: gap-4 to gap-6

**Grid Systems:**
- Video Grid: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4
- Track Separation: Full-width stacked waveforms with individual controls

### D. Component Library

**1. Navigation Bar (Fixed Top)**
- Height: h-16
- 4 Navigation Items: "Videos" | "Separator" | "Library" | "Playlists"
- Logo left, nav center/left, user profile right
- Background: bg-background/95 backdrop-blur
- Active state: border-b-2 border-primary with text-primary

**2. Video Grid Page (YouTube-style)**
- Thumbnail Cards with 16:9 aspect ratio
- Hover: subtle scale (scale-105), shadow increase
- Metadata: Title (2 lines, truncate), channel name, views, upload time
- Duration badge: absolute bottom-right on thumbnail

**3. Track Separation Interface**
- Waveform Display: Full-width horizontal waveforms per stem
- Stems: Vocals, Drums, Bass, Other (matching attached image)
- Each stem row includes:
  - Waveform visualization (gradient from accent color)
  - Track label (left)
  - Solo/Mute buttons
  - Volume slider
  - Pan control
- Waveform colors: Unique gradient per stem (blue, green, purple, orange)

**4. Music Player Controls (Bottom Bar)**
- Fixed bottom, full-width
- Height: h-20 to h-24
- Left: Track info (thumbnail, title, artist)
- Center: Playback controls (previous, play/pause, next, shuffle, repeat)
- Right: Volume, speed controls, queue toggle
- Progress bar: Full-width above controls with time indicators

**5. Buttons & Controls**
- Primary Button: bg-primary hover:bg-primary/90, rounded-md
- Icon Buttons: hover:bg-accent rounded-full p-2
- Solo/Mute: Toggle states with bg-success when active
- Sliders: Custom styled with accent color fill

### E. Audio-Specific UI Elements

**Waveform Visualization:**
- SVG-based rendering for smooth display
- Amplitude-based height, time-based width
- Gradient fill: from accent color to transparent
- Playhead: Vertical line, primary color, follows playback
- Interactive: Click to seek

**Stem Controls:**
- Compact horizontal layout per track
- Icon buttons: Solo (S), Mute (M) with toggle states
- Volume: Horizontal slider, 0-100%, shows dB value
- Visual feedback: Active stems highlighted with glow effect

**Timeline Scrubber:**
- Full-width progress bar
- Current time / Total duration display
- Draggable handle with smooth scrubbing
- Markers for loop points (if applicable)

### F. Page-Specific Layouts

**Videos Page:**
- Top: Search bar + Filter chips (All, Music Videos, Live, etc.)
- Grid: Responsive video cards with lazy loading
- Infinite scroll or pagination

**Separator Page:**
- Top: File upload area (drag-drop) or URL input
- Main: Stacked waveform display (4-5 stems)
- Bottom: Global playback controls + export options

**Library Page:**
- Sidebar: Playlists, Recently Played, Favorites
- Main: Grid or list view of saved tracks/videos
- Quick actions: Play, Add to playlist, Remove

**Playlists Page:**
- Header: Create New Playlist CTA
- Grid: Playlist cards with cover art, track count, duration
- Hover: Play button overlay

### G. Interaction Patterns

**No Distracting Animations** - Critical for audio work:
- Smooth transitions only: 150-200ms ease-in-out
- Hover states: Subtle opacity/scale changes
- Loading states: Simple spinners, no elaborate animations
- Page transitions: Instant or simple fade

**Focus States:**
- Keyboard navigation: Clear focus rings (ring-2 ring-primary)
- Tab order: Logical flow through controls

## Critical Implementation Notes

1. **Waveform Performance:** Use canvas or WebGL for rendering, not DOM elements
2. **Audio Sync:** Ensure waveform playhead perfectly tracks audio position
3. **Responsive Breakpoints:** Prioritize desktop (lg/xl) for separation tools, mobile for video browsing
4. **Accessibility:** ARIA labels for all audio controls, keyboard shortcuts for play/pause (Space), seek (Arrow keys)
5. **Dark Theme Consistency:** All inputs, selects, modals use dark variants
6. **Icon Library:** Heroicons (outline for inactive, solid for active states)

This design balances professional audio production aesthetics with familiar streaming media patterns, creating a unique experience for "One Drop" users.