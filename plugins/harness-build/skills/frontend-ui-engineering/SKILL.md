---
name: frontend-ui-engineering
description: Builds accessible, responsive, design-system-consistent user interfaces with proper state, loading, empty and error handling. Use when creating or changing components, pages or layouts, managing UI state, meeting accessibility requirements, or when output must look production-grade rather than generic.
---

# Frontend UI Engineering

## Overview

Build interfaces that are accessible, fast and consistent with the product's own design system, the way a design-aware engineer would, not a template. That means real tokens, real content, keyboard support, and every state handled.

## When to Use

- New components or pages
- Changes to existing interfaces, layouts or responsive behaviour
- Adding interactivity or state management
- Fixing visual or UX defects

## Component Architecture

Colocate a component with its tests, styles, hooks and local types in one folder.

- **Prefer composition to configuration.** `<Card><CardHeader>...</CardHeader><CardBody>...</CardBody></Card>` beats a card taking `title`, `headerVariant`, `bodyPadding` and `content` props.
- **Keep components focused.** One job each; split anything over roughly 200 lines.
- **Separate data from presentation.** A container fetches and chooses among loading, error, empty and loaded views; a presentational component only renders props.

```tsx
function TaskListContainer() {
  const { tasks, isLoading, error, refetch } = useTasks();
  if (isLoading) return <TaskListSkeleton />;
  if (error) return <ErrorState message="Failed to load tasks" retry={refetch} />;
  if (tasks.length === 0) return <EmptyState message="No tasks yet" />;
  return <TaskList tasks={tasks} />;
}
```

## State Management

Use the simplest tool that fits:

| Need | Tool |
|---|---|
| UI state of one component | local state |
| Shared by a few siblings | lift state up |
| Theme, auth, locale | context |
| Filters, pagination, shareable view | URL state |
| Remote data and caching | a server-state library |
| Complex app-wide client state | a global store |

Do not drill props through more than three levels; use context or restructure.

## Design System Adherence

**Reference-led work.** When a distinct look is needed, gather evidence first: use references the product team supplies or a trusted catalogue, study two or three relevant screens, and record decisions on hierarchy, density, navigation, controls, responsive behaviour and states. Write a short design contract (the screen's job, primary action, required states, responsive rules, patterns to reject), then rebuild the useful structure with the product's own components, tokens and content. Never copy another product's branding, text, imagery or exact layout. Without references, state assumptions and check against the existing design system.

**Avoid the generic generated look:**

| Default | Instead |
|---|---|
| Purple/indigo everywhere | the project's real palette |
| Heavy gradients | flat or subtle, per the system |
| Maximum rounding on everything | the system's radius scale |
| Generic hero sections | content-first layout |
| Lorem ipsum | realistic copy that exposes wrapping and overflow |
| Oversized uniform padding | a consistent spacing scale with hierarchy |
| Uniform card grids | layouts that reflect information priority |
| Layered shadows | subtle or none unless specified |

**Spacing:** use the project's scale (for example 0.25rem steps); no arbitrary values like 13px.

**Typography:** one h1 per page, no skipped heading levels, heading styles only for headings, smaller text for secondary content.

**Color:** semantic tokens, not raw hex; contrast at least 4.5:1 for body text and 3:1 for large text; never use color alone to convey state.

## Accessibility (WCAG 2.1 AA)

- **Keyboard.** Every interactive element must be reachable and operable. Use `<button>`, not a clickable `<div>`; if a custom control is unavoidable it needs a role, `tabIndex`, and Enter and Space handling.
- **Names.** Icon-only buttons get `aria-label`; inputs get a `<label>` or `aria-label`.
- **Focus.** Move focus into a dialog when it opens, trap it while open, return it on close.
- **States.** Never show a blank screen: empty states explain and offer the next action; errors say what happened and how to retry; loading uses skeletons for content, announced with `role="status"` and `aria-busy`.

For the full checklist, use harness-core's accessibility checklist reference.

## Responsive Design

Design mobile first and add columns at larger breakpoints. Check at 320, 768, 1024 and 1440 px.

## Loading and Perceived Speed

Skeletons over spinners for content. For fast-feeling mutations, update optimistically: cancel in-flight queries, snapshot the previous data, apply the change, and roll back in the error handler.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "Accessibility is nice to have" | It is often a legal requirement and a quality baseline. |
| "We'll make it responsive later" | Retrofitting costs far more than building it in. |
| "The design isn't final, skip styling" | Use design-system defaults; unstyled UI misleads reviewers. |
| "It's just a prototype" | Prototypes become production. |
| "The generic look is fine for now" | It signals low quality; use the real system from the start. |

## Red Flags

- Components over 200 lines
- Inline styles or arbitrary pixel values
- Missing loading, empty or error states
- Keyboard use never tested
- Color as the only state indicator
- Stock layouts and palette that ignore the product's design

## Verification

- [ ] No console errors on render
- [ ] Whole page operable by keyboard alone
- [ ] Screen reader conveys content and structure
- [ ] Works at 320, 768, 1024 and 1440 px
- [ ] Loading, empty, error, success and permission states handled where relevant
- [ ] Spacing, color and type follow the design system
- [ ] No warnings from an automated accessibility checker
- [ ] Rendered result reviewed in a browser (see harness-verify:browser-testing-with-devtools)
