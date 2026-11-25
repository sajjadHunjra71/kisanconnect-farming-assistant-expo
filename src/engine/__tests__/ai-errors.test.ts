import { classifyAiError, clearerPhotoDiagnosis, filterAiList, isModelOutputReason, parseModelJson, retryDelayMs } from '../index';

describe('classifyAiError (Groq)', () => {
  it('key, permission, organization and model problems are setup errors, not failed checks', () => {
    expect(classifyAiError(401, { error: { message: 'Invalid API Key', type: 'invalid_request_error', code: 'invalid_api_key' } })).toEqual({
      kind: 'setup',
      reason: 'http_401:invalid_request_error:invalid_api_key',
    });
    expect(classifyAiError(403, { error: { type: 'permissions_error' } }).kind).toBe('setup');
    expect(classifyAiError(404, { error: { type: 'invalid_request_error', code: 'model_not_found' } }).kind).toBe('setup');
    expect(classifyAiError(400, { error: { type: 'invalid_request_error', code: 'model_decommissioned' } }).kind).toBe('setup');
    expect(classifyAiError(400, { error: { code: 'organization_restricted' } }).kind).toBe('setup');
    expect(classifyAiError(401, null).kind).toBe('setup');
  });

  it('busy, server, output and invalid', () => {
    expect(classifyAiError(429, { error: { type: 'tokens', code: 'rate_limit_exceeded' } }).kind).toBe('busy');
    expect(classifyAiError(498, {}).kind).toBe('busy');
    expect(classifyAiError(503, {}).kind).toBe('busy');
    expect(classifyAiError(500, {}).kind).toBe('server');
    expect(classifyAiError(502, null).kind).toBe('server');
    expect(classifyAiError(422, {}).kind).toBe('output');
    expect(classifyAiError(413, { error: { type: 'invalid_request_error' } })).toEqual({ kind: 'invalid', reason: 'http_413:invalid_request_error' });
    expect(classifyAiError(400, { error: { type: 'invalid_request_error', code: 'json_validate_failed' } }).kind).toBe('invalid');
  });

  it('never copies the error message (could echo request content)', () => {
    expect(classifyAiError(400, { error: { type: 'invalid_request_error', message: 'secret prompt text' } }).reason).not.toContain('secret');
  });
});

describe('parseModelJson', () => {
  it('plain JSON object', () => {
    expect(parseModelJson('{"status":"ok","possible_causes":[]}')).toEqual({ status: 'ok', possible_causes: [] });
  });
  it('strips reasoning, code fences and surrounding words', () => {
    expect(parseModelJson('<think>looks like rust {maybe}</think>\n```json\n{"status":"unclear"}\n```')).toEqual({ status: 'unclear' });
    expect(parseModelJson('Here is the answer: {"a": {"b": 1}} Thanks')).toEqual({ a: { b: 1 } });
  });
  it('null for non-JSON, arrays, empty or non-string', () => {
    expect(parseModelJson('no json here')).toBeNull();
    expect(parseModelJson('{"status": ')).toBeNull();
    expect(parseModelJson('[1,2]')).toBeNull();
    expect(parseModelJson('')).toBeNull();
    expect(parseModelJson(undefined)).toBeNull();
  });
});

describe('retryDelayMs', () => {
  it("uses retry-after, else 1 s then 2 s, capped", () => {
    expect(retryDelayMs(0, '2')).toBe(2000);
    expect(retryDelayMs(0, '60')).toBe(4000);
    expect(retryDelayMs(0, null)).toBe(1000);
    expect(retryDelayMs(1, null)).toBe(2000);
    expect(retryDelayMs(5, 'soon')).toBe(4000);
  });
});

describe('unusable model output', () => {
  it('gives an unclear result with safe next steps', () => {
    const d = clearerPhotoDiagnosis();
    expect(d.status).toBe('unclear');
    expect(d.possible_causes).toEqual([]);
    expect(d.needs_expert).toBe(true);
    expect(filterAiList(d.next_steps)).toEqual(d.next_steps); // passes the dose filter untouched
    expect(isModelOutputReason('not_json')).toBe(true);
    expect(isModelOutputReason('unprocessable')).toBe(true);
    expect(isModelOutputReason('http_400:invalid_request_error')).toBe(false);
  });
});
