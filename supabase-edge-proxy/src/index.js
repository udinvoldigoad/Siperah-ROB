/**
 * Cloudflare Worker Proxy untuk Supabase
 * Tujuannya: Mengurangi egress Supabase dengan melakukan caching di Cloudflare Edge.
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const targetUrl = new URL(env.SUPABASE_URL);

    // Mengganti hostname request dari Cloudflare Workers/Custom Domain ke Supabase URL
    url.hostname = targetUrl.hostname;

    // Supabase tidak merekomendasikan modifikasi path, jadi kita teruskan saja apa adanya.
    // Misal: /storage/v1/object/public/... atau /rest/v1/...

    const newRequest = new Request(url.toString(), request);

    // Gunakan Cloudflare Cache API
    const cache = caches.default;
    
    // Kita hanya akan meng-cache method GET dan HEAD
    const isCacheableMethod = ['GET', 'HEAD'].includes(request.method);
    
    // Cek apakah request ditujukan untuk Storage (public file) atau REST API
    const isStorageRequest = url.pathname.startsWith('/storage/v1/object/public/');
    const isRestRequest = url.pathname.startsWith('/rest/v1/');

    if (!isCacheableMethod) {
      // Jika POST/PUT/DELETE, langsung forward tanpa cache
      return fetch(newRequest);
    }

    // Cek apakah ada di cache Cloudflare
    let response = await cache.match(request);
    
    if (!response) {
      // Jika tidak ada di cache (MISS), ambil dari Supabase
      response = await fetch(newRequest);
      
      // Jika response OK (200), kita modifikasi header untuk mengatur TTL cache di Cloudflare
      if (response.status === 200) {
        response = new Response(response.body, response);
        
        // Atur berapa lama Cloudflare akan menyimpan cache
        // Untuk file gambar (Storage) kita bisa simpan lama, misalnya 30 hari (2592000 detik)
        // Untuk data API biasa, mungkin 5 menit (300 detik) agar datanya tidak terlalu usang
        let maxAge = 0;
        if (isStorageRequest) {
           maxAge = 2592000; // 30 hari
        } else if (isRestRequest) {
           maxAge = 300; // 5 menit
        }

        if (maxAge > 0) {
          response.headers.set('Cache-Control', `public, max-age=${maxAge}`);
          // Simpan ke Cache Cloudflare (secara background/asynchronous menggunakan ctx.waitUntil)
          ctx.waitUntil(cache.put(request, response.clone()));
        }
      }
    }

    // CORS Headers: Supabase butuh ini agar bisa diakses oleh frontend
    response = new Response(response.body, response);
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', request.headers.get('Access-Control-Request-Headers') || '*');
    
    return response;
  }
};
