/**
 * Unit tests for the TruffleHog scanner parser (parseTruffleHogOutput).
 */

import { parseTruffleHogOutput, resolveTruffleHogBin, runTruffleHog } from '../scanners/truffleHog';

describe('parseTruffleHogOutput', () => {
  it('should return an empty array for empty or whitespace string', () => {
    expect(parseTruffleHogOutput('')).toEqual([]);
    expect(parseTruffleHogOutput('   \n  ')).toEqual([]);
  });

  it('should correctly normalize valid JSON TruffleHog findings', () => {
    // TruffleHog outputs JSON lines (one JSON object per line)
    const mockOutput = [
      JSON.stringify({
        DetectorName: 'AWS',
        Verified: true,
        SourceMetadata: {
          Data: {
            Filesystem: { file: 'config/aws.yml', line: 15 },
            Git: { commit: 'a1b2c3d4e5' }
          }
        }
      }),
      JSON.stringify({
        DetectorName: 'SlackWebhook',
        Verified: false,
        SourceMetadata: {
          Data: {
            Git: { file: 'src/alerts.ts', line: 42, commit: 'f6g7h8i9j0' }
          }
        }
      })
    ].join('\n');

    const result = parseTruffleHogOutput(mockOutput);

    expect(result).toHaveLength(2);
    
    expect(result[0]).toMatchObject({
      type: 'AWS',
      source: 'git',
      file: 'config/aws.yml',
      line: 15,
      commitSha: 'a1b2c3d4e5',
      isVerified: true
    });
    
    expect(result[1]).toMatchObject({
      type: 'SlackWebhook',
      source: 'git',
      file: 'src/alerts.ts',
      line: 42,
      commitSha: 'f6g7h8i9j0',
      isVerified: false
    });
  });

  it('should handle malformed JSON lines gracefully', () => {
    const mockOutput = [
      JSON.stringify({ DetectorName: 'GitHub' }),
      'This is not a json string and should be ignored',
      JSON.stringify({ DetectorName: 'Stripe' })
    ].join('\n');

    const result = parseTruffleHogOutput(mockOutput);
    
    // Should parse the 2 valid JSONs and skip the bad line
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('GitHub');
    expect(result[1].type).toBe('Stripe');
  });

  it('should apply fallback values if metadata is missing', () => {
    const mockOutput = JSON.stringify({
      // Missing SourceMetadata entirely
    });

    const result = parseTruffleHogOutput(mockOutput);
    
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'Unknown Secret', // fallback
      source: 'git',
      file: null,
      line: null,
      commitSha: null,
      isVerified: false
    });
  });

  it('should never keep the plaintext secret in rawFinding', () => {
    const mockOutput = JSON.stringify({
      DetectorName: 'AWS',
      Verified: false,
      Raw: 'AKIAIOSFODNN7EXAMPLE',
      RawV2: 'AKIAIOSFODNN7EXAMPLEwJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      Redacted: 'AKIAIOSFODNN7EXAMPLE',
      ExtraData: { account: '123456789012' },
      SourceMetadata: { Data: { Git: { file: '.env', line: 3, commit: 'a1b2c3d' } } },
    });

    const [finding] = parseTruffleHogOutput(mockOutput);
    const stored = JSON.stringify(finding.rawFinding);

    expect(stored).not.toContain('AKIAIOSFODNN7EXAMPLE');
    expect(stored).not.toContain('wJalrXUtnFEMI');
    expect(finding.rawFinding).not.toHaveProperty('Raw');
    expect(finding.rawFinding).not.toHaveProperty('ExtraData');
    expect(finding.rawFinding.fingerprint).toMatch(/^[0-9a-f]{16}$/);
    expect(finding.file).toBe('.env');
  });
});

describe('resolveTruffleHogBin / runTruffleHog', () => {
  const original = process.env.TRUFFLEHOG_BIN;
  afterEach(() => {
    if (original === undefined) delete process.env.TRUFFLEHOG_BIN;
    else process.env.TRUFFLEHOG_BIN = original;
  });

  it('prefers the TRUFFLEHOG_BIN override', () => {
    process.env.TRUFFLEHOG_BIN = '/opt/custom/trufflehog';
    expect(resolveTruffleHogBin()).toBe('/opt/custom/trufflehog');
  });

  it('falls back to a bin/ binary or trufflehog on PATH (never a hardcoded .exe on Linux)', () => {
    delete process.env.TRUFFLEHOG_BIN;
    const bin = resolveTruffleHogBin();
    expect(bin === 'trufflehog' || /bin[\/]trufflehog(\.exe)?$/.test(bin)).toBe(true);
    if (process.platform !== 'win32') expect(bin).not.toMatch(/\.exe$/);
  });

  it('throws instead of reporting 0 secrets when the binary is missing', async () => {
    process.env.TRUFFLEHOG_BIN = 'definitely-not-a-real-trufflehog-binary';
    await expect(runTruffleHog(process.cwd())).rejects.toThrow(/TruffleHog scan failed/);
  });
});
