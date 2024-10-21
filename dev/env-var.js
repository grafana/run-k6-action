import { sleep } from 'k6';
import http from 'k6/http';

export default function () {
    console.log(`Test env variable value is : ${__ENV.TEST_VAL}` )
  http.get('http://test.k6.io');
  sleep(1);
}