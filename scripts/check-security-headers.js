#!/usr/bin/env node
// ================================================================
// 🔒 Security Headers Checker
// ================================================================
// Vérifie que tous les headers de sécurité sont présents
// Usage: npm run security:headers
// ================================================================

const https = require('https');

const TARGET_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://remboursement.afneus.org';

const REQUIRED_HEADERS = {
  'content-security-policy': {
    required: true,
    pattern: /default-src\s+'self'/,
    severity: 'CRITICAL',
  },
  'strict-transport-security': {
    required: true,
    pattern: /max-age=\d+/,
    severity: 'CRITICAL',
  },
  'x-frame-options': {
    required: true,
    pattern: /DENY|SAMEORIGIN/,
    severity: 'HIGH',
  },
  'x-content-type-options': {
    required: true,
    pattern: /nosniff/,
    severity: 'MEDIUM',
  },
  'referrer-policy': {
    required: true,
    pattern: /strict-origin/,
    severity: 'MEDIUM',
  },
  'permissions-policy': {
    required: true,
    pattern: /camera=\(\)/,
    severity: 'LOW',
  },
};

function checkHeaders() {
  return new Promise((resolve, reject) => {
    const url = new URL(TARGET_URL);

    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname || '/',
      method: 'HEAD',
    };

    const req = https.request(options, (res) => {
      console.log('\n🔍 Security Headers Check\n');
      console.log(`Target: ${TARGET_URL}`);
      console.log(`Status: ${res.statusCode}\n`);

      const results = [];
      let score = 0;
      let maxScore = 0;

      for (const [headerName, config] of Object.entries(REQUIRED_HEADERS)) {
        const headerValue = res.headers[headerName.toLowerCase()];
        const severityScore = { CRITICAL: 30, HIGH: 20, MEDIUM: 10, LOW: 5 }[config.severity];
        maxScore += severityScore;

        if (!headerValue) {
          results.push({
            header: headerName,
            status: '❌ MISSING',
            severity: config.severity,
            score: 0,
          });
        } else if (!config.pattern.test(headerValue)) {
          results.push({
            header: headerName,
            status: '⚠️ INVALID',
            severity: config.severity,
            value: headerValue,
            score: severityScore / 2,
          });
          score += severityScore / 2;
        } else {
          results.push({
            header: headerName,
            status: '✅ OK',
            severity: config.severity,
            value: headerValue.substring(0, 50),
            score: severityScore,
          });
          score += severityScore;
        }
      }

      // Afficher résultats
      console.log('Headers Analysis:\n');
      results.forEach((result) => {
        console.log(`${result.status} [${result.severity}] ${result.header}`);
        if (result.value) {
          console.log(`   Value: ${result.value}...`);
        }
      });

      const percentage = Math.round((score / maxScore) * 100);
      console.log(`\nScore: ${score}/${maxScore} (${percentage}%)\n`);

      if (percentage >= 90) {
        console.log('✅ EXCELLENT - Security headers are properly configured!');
        resolve(0);
      } else if (percentage >= 70) {
        console.log('⚠️ GOOD - Some improvements needed.');
        resolve(0);
      } else if (percentage >= 50) {
        console.log('🟠 FAIR - Multiple security headers missing or invalid.');
        resolve(1);
      } else {
        console.log('🔴 POOR - Critical security headers missing! Fix immediately.');
        resolve(1);
      }
    });

    req.on('error', (err) => {
      console.error('❌ Request failed:', err.message);
      reject(1);
    });

    req.end();
  });
}

checkHeaders()
  .then((code) => process.exit(code))
  .catch((code) => process.exit(code));
