/**
 * ralha-status — Cloudflare Worker
 * Endpoints:
 *   GET /          → { live: bool }
 *   GET /clips     → { clips: [...] }   ?limit=12
 *   GET /streams   → { streams: [...] } ?limit=8
 *   GET /badges    → { global: {...}, channel: {...} }
 */

const ALLOWED_ORIGINS = [
  'https://jralha.com',
  'https://ralha-react-ultra-bwxl.vercel.app',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
]

const TWITCH_USERNAME = 'jralha_'
const CHANNEL_ID      = '216681327'

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || ''
    const isAllowed = ALLOWED_ORIGINS.includes(origin)

    const corsHeaders = {
      'Access-Control-Allow-Origin': isAllowed ? origin : '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders })
    }

    const clientId     = env.TWITCH_CLIENT_ID
    const clientSecret = env.TWITCH_TOKEN

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: 'Missing Twitch credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── Get App Access Token ───────────────────────────────────────────────
    const tokenRes = await fetch(
      `https://id.twitch.tv/oauth2/token?client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&grant_type=client_credentials`,
      { method: 'POST' }
    )
    const tokenData = await tokenRes.json()

    if (!tokenRes.ok || !tokenData.access_token) {
      return new Response(
        JSON.stringify({ error: 'Token fetch failed', details: tokenData }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const accessToken = tokenData.access_token
    const twitchHeaders = {
      'Client-ID': clientId,
      'Authorization': `Bearer ${accessToken}`,
    }

    const url      = new URL(request.url)
    const pathname = url.pathname

    // ── GET /badges ────────────────────────────────────────────────────────
    if (pathname === '/badges') {
      const [globalRes, channelRes] = await Promise.all([
        fetch('https://api.twitch.tv/helix/chat/badges/global', { headers: twitchHeaders }),
        fetch(`https://api.twitch.tv/helix/chat/badges?broadcaster_id=${CHANNEL_ID}`, { headers: twitchHeaders }),
      ])

      const globalData  = await globalRes.json()
      const channelData = await channelRes.json()

      // Flatten into { "set/version": "image_url" }
      // scale=2 devolve 2x para OBS 1080p60 mais nítido
      const scale = url.searchParams.get('scale') === '2' ? '2x' : '1x'
      const badges = {}

      const flatten = (data) => {
        for (const set of (data?.data || [])) {
          for (const version of (set.versions || [])) {
            const imgUrl = scale === '2x'
              ? (version.image_url_2x || version.image_url_1x)
              : version.image_url_1x
            badges[`${set.set_id}/${version.id}`] = imgUrl
          }
        }
      }

      flatten(globalData)
      flatten(channelData) // channel overrides global (custom sub badges etc)

      return new Response(
        JSON.stringify({ badges }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=3600', // cache 1 hora
          }
        }
      )
    }

    // ── GET /clips ─────────────────────────────────────────────────────────
    if (pathname === '/clips') {
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '12'), 20)

      const userRes  = await fetch(
        `https://api.twitch.tv/helix/users?login=${TWITCH_USERNAME}`,
        { headers: twitchHeaders }
      )
      const userData = await userRes.json()
      const broadcasterId = userData?.data?.[0]?.id

      if (!broadcasterId) {
        return new Response(
          JSON.stringify({ error: 'User not found', detail: userData }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const clipsRes  = await fetch(
        `https://api.twitch.tv/helix/clips?broadcaster_id=${broadcasterId}&first=100`,
        { headers: twitchHeaders }
      )
      const clipsData = await clipsRes.json()

      if (!clipsRes.ok) {
        return new Response(
          JSON.stringify({ error: `Clips API erro ${clipsRes.status}`, detail: clipsData }),
          { status: clipsRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const sorted = (clipsData.data ?? [])
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, limit)

      return new Response(
        JSON.stringify({ clips: sorted }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── GET /streams ───────────────────────────────────────────────────────
    if (pathname === '/streams') {
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '8'), 20)

      const userRes    = await fetch(
        `https://api.twitch.tv/helix/users?login=${TWITCH_USERNAME}`,
        { headers: twitchHeaders }
      )
      const userData   = await userRes.json()
      const broadcasterId = userData?.data?.[0]?.id

      if (!broadcasterId) {
        return new Response(
          JSON.stringify({ error: 'User not found', detail: userData }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const videosRes  = await fetch(
        `https://api.twitch.tv/helix/videos?user_id=${broadcasterId}&type=archive&first=${limit}`,
        { headers: twitchHeaders }
      )
      const videosData = await videosRes.json()

      if (!videosRes.ok) {
        return new Response(
          JSON.stringify({ error: `Videos API erro ${videosRes.status}`, detail: videosData }),
          { status: videosRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ streams: videosData.data ?? [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── GET / — live status ────────────────────────────────────────────────
    const helixRes  = await fetch(
      `https://api.twitch.tv/helix/streams?user_login=${TWITCH_USERNAME}`,
      { headers: twitchHeaders }
    )
    const helixData = await helixRes.json()

    if (!helixRes.ok) {
      return new Response(
        JSON.stringify({ error: 'Helix call failed', details: helixData }),
        { status: helixRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const live = Array.isArray(helixData.data) && helixData.data.length > 0

    return new Response(
      JSON.stringify({ live }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  },
}
