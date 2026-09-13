// Gestion des comptes reservee aux super-admins.
// Le service_role reste cote serveur ; l'appelant est verifie via son JWT puis
// son role dans public.profiles. Actions : list, create, setPassword, update, delete.
// Deploiement : supabase functions deploy admin-users (verify_jwt = true).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const URL = Deno.env.get('SUPABASE_URL')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const cleanUsername = (u: unknown): string | null => {
  if (typeof u !== 'string') return null
  const t = u.trim()
  return t ? t : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace('Bearer ', '')
    if (!token) return json({ error: 'missing_token' }, 401)

    const caller = createClient(URL, ANON, { global: { headers: { Authorization: authHeader } } })
    const { data: userData, error: userErr } = await caller.auth.getUser(token)
    if (userErr || !userData.user) return json({ error: 'invalid_token' }, 401)

    const admin = createClient(URL, SERVICE, { auth: { persistSession: false } })

    const { data: me } = await admin.from('profiles').select('role,disabled').eq('id', userData.user.id).single()
    if (!me || me.role !== 'superadmin' || me.disabled) return json({ error: 'forbidden' }, 403)

    const body = await req.json().catch(() => ({}))
    const action = body.action as string

    if (action === 'list') {
      const { data, error } = await admin.from('profiles').select('*').order('created_at', { ascending: true })
      if (error) return json({ error: error.message }, 400)
      return json({ users: data })
    }

    if (action === 'create') {
      const { email, password, display_name, role, features, username } = body
      if (!email || !password) return json({ error: 'email_password_required' }, 400)
      const { data, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { display_name: display_name ?? email },
      })
      if (error || !data.user) return json({ error: error?.message ?? 'create_failed' }, 400)
      const { error: pErr } = await admin.from('profiles').update({
        display_name: display_name ?? email,
        role: role === 'superadmin' ? 'superadmin' : 'user',
        features: Array.isArray(features) ? features : [],
        username: cleanUsername(username),
      }).eq('id', data.user.id)
      if (pErr) return json({ error: pErr.message }, 400)
      return json({ ok: true, id: data.user.id })
    }

    if (action === 'setPassword') {
      const { id, password } = body
      if (!id || !password) return json({ error: 'id_password_required' }, 400)
      const { error } = await admin.auth.admin.updateUserById(id, { password })
      if (error) return json({ error: error.message }, 400)
      return json({ ok: true })
    }

    if (action === 'update') {
      const { id, patch } = body
      if (!id || !patch) return json({ error: 'id_patch_required' }, 400)
      const allowed: Record<string, unknown> = {}
      for (const k of ['display_name', 'role', 'disabled', 'features']) {
        if (k in patch) allowed[k] = patch[k]
      }
      if ('username' in patch) allowed.username = cleanUsername(patch.username)
      const { error } = await admin.from('profiles').update(allowed).eq('id', id)
      if (error) return json({ error: error.message }, 400)
      return json({ ok: true })
    }

    if (action === 'delete') {
      const { id } = body
      if (!id) return json({ error: 'id_required' }, 400)
      if (id === userData.user.id) return json({ error: 'self_delete' }, 400)
      const { error } = await admin.auth.admin.deleteUser(id)
      if (error) return json({ error: error.message }, 400)
      return json({ ok: true })
    }

    return json({ error: 'unknown_action' }, 400)
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
