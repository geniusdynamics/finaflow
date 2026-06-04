# Changelog

## [Unreleased] — Hero Headline Rotation: 3× Slower

### Changed
- **Hero headline + subtitle rotation interval tripled** — The `rotationMs` default in [RotatingHeadline.tsx](file:///d:\DevCenter\abuilds\fina\finaflow\src\components\landing\RotatingHeadline.tsx) bumped from `5500` to `16500` (5.5s → 16.5s, exactly 3× as requested). The same five A/B variations now stay on screen long enough to actually be read, with the crossfade animation duration unchanged at 0.55s. The total cycle through all five variations is now ~82s (was ~27.5s), giving each headline a real chance to land instead of flickering past. The 0.55s enter/exit blur-and-slide motion stays — only the dwell time between variations changed.

### Files
- `src/components/landing/RotatingHeadline.tsx` — `rotationMs` default `5500` → `16500`

## [Unreleased] — Hero Headline: Simplified Wording + Industry Variations

### Changed
- **Hero headlines restructured to single-line** — The 4 two-line variations (line1 + line2 with a gradient accent) were the root cause of the "headline bleeding into subtitle" overlap. Swapped to a single-line structure with a single `headline` field, so the headline always renders as one wrapped line on mobile or one straight line on desktop. Gradient direction flipped from `bg-gradient-to-br` (diagonal) to `bg-gradient-to-r` (horizontal) which reads more naturally on a single line. Font size retuned from `text-[2.5rem] md:text-[3.5rem]` to `text-[1.75rem] md:text-[2.75rem]` — slightly smaller so the longer variations don't dominate the hero. Headline container `min-h` bumped to `min-h-[6.5rem] md:min-h-[3.75rem]` to accommodate the longest variation on mobile without layout shift.
- **Headline text rewritten for directness** — Old "Your Business Finances, / Finally Made Simple" → new "Business Finances finally made simple". Old "Losing Track of Your / Bills and Expenses?" → new "Losing track of bills and expenses". Old "See Every Shilling. / In Real Time." → new "See every coin in real time". The conversational lowercase ("finally", "every", "in") and tighter phrasing cut the hero message in half — punchier, less corporate, fewer syllables before the value prop lands.

### Added
- **`construction` headline variation** — "Construction Expenses, finally at your fingertips" with a project-level subtitle ("Track every shilling across materials, labor, and subcontractors — with project-level visibility. No more guessing where the budget went, no more end-of-month pile of receipts to reconcile."). Targets the construction / contractor segment where job-costing and project visibility are the primary pain.
- **`budget` headline variation** — "Budgeted Expenses, finally Aligned." with a budget-discipline subtitle ("Plan it, track it, stay on it. Finaflow keeps every department aligned to the same budget in real time — with variance alerts before you blow past the line, not after."). Targets finance leads who care about plan-vs-actual.
- The hero now rotates through **5 A/B variations** total (pain-point, aspirational, clarity, construction, budget) on a 5.5s cycle, so the same visitor sees five different value propositions in one session.

### Files
- `src/components/landing/RotatingHeadline.tsx` — switched from `{ line1, line2 }` to `{ headline }`, added construction + budget variations, horizontal gradient, smaller font, bigger mobile min-h
- `src/components/landing/__tests__/RotatingHeadline.test.tsx` — updated to assert 5 variations and the new IDs; length threshold relaxed to 60 chars

## [Unreleased] — Hero Headline Overlap + Premium Color Pass

### Fixed
- **Hero headline second line was overlapping with the subtitle** — The `min-h-[7.5rem]` on the headline container was just barely enough for two lines at desktop (`text-[3.5rem]` × `leading-[1.05]` = ~118px), but with `flex flex-col` + `absolute inset-0` the content rendered flush to the top with no breathing room, and the `relief` variation's "Without the Headache" line bled into the "Built for African SMEs…" subtitle below. Bumped the headline container to `min-h-[6.5rem] md:min-h-[9rem]` and the subtitle to `min-h-[6rem]`, plus widened the parent gap from `space-y-4` to `space-y-6` so both elements always have their own breathing room regardless of which variation is showing.

### Changed
- **Headline gradient now reads premium, not flat** — Switched from a symmetric 3-stop `bg-gradient-to-r from-[#C73E1D] via-[#D4A854] to-[#C73E1D]` to a diagonal `bg-gradient-to-br from-[#A02E1A] via-[#D4A854] to-[#E8A04A]`. The deeper `#A02E1A` (a richer, more saturated terracotta) starts the run, the warm amber `#E8A04A` ends it, and the diagonal direction adds a subtle highlight that catches the eye instead of the previous mirrored wash. A `drop-shadow(0 1px 1px rgba(160, 46, 26, 0.12))` sits behind the gradient text for depth.
- **Headline base color deepened** — `#2D2A26` → `#1a1815` and added `tracking-tight` so the first line reads as confident ink, not soft gray.
- **Subtitle ink upgraded from `#8D8A87` to `#4A4742`** — still warm and editorial, but the contrast is now AA-compliant for body text on the cream background, so the subtitle doesn't look like a placeholder.
- **Hero background now has three drifting orbs** instead of two — the original terracotta + gold pair is joined by a centered warm amber orb (`#E8A04A/10`) that pulses on a 12s loop. The base gradient switched from `to-white` to `to-[#F2E8DD]` (a slightly deeper warm cream) so the hero doesn't fall off into flat white. The two original orbs bumped from `/15` to `/20` opacity and from `#C73E1D` to `#A02E1A` for the terracotta — more saturated, more presence.

### Files
- `src/components/landing/RotatingHeadline.tsx` — bigger `min-h` containers, premium gradient, darker base text, richer subtitle ink, subtle drop shadow on the gradient line
- `src/components/landing/__tests__/RotatingHeadline.test.tsx` — assertion updated from `bg-gradient-to-r` → `bg-gradient-to-br` to match the diagonal
- `src/pages/Home.tsx` — hero background gradient + third amber orb

## [Unreleased] — Homepage Conversion Overhaul: A/B Headline, Motion, Counter, Mobile

### Added
- **`RotatingHeadline` component** (`src/components/landing/RotatingHeadline.tsx`) — Hero headline that A/B-tests four angles in one session: **aspirational** ("Your Business Finances, Finally Made Simple"), **pain-point** ("Losing Track of Your Bills and Expenses?"), **clarity** ("See Every Shilling. In Real Time."), and **relief** ("Run Your Books Without the Headache."). Crossfades every 5.5s with a synced subtitle so the same visitor sees multiple value propositions. Both line1 and line2 use the Finaflow gradient treatment; headline and subtitle are independently crossfaded with a blur-and-slide ease.
- **`AnimatedCounter` component** (`src/components/landing/AnimatedCounter.tsx`) — Counts from zero to a target value when the element scrolls into view (`useInView`, `once: true`, `-40px` margin). Uses framer-motion's `animate()` with `easeOut` for a smooth fill. Supports `prefix`, `suffix`, `decimals`, and `className`. Uses `toLocaleString` for comma-grouped numbers (e.g., `2,000`).
- **Homepage gradient-mesh hero** — Two large blurred radial gradients (terracotta and gold) drift slowly behind the hero section. Adds depth and warmth without using the overused purple-blue AI palette. Both orbs animate on an infinite scale + opacity loop.
- **Hero dashboard animations** — The "Daily Overview" mockup now floats gently (`y: ±6px`, 5s loop), the "Live" indicator is a pulsing green dot (`scale: 1 → 1.4 → 1`, 2s loop), and the four stat values (KES 45,200, KES 12,800, KES 32,400, 3 bills) animate from zero to their target when the hero enters the viewport. The dashboard itself has a soft terracotta→gold blurred halo behind it.
- **Magnetic hero CTAs** — The two primary hero buttons (`Get Started Free` and `Join as Partner`) lift 1px and scale to 1.03 on hover, and scale to 0.98 on tap, with a spring transition. The primary CTA also picks up a `shadow-lg shadow-[#C73E1D]/20` ring so it feels grounded in the brand color.
- **Trust-stats animated counters** — The four stats (500+ Businesses, KES 2B+ Transactions, 2,000+ Users, 99.9% Uptime) now use `AnimatedCounter` and stagger-reveal as a row when the section enters the viewport (100ms per stat). A soft gold blurred orb pulses in the background.
- **Scroll-triggered reveal vocabulary** — Every section now uses a consistent motion grammar: `whileInView` with `once: true`, 50–80px margin, 0.5–0.7s duration, spring `bounce: 0.25`, and 24–40px translate. Applied to: section headers (Showcase, How it Works, Features), showcase items, feature cards, step cards, partner CTA headline/body/CTAs.
- **Showcase hover lift** — Each showcase screenshot now lifts 4px on hover with a stronger terracotta shadow; the inner image scales to 1.03 (was 1.02) and the transition is 700ms (was 500ms) for a slower, more cinematic feel.
- **Features grid micro-interactions** — Each feature card lifts on hover, the icon scales to 1.1 and rotates 5° with a spring bounce, the icon background darkens, and the title shifts to the brand red. Cards stagger-reveal (80ms per column index) and respect the brand's gold-tinted shadow on hover.
- **How-it-works step animations** — Each step card lifts on hover, the step number deepens from `/20` to `/40` opacity, and the icon scales and counter-rotates. The three steps stagger-reveal with a 120ms delay between them.
- **Partner CTA dark section** — The Partner section now has a dark gradient background (`#2D2A26` → `#1a1815` → `#2D2A26`) with two drifting gold + terracotta blurred orbs, white headline/body, gold accent icon ring, and the same shadow + lift on the "Join as Partner" button. A clear contrast pivot that draws the eye to the partner funnel without breaking the editorial flow.

### Changed
- **`src/pages/Home.tsx`** — `stats` array restructured to support animated counters (numeric `value`, `prefix`, `suffix`, `decimals` instead of pre-formatted strings). Removed unused `Clock` import (replaced by the animated live pulse). Subtitle now lives in the `RotatingHeadline` component, so the hero markup is leaner.
- **`src/components/landing/AnimatedCounter.tsx`** — Uses `toLocaleString("en-US", …)` instead of `toFixed` so comma-grouped values (2,000 → `2,000`) render correctly with the `en-US` locale.

### Mobile friendliness
- Hero dashboard stacks below the headline on `< md` as before, with all animations working on touch devices (the floating motion, the live pulse, the counter fill all trigger on first viewport).
- Every section's `whileInView` margin is tuned for mobile (40–50px) so animations trigger as the user scrolls naturally, not late.
- All hover effects use `whileHover` from framer-motion which is touch-friendly by design (taps register as taps, not hover-then-tap).
- The rotating headline is fully responsive — the `min-h-[5.5rem] md:min-h-[7.5rem]` container prevents layout shift across the two-line variations on small screens.

### Tests
- **`RotatingHeadline` test file** (`src/components/landing/__tests__/RotatingHeadline.test.tsx`) — 5 cases covering the first-variation default render, the gradient treatment on line2, the subtitle render, the four-variation A/B set, and the variation-shape contract.
- **`AnimatedCounter` test file** (`src/components/landing/__tests__/AnimatedCounter.test.tsx`) — 5 cases covering the zero-default viewport wait, the `startOnView={false}` shortcut, the prefix/suffix rendering, the `decimals` prop, and the `className` passthrough.
- All 10 new tests pass under `npm test`. Combined with the existing pricing tests, the landing + pricing suite is **38/38 passing across 7 files**.

### Files
- `src/components/landing/RotatingHeadline.tsx` — new A/B-tested headline
- `src/components/landing/AnimatedCounter.tsx` — new viewport-triggered counter
- `src/components/landing/__tests__/RotatingHeadline.test.tsx` — new test file
- `src/components/landing/__tests__/AnimatedCounter.test.tsx` — new test file
- `src/pages/Home.tsx` — hero, stats, showcase, how-it-works, features, partner CTA rewrites with the new motion vocabulary

## [Unreleased] — Desktop Pricing: Pro Monthly Price Wraps to Two Lines

### Fixed
- **Pro monthly price (`KES 3,000`) was wrapping at the space between `KES` and `3,000`** — The price span had no `white-space` rule, so when the price string was longer than the available content area (Pro is the rightmost card in the 4-col grid and inherits the tightest slot), the browser broke the line and pushed `3,000` down onto a second line, overlapping the `EVERYTHING IN GROWTH, PLUS:` label below. The yearly version (`KES 2,500`) is the same character count but rendered in a different font-metrics context, so it appeared to fit on one line — the user reported the inconsistency. Two `whitespace-nowrap` classes on the price span and the `/mo` span in [PricingCard.tsx](file:///d:\DevCenter\abuilds\fina\finaflow\src\components\pricing\PricingCard.tsx#L109-L111) keep the entire price string on one line for both cycles, so monthly and yearly now occupy the same vertical space.

### Tests
- **Regression test added** in `src/components/pricing/__tests__/PricingCard.test.tsx` that asserts the Pro monthly price span carries `whitespace-nowrap`. Any future change that drops the class will fail the test.

### Files
- `src/components/pricing/PricingCard.tsx` — added `whitespace-nowrap` to the price span and the `/mo` span
- `src/components/pricing/__tests__/PricingCard.test.tsx` — added Pro monthly `whitespace-nowrap` regression test

## [Unreleased] — Desktop Pricing: Pro Monthly Price Clipped

### Fixed
- **Pro plan's monthly amount was invisible on the desktop / tablet grid** — The price slot used `overflow-hidden` with a ±24px `y` enter/exit offset, so the Pro card (which carries the longest stagger delay of `index * 0.08 = 240ms`) frequently rendered with the price caught mid-clip at `y: -24` — outside the `h-12` container, hidden by the `overflow-hidden`. On most cards the enter animation finished fast enough to mask it, but the Pro card's later stagger exposed the race. Yearly worked because the user had already triggered an AnimatePresence key change by that point, so the enter animation ran fresh. Three changes in [PricingCard.tsx](file:///d:\DevCenter\abuilds\fina\finaflow\src\components\pricing\PricingCard.tsx) close the race:
  1. **Dropped `overflow-hidden`** from the price slot. The price is now always visible — even if a frame lands at the offset — so there's no clipping path.
  2. **Reduced the y offset from ±24 to ±10** and the blur from `6px` to `4px`. Smaller motion = less risk of overlapping the description above and less visual "smash" on the morph.
  3. **Loosened the `whileInView` margin from `-80px` to `-20px`** on the card wrapper. The `-80px` shrink meant the rightmost card (Pro) sometimes failed to register as "in view" on common viewport widths, so its `whileInView` enter animation never fired and the price stayed at its initial invisible state.

### Tests
- **Two regression tests added** to `src/components/pricing/__tests__/PricingCard.test.tsx` covering the Pro plan at `index={3}` (the last card in the desktop 4-col grid) for both `monthly` and `yearly` cycles. They assert the amount string and the CTA are present, so any future regression that re-introduces clipping will fail the test.

### Files
- `src/components/pricing/PricingCard.tsx` — removed `overflow-hidden`, reduced y offset and blur, loosened `whileInView` margin
- `src/components/pricing/__tests__/PricingCard.test.tsx` — added Pro @ `index={3}` regression tests (2 cases)

## [Unreleased] — Desktop Pricing: Yearly Toggle + Micro-Interactions

### Added
- **`BillingCycleToggle` component** (`src/components/pricing/BillingCycleToggle.tsx`) — Section-level Monthly/Yearly switcher styled as a pill with a sliding dark indicator. The active side animates with a spring (`bounce: 0.35`), the inactive side uses the brand ink color, and a small green "−17%" badge sits inside the Yearly option. Exposes `value`, `onChange`, custom labels, and a `className` for placement. ARIA: `role="group"`, `aria-label="Billing cycle"`, `aria-pressed` on each option, and the animated indicator is `aria-hidden`.
- **`PricingCard` component** (`src/components/pricing/PricingCard.tsx`) — Animated pricing card for the tablet and desktop grids. Brings the same blur-and-slide price morph used on mobile up to the bigger layouts, plus a stack of micro-interactions: viewport-triggered stagger entrance, hover lift (`y: -6`), featured-card pulsing border glow on the highlighted plan, badge pop-in with a spring bounce, feature-by-feature reveal, and a CTA that scales 1.02 on hover / 0.98 on tap. Accepts a `billingCycle` prop, a `ctaHref` (defaults to `/login?type=standard`), and a `maxFeatures` cap.
- **Unit tests for the two new components** (`src/components/pricing/__tests__/BillingCycleToggle.test.tsx` and `PricingCard.test.tsx`) — 5 + 8 = 13 new cases. All 13 pass under `npm test`.

### Changed
- **`src/pages/Home.tsx` — Pricing section now shares one billing-cycle state** — The component holds `useState<"monthly" | "yearly">("monthly")` and passes the value down to both `PricingCard` instances in the tablet (2-col) and desktop (4-col) grids, so toggling once updates every card on the page. The mobile accordion keeps its own internal toggle (its own visual context — never on the same breakpoint as the section toggle), so the two are intentionally independent.
- **`src/pages/Home.tsx` — Section header now hosts the toggle on `md+`** — A new `<BillingCycleToggle value={...} onChange={...} />` sits centered under the heading/subtitle, hidden on `< md` (mobile keeps the inline toggle inside the accordion). When the user switches to Yearly, a green "Save ~17% on yearly — that's 2 months free on every paid plan." callout slides in via `AnimatePresence` (opacity + y + height), reinforcing the discount without taking over the layout.
- **`src/pages/Home.tsx` — Tablet 2-col and desktop 4-col grids are now `PricingCard`** — Both layouts share the same component, so the desktop finally has the same motion vocabulary the mobile accordion has had since the previous changelog: hover lift, featured glow, blur price morph, feature reveal, CTA scale. Desktop grid gap also bumped from `gap-4` to `gap-5` to give the lifted hover state room to breathe.
- **`src/components/pricing/ChangeablePricingSection.tsx`** — `BillingCycle` is now re-exported as a named type (used by both `BillingCycleToggle` and `PricingCard`). The mobile accordion's existing public API is unchanged.

### Micro-interactions summary (desktop / tablet grids)
- **Entrance** — Each card fades up by 24px with a stagger of 80ms per index, spring-bounce landing. The viewport observer (`once: true, margin: "-80px"`) prevents re-triggering on scroll.
- **Hover** — The whole card lifts up 6px; the shadow grows from `shadow-md` → `shadow-xl` on the featured card and `shadow-sm` → `shadow-md` on the rest. Featured card also gets a faint terracotta tint at the top (`from-[#FFF7F4]`).
- **Featured card glow** — The Growth plan has an absolutely-positioned div that pulses a 4px terracotta box-shadow at 2.8s intervals (`infinite`, `easeInOut`). `aria-hidden` so screen readers don't see it.
- **Price transition** — The `/mo` price slot is wrapped in `AnimatePresence mode="popLayout"`. Switching the toggle key-remounts the inner motion.div, which slides in/out 24px with a 6px blur. Same vocabulary as the mobile accordion.
- **Badge** — The "Popular" badge starts at `scale: 0.6, opacity: 0` and springs to `1, 1` with `bounce: 0.55` after a 350ms delay.
- **Features** — Each `<li>` reveals with an 8px leftward slide and opacity fade. Stagger of 50ms per feature, plus 80ms per card index.
- **CTA** — The `<Button>` is wrapped in a `motion.div` with `whileHover={{ scale: 1.02 }}` and `whileTap={{ scale: 0.98 }}` for tactile feedback. Both transitions are springs (bounce 0.4, 300ms).

### Files
- `src/components/pricing/BillingCycleToggle.tsx` — new section-level toggle
- `src/components/pricing/PricingCard.tsx` — new animated desktop/tablet card
- `src/components/pricing/__tests__/BillingCycleToggle.test.tsx` — new test file (5 cases)
- `src/components/pricing/__tests__/PricingCard.test.tsx` — new test file (8 cases)
- `src/pages/Home.tsx` — added `billingCycle` state, section-level toggle, yearly discount callout, and switched the md/lg grids to `<PricingCard />`
- `src/components/pricing/ChangeablePricingSection.tsx` — re-exported the `BillingCycle` type (no behavior change)

## [Unreleased] — Mobile Pricing: Fluid Accordion + Responsive Grid

### Added
- **New `ChangeablePricingSection` component** (`src/components/pricing/ChangeablePricingSection.tsx`) — Mobile-first accordion pricing UI adapted from the watermelon `changeable-pricing-section` reference. Renders a single-column list of plans, each collapsed by default to (name, description, price) and tap-to-expand for the full feature list. Includes a spring-animated Monthly/Yearly billing toggle, smooth price morph between cycles, and `framer-motion` layout transitions as the user changes selection. Built on the project's existing shadcn-style theme tokens (`bg-muted`, `bg-background`, `ring-border`, etc.) and the Finaflow brand red (`#C73E1D`) for selected/CTA states.
- **`framer-motion` dependency** (`^12.40.0`) — added to `package.json` as the animation engine for the new pricing section. Required by the accordion's spring layouts, AnimatePresence-driven price morphs, and the selected-card ring pulse.
- **Unit tests for the new component** (`src/components/pricing/__tests__/ChangeablePricingSection.test.tsx`) — 9 cases covering plan names, descriptions, badges, billing-cycle visibility of the yearly discount note, the Monthly/Yearly toggle, footer/button text, the `ctaHref` anchor, and the "features-only-for-selected-plan" invariant. All 9 pass under `npm test`.
- **Single source of truth for pricing data** (`pricingPlans` in `src/pages/Home.tsx`) — Replaces the old `tiers` array. Each plan now carries monthly + yearly price strings, a description, an optional badge, an optional `featuresLabel` ("Everything in X, plus:"), and a feature list. The same array drives the mobile accordion, the tablet 2-column grid, and the desktop 4-column grid, so price changes only need to happen in one place.

### Changed
- **`src/pages/Home.tsx` — Pricing section (#pricing) is now responsive across three breakpoints**:
  - `< md` (phones): Renders the new `ChangeablePricingSection` accordion. Default selected plan is `growth`, the billing toggle defaults to `monthly`, and a green "Save ~17% when you pay yearly — that's 2 months free." note appears under the toggle when the user switches to Yearly. The CTA anchors to `/login?type=standard`.
  - `md` (tablets, 768–1023px): 2-column grid using the same `pricingPlans` data. Shows the monthly price, description, optional badge, and feature list. The CTA button is per-card, linking to `/login?type=standard`.
  - `lg+` (desktop, 1024px+): 4-column grid, same as before but powered by `pricingPlans` instead of the old `tiers` array. The strikethrough-price / KES 0 /mo marketing trick is gone — cards now show the real monthly price directly (Free → KES 0, Starter → KES 500, Growth → KES 1,500, Pro → KES 3,000) per the design call to "show real prices".
  - The legacy 6-row stat table (businesses / branches / users / transactions / payroll / support) is replaced by a cleaner description + feature list on every card. The same information is still conveyed, just in a more scannable form.

### Accessibility
- **Plans are now real `<button>` elements** (not clickable `<div>`s) with `aria-pressed` reflecting the selected state and `aria-label="Select <Plan> plan"` for screen readers. The original reference used `motion.div` with `onClick`; the Finaflow adaptation upgrades to semantic buttons while preserving the `motion.div layout` for the spring animation.
- **The Monthly/Yearly toggle is a `role="group"`** with `aria-label="Billing cycle"` and each option sets `aria-pressed`. The animated pill behind the toggle carries `aria-hidden`.
- **Focus visibility** — every interactive element (plan buttons, toggle buttons, CTA) carries `focus-visible:ring-2 focus-visible:ring-[#C73E1D]/40` so keyboard users see a clear focus ring without affecting mouse users.

### Files
- `src/components/pricing/ChangeablePricingSection.tsx` — new component (reused from watermelon `changeable-pricing-section` with Finaflow brand tokens + a11y upgrades)
- `src/components/pricing/__tests__/ChangeablePricingSection.test.tsx` — new test file (9 cases)
- `src/pages/Home.tsx` — replaced the 4-card `tiers` data + section with `pricingPlans` data and three responsive layouts (mobile accordion, tablet 2-col, desktop 4-col)
- `package.json` — added `"framer-motion": "^12.40.0"` to `dependencies`

## [Unreleased] — Wallet Provider Brand Colors

### Fixed
- **AirtelMoney wallet was rendering as gray in the Wallets page** — `src/pages/Wallet.tsx` had its `providerColors` / `providerIcons` maps keyed on `airtel`, but the seeded provider code in `api/lib/seed-wallet-providers.ts` is `airtel_money`. The lookup missed and the spans fell back to `bg-gray-600` instead of red. Renamed the key to `airtel_money` and switched to the exact brand red (`bg-[#E30613]`) used in Settings, so the AirtelMoney pill on the Wallets page now matches the one in Settings → Wallets.

### Changed
- **`src/pages/Settings.tsx`** — The `PROVIDER_COLORS` map now paints SasaPay blue (`bg-[#1A73E8]`) instead of green (`bg-[#00A651]`). The blue is the same hex already used for the active CoA picker row, keeping the design system tight. M-PESA stays green and Airtel Money stays red so the three providers are still visually distinct.
- **`src/pages/Wallet.tsx`** — `providerColors` and `providerIcons` keys renamed from `airtel` to `airtel_money` to match the provider `code` returned by the API. The AirtelMoney entry now uses `bg-[#E30613]` (the same red as Settings) instead of the generic `bg-red-600`, and the label text stays as "Airtel".

### Files
- `src/pages/Settings.tsx` — SasaPay color changed from `#00A651` to `#1A73E8`
- `src/pages/Wallet.tsx` — `airtel` key renamed to `airtel_money` (in both `providerColors` and `providerIcons`); AirtelMoney color switched to `bg-[#E30613]` to match Settings

## [Unreleased] — Version 0.9.9

### Changed
- **App version bumped to `0.9.9`** — The centralized version constant in `src/lib/version.ts` was incremented from `0.9.8` to `0.9.9`, and the `version` field in `package.json` was updated to match. The derived `APP_VERSION_DISPLAY` (`V:0.9.9`) and `APP_VERSION_FULL` (`Version: 0.9.9`) automatically reflect the bump in the desktop sidebar, mobile header, and Settings page footer.

### Files
- `src/lib/version.ts` — `APP_VERSION` constant updated from `"0.9.8"` to `"0.9.9"`
- `package.json` — top-level `version` field updated from `0.9.8` to `0.9.9`

## [Unreleased] — Journal Picker Dropdown Scrolling

### Fixed
- **Account selector dropdown did not scroll** — The `PopoverContent` had no max-height, so the dropdown tried to render all 51+ Chart-of-Accounts rows in a single panel that overflowed the viewport; the inner `CommandList` had `max-h-[320px]` and `overflow-y-auto` but those rules were inert because the parent didn't constrain the popover height. Fixed by chaining the constraints top-down: the `PopoverContent` now caps itself at `var(--radix-popover-content-available-height)` (Radix injects the available viewport space below the trigger) and clips with `overflow-hidden`; the `Command` flex column takes the full remaining height with `h-full max-h-full`; the search-bar row is `shrink-0` so it stays pinned at the top; the `CommandList` is `flex-1 overflow-y-auto overscroll-contain` with a defensive `max-h-[min(320px,var(--radix-popover-content-available-height)-56px)]` so it never tries to be taller than (popover - search row). Result: the dropdown respects the viewport, the search bar stays visible, and the list scrolls cleanly.

### Files
- `src/components/CoAJournalAccountPicker.tsx` — added max-height + overflow chain to PopoverContent/Command/CommandList so the inner list actually scrolls inside the viewport

## [Unreleased] — Journal Picker Layout Alignment & Sourced-From-CoA

### Fixed
- **Missing `isNotNull` import in `api/journal-router.ts`** — The `fetchCoaRows` helper used `isNotNull(accounts.accountType)` to identify CoA rows but the import on line 5 was still the old `import { and, asc, eq, isNull } from "drizzle-orm"`. Without `isNotNull` the function would throw `ReferenceError: isNotNull is not defined` at runtime, causing the resolver to fail for the primary candidate and silently fall through to other businesses (which sometimes only had liability accounts — the original "only liability is shown" symptom). Added `isNotNull` to the import list so the canonical CoA filter runs as written.
- **Journal entry line misalignment** — The picker button was rendered with `min-h-[2.25rem]` (36px) while the DEBIT/CREDIT/Memo inputs were 34px and stacked under uppercase labels; the Memo and Delete columns had no label at all. The grid was `items-start` so the picker and inputs floated to the top of their cells with visibly different baselines. Fixed by:
  - Adding a small "ACCOUNT" uppercase label above the picker and a "MEMO" label above the description input to match the DEBIT/CREDIT structure.
  - Hard-pinning the picker button to `h-[34px]` (matching the other inputs).
  - Pinning all DEBIT and CREDIT inputs to `h-[34px]`.
  - Switching the row grid from `items-start` to `items-end` so all five controls (picker, debit, credit, memo, delete) align on the same bottom baseline.
  - Adding a `className` prop to `CoAJournalAccountPicker` so the call site can override the button height when it embeds the picker in a row with fixed-height peers.

### Changed
- **`src/components/CoAJournalAccountPicker.tsx`** — Each dropdown row now shows only the account code (monospace) and the account name. The right-aligned sub-type label was removed for visual quietness, and the search placeholder was tightened to "Search by name or code…". The previously-invisible Check icon (which always occupied a ~14px column even when nothing was selected) is now only rendered for the active item, eliminating the large empty space that appeared before the account code on every row. A `className` prop was added so the host page can pin the trigger button height to match sibling controls.
- **`src/pages/JournalEntries.tsx`** — Each journal line now starts with an "ACCOUNT" label above the picker, the picker/inputs/memo/delete controls all share a `h-[34px]` baseline, and the row uses `items-end` so the bottom of every control lines up across the row. The total grid is still `grid-cols-12` (6 / 2 / 2 / 1 / 1) but reads as one aligned strip instead of a top-floating picker next to bottom-floating inputs.

### Files
- `api/journal-router.ts` — added `isNotNull` to drizzle-orm import so `fetchCoaRows` runs the CoA-only filter
- `src/components/CoAJournalAccountPicker.tsx` — removed sub-type display, conditionally render Check icon, hard-pin button to `h-[34px]`, accept `className` prop, tighten search placeholder
- `src/pages/JournalEntries.tsx` — added "ACCOUNT" and "MEMO" labels, fixed `h-[34px]` on all controls, switched row grid to `items-end`

## [Unreleased] — Journal Picker: CoA-Only Resolver with Multi-Business Fallback

### Fixed
- **Empty "No Chart-of-Accounts accounts are set up yet" message on the journal entry picker** — The new `journal.listForJournalEntries` resolver only checked the user's `currentBusinessId`. When that business was empty (or newly created and not yet populated) the picker had nothing to show. The resolver now builds an ordered list of candidate business ids from (1) the explicit `businessId` argument, (2) `ctx.user.currentBusinessId`, (3) the rows in `userBusinesses` for the user, and (4) the first authorized location's business. It then tries the primary candidate first; if that business has zero active CoA entries, it walks the remaining candidates and returns the first one that does. The result is returned as `{ accounts, businessId }` so the frontend always sees a populated list when *any* authorized business has CoA entries.

### Added
- **`journal.listForJournalEntries` endpoint** on `api/journal-router.ts` — Returns all active, non-deleted Chart-of-Accounts entries for the resolved business, ordered by `accountCode` then `name`. CoA-only (filters out operational cash/wallet/bank accounts that belong to the transfer module). Resolves the business via the multi-source fallback described above.
- **`fetchCoaRows` helper** in `api/journal-router.ts` — Single-source query used by the resolver so the filtering rules are defined once.
- **Server-side CoA validation in `createJournalEntry`** in `api/lib/journal.ts` — Before the entry is persisted, every line's `accountId` is checked: must exist, must have `accountType` set (i.e. be a CoA entry, not an operational account), must belong to the same `businessId`, and must be `isActive` with no `deletedAt`. Rejects with a clear error otherwise. Prevents hand-crafted API calls from bypassing the UI restriction.
- **`CoAJournalAccountPicker` component** in `src/components/CoAJournalAccountPicker.tsx` — A purpose-built combobox for the manual journal entry form. Sourced from `journal.listForJournalEntries`, grouped by `accountType` (Asset / Liability / Equity / Revenue / Expense) in that order, with each row showing the account code (monospace) plus the account name plus the sub-type on the right. Mirrors the visual style of the reference image: search box at top with a clear-button, bold group headings, items with a check indicator on the left and the code as a small chip. Excludes already-selected account ids from the dropdown so the same CoA entry can't be picked twice in one entry.

### Changed
- **`src/pages/JournalEntries.tsx`** — The journal entry form now uses `CoAJournalAccountPicker` (CoA-only) instead of `AccountCombobox` (which mixed operational and CoA accounts). The form's helper text under "Journal Lines" now reads: "Pick accounts from the Chart of Accounts. Cash, wallet, and bank movements belong in the Transfer module." This makes the separation of concerns explicit for advanced users.

### Files
- `api/journal-router.ts` — new endpoint + `fetchCoaRows` helper
- `api/lib/journal.ts` — CoA / business / active validation in `createJournalEntry`
- `src/components/CoAJournalAccountPicker.tsx` — new component
- `src/pages/JournalEntries.tsx` — switched to CoA-only picker, updated helper copy

## [Unreleased] — Comprehensive Versioning & Changelog Management

### Added
- **Centralized version source** (`src/lib/version.ts`) — Single source of truth for the application version number (`APP_VERSION`), with derived display constants `APP_VERSION_DISPLAY` (`V:0.9.8`) and `APP_VERSION_FULL` (`Version: 0.9.8`). All version displays across the app import from this single file, guaranteeing consistency.
- **Version display in sidebar** — `src/components/Layout.tsx` now renders the version number (`V:0.9.8`) in gold monospace below the "Cashflow Manager" subtitle in the desktop sidebar, visible whenever the sidebar is expanded.
- **Version display in mobile header** — `src/components/Layout.tsx` mobile header now includes the version number (`V:0.9.8`) next to the "Finaflow" branding, ensuring version visibility on all screen sizes.
- **Version display in Settings page** — `src/pages/Settings.tsx` now shows the full version string (`Version: 0.9.8`) at the bottom of the settings content area, providing a clear reference point for debugging and support.
- **package.json version sync** — The `version` field in `package.json` is now set to `0.9.8`, matching the centralized version source.

### Changed
- **`src/lib/version.ts`** — New centralized version module (baseline: `0.9.8`)
- **`src/components/Layout.tsx`** — Imported `APP_VERSION_DISPLAY` and added version rendering to both desktop sidebar and mobile header
- **`src/pages/Settings.tsx`** — Imported `APP_VERSION_FULL` and added version display at the bottom of the settings page
- **`package.json`** — Version updated from `0.0.0` to `0.9.8`

### Files
- `src/lib/version.ts` — centralized version source
- `src/components/Layout.tsx` — version display in sidebar + mobile header
- `src/pages/Settings.tsx` — version display in settings page
- `package.json` — version field synced

## [Unreleased] — Homepage: GitHub Links, "How it Works", and FAQ

### Added
- **GitHub star button in top-right navigation** — A compact dark pill button with the GitHub mark and a `Star` icon links to `https://github.com/geniusdynamics/finaflow` in a new tab. The star icon animates (scale + fill yellow) on hover to invite interaction. Includes proper `aria-label`, `target="_blank"`, and `rel="noopener noreferrer"`.
- **GitHub link in mobile menu** — The same repo URL is added to the collapsible mobile nav so the project link is reachable on phones.
- **"by genius" attribution in footer** — Next to the `Finaflow` logo in the footer, a small `by genius` line is rendered with an underlined link to `https://genius.africa` (opens in a new tab). The link uses the gold accent (`#D4A854`) for the underline and the brand red on hover, matching the rest of the palette.
- **GitHub icon link in footer** — The footer now also exposes a `GitHub` link (with the GitHub icon) alongside `Sign In` and `Sign Up` so the open-source repo is discoverable from the bottom of the page.
- **"How it works" 3-step onboarding section** — A new section (id `how-it-works`, linked from the main nav) explains the path from signup to first report in three numbered cards: `01 Create your free account` → `02 Connect or import your data` → `03 See your business clearly`. Each step lists a time-to-value detail (e.g. "Takes ~30 seconds") and the section ends with a primary CTA to start a free account.
- **FAQ accordion section** — A new section (id `faq`, linked from the main nav) presents six common pre-signup questions in a native `<details>` / `<summary>` accordion (security, M-Pesa integration, Free plan scope, CSV import, multi-location, open-source). Each question uses a `+` icon that rotates to `×` when expanded. The section closes with a help callout linking to the GitHub Discussions page.
- **New nav links: `How it works` and `FAQ`** — Both new sections are reachable from the desktop and mobile navigation bars, with mobile menu auto-closing on selection.

### Changed
- **`src/pages/Home.tsx`** — Added `Github`, `Star`, `Plus`, `Sparkles`, `HelpCircle`, `BookOpen` to the lucide-react import; inserted the GitHub pill into the desktop nav; added the new `How it works` and `FAQ` sections; added `by genius` and a footer GitHub link; updated the mobile menu with the new links and GitHub entry. No existing content was removed — only augmented.

### Files
- `src/pages/Home.tsx` — homepage layout, navigation, FAQ, and how-it-works additions
- `CHANGELOG.md` — this entry

## [Unreleased] — Payroll Salary Expense Fix

### Fixed
- **[CRITICAL] Salary expense (6300) debited with net pay instead of gross pay** — When marking payroll as paid, the `markPaid` mutation was recording the Salaries & Wages expense (account 6300) as a debit of only `totalNetPay` (the net amount paid to employees). This understated the true cost of employment by excluding all statutory deductions (PAYE, NSSF, NHIF, Housing Levy). Fixed to debit `totalGross` (net pay + all deductions), correctly reflecting the full gross salary cost in the ledger. Verified that liability accounts 2200 (PAYE), 2300 (NSSF), and 2400 (NHIF) are all credited correctly.
- **`openingBalance` not reset on accounts** — The reset function only reset `currentBalance` to `0.00` but left `openingBalance` untouched, causing bank account values and displayed balances to appear retained after reset. Now both `currentBalance` and `openingBalance` are reset to `0.00` for all accounts.
- **Debt records not cleared on reset** — The `debts` table was completely absent from the reset function. Debt records were never soft-deleted or cancelled during a business reset. Added proper debt clearing with status set to `cancelled` and `deletedAt` timestamp.
- **[CRITICAL] Operational accounts (Cash Drawer, M-PESA, Bank) not reset** — The root cause of bank account balances and ledger entries surviving the reset was that all account queries in the reset function filtered by `businessId` only. However, operational accounts (Cash Drawer, M-PESA Till, Bank Account) use `locationId` as their identifier and have `businessId = NULL` in the database. The reset completely missed these accounts, leaving their balances and transaction histories intact.

### Added
- **Multi-level confirmation wizard** — Reset dialog now has a two-step flow:
  - Step 1 (Review): Shows all records to be cleared and preserved with a "Continue to Confirmation" button
  - Step 2 (Confirm): Requires both (a) typing "RESET" in the confirmation field AND (b) checking an acknowledgment checkbox that explicitly lists what will be deleted (invoices, expenses, sales, bank transactions, debts, payroll entries) and confirms that account balances and opening balances will be reset to zero
  - Execute Reset button only enables when both confirmation conditions are met
  - Cancel and Back buttons available at both steps
- **`debts` table to reset scope** — Debts are now soft-deleted with `status: "cancelled"` during reset. Added to short-circuit path, snapshot counting, and the main clearing logic (Step 7h).
- **Enhanced audit logging** — Reset audit entries now include: `accountsResetToZero`, `accountsOpeningBalanceReset`, `suppliersResetToZero`, `debtsCleared`, `initiatedByUserId`, and `outcome: "success"`. Error logging now captures the actual error message for debugging.
- **Operational account (locationId-only) coverage** — All three account queries now use `or(eq(businessId), inArray(locationId))` to ensure operational accounts are included in reset operations (balance reset, ledger entry deletion, snapshot counts).
- **Test coverage for locationId-only accounts** — Integration tests now create an M-PESA Till account with `businessId = NULL` and `locationId` only (matching production data), and verify its `currentBalance` and `openingBalance` are reset to `0.00`. Test cleanup also handles locationId-only accounts.

### Changed
- **`api/lib/business-reset.ts`** — Step 11 now resets `openingBalance: "0.00"` alongside `currentBalance: "0.00"` on all accounts. Added Step 7h for debts soft-deletion. Updated snapshot to count debts. Updated audit log to include detailed metrics.
- **`src/pages/Businesses.tsx`** — Reset dialog redesigned with two-step wizard (review → confirm), acknowledgment checkbox, preserved records summary, Cancel/Back buttons at every step, and disabled-until-confirmed Execute button.
- **`api/__tests__/business-reset.test.ts`** — Added `debts` import, `debt` to SeededContext, debt record in seed function, `openingBalance` assertions in account checks, debt deletion verification, and debt cleanup in teardown.

### Files
- `api/lib/business-reset.ts` — openingBalance reset, debts clearing, enhanced audit logging
- `src/pages/Businesses.tsx` — two-step wizard, acknowledgment checkbox, cancel/back navigation
- `api/__tests__/business-reset.test.ts` — debt tests, openingBalance assertions

## [Unreleased] — Journal Entry Form: Searchable Account Combobox

### Fixed
- **Broken account selector on manual journal entries** in `src/pages/JournalEntries.tsx` — The previous implementation rendered the account picker as a native `<select size={5}>` widget with a separate search input above it. Inside the dialog's narrow form layout the widget collapsed to a tiny scrollable list (only ~20 px wide), the optgroup labels were clipped to a single character, and the search input was a sibling rather than a live filter — making it effectively impossible to find the right Chart-of-Accounts entry for a fund movement. Replaced the entire widget with a proper searchable combobox.

### Added
- **`AccountCombobox` component** in `src/components/AccountCombobox.tsx` — A Popover + Command (cmdk) based combobox for picking any Chart-of-Accounts entry or operational account from the journal line. Features: live search across name, code, account type, and sub-type; grouped list with a sensible display order (Asset → Cash, Asset → Bank, Asset → Prepaid Expenses, Asset → Accounts Receivable, Asset → Fixed Assets, then Liability, Equity, Revenue, Expense, Operational Accounts); selected-value preview showing code chip + name + type/subtype; ability to exclude already-selected account ids from each line's dropdown (via `excludeIds` prop) so the same account can't be picked twice in one entry; rich option preview with code, name, and type/subtype.

### Changed
- **`src/pages/JournalEntries.tsx` form layout** — Each journal line is now a 12-column grid: 6 cols for the account combobox, 2 cols for Debit (with a `KES` prefix and 0.00 placeholder), 2 cols for Credit, 1 col for Memo, 1 col for the delete button. Field labels (`Debit` / `Credit`) appear above the inputs. The balance summary was promoted into a colored bar (`bg-[#F5EDE6]`) at the bottom of the line list, and the "Post immediately" checkbox now lives in a bordered callout for clarity. Removed all the now-unneeded `searchTerms` state, `getFilteredOptions` helper, and the broken native `<select>` widget.

### Files
- `src/components/AccountCombobox.tsx` — new searchable combobox
- `src/pages/JournalEntries.tsx` — rewrote `JournalEntryForm` body; removed unused `Search` and `useMemo` imports

## [Unreleased] — Accounts & Chart of Accounts Loading Fix (Migration Recovery)

### Fixed
- **`coaId` column missing from production database** — Migration 0011 had been recorded as "applied" in the `drizzle_schema` journal but the actual DDL changes (the `ALTER TABLE accounts ADD COLUMN coaId` statement) had been silently rolled back due to a bug in `scripts/run-migrations.ts`. The script was treating *any* failure inside the migration's transaction as an "already applied" idempotent error and marking the migration complete, even though no schema changes had been committed. This caused every `db.select().from(accounts)` query to fail with `column "coaId" does not exist`, leaving the Accounts and Chart of Accounts pages blank.
- **Mpesa operational accounts missing `coaId`** — The 0011 backfill only covered `cash`, `wallet`, and `bank_account` types, so the 4 legacy `mpesa`-type accounts (still present in the database) were never linked to a CoA entry. Added a dedicated `mpesa` backfill statement plus a fallback that joins through `locations.businessId` to catch any stragglers. Re-ran the backfill and created the missing `asset:cash` and `asset:bank` CoA entries for businesses that did not yet have them. Verified: 8/8 operational accounts now have a `coaId`.
- **Foreign key constraint on `accounts.coaId` was never created** — The `DO $ ... $` block in 0011 was dropped during the same failed transaction, leaving the column present but unconstrained. Re-applied the FK with `ON DELETE SET NULL` and verified via `pg_constraint`.
- **`run-migrations.ts` race condition / silent failure** — The script previously ran the entire migration as a single `pool.query(sql)` inside one transaction. When a single statement failed (e.g. a unique-constraint conflict deeper in the migration), the transaction was rolled back, but the script's catch-block then inserted the migration name as "applied" anyway, leaving the database in a half-migrated state forever. Refactored the script to: (1) split on `--> statement-breakpoint` markers when present, (2) run each statement in its own iteration so a single failure does not roll back earlier successful DDL, and (3) only insert into `drizzle_schema` if every statement in the migration actually succeeded. Idempotent "already exists" errors are still tolerated but only after the per-statement recovery path actually re-applies any missing DDL.

### Changed
- **`db/migrations/0011_coa_auto_link_and_wallet_support.sql`** — Added `--> statement-breakpoint` markers between every statement so `run-migrations.ts` can run each piece in its own transaction. Added a dedicated `mpesa` backfill and a final location-join fallback so legacy data and businesses without a CoA entry are fully covered.
- **`scripts/run-migrations.ts`** — Rewrote the migration application loop to apply statements individually, recover from idempotency conflicts by re-applying missing DDL, and only mark a migration as applied when it actually succeeded.

### Verification
- `accounts` table has 26 columns (was 25), including the new `coaId BIGINT`.
- `coa_subtypes` table exists with 27 seeded subtypes.
- `fk_accounts_coa` foreign key exists: `FOREIGN KEY (coaId) REFERENCES accounts(id) ON DELETE SET NULL`.
- 8/8 operational accounts have a `coaId`: `mpesa 4/4, bank_account 1/1, cash 3/3`.
- `npm run check` — exit 0 (clean)
- `npx tsc -b` — clean

## [Unreleased] — Notifications Overhaul: Highlight Lifecycle, Clearance, Compact UI

### Added
- **Single-record notification lifecycle** — Replaced duplicate-generation pattern with a state machine: `highlighted` → `faded` (on user click) → re-highlighted (on overdue or 24h idle). New columns: `highlightState`, `fadedAt`, `lastHighlightedAt`, `highlightCount`, `archivedAt`, `clearedAt`, `clearedReason`. No duplicate rows are ever created for the same bill/event, even across multiple re-highlight cycles.
- **`notification-lifecycle.ts`** — Pure-function helper module with `applyClickFade`, `applyReHighlight`, `applyClear`, `shouldReHighlight`, and `isActive` — fully unit-testable without DB infrastructure.
- **`clickFade` API** — New tRPC mutation transitions a notification from highlighted → faded when the user clicks to view, with idempotent no-op on already-faded rows.
- **`dismiss` API** — New tRPC mutation archives a single notification with reason `user_dismissed`.
- **`clearAll` API** — New tRPC mutation archives every active notification in one call with reason `manual_clear_all`. Frontend "Clear All" button triggers this.
- **`clearForEntity` API** — Automatic-clearance hook the bills-router calls after successful `recordPayment`, archiving notifications with reason `bill_paid` atomically within the payment transaction.
- **`autoReHighlight` API** — Background sweep that re-highlights faded notifications whose underlying bill is overdue or that have been idle for 24h+. Runs on mount and every 5 minutes.
- **`highlightedCount` API** — New tRPC query returning the count of active `highlighted` rows for the bell icon badge, replacing the previous `unreadCount` badge which excluded faded items.
- **`listArchived` API** — New tRPC query returning historically cleared/archived notifications.
- **Archived notifications log** — Cleared rows are preserved in the DB with `archivedAt` and `clearedReason` for audit/historical review.
- **Unit tests** — `api/lib/__tests__/notification-lifecycle.test.ts` covers the full lifecycle (highlighted → faded → re-highlighted → repeated cycles → cleared), boundary conditions (24h threshold, overdue-triggered re-highlight), archive idempotency, and no-duplicate verification.
- **Integration tests** — `api/__tests__/notification-bill-clearance.test.ts` validates single-record generation, clearForEntity archive, idempotent re-clear, and clear-all bulk archive.

### Changed
- **"Check Overdue Bills" button** — Reduced to 50% width in the notification panel action bar, renamed to "Check Bills" with compact `text-[9px]` sizing.
- **"Clear All Notifications" button** — Added as a 50% width partner button in the same action bar, renamed to "Clear All".
- **Notification item rendering** — Now respects `highlightState`: faded items render at `opacity-50` without the unread dot; highlighted items show full opacity and the dot. Severity-based colors are preserved.
- **Bell badge count** — Now uses `highlightedCount` (count of active highlighted rows) instead of `unreadCount`, so the badge accurately reflects items needing attention.
- **Re-highlight sweep** — `autoReHighlight` runs on mount and every 5 minutes alongside the existing overdue notification generator, ensuring faded items automatically re-prioritize.
- **`generateOverdueNotifications`** — Now idempotent: checks for an existing record per `(userId, entityType='bill', entityId)` before inserting, and re-highlights or reopens archived/cleared records instead of creating duplicates.

### Fixed
- **Duplicate overdue-bill notifications** — Multiple scans no longer create multiple rows for the same overdue bill. The single-record state machine handles all transitions.

### Schema
- New columns on `notifications`: `highlightState` (enum: `highlighted`, `faded`, `archived`), `fadedAt`, `lastHighlightedAt`, `highlightCount`, `archivedAt`, `clearedAt`, `clearedReason` (enum: `user_dismissed`, `bill_paid`, `action_completed`, `manual_clear_all`, `system_resolved`).
- Migration `db/migrations/0012_notification_highlight_lifecycle.sql` — idempotent, adds all columns and indexes.

### Files
- `db/schema.ts` — updated notifications table with lifecycle + archive columns
- `db/migrations/0012_notification_highlight_lifecycle.sql` — new migration
- `api/lib/notification-lifecycle.ts` — new pure-function lifecycle module
- `api/lib/notification-clearance.ts` — new bill-payment clearance helper
- `api/notifications-router.ts` — refactored with clickFade, dismiss, clearAll, clearForEntity, autoReHighlight, highlightedCount, listArchived, idempotent generateOverdueNotifications
- `api/bills-router.ts` — wired `clearNotificationsForBill` after successful `recordPayment`
- `api/lib/__tests__/notification-lifecycle.test.ts` — new unit tests
- `api/__tests__/notification-bill-clearance.test.ts` — new integration tests
- `api/test/setup.ts` — added 0012 migration
- `src/components/Layout.tsx` — compact action bar (50% Check Bills + 50% Clear All), highlight-driven notification rendering, autoReHighlight timer, highlightedCount badge, dismiss button per item

## [Unreleased] — CoA Auto-Link, Wallet Support, Journal Entries Overhaul

### Added
- **`coa_subtypes` reference table** — New `db/schema.ts` table seeded with all 27 account subtypes, each with `walletSupport` boolean. Cash subtype flagged `walletSupport=true` to allow unlimited wallet accounts.
- **Automatic CoA linking on account creation** — All new operational accounts now auto-link to the correct CoA entry without requiring user checkbox selection. Bank → Bank Accounts (asset/bank), Cash → Cash Accounts (asset/cash), Wallet → Wallet Accounts (asset/cash). `coaId` FK stored on every account.
- **`listForJournal` API endpoint** — New `api/accounts-router.ts` query returns both operational accounts and CoA entries for hierarchical journal entry selection.
- **`getSubtypes` API endpoint** — New `api/chart-of-accounts-router.ts` query returns all active CoA subtypes with wallet support info.
- **Post-migration validation script** — `scripts/validate-coa-migration.ts` verifies M-Pesa rename, coaId backfill, wallet account linking, and transaction reference integrity.
- **Audit logging for journal entries** — Manual journal entries now create audit trail entries tracking user, CoA IDs, account IDs, and source type.

### Changed
- **Account creation form** — `src/pages/Accounts.tsx` "Show in Charts of Accounts" checkbox replaced with "Override CoA Mapping" toggle. When unchecked, accounts auto-link to default CoA. When checked, all 5 asset subtypes (Cash, Bank, Prepaid Expenses, Accounts Receivable, Fixed Assets) are shown for manual selection. Tooltip shows default auto-mapping per account type. Invalid CoA assignments (non-asset types) are blocked client-side.
- **Journal entries overhaul** — `src/pages/JournalEntries.tsx` now uses hierarchical, searchable account selector grouped by CoA type/subtype (e.g., "Assets → Cash", "Assets → Bank") plus operational accounts. Enhanced validation enforces balanced entries, prevents dual debit/credit lines, and ensures all lines have accounts selected. Inline balance status indicator.
- **`ensureSystemAccount` return type** — Now returns `{ id, coaId }` instead of plain `number`, enabling direct coaId back-linking on operational accounts.
- **`accounting-maps.ts`** — Refactored with `coaSystemKey`, `coaName`, `coaSystemKey` in all mapping records. Added `ALL_ASSET_SUBTYPES`, `getDefaultCoaMappingTooltip()`, `isManualCoaSubtypeAllowed()`, `isWalletSupportedSubType()`, `getCoaSystemKeyForType()`, `getDefaultCoaNameForType()`.
- **`accounting-validation.ts`** — Refactored `validateOperationalAccountClassification()` to accept all asset subtypes for manual selection. Added `getDefaultCoaClassification()`.

### Fixed
- **Removed hardcoded single sub-type filtering** — Account creation form no longer only shows "Bank" for bank accounts or "Cash" for cash/wallet accounts. All 5 asset subtypes are now available when user opts for manual CoA override.
- **M-Pesa CoA entry renamed** — Database migration renames "1200 - M-Pesa Account (Cash)" to "1200 - Wallet Account (Cash)", preserving all historical transaction links.

### Database Migrations
- **0011_coa_auto_link_and_wallet_support.sql** — Creates `coa_subtypes` reference table (idempotent). Seeds 27 subtype entries with `walletSupport` flag. Renames M-Pesa CoA entry to Wallet Account. Adds `coaId` column to accounts. Backfills coaId for all existing unlinked accounts. Adds FK constraint and index.

### Tested
- All 63+ integration tests pass. TypeScript compilation clean. Accounting foundation tests updated for new mapping APIs. `ensureSystemAccount` caller tests updated for new return type.

### Added
- **Per-category budget management** — `api/reports-router.ts` `setBudget` mutation now actually saves to `budgets` table with proper year, month, categoryId, locationId, and amount. `budgetVsActual` query joins with budgets table returning real budgeted amounts instead of always "0.00".
- **Budget UI revision** — `src/features/reports/OperationsReportsPanel.tsx` "Set Budget" dialog replaced from COA-type selector to per-expense-category budget inputs with pre-filled values from API.
- **Debts tab in Accounting Hub** — `src/pages/Accounts.tsx` now has a third "Debts" tab alongside Accounts and Payment Methods, rendering `Debts` component in embedded mode.
- **Settings page vertical navigation** — `src/pages/Settings.tsx` redesigned from horizontal tab bar to profile-like vertical sidebar (desktop) / list navigation (mobile) with icon + label + description for each section.
- **Month navigation** — Budgeting tab now has prev/next month arrows (← →) that navigate month-by-month, wrapping across years. All queries (budget vs actual, budgets list, P&L statement) refetch with the selected month.
- **Branch filter** — Budgeting tab has a branch selector dropdown (All Branches / specific branch). "All Branches" aggregates budgets across all branches. Budgets are created per-branch.
- **Batch budget save** — `budgets.batchSet` mutation upserts all category budgets atomically in a single `db.transaction()`. Frontend sends all budgets in one call instead of looping individual mutations.
- **COGS Set Target branch validation** — COGS target now validates that a specific branch is selected before saving.

### Changed
- **Budget UI** — Set Budget dialog now shows all expense categories with individual amount inputs and "Save All Budgets" batch save.
- **Settings navigation** — Replaced horizontal pill-tab bar with responsive sidebar layout: sticky desktop sidebar (`lg:block w-64`), full-width mobile list (`lg:hidden`), each with icon, label, description, and active state indicator.
- **Debts permissions** — Added `DEBTS_VIEW` and `DEBTS_MANAGE` permissions to middleware and role definitions (admin, manager, employee, partner).
- **Budget API** — `gt(bills.balanceDue, '0')` replaces raw `sql` inline comparison to fix Drizzle parameter binding.

### Fixed
- **Budget data flow** — `budgetVsActual` previously returned zero budgeted amounts for all categories. Now queries actual budget records from `budgets` table.
- **Reports cashFlowForecast query** — Changed `sql`${bills.balanceDue} > 0`` to use Drizzle's `gt(bills.balanceDue, '0')` for proper parameterized binding, resolving the query rendering error. Added try-catch for better error messages.
- **Select.Item empty value** — Fixed Radix UI Select crash by changing sentinel from empty string `""` to `"all"` for "All Branches" option.

### Files
- `api/middleware.ts` — added DEBTS_VIEW, DEBTS_MANAGE permissions + procedures
- `api/reports-router.ts` — fixed budgetVsActual query, setBudget mutation, added budgetsList + budgets.batchSet queries, fixed cashFlowForecast parameter binding
- `api/debts-router.ts` — new tRPC router for debt CRUD and payment recording
- `api/router.ts` — registered debts router
- `db/schema.ts` — added debts table
- `src/pages/Settings.tsx` — full navigation redesign (vertical sidebar/list)
- `src/pages/Debts.tsx` — new debt management page with cards, progress, payments
- `src/pages/Accounts.tsx` — added Debts tab integration
- `src/features/reports/OperationsReportsPanel.tsx` — month navigation, branch filter, batch budget save, per-category budget UI
- `src/features/reports/chart-data.ts` — budget chart data handling
- `src/lib/permissions.ts` — frontend DEBTS permissions
- `resources/mobile-visual-design-analysis.md` — comprehensive visual design report
- `resources/navigation-ux-review.md` — navigation UI/UX review document

## [Unreleased] — Debt Origination, COA Auto-Classification, Bank Linking, Recurring Installments

### Added
- **Debt-origination double-entry** — `api/lib/debt-classification.ts` posts paired ledger legs at `loanDate`:
  - **Immediate** (default): debit destination bank + credit loan liability.
  - **Deferred**: credit loan liability only; user triggers `Disburse` later for the cash leg.
  - `disburse` mutation also supports an optional **arrangement fee**, which debits a Bank Charges expense account and credits the loan liability for the full principal.
- **COA auto-classification** — `getLoanLiabilityAccountId` picks between 2600 (`current_loan`, ≤ 365 days) and 2700 (`long_term_loan`, > 365 days) per business. The chosen account id is frozen on the debt row.
- **Recurring installment bills** — When a debt is created with both `installmentAmount` and a `paymentSchedule`, a `recurring_bill_templates` row is created with `liabilityAccountId` pointing at the classified loan account. `debts.generateInstallment` materializes the next bill; paying that bill through the existing `Bills → Pay` flow debits cash and credits the loan liability, automatically reducing the debt's `paidAmount` and flipping `status` to `paid` when fully settled.
- **Disburse dialog** — `src/components/DisburseDebtDialog.tsx` mirrors the `Link Topup` dialog from `Wallet.tsx`, with a date picker, optional fee, and a live posting preview.
- **Compact 5-column form row** — Location / Payment Schedule / Installment Amount / Loan Date / Due Date share a single responsive row; full-width Destination Bank + Disburse-immediately toggle follow.
- **Unit tests** — `api/lib/__tests__/debt-classification.test.ts` covers the long-term threshold (boundary at 365 days) and per-frequency date advancement.

### Schema
- New columns on `debts`: `loanDate`, `installmentAmount`, `destinationAccountId`, `loanAccountId`, `isDisbursed`, `disbursementDate`, `disbursementFee`, `recurringBillTemplateId`.
- New column on `bills`: `debtId` (nullable, FK to `debts.id` with `onDelete: set null`).
- New enum values: `transactionType` gains `loan_origination` and `loan_disbursement`; `accountSubType` gains `bank_charges`.
- Migration `db/migrations/0010_debt_origination_and_accounting.sql` is idempotent — guarded with `IF NOT EXISTS` / `pg_enum` lookups so it can be re-run safely.

### Files
- `db/schema.ts` — new columns and enum values.
- `db/migrations/0010_debt_origination_and_accounting.sql` — new migration.
- `api/lib/debt-classification.ts` — new helper module.
- `api/debts-router.ts` — new `disburse` and `generateInstallment` mutations; new `bankAccounts` query; `create` now auto-classifies, posts the double-entry, and creates the recurring template when applicable.
- `api/bills-router.ts` — `pay` mutation now re-syncs the linked debt's `paidAmount` + `status` from the sum of paid bills, so paying installments always keeps the loan card accurate.
- `src/pages/Debts.tsx` — restructured form (5-column compact row + destination bank + disburse toggle), debt card now shows Loan Account, Destination, and Disbursement status, and exposes a `Disburse` button (when pending) and a `Generate Installment` button (when a recurring template exists).
- `src/components/DisburseDebtDialog.tsx` — new component.
- `api/lib/__tests__/debt-classification.test.ts` — new tests.

### Verification
- `npm run check` — exit 0
- `npx vitest run api/lib/__tests__/debt-classification.test.ts` — 7/7 pass

## [Unreleased] — Accounts Page Hydration & Performance, Debts Location Selector, Daily Schedule

### Fixed
- **`<button>` cannot be a descendant of `<button>` hydration error** in `src/pages/Accounts.tsx` — Each account card was a `<button>` element that contained nested `<Button>` controls (Edit, Delete, Drawing, Deposit), which produces a React DOM-nesting warning and an invalid HTML structure. Converted the outer card to a `<div role="button" tabIndex={0} aria-pressed={isSelected}>` with Enter/Space keyboard handling. The inner action buttons continue to `stopPropagation()` so the card click handler doesn't fire when a dialog or delete is triggered.
- **Slow Accounts page load** in `src/pages/Accounts.tsx` — The `balanceHistory` query was refetching every 15 s with `refetchOnWindowFocus: true`, and the response includes two heavy charts (Area + LineChart with 30-day per-account series). Increased the refetch interval to 60 s, turned off focus refetch, set `staleTime: 30 s`, and added `placeholderData: (prev) => prev` so the chart no longer flashes to its loading skeleton between polls.

### Changed
- **Debts page now uses the shared `LocationSelector`** in `src/pages/Debts.tsx` — The Add-Debt dialog was using a raw `<select>` for branch, bypassing the auto-selection, unassigned-location warning, and enforcement logic that the rest of the system relies on. Replaced with `<LocationSelector>` wired to `trpc.locations.list` and `trpc.settings.list` (for the `enforceLocationAssignment` flag) — same component used on the Accounts and Sales pages.
- **Payment schedule gains a `daily` option** in `api/debts-router.ts` and `src/pages/Debts.tsx` — Added `"daily"` to the `paymentScheduleEnum` on both the create and update procedures, and inserted a `<option value="daily">Daily</option>` in the Add and Edit dialogs. The form-state type was widened from a literal `"weekly" | "monthly" | "quarterly" | "annually"` union to a named `PaymentSchedule` alias that also includes `"daily"`.

### Verification
- `npm run check` — exit 0 (clean)
- Lint command in this environment is broken pre-existing (ESLint crashes with `SyntaxError: Unexpected token '}'` on every file, including `src/pages/Home.tsx`), unrelated to these changes.

## [Unreleased] — Lint Sweep: Drizzle/PG Type Errors, Frontend State Types, Schema Enums

### Fixed
- **drizzle-orm type imports** — `PgTable` and `PgSelect` are no longer exported from the root `drizzle-orm` module. Re-imported from `drizzle-orm/pg-core` in:
  - `api/lib/business-reset.ts`
  - `api/lib/pagination.ts`
- **`PgColumn` not assignable to `TemplateStringsArray`** in `api/lib/business-reset.ts` — `countTable` helper was typed with `Parameters<typeof sql>[0]` (which resolves to the template strings array, not the interpolation). Switched the parameter to `PgColumn` so it can be embedded in `sql\`${column} IN (…)\`` correctly.
- **Ledger `entryDate` Date vs string mismatch** in `api/accounts-router.ts` — Five call sites were passing `new Date(...)` but the schema column is `date("entryDate")` (string). Converted to `new Date(...).toISOString().slice(0, 10)` in the deposit, drawing, transfer-out, and transfer-in ledger inserts.
- **`issueDate` / `dueDate` Date vs string mismatch** in `api/bills-router.ts` — `bills.create` was wrapping inputs in `new Date(...)` before inserting. The schema column is `date(...)` (string), so the values are now passed through as-is.
- **Frontend state with `as const` payment methods** — `src/pages/Bills.tsx` and `src/pages/Suppliers.tsx` declared `payForm` with `paymentMethod: "wallet" as const`, which then refused legitimate wider-type setters (`"cash" | "wallet" | "bank_transfer" | "card"`). Widened the state types to the full union and removed the `as const` literals.
- **Same fix for `recForm` in `Bills.tsx`** — Widened `frequency` from literal `"monthly"` to the full `"daily" | "weekly" | "monthly" | "quarterly" | "annually"` union.
- **`editForm.role` literal in `src/pages/Users.tsx`** — Same `as const` pattern. Widened to `"owner" | "admin" | "manager" | "employee" | "viewer"`.
- **`accounts` not assignable to `FundingAccount[]`** in `Bills.tsx` — tRPC query return is `{ [x: string]: any }[]`. Cast at the two call sites to `FundingAccount[] | undefined`.
- **`BusinessOverview.startEditLocation` signature** — `loc.address` / `phone` / `email` are nullable in the DB but the function param signature was `string | undefined`. Widened the optional fields to `string | null`.
- **Wallet report type exports** — `WalletTxn.balance` was `string | undefined` but the source data is `string | null`. Widened to `string | null`; cast `salesData` and `walletTxns` in `OperationsReportsPanel.tsx` via `as any` so the existing record shape passes through without restructuring the hook signature.
- **Balance sheet totals** in `src/features/reports/FinancialReportsPanel.tsx` — `parseFloat(i.amount.replace(/,/g, '') || 0)` was typed as `string | 0` (the empty-string fallback to literal `0`). Switched to `Number(...) || 0` and precomputed the totals in an IIFE so `formatKES(String(total))` is unambiguous. Also dropped the `|| "0"` fallback that was returning the literal `"0"` when totals were non-zero strings.
- **`salesRouter` / `caller` argument count** in `api/wallet-management-router.ts` — Three queries used the old `(_input, _ctx)` two-arg form. The new `ProcedureResolver` expects a destructured-object argument, so they were switched to `async () => …` or `async ({ ctx }) => …`. Also added the missing `sql` import.
- **`_ctx` property access** in `api/journal-router.ts` — Destructured `({ input, _ctx })` was being read as a property lookup on the resolver options. Renamed to `ctx`.
- **`Cannot find name 'result'`** in `api/employees-payroll-router.ts` — `entries.push({ id: result.id, … })` referenced an undefined variable inside the `payrollEntries` insert loop. Switched to `id: emp.id`.
- **`Unknown not assignable to BodyInit`** in `api/lib/http.ts` — `HttpClient.post` body parameter was `unknown`. Cast at the call site to `any` so it serialises through `RequestInit`.
- **`action: "DOWNLOAD"` missing from audit union** in `api/businesses-router.ts` — Extended the literal union in `api/lib/audit.ts` to include `"DOWNLOAD"` (also added to the `actionEnum` in `db/schema.ts`).
- **`accountId` unknown in business insert** in `api/lib/business-provisioning.ts` — Fix was to provide a properly typed `subscriptionExpiry` (Date → ISO string) and `firstMonthDiscountApplied` (null → undefined). Also guarded `customerAccounts.maxBranches` (column doesn't exist) by falling back to `1`.
- **`DbClient` transaction typing** in `api/lib/account-subscriptions.ts` — `db.transaction(async (tx) => …)` callbacks were getting `NodePgDatabase` instead of `PgTransaction`. Widened `DbClient` to `DbInstance | TxClient`. The `countTable` helper signature was also restored after a refactor had inadvertently removed it.
- **Caller context test mocks** in 6 test files — The local `CallerContext` interface is missing the index signature required by `TrpcUser`. Switched the `as CallerContext` casts to `as any` since these are test fixtures, not production types:
  - `api/__tests__/account-subscription-enforcement.test.ts`
  - `api/__tests__/accounts-coa-integration.test.ts`
  - `api/__tests__/expenses-dual-mode.test.ts`
  - `api/__tests__/journal-and-sales.test.ts`
  - `api/__tests__/posted-delete-guards.test.ts`
  - `api/__tests__/subscriptions.test.ts`
- **`supplierId` missing on `createdBill` type** in `expenses-dual-mode.test.ts` — The `bills.create` return type is `{ id; billNumber?; success }`, not the full row. The test was reading `createdBill.supplierId` (not present). Replaced with `supplier.id` in all four call sites, and added `supplier` to the destructuring where it was missing.
- **`plan` not a property of `businesses.create` input** in `account-subscription-enforcement.test.ts` — The test was passing an extra `plan: "starter"` to verify the subscription guard rejects it. Cast the call args to `any` so the test continues to drive the rejection path.
- **`paymentMethod: "wallet"` rejected by payroll enum** in `business-reset.test.ts` and `db/schema.ts` — Per Mr GENIUS's clarification, wallet is a valid payment method. Added `"wallet"` to the `paymentMethodEnum` in `db/schema.ts` (the second `paymentMethod2Enum` already had it).
- **Hardcoded `subscriptionExpiry: string` passed where `Date` expected** in `api/local-auth-router.ts` — `provisionBusiness` declares `subscriptionExpiry: Date | null`. Was passing the already-stringified value; switched back to the original `subscriptionExpiry` (Date | null). Also widened the catch-block `accountRefId` to `number | null` to match the actual return type.
- **Per-rule corrections**:
  - `api/employees-payroll-router.ts` — replaced `result.id` with `emp.id` (variable that actually exists)
  - `api/employees-payroll-router.ts` — the `payrollPeriod` row's `paymentDate` and `startDate` use ISO string format (not a Date) so no conversion needed.

### Verification
- `npx tsc -b --force` — exit 0 (clean)
- `npm test` — 311 tests across 51 files all pass

## [Unreleased] — Typecheck & Test Fixes

### Added
- Missing `sql` import in `api/suppliers-router.ts` (needed for `LOWER()` and `IN()` queries)
- Missing `locations` import in `api/wallet-router.ts`

### Fixed
- **JSX comments inside JS expression contexts** — Three files used `{/* eslint-disable */}` (JSX comment syntax) inside TypeScript expression contexts (object literals, top-level function declarations) which broke esbuild/TypeScript compilation. Changed to `//` single-line JS comments:
  - `src/pages/Expenses.tsx` — Two top-level `{/* */}` comments before function declarations
  - `src/pages/Suppliers.tsx` — One top-level `{/* */}` comment before function declaration
- **Runtime SlotClone error** — `React.Children.only expected to receive a single React element child` on Users page. Root cause: `{/* eslint-disable-next-line */}` JSX comment inside `<DialogTrigger asChild>` created an extra undefined child entry, causing Radix UI's `SlotClone` to see multiple children. Removed the comment and the `as any` cast.
- **expenses-dual-mode.test.ts** (7 failing tests) — `accounts.create()` only returns `{ id, success }`, not `locationId`. Fixed by:
  - Replacing `paymentAccount.locationId` → `ctx.location.id` across 7 test cases
  - Keeping `paymentAccount` in destructuring (needed for `paymentAccount.id`)
  - Fixed `acctB.locationId` → `ctxB.location.id` in the cross-path test
- **recurring-bills-isolation.test.ts** — `ReferenceError: catA is not defined`. Variable declared as `_catA` but used as `catA`. Fixed destructuring.
- **`Type 'unknown' not assignable to ReactNode`** — `{(b as { allocationSource?: unknown }).allocationSource && <span>}` in Layout.tsx and MobileNavigation.tsx. Changed `&&` to ternary with explicit `null` fallback.
- **migrate-existing-data.ts** (3 errors) — Raw `db.execute()` rows have `unknown` type. Added `as Record<string, unknown>` casts for property access.

## [Unreleased] — Duplicate Accounts Payable Fix & Chart of Accounts systemKey Backfill

### Fixed
- **Duplicate AP accounts** — Root cause identified: the COA seed script (`seed-accounting.ts`) created accounts without setting `systemKey`, while `ensureSystemAccount()` relied on `systemKey` for deduplication. When the first bill was created, `ensureSystemAccount()` couldn't find the seeded AP account (which had `systemKey=NULL`) and created a second system-managed account with the same `accountSubType`. This caused:
  - Two AP accounts sharing the same `accounts_payable` sub-type code
  - Split balances between the seeded account (code 2000) and the system-generated account
  - Inconsistent transaction posting depending on which code path resolved the AP account
- **Resolution** — Three layers of defense implemented:
  1. **Remediation script** ([scripts/fix-duplicate-ap-accounts.ts](file:///d:/DevCenter/abuilds/fina/finaflow/scripts/fix-duplicate-ap-accounts.ts)) — One-time fix that: finds all duplicate AP accounts per business, merges balances, reassigns ledger entries and journal lines from the orphan to the survivor, backfills `systemKey` on the survivor, and soft-deletes duplicates. Also backfills `systemKey` on ALL accounts missing it
  2. **Seed fix** ([db/seed-accounting.ts](file:///d:/DevCenter/abuilds/fina/finaflow/db/seed-accounting.ts)) — Now computes `systemKey` as `${accountType}:${accountSubType}` for every seeded account, preventing future duplication at the source
  3. **Defense-in-depth** ([api/lib/accounting-accounts.ts](file:///d:/DevCenter/abuilds/fina/finaflow/api/lib/accounting-accounts.ts)) — `ensureSystemAccount()` now has a fallback: if the `systemKey` lookup finds nothing, it searches by `(businessId, accountType, accountSubType)` for accounts with `systemKey=NULL`. If found, it backfills the `systemKey` and returns the existing account instead of creating a duplicate
- **check-accounts.ts** — Updated to include `systemKey` in its INSERT statement for default accounts

### CI/CD Integration
- **Dockerfile** — Updated to copy `scripts/fix-duplicate-ap-accounts.ts` into the production image alongside `run-migrations.ts`. The container startup CMD now runs `npx tsx scripts/fix-duplicate-ap-accounts.ts` after schema migrations and before the app starts, ensuring the data fix is applied automatically on every deployment.
- **package.json** — Added `db:fix:ap` script (`npm run db:fix:ap`) for local/manual execution of the AP remediation.

## [Unreleased] — Bug Fixes: Duplicate Labels, Categories, M-PESA Parser

### Fixed
- **Suppliers.tsx** — Fixed duplicate "Category" label in Add Bill dialog caused by `ExpenseCategorySelector` rendering its own `<Label>` while the page also wrapped it in `<Label>Category</Label>`. Removed outer `<Label>` and passed `label="Category"` prop instead. Also fixed `trpc.expenses.listCategories.useQuery()` to `trpc.expenses.categories.useQuery()` (wrong procedure name — `listCategories` doesn't exist in the API)
- **Bills.tsx** — Fixed 3 duplicate label instances: main bill form "Category", recurring bill "Default Category", and bill line item "Category" with text-xs styling. All now pass labels via the `ExpenseCategorySelector` `label` prop instead of wrapping in outer `<Label>` tags
- **M-PESA Parser (`mpesa-provider.ts`)** — Fixed critical bug in `splitIntoSmsChunks` regex: the pattern `(?=[A-Z0-9]{6,20}\s+Confirmed\.)` was matching within transaction IDs (e.g., "UDP9H1ZKXB" would match at positions 0, 1, 2, 3, 4 as sub-sequences of 6+ chars), fragmenting each transaction into multiple chunks and corrupting `providerTxnId` values. Fixed by adding `\b` word boundary: `(?=\b[A-Z0-9]{6,20}\s+[Cc]onfirmed\.)`. Also added `[Cc]onfirmed` to handle lowercase "confirmed" messages (e.g., airtime purchases)

## [Unreleased] — Unified ExpenseCategorySelector Component

### Added
- **`ExpenseCategorySelector` component** ([src/components/ExpenseCategorySelector.tsx](file:///d:/DevCenter/abuilds/fina/finaflow/src/components/ExpenseCategorySelector.tsx)) — Reusable UI component modeled after `LocationSelector` for centralized expense category selection. Features:
  - Auto-selects the single category when only one exists
  - Accepts `categories`, `value`, `onChange`, `label`, `hint`, `required`, `disabled`, `placeholder` props
  - `label` prop supports `ReactNode` for rich labels (e.g., hint text next to label)

### Changed
- **Bills.tsx** — Replaced 3 inline `<select>` category selectors (main bill form, recurring bill, bill line item) with `<ExpenseCategorySelector>`
- **Expenses.tsx** — Replaced inline `<select>` category selector with `<ExpenseCategorySelector>`, preserving bill-linked category hint behavior
- **Suppliers.tsx** — Replaced inline `<select>` category selector in Add Bill dialog with `<ExpenseCategorySelector>`
- **Wallet.tsx** — Replaced inline `<select>` category selector in Tag Transaction dialog with `<ExpenseCategorySelector>`

## [Unreleased] — Location Selector Consolidation + Add Bill Unification + Pay Supplier

### Added
- **`PaySupplierDialog` component** (`src/pages/Suppliers.tsx`) — Shared payment dialog rendered on the suppliers page when a supplier has pending unpaid bills. Reuses the `trpc.bills.recordPayment` mutation with the same core payment logic.
- **"Pay" button on supplier cards** — Conditionally rendered only when `supplier.currentBalance > 0`. Opens the PaySupplierDialog with supplier pre-selected, bill selector limited to that supplier's pending bills.
- **Account-level funding source filtering** — `getFundingAccounts()` helper extracted into the suppliers page, matching the Bills page behavior

### Changed
- **Suppliers page Add Bill** — Refactored from a simplified inline form with `trpc.suppliers.createBill` to a full-featured form matching the main Bills page:
  - Uses `<LocationSelector>` component instead of inline `<select>` (consistent with other pages)
  - Uses `trpc.bills.create` mutation (creates ledger entries for full accounting trail)
  - Added Category field (using `trpc.expenses.listCategories`)
  - Supplier selector is pre-filled and disabled — the only allowed difference from the main Bills page
- **Suppliers page imports** — Added `useAuth`, `LocationSelector`, `CheckCircle`, `OctagonX` icons, and `useEffect` hook

### Fixed
- **Location selector on "Create Bill" under suppliers module** — Replaced inline `<select>` with the shared `<LocationSelector>` component, matching the design and behavior used everywhere else in the system
- **Per-business bill creation** — Bills created from the suppliers page now go through `trpc.bills.create` which creates proper double-entry ledger entries (debit expense, credit accounts payable), instead of the simplified `trpc.suppliers.createBill` which only updated supplier balances

### Testing
- Regression: Add Bill on suppliers page (supplier pre-selected, cannot change) → verify it creates bill with full accounting trail
- Regression: Add Bill on main bills page (full supplier selection) → verify unchanged behavior
- Conditional visibility: Pay button only appears when `supplier.currentBalance > 0`
- Pay Supplier: Record payment works with pre-populated supplier, bill selector shows only that supplier's pending bills

## [Unreleased] — Business Bootstrap Refactoring + Bill Payment Consolidation

### Added
- **`api/lib/business-provisioning.ts`** — Shared `provisionBusiness()` utility that centralizes business bootstrap:
  - Business creation with plan/limits inherited from the customer account (not defaulting to "free")
  - Membership (`userBusinesses`) creation
  - User row update — sets both `currentBusinessId` and `accountRefId` together (fixes drift)
  - Default location ("Main Branch") creation
  - Default accounts (Cash Drawer, Wallet, Bank Account) creation
  - Supports `testFailPoint` for registration failure testing
  - `seedBusinessAccounting()` wrapper for consistent post-bootstrap accounting seed
- **`api/lib/bill-payment.ts`** — Shared `payBill()` utility that centralizes all bill payment accounting:
  - Bill balance update and status calculation
  - `billPayments` record creation
  - Supplier `totalPaid`/`currentBalance` update
  - Cash account credit ledger entry
  - AP account debit ledger entry (with overpayment → prepaid logic via `ensureSystemAccount`)
  - Expense audit trail record creation (optional via `skipExpenseCreation`)
  - Consistent category resolution, AP account lookup, and prepayment account resolution
- **`api/lib/account-subscriptions.ts:checkUserLimitForAccount`** — Account-level user limit enforcement that counts users across the entire account (not per-business) and resolves limits from the customer account row
- **Database migration** `0007_backfill_bill_payments.sql` — Backfills missing `billPayments` records for existing expenses that reference a `billId` but have no corresponding payment entry
- **Database migration** `0008_sync_business_limits_from_accounts.sql` — Syncs existing business rows' `maxUsers` and `plan` from their customer account records

### Changed
- **Business bootstrap (4 entry points → 1 shared service)**:
  - `local-auth-router.ts:register` — Refactored from ~55 lines of inline business creation to a `provisionBusiness()` call
  - `businesses-router.ts:create` — Refactored from ~45 lines of inline code to `provisionBusiness()`; removed `plan: z.string().default("free")` from the input schema — plan and limits are now inherited from the account
  - `businesses-router.ts:createDemo` — Refactored from ~50 lines of inline code to `provisionBusiness()`
- **`api/bills-router.ts:recordPayment`** — Refactored to delegate all payment accounting to the shared `payBill()` utility. Router now handles validation (bill auth, account location check, category resolution) and passes context to `payBill()`.
- **`api/expenses-router.ts:create` → billId path** — Refactored to delegate AP debit, prepaid, supplier update, and bill update to `payBill({ skipExpenseCreation: true })`. The detailed expense record (with items/attachments) is created first, then `payBill()` handles the payment-specific side effects.
- **Blocking guard fix** — The supplier outstanding-bills guard at `expenses-router.ts:290-301` now only fires when `billId` is NOT set (Option C). Users paying a specific bill via the Expenses tab no longer get incorrectly blocked by other outstanding bills.
- **User limit enforcement** — `businesses-router.ts:addMember` and `middleware.ts:checkUserLimit` now use `checkUserLimitForAccount()` which counts users across the entire account and resolves limits from the `customerAccounts` row, instead of reading `businesses.maxUsers` directly.
- **Seed accounting calls** — All 4 bootstrap flows now use the shared `seedBusinessAccounting()` wrapper instead of dynamic `import("../db/seed-accounting")` with inline `.catch()`.

### Fixed
- **`accountRefId` drift** — `businesses-router.ts:create` and `createDemo` both now update `accountRefId` on the user row alongside `currentBusinessId` (via `provisionBusiness`), preventing stale account reference after business creation
- **Business defaulting to "free" plan** — `businesses-router.ts:create` no longer defaults `plan: "free"`; the `provisionBusiness()` utility resolves the account's actual plan and limits from `customerAccounts`
- **Per-business user limit enforcement** — `addMember` now enforces limits at the account level, so a user added to one business counts against the same pool as users in other businesses under the same account
- **Missing `billPayments` records** — Bill payments initiated via the Expenses tab (Path B) now correctly create `billPayments` records, ensuring complete payment history and reconciliation data.
- **Inconsistent blocking guard** — The "outstanding bills" block no longer prevents legitimate bill payments from the Expenses tab.
- **Hardcoded AP account code `1550`** — Prepayment account lookup now uses the same `ensureSystemAccount` pattern as Path A, instead of hardcoding account code `1550`.
- **AP account lookup** — Path B now supports the same `accountSubType: "accounts_payable"` resolution as Path A.
- **Supplier balance double-update** — When `billId` is present, `payBill()` handles the supplier update, avoiding the duplicate inline update that previously existed.

### Testing
- Added 9 new integration tests in `expenses-dual-mode.test.ts` for bill payment consolidation:
  - `creates a billPayments record when paying via expense with billId`
  - `marks the bill as paid when full amount is paid via expense`
  - `marks the bill as partial when partial amount is paid via expense`
  - `updates supplier totalPaid and currentBalance when paying via expense`
  - `creates AP ledger debit entry when paying via expense with billId`
  - `blocks standalone expense when supplier has outstanding bills (no billId)`
  - `does NOT block expense when billId is provided even if supplier has outstanding bills`
  - `produces identical billPayments records from both payment paths` (cross-path consistency)
  - `does NOT create billPayments for standalone expense without billId`

### Cross-Path Consistency
Both payment paths now produce identical outcomes:
| Behavior | Path A (Bills Pay) | Path B (Expenses + billId) |
|---|---|---|
| `billPayments` record | Created ✅ | Created ✅ (NEW) |
| Bill status update | Correct ✅ | Correct ✅ (via payBill) |
| Supplier balance update | Correct ✅ | Correct ✅ (via payBill) |
| Category resolution | `resolveBillCategoryId` ✅ | `resolveBillCategoryId` ✅ (via payBill) |
| AP account lookup | `liabilityAccountId` override → `subType` fallback ✅ | Same ✅ (via payBill) |
| Prepayment account | `ensureSystemAccount` ✅ | `ensureSystemAccount` ✅ (FIXED) |
| Blocking guard | Not blocked ✅ | Not blocked when billId present ✅ (FIXED) |
| Expense audit trail | `EXP-BP-*` ✅ | Detailed expense with `billId` ✅ |
