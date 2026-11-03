// Vercel Function that runs the Express API. vercel.json rewrites /api/* and
// /health here; Express still sees the original path (e.g. /api/v1/auth/login).
// It imports the compiled server, which the build step produces in server/dist.
process.env.NODE_ENV ??= 'production';

const { createApp } = await import('../server/dist/app.js');

export default createApp();
