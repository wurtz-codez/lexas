---
name: Lexas AI Briefing
colors:
  surface: '#fbf9fa'
  surface-dim: '#dbd9db'
  surface-bright: '#fbf9fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f3f4'
  surface-container: '#efedef'
  surface-container-high: '#eae7e9'
  surface-container-highest: '#e4e2e3'
  on-surface: '#1b1b1d'
  on-surface-variant: '#44474c'
  inverse-surface: '#303032'
  inverse-on-surface: '#f2f0f2'
  outline: '#74777d'
  outline-variant: '#c4c6cd'
  surface-tint: '#506073'
  primary: '#162536'
  on-primary: '#ffffff'
  primary-container: '#2c3b4d'
  on-primary-container: '#95a5bb'
  inverse-primary: '#b8c8de'
  secondary: '#545f6d'
  on-secondary: '#ffffff'
  secondary-container: '#d8e3f4'
  on-secondary-container: '#5a6573'
  tertiary: '#322108'
  on-tertiary: '#ffffff'
  tertiary-container: '#4a361b'
  on-tertiary-container: '#bc9f7c'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d4e4fb'
  primary-fixed-dim: '#b8c8de'
  on-primary-fixed: '#0d1d2d'
  on-primary-fixed-variant: '#39485a'
  secondary-fixed: '#d8e3f4'
  secondary-fixed-dim: '#bcc7d7'
  on-secondary-fixed: '#111c28'
  on-secondary-fixed-variant: '#3d4855'
  tertiary-fixed: '#feddb7'
  tertiary-fixed-dim: '#e0c19d'
  on-tertiary-fixed: '#281802'
  on-tertiary-fixed-variant: '#584327'
  background: '#fbf9fa'
  on-background: '#1b1b1d'
  surface-variant: '#e4e2e3'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-padding: 40px
  gutter: 24px
  section-gap: 64px
  max-width: 1200px
---

## Brand & Style

The design system is engineered to evoke a sense of focused intelligence and premium hospitality. It is designed for high-performing professionals who require clarity amidst information density. The visual narrative combines the sleek, precision-engineered ethos of modern computing with the warm, organic textures of high-end editorial design.

The style is a sophisticated blend of **Glassmorphism** and **Minimalism**. It utilizes translucency to maintain a sense of space and context, while the generous use of "Soft Linen" surfaces provides a grounding, tactile quality that distinguishes it from cold, purely digital interfaces. The interaction model is calm and deliberate, avoiding aggressive transitions in favor of subtle fades and depth shifts.

## Colors

This design system uses a warm-neutral foundation to reduce eye strain during long reading sessions. 

- **Primary & Secondary:** These charcoal and jet tones are reserved for high-contrast text, primary navigation anchors, and deep-state backgrounds.
- **Accents:** "Sandy Brown" is the primary action color, used for CTA highlights and notifications. "Reddish Brown" serves as a secondary accent for categorization or semantic warnings.
- **Surfaces:** "Soft Linen" is the global background. "Pale Oak" is used for structural borders and secondary containers to create subtle contrast without relying on harsh lines.
- **Glassmorphism:** Use `glass_white_hex` with a 20px-40px backdrop blur for overlays, floating toolbars, and the center-aligned navigation bar.

## Typography

The system utilizes **Plus Jakarta Sans** for its friendly yet professional geometry, mimicking the smooth curves of Apple's rounded fonts. 

Key principles:
- **Generous Leading:** Body text uses a multiplier of 1.5x–1.6x to ensure the AI-generated briefings are highly legible.
- **Hierarchy:** Use the Primary Charcoal Blue for headlines to ensure weight, and a 60% opacity of Jet Black for secondary body text.
- **Alignment:** The brand mark "lexas" in the navbar should always be lowercase, center-aligned, and set in `headline-md` with slightly increased letter spacing.

## Layout & Spacing

This design system follows a **Fixed Grid** approach for desktop to maintain an editorial feel, centered on a 1200px maximum width.

- **The Navbar:** A fixed-top, glassmorphic bar (80px height). The branding is perfectly centered. Navigation items and profile actions are pushed to the far left and right edges respectively.
- **The Briefing Feed:** A single-column layout centered on the screen (approx. 800px width) to minimize horizontal eye movement.
- **Margins:** High-density content is avoided. Use `section-gap` between major content blocks to provide "room to breathe," mirroring the whitespace-heavy aesthetic of premium hardware marketing.

## Elevation & Depth

Depth is communicated through light and physics, rather than traditional dark shadows.

1.  **Base Level:** The "Soft Linen" background.
2.  **Card Level:** "Pale Oak" or White surfaces with a very soft, high-spread shadow: `0 10px 30px rgba(44, 59, 77, 0.05)`.
3.  **Floating Level:** Glassmorphic elements (Navbars, Modals) using a `40px` backdrop blur and a thin `1px` inner white border (stroke) at 20% opacity to define the edge against the background.
4.  **Active State:** Buttons and interactive elements lift slightly on hover using a more pronounced shadow and a 1.02x scale transform.

## Shapes

The shape language is defined by extreme "squircle-like" rounding to create an approachable, high-end feel.

- **Containers/Cards:** Use a minimum radius of **24px**. For large layout sections, this can scale up to **32px**.
- **Buttons & Inputs:** Use a consistent **12px** radius.
- **Icon Enclosures:** Small chips or icon buttons should use a **10px** radius or be fully circular (pill) depending on context.
- **Selection States:** Use a 12px rounded background highlight for menu selection items.

## Components

### Buttons
- **Primary:** Background in Jet Black or Sandy Brown, white text, 12px radius. No border.
- **Secondary:** Transparent background with a 1.5px stroke of Charcoal Blue (20% opacity).
- **Glass:** White at 10% opacity with a heavy backdrop blur for buttons sitting on top of imagery.

### Cards
- Standard briefing cards use a white background, 24px radius, and a 1px "Pale Oak" border. Content should have 32px of internal padding.

### Input Fields
- Soft Linen background (slightly darker than the page) or transparent with a Pale Oak bottom border. 12px radius for fully enclosed fields. Focus state should highlight the border in Sandy Brown.

### Navigation Bar
- A floating "Island" style or full-width glass bar. The branding "lexas" is the anchor point in the dead center.

### Chips/Tags
- Small, 12px height text inside 8px rounded boxes. Use subtle tints of the accent colors (e.g., 10% opacity Sandy Brown background with 100% opacity Reddish Brown text).

### Iconography
- Use thick-stroke (2pt), rounded-cap icons. Ensure all icons are visually weighted to match the Plus Jakarta Sans typography.
