import exec from 'k6/execution';
import { sleep } from 'k6';


export default function () {
  sleep(10);
  exec.test.abort();
}