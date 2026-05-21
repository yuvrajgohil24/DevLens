/**
 * Unit tests for the TruffleHog scanner parser (parseTruffleHogOutput).
 */

import { parseTruffleHogOutput } from '../scanners/truffleHog';

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
            Filesystem: { file: 'src/alerts.ts', line: 42 },
            Git: { commit: 'f6g7h8i9j0' }
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
});
