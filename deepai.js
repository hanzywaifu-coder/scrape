/*
 * sumber: https://whatsapp.com/channel/0029Vb8Thxq2kNFik6sVnY0J
 * Dongtube API - https://api.dongtube.id
 * scrape DeepAI AI Chatbot (https://deepai.org/chat)
 * api.dongtube.id 300++ endpoint 🔥
 * sumber: https://whatsapp.com/channel/0029Vb8Thxq2kNFik6sVnY0J
 * Docs: https://api.dongtube.id/docs
 */
const https = require('https');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function generateDeepAiKey(ua) {
  const myrandomstr = Math.round(Math.random() * 100000000000) + '';
  const myhashfunction = (() => {
    const a = [];
    for (let b = 0; 64 > b;) a[b] = 0 | (4294967296 * Math.sin(++b % Math.PI));
    return (input) => {
      let d;
      let e;
      let f;
      const g = [d = 1732584193, e = 4023233417, ~d, ~e];
      const h = [];
      const l = unescape(encodeURI(input)) + '\u0080';
      let k = l.length;
      let c = (--k / 4 + 2) | 15;
      for (h[--c] = 8 * k; ~k;) h[k >> 2] |= l.charCodeAt(k) << (8 * k--);
      for (let b = 0, l2 = 0; b < c; b += 16) {
        for (k = g; 64 > l2; k = [f = k[3], d + ((f = k[0] + [d & e | ~d & f, f & d | ~f & e, d ^ e ^ f, e ^ (d | ~f)][k = l2 >> 4] + a[l2] + ~~h[b | [l2, 5 * l2 + 1, 3 * l2 + 5, 7 * l2][k] & 15]) << (k = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21][4 * k + l2++ % 4]) | f >>> -k), d, e]) {
          d = k[1] | 0;
          e = k[2];
        }
        for (let l3 = 4; l3;) g[--l3] += k[l3];
      }
      let result = '';
      for (let l4 = 0; 32 > l4;) result += ((g[l4 >> 3] >> (4 * (1 ^ l4++))) & 15).toString(16);
      return result.split('').reverse().join('');
    };
  })();

  return 'tryit-' + myrandomstr + '-' + myhashfunction(ua + myhashfunction(ua + myhashfunction(ua + myrandomstr + 'hackers_become_a_little_stinkier_every_time_they_hack')));
}

function deepaiChat(prompt, model = 'standard') {
  return new Promise((resolve, reject) => {
    const boundary = '--------------------------' + Math.random().toString(36).slice(2);
    const apiKey = generateDeepAiKey(UA);

    const payload = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="chat_style"',
      '',
      'chat',
      `--${boundary}`,
      'Content-Disposition: form-data; name="chatHistory"',
      '',
      JSON.stringify([{ role: 'user', content: prompt }]),
      `--${boundary}`,
      'Content-Disposition: form-data; name="model"',
      '',
      model,
      `--${boundary}`,
      'Content-Disposition: form-data; name="hacker_is_stinky"',
      '',
      'very_stinky',
      `--${boundary}--`,
      '',
    ].join('\r\n');

    const req = https.request('https://api.deepai.org/hacking_is_a_serious_crime', {
      method: 'POST',
      headers: {
        'User-Agent': UA,
        'api-key': apiKey,
        origin: 'https://deepai.org',
        referer: 'https://deepai.org/chat',
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: 45000,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ status: true, model, result: data.trim() });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

(async () => {
  const q = process.argv[2] || 'Halo!';
  try {
    const res = await deepaiChat(q);
    console.log(JSON.stringify(res, null, 2));
  } catch (e) {
    console.error(e.message);
  }
})();
