import { classifyGeminiError } from '../scan-diagnosis';

describe('classifyGeminiError', () => {
  it('treats key / API-not-enabled / restricted-key errors as setup problems, not failed checks', () => {
    const disabled = { error: { code: 403, status: 'PERMISSION_DENIED', details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'SERVICE_DISABLED' }] } };
    expect(classifyGeminiError(403, disabled)).toEqual({ kind: 'setup', reason: 'http_403:PERMISSION_DENIED:SERVICE_DISABLED' });
    expect(classifyGeminiError(403, { error: { status: 'PERMISSION_DENIED', details: [{ reason: 'API_KEY_IOS_APP_BLOCKED' }] } }).kind).toBe('setup');
    expect(classifyGeminiError(400, { error: { status: 'INVALID_ARGUMENT', details: [{ reason: 'API_KEY_INVALID' }] } }).kind).toBe('setup');
    expect(classifyGeminiError(404, { error: { status: 'NOT_FOUND' } }).kind).toBe('setup');
    expect(classifyGeminiError(401, null).kind).toBe('setup');
  });

  it('busy, server and invalid', () => {
    expect(classifyGeminiError(429, {}).kind).toBe('busy');
    expect(classifyGeminiError(503, {}).kind).toBe('busy');
    expect(classifyGeminiError(500, {}).kind).toBe('server');
    expect(classifyGeminiError(400, { error: { status: 'INVALID_ARGUMENT' } })).toEqual({ kind: 'invalid', reason: 'http_400:INVALID_ARGUMENT' });
  });

  it('never copies the error message (could echo request content)', () => {
    expect(classifyGeminiError(400, { error: { status: 'INVALID_ARGUMENT', message: 'secret prompt text' } }).reason).not.toContain('secret');
  });
});
