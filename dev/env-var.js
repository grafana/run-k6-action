import { sleep } from 'k6';
import http from 'k6/http';

console.log(`Log in the init context: ${__ENV.TEST_VAL}`);

export default function () {
 http.get(__ENV.URL);
  sleep(1);
}