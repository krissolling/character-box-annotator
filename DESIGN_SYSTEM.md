# Teenage Engineering Design System

A minimal, functional design system inspired by the Teenage Engineering OP-1 synthesizer. This system prioritizes clarity, consistency, and a tactile feel through subtle 3D effects.

## Design Principles

- **Minimal**: No decoration, every element serves a purpose
- **Consistent**: Same treatments applied across all interactive elements
- **Tactile**: Subtle 3D effects give elements a physical, pressable feel
- **Uppercase**: Small text uses all caps with letter-spacing for clarity

---

## Typography

### Font Family

```css
font-family: 'Antarctica', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
```

Load the Antarctica variable font:
```css
@font-face {
  font-family: 'Antarctica';
  src: url('/fonts/Antarctica-VF.ttf') format('truetype');
  font-weight: 100 900;
  font-stretch: 75% 125%;
  font-style: normal;
}
```

### Font Settings

| Context | Weight | Stretch | Size | Letter Spacing |
|---------|--------|---------|------|----------------|
| Body text | 350 | 85% | 12px | 0 |
| Buttons | 380 | 85% | 11px | 0.1px |
| Labels/Small caps | 350 | 85% | 10px | 1px |
| Panel titles | 500 | 85% | 10px | 1px |
| Character display | 500 | 85% | 14px | 0 |
| Section headings | 500 | 85% | 11px | 1px |

### Small Caps Pattern

All labels, status text, slider values, and panel titles use this pattern:
```css
font-size: 10px;
font-variation-settings: 'wght' 350;
text-transform: uppercase;
letter-spacing: 1px;
```

---

## Color Palette

### CSS Variables

```css
:root {
  /* Core colors */
  --te-bg: #DDE0EC;        /* Page background */
  --te-white: #FFFFFF;      /* Panel backgrounds, hover states */
  --te-black: #545671;      /* Primary text and icons */

  /* Gray scale */
  --te-gray-light: #EAECF4; /* Element backgrounds */
  --te-gray-mid: #C8CBDB;   /* Borders */
  --te-gray-dark: #808080;  /* Secondary text */

  /* Accent colors */
  --te-orange: #FF6B00;     /* Primary action, active states */
  --te-blue: #00B4D8;       /* Info, focus states */
  --te-green: #4ADE80;      /* Success, toggle active */
  --te-yellow: #FFD60A;     /* Warning */
  --te-red: #EF4444;        /* Danger, destructive actions */
}
```

### Color Usage

| Color | Use Case |
|-------|----------|
| `--te-bg` | Page background |
| `--te-white` | Panel backgrounds, hover states |
| `--te-black` | Text, icons |
| `--te-gray-light` | Element backgrounds (buttons, inputs, toggles) |
| `--te-gray-mid` | All borders |
| `--te-gray-dark` | Secondary/muted text |
| `--te-orange` | Primary buttons, selected/active states |
| `--te-blue` | Info tags, focus borders |
| `--te-green` | Success states, active toggles |
| `--te-red` | Danger buttons, errors |

---

## Spacing

```css
:root {
  --padding-xs: 4px;   /* Tight gaps, between small elements */
  --padding-sm: 8px;   /* Default padding, element gaps */
  --padding-md: 12px;  /* Panel padding, larger gaps */
  --padding-lg: 16px;  /* Page margins, section spacing */
}
```

---

## Border & Shadow

### Border Radius

```css
:root {
  --radius-sm: 4px;  /* Most elements */
  --radius-md: 6px;  /* Panels, larger containers */
}
```

### Border

All interactive elements use:
```css
border: 1px solid var(--te-gray-mid);
```

### Inner Shadow (3D Effect)

Critical for the tactile feel. Apply to ALL interactive elements:
```css
box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4);
```

This creates a subtle highlight at the top edge, making elements appear raised.

---

## Components

### Buttons

All buttons are 32px height with consistent styling:

```css
.btn {
  padding: var(--padding-sm) var(--padding-md);
  font-family: 'Antarctica', sans-serif;
  font-size: 11px;
  font-variation-settings: 'wght' 380;
  font-stretch: 85%;
  border-radius: var(--radius-sm);
  cursor: pointer;
  border: 1px solid var(--te-gray-mid);
  transition: all 0.15s ease;
  text-transform: uppercase;
  letter-spacing: 0.1px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4);
}

.btn:hover {
  transform: translateY(-1px);
}

.btn:active {
  transform: translateY(0);
}
```

#### Button Variants

**Secondary (default)**
```css
.btn-secondary {
  background: var(--te-gray-light);
  color: var(--te-black);
  border-color: var(--te-gray-mid);
}
.btn-secondary:hover {
  background: var(--te-white);
}
```

**Primary**
```css
.btn-primary {
  background: var(--te-orange);
  color: var(--te-white);
  border-color: var(--te-orange);
}
.btn-primary:hover {
  background: #E65C00;
  border-color: #E65C00;
}
```

**Ghost**
```css
.btn-ghost {
  background: transparent;
  color: var(--te-black);
  border-color: var(--te-gray-mid);
}
.btn-ghost:hover {
  background: var(--te-white);
}
```

#### Icon Buttons

Square icon buttons (32x32):
```css
.btn-icon {
  width: 32px;
  padding: 0;
}
```

Use Lucide icons at 14px for standard buttons, 12px for compact contexts.

---

### Tool Buttons

Used in tool palettes:

```css
.tool-btn {
  width: 32px;
  height: 32px;
  padding: 0;
  background: var(--te-gray-light);
  border: 1px solid var(--te-gray-mid);
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4);
  color: var(--te-black);
}

.tool-btn:hover {
  background: var(--te-white);
}

.tool-btn.active {
  background: var(--te-orange);
  color: var(--te-white);
  border-color: var(--te-orange);
}
```

---

### Panels

Floating containers with white background:

```css
.panel {
  background: var(--te-white);
  border: 1px solid var(--te-gray-mid);
  border-radius: var(--radius-sm);
  padding: var(--padding-sm);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4);
}

.panel-title {
  font-size: 10px;
  font-variation-settings: 'wght' 500;
  color: var(--te-gray-dark);
  text-transform: uppercase;
  margin-bottom: var(--padding-sm);
  letter-spacing: 1px;
}
```

---

### Inputs

```css
.input {
  padding: var(--padding-sm);
  font-family: 'Antarctica', sans-serif;
  font-size: 11px;
  font-variation-settings: 'wght' 350;
  font-stretch: 85%;
  border: 1px solid var(--te-gray-mid);
  border-radius: var(--radius-sm);
  background: var(--te-gray-light);
  outline: none;
  transition: all 0.15s;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4);
  height: 32px;
}

.input:focus {
  border-color: var(--te-blue);
  background: var(--te-white);
}
```

---

### Sliders

```css
.slider {
  -webkit-appearance: none;
  width: 120px;
  height: 6px;
  background: var(--te-gray-light);
  border-radius: var(--radius-sm);
  outline: none;
  border: 1px solid var(--te-gray-mid);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4);
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  background: var(--te-gray-light);
  border-radius: var(--radius-sm);
  cursor: pointer;
  border: 1px solid var(--te-gray-mid);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4);
}

.slider::-webkit-slider-thumb:hover {
  background: var(--te-white);
}
```

Slider labels and values use small caps pattern:
```css
.slider-label, .slider-value {
  font-size: 10px;
  font-variation-settings: 'wght' 350;
  color: var(--te-black);
  text-transform: uppercase;
  letter-spacing: 1px;
}
```

---

### Toggles

```css
.toggle {
  width: 44px;
  height: 24px;
  background: var(--te-gray-light);
  border: 1px solid var(--te-gray-mid);
  border-radius: var(--radius-sm);
  position: relative;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4);
}

.toggle.active {
  background: var(--te-green);
  border-color: var(--te-green);
}

.toggle::after {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  background: var(--te-gray-light);
  border: 1px solid var(--te-gray-mid);
  border-radius: 3px;
  top: 3px;
  left: 3px;
  transition: transform 0.2s;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4);
}

.toggle.active::after {
  transform: translateX(20px);
  background: var(--te-white);
  border-color: var(--te-green);
}
```

---

### Character Picker Items

List items for character selection:

```css
.char-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--padding-sm);
  background: var(--te-gray-light);
  border: 1px solid var(--te-gray-mid);
  border-radius: var(--radius-sm);
  margin-bottom: var(--padding-xs);
  cursor: pointer;
  transition: all 0.15s;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4);
}

.char-item:hover {
  background: var(--te-white);
}

.char-item.selected {
  background: var(--te-orange);
  border-color: var(--te-orange);
  color: var(--te-white);
}

.char-item .char {
  font-size: 14px;
  font-variation-settings: 'wght' 500;
}

.char-item .status {
  font-size: 10px;
  font-variation-settings: 'wght' 350;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.char-item.selected .status {
  color: rgba(255, 255, 255, 0.8);
}
```

---

### Tags/Badges

Small status indicators:

```css
.tag {
  display: inline-block;
  padding: 3px 6px 2px;
  font-size: 9px;
  font-variation-settings: 'wght' 500;
  border-radius: 3px;
  text-transform: uppercase;
  line-height: 1.1;
  letter-spacing: 1px;
}

.tag-orange { background: var(--te-orange); color: var(--te-white); }
.tag-blue { background: var(--te-blue); color: var(--te-white); }
.tag-green { background: var(--te-green); color: var(--te-black); }
.tag-gray { background: var(--te-gray-mid); color: var(--te-black); }
```

---

### Tool Palette Container

```css
.tool-palette {
  display: flex;
  flex-direction: column;
  gap: var(--padding-xs);
  background: var(--te-white);
  padding: var(--padding-sm);
  border-radius: var(--radius-sm);
  border: 1px solid var(--te-gray-mid);
  width: fit-content;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4);
}

.tool-separator {
  height: 1px;
  background: var(--te-gray-mid);
  margin: var(--padding-xs) 0;
}
```

---

### Zoom Controls

Horizontal control group:

```css
.zoom-controls {
  display: flex;
  align-items: center;
  gap: var(--padding-xs);
  background: var(--te-white);
  padding: var(--padding-sm);
  border-radius: var(--radius-sm);
  border: 1px solid var(--te-gray-mid);
  width: fit-content;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4);
}
```

---

## Icons

Use [Lucide Icons](https://lucide.dev) with these settings:

- Default size: 14px × 14px
- Compact contexts: 12px × 12px
- Color: `var(--te-black)` (inherits from parent)
- Stroke width: default (2)

```html
<i data-lucide="icon-name" style="width:14px;height:14px;"></i>
```

Initialize with:
```javascript
lucide.createIcons();
```

---

## Implementation Checklist

When implementing this design system in React:

### Global Styles
- [ ] Load Antarctica font via @font-face
- [ ] Set CSS custom properties on :root
- [ ] Apply base font settings to body

### Every Interactive Element Must Have
- [ ] `border: 1px solid var(--te-gray-mid)`
- [ ] `border-radius: var(--radius-sm)`
- [ ] `box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4)`
- [ ] `background: var(--te-gray-light)` (default state)
- [ ] `transition: all 0.15s ease`

### Text Elements
- [ ] Labels/status text: 10px, uppercase, 1px letter-spacing
- [ ] Button text: 11px, weight 380, uppercase, 0.1px letter-spacing
- [ ] All text uses `var(--te-black)` color
- [ ] Icons also use `var(--te-black)` color

### Buttons
- [ ] Height: 32px (all types)
- [ ] Icon buttons: 32px × 32px
- [ ] Hover: `background: var(--te-white)`
- [ ] Active state: `background: var(--te-orange)`, border matches

### State Colors
- [ ] Selected/active: `var(--te-orange)` with white text
- [ ] Success/on: `var(--te-green)`
- [ ] Focus: `var(--te-blue)` border
- [ ] Danger: `var(--te-red)`

---

## Reference

See `/public/ui-demo.html` for a complete working example of all components.
