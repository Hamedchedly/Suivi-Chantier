// Auto-inscription publique (« Demander une démo »).
// Le demandeur choisit son mot de passe ; le compte est cree DESACTIVE (en
// attente) et sans module. Un super-admin le valide ensuite et ouvre les
// fonctionnalites. Deploiement : verify_jwt = false (point d'entree public).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const URL = Deno.env.get('SUPABASE_URL')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const body = await req.json().catch(() => ({}))
    const email = str(body.email).toLowerCase()
    const password = typeof body.password === 'string' ? body.password : ''
    const name = str(body.name)
    const company = str(body.company)
    const message = str(body.message)

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'email_invalide' }, 400)
    if (password.length < 8) return json({ error: 'mot_de_passe_court' }, 400)

    const admin = createClient(URL, SERVICE, { auth: { persistSession: false } })

    const { data, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { display_name: name || email },
    })
    if (error || !data.user) {
      const msg = (error?.message ?? '').toLowerCase()
      if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
        return json({ error: 'email_deja_utilise' }, 400)
      }
      return json({ error: error?.message ?? 'creation_impossible' }, 400)
    }

    const uid = data.user.id
    // Compte en attente : desactive, aucun module (features par defaut = []).
    await admin.from('profiles').update({
      display_name: name || email,
      disabled: true,
      role: 'user',
      features: [],
    }).eq('id', uid)

    await admin.from('demo_requests').insert({
      user_id: uid, name: name || null, email, company: company || null,
      message: message || null, status: 'pending',
    })

    return json({ ok: true })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
