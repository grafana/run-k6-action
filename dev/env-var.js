import { sleep } from 'k6';
import http from 'k6/http';

export default function () {
    console.log(`Test env variable value is : ${__ENV.TEST_VAL}` )
  http.get(__ENV.URL);
  sleep(1);
}