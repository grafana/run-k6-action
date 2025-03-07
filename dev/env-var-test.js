import { check } from 'k6'

export const options = {
  thresholds: {
    checks: ['rate>=1'],
  },
}

export default function () {
  check(__ENV, {
    'System env var': (env) =>
      env.TEST_SYSTEM_ENV_VAR === 'test-system-env-var-value',
    'CLI --env flag set': (env) =>
      env.TEST_FLAG_ENV_VAR === 'test-flag-env-var-value',
    'CLI -e flag set': (env) =>
      env.TEST_SYSTEM_ENV_VAR_E === 'test-cli-e-env-var-value',
  })
}
