// Démarre le serveur de dev sur un port dédié aux tests, attend qu'il
// réponde, exécute le scénario E2E permanent, puis arrête le serveur.
// `npm run e2e`
import { spawn } from 'node:child_process'

const PORT = process.env.E2E_PORT ?? '5199'
const BASE = `http://localhost:${PORT}`

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
    const spec = spawn(process.execPath, ['e2e/planning-visite.mjs'], {
      stdio: 'inherit',
      env: { ...process.env, E2E_BASE_URL: BASE },
    })
    const code = await new Promise(resolve => spec.on('exit', resolve))
    process.exitCode = code ?? 1
  } finally {
    cleanup()
  }
}

main().catch(err => {
  console.error('e2e run failed:', err)
  process.exitCode = 1
})
