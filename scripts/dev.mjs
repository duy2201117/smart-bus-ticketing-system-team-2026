import { spawn } from 'node:child_process';
import { createServer as createViteServer } from 'vite';

const apiUrl = `http://127.0.0.1:${process.env.PORT || 3001}/api/health`;
let apiProcess = null;
let vite = null;
let shuttingDown = false;

async function apiIsReady() {
  try {
    const response = await fetch(apiUrl, { signal: AbortSignal.timeout(1200) });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForApi(child, timeoutMs = 120000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await apiIsReady()) return;
    if (child?.exitCode !== null) throw new Error(`Backend đã dừng với mã ${child.exitCode}.`);
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  throw new Error(`Backend chưa sẵn sàng sau ${Math.round(timeoutMs / 1000)} giây.`);
}

async function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  try { await vite?.close(); } catch { /* noop */ }
  if (apiProcess && apiProcess.exitCode === null) {
    apiProcess.kill('SIGTERM');
    await new Promise(resolve => setTimeout(resolve, 250));
    if (apiProcess.exitCode === null) apiProcess.kill('SIGKILL');
  }
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

try {
  if (await apiIsReady()) {
    console.log(`[dev] SmartBus API đã chạy sẵn: ${apiUrl}`);
  } else {
    console.log('[dev] Đang khởi động SmartBus API...');
    apiProcess = spawn(process.execPath, ['server/index.js'], {
      cwd: process.cwd(),
      env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'development' },
      stdio: 'inherit',
      windowsHide: false,
    });
    apiProcess.on('error', error => console.error('[dev] Không thể khởi động backend:', error.message));
    await waitForApi(apiProcess);
    console.log(`[dev] Backend sẵn sàng: ${apiUrl}`);
  }

  // Start Vite only after API health is live, preventing startup proxy 502 errors.
  vite = await createViteServer({ server: { host: '0.0.0.0' } });
  await vite.listen();
  console.log('[dev] Frontend sẵn sàng.');
  vite.printUrls();
} catch (error) {
  console.error(`\n[dev] Không thể khởi động SmartBus: ${error.message}`);
  await shutdown(1);
}
