// Failure metadata only: messages, stacks, stdout/stderr and assertion values may
// contain private edition data or credentials and must never enter the report.
const phases = new Set(['configuration','package-coverage','recommendation-config','recommendation-history','durable-state','prepared-research','public-sources','red-sox-source','finance-selection','recommendation-selection','photography-selection','write-edition']);
const names = new Set(['Error','TypeError','SyntaxError','RangeError','URIError','AbortError','TimeoutError','AssertionError','DOMException']);
const codes = new Set(['ETIMEDOUT','ENOENT','EACCES','EPERM','EIO','EISDIR','ENOTDIR','ECONNRESET','ECONNREFUSED','ENETUNREACH','EHOSTUNREACH','ENOTFOUND','EAI_AGAIN','EPIPE','ENOBUFS','ABORT_ERR','ERR_ASSERTION','ERR_INVALID_ARG_TYPE','ERR_INVALID_ARG_VALUE','ERR_OUT_OF_RANGE','ERR_CRYPTO_INVALID_STATE','UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT','UND_ERR_BODY_TIMEOUT','UND_ERR_SOCKET']);
const gitOperations = new Set(['remote','fetch','rev-parse','log','rev-list','merge-base','show','ls-tree']);
const historyChecks = new Set(['Incomplete deployment history','Deployment history unavailable or still changing','Main must match the latest successful deployment','Published commit is missing','Live edition differs from the published commit','Same-day recovery requires its verified original published anchor','A published yesterday edition must be restored, not bypassed','Missing actual observation time','Published current edition is missing from its archive','A deployed commit could not be verified','Invalid publication history','A published edition is missing from its commit archive','A previously published archive was removed','Local current-day archive is missing','Same-day update lost published recommendation exposures','Local history differs from the verified published archive','Unexpected history repository','Full Git history is required for recovery','Deployment history changed during verification','Published commits are missing from complete Git history','An archive was removed after introduction','Empty archive','Duplicate archived days','Live archive index differs from GitHub','Live historical edition differs from GitHub','Remote changed during recovery']);
export function refreshFailureDiagnostic(error, phase, now = new Date()) {
  const errors = [], seen = new Set();
  for (let current = error; current && typeof current === 'object' && !seen.has(current) && errors.length < 5; current = current.cause) {
    seen.add(current);
    const item = {name: names.has(current.name) ? current.name : 'Error'};
    if (codes.has(current.code)) item.code = current.code;
    if (['SIGTERM','SIGKILL','SIGABRT'].includes(current.signal)) item.signal = current.signal;
    if (Number.isInteger(current.status) && current.status >= 0 && current.status <= 599) item.status = current.status;
    const program = String(current.path || '').split('/').at(-1);
    if (program === 'git' && Array.isArray(current.spawnargs)) {
      const command = current.spawnargs.find(value => gitOperations.has(value));
      if (command) item.operation = `git ${command}`;
    } else if (program === 'gh') item.operation = 'gh';
    const firstLine = typeof current.message === 'string' ? current.message.split('\n')[0] : '';
    if (historyChecks.has(firstLine)) item.check = firstLine;
    errors.push(item);
  }
  return {version: 1, checkedAt: now.toISOString(), phase: phases.has(phase) ? phase : 'unknown', errors};
}
