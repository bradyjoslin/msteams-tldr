const summaryLength = 8

/**
 * Converts base64 string to Uint8Array
 *
 * @param {string} base64 base64 string to convert
 * @returns {Uint8Array} Uint8Array representation of the provided base64 string
 * */
function base64ToUint8Array(base64) {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
}

/**
 * Verifies HMAC signature provided by MS Teams
 *
 * @param {string} body incoming message text from MS Teams
 * @param {string} signature base64 string representation of HMAC signature from MS Teams
 * @returns {Promise<Boolean>} true/false depending on if the signature is valid
 * */
async function verifySignature(body, signature) {
  const secretBuf = base64ToUint8Array(SECRET) // SECRET is a Workers Secret

  // Removes 'HMAC ' prefix from the provided signature and then converts
  // the remaining base64 string to Uint8Array
  const sigBuf = base64ToUint8Array(signature ? signature.slice(5) : '')

  const msgBuf = new TextEncoder().encode(body)

  const key = await crypto.subtle.importKey(
    'raw',
    secretBuf,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  )

  return await crypto.subtle.verify('HMAC', key, sigBuf, msgBuf)
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
    .then((res) => res.json())
    .then((json) => json.result)
    .catch((e) => console.log(e))

  return summary
}

addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  let body = await request.text()
  let signature = request.headers.get('authorization')
  let isSignatureValid = false

  try {
    isSignatureValid = await verifySignature(body, signature)
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
