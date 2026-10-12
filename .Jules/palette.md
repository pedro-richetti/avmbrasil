
## 2024-10-12 - Accessible Icon Buttons
**Learning:** Found multiple instances in `apps/web/src/components/project-workspace.tsx` where icon-only buttons lacked descriptive accessibility text (missing `aria-label`). Users relying on screen readers wouldn't have sufficient context for these actions (e.g. closing modals, understanding methodology, viewing score breakdowns).
**Action:** Always ensure that icon-only interactive elements (like `<button className="icon-button">` containing only `Lucide` icons) have corresponding `aria-label` tags in Portuguese to clarify their intent and improve accessibility, particularly within popups and data-dense tables.
