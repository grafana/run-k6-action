import { check, group, sleep } from 'k6'
import http from 'k6/http'

export const options = {
  scenarios: {
    normal_users: {
      executor: 'constant-vus',
      vus: 5,
      duration: '30s',
    },
    spike_users: {
      executor: 'ramping-vus',
      stages: [
        { duration: '10s', target: 10 },
        { duration: '10s', target: 20 },
        { duration: '10s', target: 5 },
      ],
    },
  },
}

export default function () {
  group('Always Passing Check', function () {
    let res = http.get('https://test-api.k6.io/public/crocodiles/')

    check(res, {
      'Response status is 200': (r) => r.status === 200, // ✅ Always passes
    })

    sleep(1)
  })

  group('Partially Failing Check', function () {
    let res = http.get('https://test-api.k6.io/public/does-not-exist/')

    check(res, {
      'Response status is 200 or 404': (r) =>
        r.status === 200 || r.status === 404, // ⚠️ Partially fails
    })

    sleep(1)
  })

  group('Completely Failing Check', function () {
    let res = http.get('https://test-api.k6.io/internal/secret')

    check(res, {
      'Response status is 200': (r) => r.status === 200, // ❌ Always fails (Expected 403/500)
    })

    sleep(1)
  })
}
