// Optional local proxy so your Anthropic key never reaches the browser.
//   ANTHROPIC_API_KEY=sk-... node server/proxy.mjs
// Then set the "Proxy URL" in the Claude panel to http://localhost:8787
import http from 'node:http'

const key = process.env.ANTHROPIC_API_KEY
if (!key) {
  console.error('Set ANTHROPIC_API_KEY first.')
  process.exit(1)
}

http
  .createServer(async (req, res) => {
    res.setHeader('access-control-allow-origin', '*')
    res.setHeader('access-control-allow-headers', 'content-type')
    if (req.method === 'OPTIONS') return res.writeHead(204).end()
    if (req.method !== 'POST') return res.writeHead(405).end()
    let body = ''
    for await (const chunk of req) body += chunk
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body,
    })
    res.writeHead(upstream.status, { 'content-type': 'application/json' })
    res.end(await upstream.text())
  })
  .listen(8787, () => console.log('Claude proxy on http://localhost:8787'))
