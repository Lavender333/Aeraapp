import { copyFile, mkdir } from 'node:fs/promises';

// GitHub Pages returns a real 200 response for directory index files. Keep a
// dedicated privacy entrypoint so App Store crawlers do not have to rely on
// the single-page application's JavaScript 404 redirect.
for (const route of ['privacy', 'reset-password']) {
  await mkdir(`dist/${route}`, { recursive: true });
  await copyFile('dist/index.html', `dist/${route}/index.html`);
}
