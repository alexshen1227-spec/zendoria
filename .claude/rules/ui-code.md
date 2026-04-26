---
paths: []
---

# UI Code Rules

> **Status: Disabled for this project.**
> Zendoria's UI (HUD, menus, dialogs, settings panels, death screen) is mixed
> into the same flat `js/` directory as gameplay, with DOM overlays defined
> in `index.html` and styled in `css/style.css`. The general gameplay rules
> in `gameplay-code.md` already cover that code. The full localization /
> gamepad / colorblind / scalable-text mandates here are out of scope for
> the Lean review-mode solo build. Re-enable when adding accessibility passes
> or a multi-language release.


- UI must NEVER own or directly modify game state — display only, use commands/events to request changes
- All UI text must go through the localization system — no hardcoded user-facing strings
- Support both keyboard/mouse AND gamepad input for all interactive elements
- All animations must be skippable and respect user motion/accessibility preferences
- UI sounds trigger through the audio event system, not directly
- UI must never block the game thread
- Scalable text and colorblind modes are mandatory, not optional
- Test all screens at minimum and maximum supported resolutions
