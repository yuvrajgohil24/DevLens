/**
 * Unit tests for the Snyk scanner parser (parseSnykOutput).
 *
 * These tests are intentionally self-contained — no DB, Redis, or network
 * required. They validate the normalization logic that converts raw Snyk
 * JSON into our internal NormalizedVulnerability format.
 */

import { parseSnykOutput } from '../scanners/snyk';

describe('parseSnykOutput', () => {
  it('should return an empty array for null / undefined input', () => {
    expect(parseSnykOutput(null)).toEqual([]);
    expect(parseSnykOutput(undefined)).toEqual([]);
    expect(parseSnykOutput({})).toEqual([]);
  });

  it('should correctly normalize a valid Snyk vulnerability object', () => {
    const rawSnykOutput = {
      vulnerabilities: [
        {
          id: 'SNYK-JS-AXIOS-6165243',
          title: 'Server-Side Request Forgery (SSRF)',
          severity: 'high',
          cvssScore: 7.5,
          packageName: 'axios',
          version: '1.6.0',
          fixedIn: ['1.6.1'],
        },
      ],
    };

    const result = parseSnykOutput(rawSnykOutput);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      cveId: 'SNYK-JS-AXIOS-6165243',
      title: 'Server-Side Request Forgery (SSRF)',
      severity: 'high',
      cvssScore: 7.5,
      affectedPackage: 'axios@1.6.0',
      fixedVersion: '1.6.1',
      scannerSource: 'snyk',
    });
  });

  it('should handle multiple vulnerabilities', () => {
    const rawSnykOutput = {
      vulnerabilities: [
        {
          id: 'SNYK-JS-AXIOS-6165243',
          title: 'SSRF',
          severity: 'high',
          cvssScore: 7.5,
          packageName: 'axios',
          version: '1.6.0',
          fixedIn: ['1.6.1'],
        },
        {
          id: 'SNYK-JS-LODASH-6080780',
          title: 'Prototype Pollution',
          severity: 'high',
          cvssScore: 7.4,
          packageName: 'lodash',
          version: '4.17.20',
          fixedIn: ['4.17.21'],
        },
      ],
    };

    const result = parseSnykOutput(rawSnykOutput);
    expect(result).toHaveLength(2);
    expect(result[1].cveId).toBe('SNYK-JS-LODASH-6080780');
  });

  it('should default cvssScore to 0 when missing', () => {
    const rawSnykOutput = {
      vulnerabilities: [
        {
          id: 'SNYK-JS-TEST-001',
          title: 'Missing CVSS',
          severity: 'medium',
          packageName: 'some-pkg',
          version: '1.0.0',
          fixedIn: [],
        },
      ],
    };

    const result = parseSnykOutput(rawSnykOutput);
    expect(result[0].cvssScore).toBe(0);
  });

  it('should set fixedVersion to null when fixedIn is an empty array', () => {
    const rawSnykOutput = {
      vulnerabilities: [
        {
          id: 'SNYK-JS-TEST-002',
          title: 'No Fix Available',
          severity: 'low',
          cvssScore: 2.0,
          packageName: 'old-pkg',
          version: '0.0.1',
          fixedIn: [],
        },
      ],
    };

    const result = parseSnykOutput(rawSnykOutput);
    expect(result[0].fixedVersion).toBeNull();
  });
});
