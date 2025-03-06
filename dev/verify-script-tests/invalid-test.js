import { sleep } from 'k6'
import http from 'k6/http'

export const options = {
  scenarios: {
    createBrowser: {
      executor: 'constant-arrival-rate',
    },
  },
}

export default function () {
  http.get('http://test.k6.io')
  sleep(1)
}
