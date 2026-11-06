// Apply the saved theme before first paint to avoid a flash. Loaded as a
// blocking script from <head>; kept in its own file because the site's
// Content-Security-Policy (vercel.json) does not allow inline scripts.
try {
  const t = localStorage.getItem('theme');
  const dark = t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark', dark);
} catch {}
