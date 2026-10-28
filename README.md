# Taskwise — Student Assignment Manager

A responsive, browser-based assignment planner built with plain HTML, CSS, and JavaScript.

## Features
- Dashboard totals for all, to-do, completed, and overdue assignments
- Create, edit, complete, and delete assignments
- Subject, due date, priority, and optional notes
- Search across titles, subjects, and notes
- Filter by subject and sort by deadline, priority, title, or creation time
- Automatic overdue and upcoming-deadline labels
- Progress indicator, mobile navigation, and light/dark theme
- Local persistence through browser `localStorage`
- Accessible labels, keyboard focus states, escape-to-close dialogs, and reduced-motion support

## Run locally
Open `index.html` in a modern browser. No build tools or dependencies are required.

## Deploy with GitHub Pages
In the repository, open **Settings → Pages**. Set the source to **Deploy from a branch**, select **main** and **/(root)**, then save. GitHub Pages will publish the site at:
https://patu-art.github.io/student-assignment-manager/

## Data and privacy
Assignments are stored in the current browser's local storage on the current device. They are not uploaded to a server, shared between devices, or protected by an account login. Clearing browser site data may remove them. Export/backup and cross-device synchronization are not included in this frontend-only version.

## Browser support
Use a recent version of Chrome, Edge, Firefox, or Safari. An internet connection is used only to load the optional Google Fonts; the app itself has no external runtime dependency.
