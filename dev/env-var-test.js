import { check } from 'k6'

export const options = {
  thresholds: {
    checks: ['rate>=1'],
  },
}

const data = JSON.parse(open(`./${__ENV.ENVIRONMENT}-data.json`))

export default function () {
  check(__ENV, {
    'System env var': (env) =>
      env.TEST_SYSTEM_ENV_VAR === 'test-system-env-var-value',
    'CLI --env flag set': (env) =>
      env.TEST_FLAG_ENV_VAR === 'test-flag-env-var-value',
    'CLI -e flag set': (env) =>
      env.TEST_SYSTEM_ENV_VAR_E === 'test-cli-e-env-var-value',
  })

  check(data, {
    'Username is john_doe': (data) => data.username == 'john_doe',
  })
}
