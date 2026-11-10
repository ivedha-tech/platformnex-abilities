# Accessibility Checklist (reference)

A quick reference for WCAG 2.1 AA compliance in web UI.

## Essential checks

### Keyboard
- [ ] Every interactive element is reachable with Tab
- [ ] Focus order matches visual and logical order
- [ ] Focus is visible (outline or ring)
- [ ] Custom widgets work from the keyboard (Enter to activate, Escape to close)
- [ ] No keyboard traps
- [ ] A skip-to-content link exists, visible at least on focus
- [ ] Modals trap focus while open and return it on close

### Screen readers
- [ ] Images have `alt` (or `alt=""` when decorative)
- [ ] Every form input has an associated label (`<label>` or `aria-label`)
- [ ] Buttons and links have descriptive text, not "click here"
- [ ] Icon-only buttons have `aria-label`
- [ ] One `<h1>`; headings do not skip levels
- [ ] Dynamic changes are announced (`aria-live` regions)
- [ ] Data tables use `<th>` with scope

### Visual
- [ ] Text contrast at least 4.5:1, or 3:1 for large text (18pt / 24 CSS px, or 14pt bold / about 18.67 CSS px). Never round a failing ratio up to the threshold.
- [ ] UI component contrast at least 3:1 against the background
- [ ] Color is never the only carrier of information
- [ ] Text resizes to 200% without breaking layout
- [ ] Nothing flashes more than 3 times per second

### Forms
- [ ] Every input has a visible label
- [ ] Required fields are marked by more than color
- [ ] Error messages are specific and tied to their field
- [ ] Error state shows more than color (icon, text, border)
- [ ] Submission errors are summarized and focusable
- [ ] Known fields use autocomplete (for example `type="email" autocomplete="email"`)

### Content
- [ ] Language declared (`<html lang="en">`)
- [ ] Descriptive page `<title>`
- [ ] Links are distinguishable from surrounding text by more than color
- [ ] Touch targets at least 44x44px on mobile
- [ ] Empty states are meaningful, not blank

## Common HTML patterns

```html
<!-- <button> for actions, <a> for navigation; never a div as a button -->
<button onClick={handleDelete}>Delete task</button>
<a href="/tasks/123">View task</a>

<!-- Labels -->
<label for="email">Email address</label>
<input id="email" type="email" required />
<input type="search" aria-label="Search tasks" />   <!-- visible label preferred -->

<!-- Landmarks and live regions -->
<nav aria-label="Main navigation">...</nav>
<div role="status" aria-live="polite">Task saved</div>
<div role="alert">Error: title is required</div>

<!-- Dialog -->
<dialog aria-modal="true" aria-labelledby="dialog-title">
  <h2 id="dialog-title">Confirm delete</h2>
</dialog>

<!-- Loading -->
<div role="status" aria-busy="true" aria-label="Loading tasks"></div>
```

## Testing

- Automated audits: an axe-based scan, pa11y, or the browser's built-in accessibility audit. They catch only part of the issues; they do not replace manual checks.
- Inspect the accessibility tree in browser devtools.
- Try a real screen reader: VoiceOver (macOS), NVDA (Windows), Orca (Linux).
- Tab through the whole page without a mouse.

## ARIA live regions

| Value | Behavior | Use for |
|---|---|---|
| `aria-live="polite"` / `role="status"` | Announced at the next pause | Status updates, save confirmations |
| `aria-live="assertive"` / `role="alert"` | Announced immediately | Errors, time-sensitive alerts |

## Common anti-patterns

| Anti-pattern | Problem | Fix |
|---|---|---|
| `div` as button | Not focusable, no keyboard support | Use `<button>` |
| Missing `alt` | Image invisible to screen readers | Add descriptive `alt` |
| Color-only state | Invisible to color-blind users | Add icon, text or pattern |
| Autoplaying media | Disorienting, cannot be stopped | Add controls; do not autoplay |
| Custom dropdown without ARIA | Unusable by keyboard and screen reader | Native `<select>` or a proper listbox |
| Removed focus outline | Users lose their place | Style it, do not remove it |
| Empty links or buttons | Announced with no description | Add text or `aria-label` |
| `tabindex` above 0 | Breaks natural tab order | Use only 0 or -1 |
