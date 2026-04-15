# STYLING GUIDE (Shell UI Design Reference)

This file is the style source-of-truth guide for developers.

It explains colors, fonts, buttons, spacing, and common UI patterns in simple language.

## 1) Where Style Comes From

Main style files:

- `src/styles/variables.css`
- `src/styles/theme.css`
- `src/styles/globals.css`
- `src/app/layout.js` (font loading)

Use these files first before adding new CSS.

## 2) Core Design Tokens (Colors + Fonts)

Defined in `src/styles/variables.css`.

### Font Tokens

- `--psb-font-primary`: Inter stack
- `--psb-font-secondary`: Manrope stack
- `--psb-sans`: alias to primary font
- `--psb-serif`: alias to secondary font

### Color Tokens

- `--psb-bg`: `#eef3f8` (main app background)
- `--psb-surface`: `#ffffff` (cards/surfaces)
- `--psb-text`: `#173348` (default text)
- `--psb-muted`: `#4f6578` (muted text)
- `--psb-border`: `#c8d7e4` (default border)
- `--psb-brand`: `#1d597f` (brand blue)
- `--psb-brand-2`: `#2b7b89` (secondary brand)
- `--psb-gold`: `#c4a06b` (accent)
- `--psb-ink`: `#102736` (deep text)

### Visual Swatches (Tiny Preview Chips)

Use this quick table when choosing colors during UI work.

| Token | Tiny Preview | Hex | Typical Use |
|---|---|---|---|
| `--psb-bg` | <span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:#eef3f8;border:1px solid #d8e3ed;"></span> | `#eef3f8` | Main app background |
| `--psb-surface` | <span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:#ffffff;border:1px solid #d8e3ed;"></span> | `#ffffff` | Cards, panels, form surfaces |
| `--psb-text` | <span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:#173348;border:1px solid #102433;"></span> | `#173348` | Default text |
| `--psb-muted` | <span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:#4f6578;border:1px solid #3f5363;"></span> | `#4f6578` | Secondary text |
| `--psb-border` | <span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:#c8d7e4;border:1px solid #b3c5d4;"></span> | `#c8d7e4` | Borders and separators |
| `--psb-brand` | <span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:#1d597f;border:1px solid #164864;"></span> | `#1d597f` | Brand-heavy actions and accents |
| `--psb-brand-2` | <span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:#2b7b89;border:1px solid #22626d;"></span> | `#2b7b89` | Secondary brand accents |
| `--psb-gold` | <span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:#c4a06b;border:1px solid #a78658;"></span> | `#c4a06b` | Warm accent/highlight |
| `--psb-ink` | <span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:#102736;border:1px solid #0c1f2b;"></span> | `#102736` | Deep titles and strong contrast text |

### Shadow Token

- `--psb-shadow`: `0 12px 32px rgba(18, 54, 83, 0.12)`

## 3) Typography Rules

Loaded in `src/app/layout.js`:

- Primary Google font: Inter
- Secondary Google font: Manrope

Global assignments in `src/styles/globals.css`:

- Body/default text uses primary font
- Headings (`h1` to `h6`) use secondary font

Dense workspace scale:

- Base text: `13px`
- Labels: `11px`
- Section headers/card headers: `14px`
- Main heading level in dense mode (`h1`, `h2`): `18px`

## 4) Global Layout + Background

From `src/styles/theme.css`:

- Body background uses layered radial gradients plus `--psb-bg`
- App content max width: `1440px`
- Body area uses responsive padding

Meaning:

- The app has a soft, light-blue professional background instead of plain white.

## 5) Form Controls And Density

From `src/styles/globals.css` under `.dense-workspace`:

- Inputs/select height: `32px`
- Input radius: `0.45rem`
- Compact row gutters for dense data screens
- Textareas have compact defaults and vertical resize

Login form has a separate larger style system:

- Login inputs: `46px` height
- Larger title/subtitle sizes for authentication screen

## 6) Button Style Standards

## 6.1 Base Button Sizing (Dense Workspace)

Global compact button sizing:

- `.dense-workspace .btn`: `12px` font, compact padding
- `.dense-workspace .btn-sm`: `11px` font, tighter padding

Use this for internal tool pages.

## 6.2 Primary Auth Button (Login)

Class: `.portal-signin-btn`

- Default gradient: `#0b4f78 -> #1670a2 -> #2584b2`
- Hover gradient: darker blue range
- Active gradient: darkest pressed state
- Disabled gradient: muted blue-gray

Meaning:

- Sign in button has strong visual weight and clear interaction states.

## 6.3 Profile Primary Action Button

Class: `.profile-action-primary`

- Gradient: `#1a587a -> #2b6f92`
- Hover: darker gradient
- Text: white

Use for high-priority action buttons in profile area.

## 6.4 Icon Action Buttons

Class: `.setup-row-icon-btn`

- Fixed square size: `30px x 30px`
- Centered icon style
- Reduced opacity when disabled

Use for table row actions (edit/delete).

## 6.5 Navigation-like Button Patterns

Classes:

- `.setup-side-nav-item`
- `.setup-side-nav-item.is-active`

Active state uses:

- Border: `#1f5f93`
- Background: light blue gradient
- Text: deeper blue tone

Use this pattern for vertical section navigation.

## 6.6 Button State Matrix (Mini Table)

This quick matrix is for fast UI checks during implementation and QA.

| Class | Default | Hover | Active | Disabled | Focus |
|---|---|---|---|---|---|
| `.portal-signin-btn` | Blue gradient `#0b4f78 -> #1670a2 -> #2584b2`, rounded 12px, shadow | Darker gradient (`:hover`) | Darkest gradient + slight press (`transform: translateY(1px)`) | Muted blue-gray gradient, no shadow | Same visual as hover (`:hover, :focus` combined rule) |
| `.profile-action-primary` | Blue gradient `#1a587a -> #2b6f92`, white text | Darker blue gradient (`:hover`) | No custom active rule (inherits default/Bootstrap behavior) | No custom disabled rule (inherits default/Bootstrap behavior) | Same visual as hover (`:hover, :focus` combined rule) |
| `.setup-row-icon-btn` | 30x30 icon button, centered content | No custom hover rule in shell CSS | No custom active rule in shell CSS | `opacity: 0.45`, `pointer-events: none` | No custom focus rule in shell CSS |
| `.dense-workspace .btn` | Compact text/padding standard for tool UI | No custom hover rule at global density level | No custom active rule at global density level | No custom disabled rule at global density level | No custom focus rule at global density level |

Note:

- "No custom rule" means the component will follow Bootstrap defaults or more specific component-level classes.

## 7) Header/Nav Styling

Classes in `src/styles/globals.css`:

- `.app-header`
- `.app-header-tab`
- `.app-header-tab.active`
- `.app-header-progress-bar`

Highlights:

- Sticky top header with white surface and subtle border
- Active tab has light blue background + underline indicator
- Loader bar uses blue animated gradient

## 8) Card And Tile Styling

### Tile cards

Class: `.tile-card`

- Border, rounded corners, subtle lift on hover
- Hover adds shadow and slight translate up

### Setup/editor cards

Class: `.setup-editor-card`

- White surface
- Soft border and subtle shadow
- Rounded corners

### Org and module cards

Classes like `.my-apps-org-card`, `.my-app-card`

- White surfaces with blue-gray borders
- Light shadows for depth

## 9) Toast/Feedback Colors

Global toast variants use these colors:

- Success: green-tinted background and border (`.global-toast-success`)
- Warning: warm yellow tint (`.global-toast-warning`)
- Error: red tint (`.global-toast-error`)
- Info: blue tint (`.global-toast-info`)

Meaning:

- Every feedback type has a clear, consistent color language.

## 10) Login Screen Look And Feel

Main classes:

- `.portal-login-shell`
- `.portal-login-split`
- `.portal-login-brand`
- `.portal-login-form-shell`
- `.psb-title`

Visual direction:

- Split panel layout
- Deep blue brand panel with gradients
- Light panel for form
- Large, bold title
- Responsive behavior for mobile widths

## 11) Style Do And Dont

DO:

1. Reuse existing token variables from `variables.css`
2. Follow dense-workspace sizing for internal app pages
3. Keep button states (default/hover/active/disabled) consistent
4. Reuse existing class patterns before inventing new ones

DONT:

1. Hardcode random colors when a token exists
2. Mix different spacing systems in same screen
3. Use oversized controls in dense operation pages
4. Introduce a new button style for every page

## 12) How To Add A New Style Safely

1. Check if existing class already solves it.
2. If not, use existing color/font tokens.
3. Add new class in `src/styles/globals.css` with clear naming.
4. Test desktop and mobile.
5. Confirm hover/focus/disabled states for interactive elements.

## 13) Quick Copy Reference

Most used blue tones:

- `#1f5f93` (action blue)
- `#0f3f61` (title blue)
- `#577286` (muted supporting text)

Most used surfaces:

- `#ffffff` (cards, forms)
- `#eef3f8` (app background token)
- Light blue gradients for highlights and active states

If unsure, start from existing classes instead of creating a brand-new visual language.

## 14) Component-By-Component Style Map (Direct Class References)

Source files for these classes:

- [src/styles/globals.css](src/styles/globals.css)
- [src/styles/variables.css](src/styles/variables.css)
- [src/styles/theme.css](src/styles/theme.css)

### A) Header Map

- `.app-header`: sticky top shell, border, white surface, spacing.
- `.app-header-left` and `.app-header-right`: left/right content grouping.
- `.app-header-title`: main product title color and weight.
- `.app-header-subtitle`: supporting subtitle style.
- `.app-header-tabs`: desktop tab row container.
- `.app-header-tab`: default tab style.
- `.app-header-tab:hover`: hover background and text shift.
- `.app-header-tab.active`: active tab highlight state.
- `.app-header-tab.active::after`: active underline bar.
- `.app-header-mobile-nav` and `.app-header-mobile-nav .form-select`: mobile nav dropdown styles.
- `.app-header-user`: greeting text style.
- `.app-header-progress-shell`: progress rail container.
- `.app-header-progress-bar`: animated navigation/API loading bar.

### B) Login Map

- `.portal-login-shell`: full viewport login background with layered gradients.
- `.portal-login-split`: split two-panel card container.
- `.portal-login-brand`: left branding panel gradient and overlay setup.
- `.portal-login-brand-inner`: branding content layout.
- `.portal-login-logo`: logo sizing and fitting.
- `.psb-title`: large brand title text behavior.
- `.portal-brand-copy`: supporting brand message text style.
- `.portal-login-main`: right-side form panel background and spacing.
- `.portal-login-form-shell`: glass-like login form container.
- `.portal-login-title`: login heading.
- `.portal-login-subtitle`: helper subtitle copy.
- `.portal-login-form`: form field spacing grid.
- `.portal-login-label`: label style.
- `.portal-login-input`: base input style.
- `.portal-login-input:focus`: focus ring and border color.
- `.portal-password-toggle`: show/hide password toggle style.
- `.portal-signin-btn`: primary sign-in button.
- `.portal-signin-btn:hover`: hover state.
- `.portal-signin-btn:active`: pressed state.
- `.portal-signin-btn:disabled`: disabled state.
- `.portal-inline-error`: inline auth error style.
- `.portal-login-form-shake`: failed-login shake animation trigger class.

### C) Setup Tables Map

- `.setup-shell`: overall setup page min-height shell.
- `.setup-split-layout`: two-column layout (side nav + content).
- `.setup-side-nav`: left navigation card.
- `.setup-side-nav-item`: navigation row style.
- `.setup-side-nav-item.is-active`: active navigation row style.
- `.setup-side-nav-item.is-inactive`: inactive navigation row style.
- `.setup-side-nav-dirty-dot`: unsaved-change indicator dot.
- `.setup-content-pane`: right content pane wrapper.
- `.setup-editor-card`: core white editor panel.
- `.setup-table`: table-level shared styles.
- `.setup-table-header`: table section header row.
- `.setup-editor-title`: setup table title style.
- `.setup-editor-description`: subtitle/help text style.
- `.setup-pending-pill`: unsaved badge style.
- `.setup-row-icon-btn`: row action button shell (edit/delete).
- `.setup-row-new`, `.setup-row-modified`, `.setup-row-pending-remove`: row state backgrounds.
- `.setup-cell-changed` and `.setup-input-changed`: changed-cell visual emphasis.

### D) Dashboard Cards Map

- `.my-apps-portal-hero`: dashboard hero panel.
- `.my-apps-portal-title` and `.my-apps-portal-copy`: hero text hierarchy.
- `.my-apps-org-card`: organization info card shell.
- `.my-app-card`: app card container.
- `.my-app-card-icon`: app icon capsule.
- `.my-app-card-copy`: app card text block min-height.
- `.tile-card`: generic dashboard tile style.
- `.tile-card:hover`: lift + shadow hover interaction.
- `.tile-badge`: uppercase micro-label style.
- `.tile-cta`: card call-to-action link style.
- `.my-apps-skeleton-card` and `.my-apps-skeleton-line*`: loading skeleton visuals.

### Quick Usage Rule

- For Header work: start with `.app-header*` classes.
- For Login work: start with `.portal-login*`, `.psb-title`, `.portal-signin-btn`.
- For Setup tables: start with `.setup-*` classes.
- For Dashboard cards: start with `.my-apps-*` and `.tile-*` classes.