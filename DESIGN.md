# DESIGN.md · Seoul Pocket

Mode: **Operate**. The traveler is in a task (find the address, convert a price, say a phrase). The tool disappears into the task. Brand lives in details, never in choreography. Written 8 September 2026 after reviewing emilkowalski/skills, Impeccable and Design with Intent; the decisions below are the ones that survived those filters.

## Tokens (public/styles.css `:root`)
Color: `--bg #f6f5ef` warm off-white ground, `--paper #fff` cards, `--ink #152d2a`, `--muted #596863`, `--line #dedfd6`, `--green #163e39` primary and selection, `--soft #e7eee5` secondary surfaces, `--orange #ef7953` food and must-try only, `--danger #9e322c`. Accent is for primary actions, current selection and state. Never decoration.
Type: system sans stack, fixed rem scale, headings 32/20/16, body 16, captions 13 and 11. Tabular numerals on every number the eye compares: currency result and input, clocks, PIN, forecast temperatures, emergency numbers, date pills.
Shape: cards 20 to 22px radius, chips 30px, one elevation system (1px `--line` border plus `--shadow`, never both heavy). Touch targets 48px.
Browser surfaces: `::selection` and caret tinted from `--green`, checkboxes and radios use `accent-color: var(--green)`, focus ring is a 3px `#ad4d2e` outline with 3px offset.

## Motion thesis
One authored moment, feedback on press, nothing on navigation.

| Moment | Decision | Values |
|---|---|---|
| Bottom sheet opens | Slide up from its own height, backdrop fades | `translateY(100%) → 0`, 260ms, `--ease-drawer cubic-bezier(.32,.72,0,1)` via `@starting-style` |
| Bottom sheet closes | Exits the way it entered, faster | `translateY(100%)`, 180ms; JS adds `.closing`, closes the dialog on `transitionend` or a 240ms fallback |
| Desktop sheet (≥680px) | Centered, so it rises 18px and scales from .985 with opacity | same durations |
| Press on any tappable surface | Scale feedback | `scale(.97)` (`.985` on place cards), 120ms, `--ease-out cubic-bezier(.23,1,.32,1)` |
| Toast | Transition, never keyframes, so rapid toasts retarget | opacity and 12px rise, 200ms ease-out |
| Tab switch | **No animation.** Used hundreds of times a trip | instant |
| Currency swap, filter chips, checklist ticks | **No motion beyond press feedback.** State change is the feedback | instant |
| Reduced motion | Sheet and toast cross-fade only, no transforms anywhere, press scale removed | 150ms ease |

Properties are limited to `transform` and `opacity`. No `ease-in` on UI. No `scale(0)`. Lock, background and idle paths close the sheet immediately with no animation so secrets never linger in the DOM.

## Copy rules applied
Controls name the action ("Encrypt and save stay", "Import without overwriting"). Errors name the problem and the recovery ("Choose a JPEG, PNG, or WebP. For HEIC, export a JPEG or use a screenshot."). Status language is fixed in docs/02 and never implies more than the device has verified.

## Refused defaults
No page-load choreography, no section reveals, no hover-only affordances, no pulsing indicators, no gradient text, no glass as decoration, no modal for anything a card can carry inline, no select elements for choices with fewer than five options.

## Still open
The hero eyebrow was removed after the design audit; the clock line now carries the neighborhood. Remaining `.eyebrow` uses are plain 13px labels, not uppercase kickers. A native-speaker pass on the 28 audio clips and Korean phrase text is pending and is the only remaining content review before the trip.
