# Margin — Student Assignment Manager

A student-first coursework planner built with plain HTML, CSS, and JavaScript. Margin uses an editorial paper-and-ink visual system, with a responsive layout and local-first data storage.

## Features
- Dashboard totals for all, to-do, completed, and overdue assignments
- Create, edit, complete, and delete assignments
- Subject, due date, priority, and optional notes
- Search across titles, subjects, and notes
- Filter by subject and sort by deadline, priority, title, or creation time
- Automatic overdue and upcoming-deadline labels
- Progress indicator, mobile navigation, and light/dark theme
- Local persistence through browser `localStorage`
- Accessible labels, keyboard focus management, escape-to-close dialogs, and reduced-motion support
- Warm paper-and-forest visual identity designed for coursework rather than a generic SaaS template

## Run locally
Open `index.html` in a modern browser. No build tools or dependencies are required.

## Deploy with GitHub Pages
The `SITEPRO audit and deploy Margin` GitHub Actions workflow runs browser-based functional checks, responsive viewport checks, and a WCAG accessibility scan before deployment. In **Settings → Pages**, set the publishing source to **GitHub Actions**. A deployment is allowed only after the audit job passes. The site is published at:
https://patu-art.github.io/student-assignment-manager/

## Data and privacy
Assignments are stored in the current browser's local storage on the current device. They are not uploaded to a server, shared between devices, or protected by an account login. Clearing browser site data may remove them. Export/backup and cross-device synchronization are not included in this frontend-only version.

## Quality checks
Run `npm install` and `npm run test:sitepro` after installing the Playwright Chromium browser (`npx playwright install --with-deps chromium`). The automated audit covers create/edit/complete/delete flows, search and filters, local persistence, theme persistence, keyboard interactions, viewport widths from 320px to desktop, and serious/critical WCAG issues in both themes. Screenshots and reports are uploaded as artifacts by GitHub Actions.

## Browser support
Use a recent version of Chrome, Edge, Firefox, or Safari. Google Fonts are optional presentation assets; system-font fallbacks keep the app usable if they cannot load.
