#!/usr/bin/env node

const { execFileSync } = require('node:child_process')

const port = process.env.PORT || '3101'

function getListeningPids() {
  try {
    const output = execFileSync('lsof', ['-tiTCP:' + port, '-sTCP:LISTEN'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })

    return output
      .split('\n')
      .map((pid) => pid.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function killPid(pid, signal) {
  try {
    process.kill(Number(pid), signal)
    return true
  } catch {
    try {
      execFileSync('kill', [`-${signal}`, pid], { stdio: 'ignore' })
      return true
    } catch {
      return false
    }
  }
}

const pids = getListeningPids()

if (pids.length === 0) {
  process.exit(0)
}

console.log(`[dev] Freeing port ${port}: ${pids.join(', ')}`)

for (const pid of pids) {
  killPid(pid, 'TERM')
}

sleep(500)

const remaining = getListeningPids()
for (const pid of remaining) {
  killPid(pid, 'KILL')
}

sleep(200)

const stillListening = getListeningPids()
if (stillListening.length > 0) {
  console.error(`[dev] Port ${port} is still busy: ${stillListening.join(', ')}`)
  process.exit(1)
}
