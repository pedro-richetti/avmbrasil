## 2024-07-13 - [Missing ARIA Labels on Icon-only Action Buttons]
**Learning:** Common modal overlay interactive elements (close, help/info) and table actions (add row, remove column) built purely with icons or minimal layout text lacked `aria-label`. This significantly impacts screen reader support when they iterate over `icon-button` styled components without text nodes.
**Action:** Always verify `icon-button` instances and ensure `aria-label` matching `title` (or descriptive text) is included. Make sure data-grid and modal overlay components have accessible action triggers.
