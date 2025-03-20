import { sleep } from 'k6'
import http from 'k6/http'

export default function () {
  http.get('http://test.k6.io')
  http.get('http://test1.k6.io')
  http.get('http://google.com')
  sleep(1)
}
