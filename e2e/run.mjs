// Démarre le serveur de dev sur un port dédié aux tests, attend qu'il
// réponde, exécute les scénarios E2E permanents, puis arrête le serveur.
// `npm run e2e`
import { spawn } from 'node:child_process'

const PORT = process.env.E2E_PORT ?? '5199'
const BASE = `http://localhost:${PORT}`
const SPECS = [
  'e2e/planning-visite.mjs', 'e2e/multi-operation-isolation.mjs', 'e2e/permissions.mjs',
  'e2e/finances-chain.mjs', 'e2e/entreprises-synthesis.mjs', 'e2e/recipe-metier-complete.mjs',
]

function waitForServer(url, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const res = await fetch(url)
        if (res.ok || res.status < 500) return resolve()
      } catch { /* pas encore prêt */ }
      if (Date.now() > deadline) return reject(new Error(`Le serveur de dev n'a pas répondu sur ${url}`))
      setTimeout(tick, 300)
    }
    tick()
  })
}

async function main() {
  const server = spawn('npx', ['vite', '--port', PORT], { stdio: 'pipe' })
  server.stdout.on('data', () => {})
  server.stderr.on('data', d => process.stderr.write(d))

  const cleanup = () => { if (!server.killed) server.kill() }
  process.on('exit', cleanup)

  try {
    await waitForServer(BASE)
    for (const specPath of SPECS) {
      console.log(`\n=== ${specPath} ===`)
      const spec = spawn(process.execPath, [specPath], {
        stdio: 'inherit',
        env: { ...process.env, E2E_BASE_URL: BASE },
      })
      const code = await new Promise(resolve => spec.on('exit', resolve))
      if (code !== 0) { process.exitCode = code ?? 1; return }
    }
    process.exitCode = 0
  } finally {
    cleanup()
  }
}

main().catch(err => {
  console.error('e2e run failed:', err)
  process.exitCode = 1
})
