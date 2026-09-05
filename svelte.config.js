import adapter from '@sveltejs/adapter-cloudflare';
export default {
  kit: {
    adapter: adapter(),
    csp: {
      mode: 'auto',
      directives: {
        'default-src': ['self'],
        'script-src': ['self'],
        'style-src': ['self', 'unsafe-inline', 'https://fonts.googleapis.com'],
        'font-src': ['self', 'https://fonts.gstatic.com'],
        'img-src': ['self', 'blob:', 'data:'],
        'connect-src': ['self', 'https://*.supabase.co'],
        'frame-ancestors': ['none'],
        'object-src': ['none'],
        'base-uri': ['self'],
        'form-action': ['self'],
        'worker-src': ['self', 'blob:']
      }
    }
  }
};
