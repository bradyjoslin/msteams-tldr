const crypto = require('crypto')
const summaryLength = 8

function verifySignature(body, signature) {
  let bufSecret = Buffer.from(SECRET, 'base64')
  let msgBuf = Buffer.from(body, 'utf8')

  let msgHash =
    'HMAC ' +
    crypto
      .createHmac('sha256', bufSecret)
      .update(msgBuf)
      .digest('base64')

  return msgHash === signature
}

async function getSummary(url) {
  let algo =
    'https://api.algorithmia.com/v1/algo/nlp/SummarizeURL/0.1.4?timeout=300'
  let summary = await fetch(algo, {
    method: 'POST',
    headers: {
      Authorization: ALGO_KEY,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([url, summaryLength]),
  })
    .then(res => res.json())
    .then(json => json.result)
    .catch(e => console.log(e))

  return summary
}

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  let body = await request.text()
  let signature = request.headers.get('authorization')
  let isSignatureValid = false

  try {
    isSignatureValid = verifySignature(body, signature)
  } catch (e) {
    // console.log(e.stack)
    return new Response('Error', { status: 500 })
  }
  if (!isSignatureValid) {
    return new Response('invalid token', { status: 401 })
  } else {
    let json = JSON.parse(body)
    let message = json.text

    let urlMatcher = /(?<=a href=?")([h]t{1,2}ps?:\/\/.*?)(?=")/.exec(message)
    let url = urlMatcher != null && urlMatcher.length ? urlMatcher[0] : ''

    let summary = await getSummary(url)

    return new Response(`{"type": "message","text": "${summary}"}`, {
      headers: { 'content-type': 'application/json' },
    })
  }
}
