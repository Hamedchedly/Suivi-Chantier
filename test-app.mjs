const { spawn } = await import('child_process');
const chromium = '/opt/pw-browsers/chromium';

// Launch chromium with debug protocol
const proc = spawn(chromium, [
  '--headless',
  '--disable-gpu',
  '--dump-dom',
  'http://localhost:5173',
], {
  stdio: ['ignore', 'pipe', 'pipe']
});

let output = '';
proc.stdout.on('data', (data) => {
  output += data.toString();
});

proc.on('close', () => {
  // Extract text content to verify what's displayed
  if (output.includes('Gambetta')) {
    console.log('✓ Project name found: Gambetta');
  }
  if (output.includes('Visite') || output.includes('visite')) {
    console.log('✓ Visite references found');
  }
  if (output.includes('%')) {
    console.log('✓ Progress percentages found in DOM');
  }
  console.log('Page snippet:', output.substring(0, 500));
});
