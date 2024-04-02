# run-k6-action

## Usage

See [action.yml](action.yaml).

### Basic

```yaml
on:
  push:

jobs:
  protocol:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: grafana/setup-k6-action@v1
        with:
          k6-version: "0.49.0"
      - uses: grafana/run-k6-action@v1
        with:
          path: |
            ./tests/protocol*.js
```

#### Grafana Cloud k6 integration

```yaml
on:
  push:

jobs:
  protocol:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: grafana/setup-k6-action@v1
        with:
          k6-version: "0.49.0"
      - uses: grafana/run-k6-action@v1
        env:
          K6_CLOUD_TOKEN: ${{ secrets.K6_CLOUD_TOKEN }}
          K6_CLOUD_PROJECT_ID: ${{ secrets.K6_CLOUD_PROJECT_ID }}
        with:
          path: |
            ./tests/protocol*.js
```

When the Cloud environment variables are set, by default, the action will run k6 locally and send the results to Grafana Cloud k6. If you want to run the tests in our Cloud instances, you can change the `cloud-run-locally` input to `false`:

```yaml
- uses: grafana/run-k6-action@v1
  env:
    K6_CLOUD_TOKEN: ${{ secrets.K6_CLOUD_TOKEN }}
    K6_CLOUD_PROJECT_ID: ${{ secrets.K6_CLOUD_PROJECT_ID }}
  with:
    path: |
      ./tests/protocol*.js
    cloud-run-locally: false
```

### Advanced

```yaml
on:
  push:

jobs:
  protocol:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: grafana/setup-k6-action@v1
        with:
          k6-version: "0.49.0"
      - uses: grafana/run-k6-action@v1
        with:
          path: |
            ./tests/protocol*.js
          flags: --vus 10 --duration 20s # optional: flags to pass to to each k6 test (default: none)
          parallel: true # optional: run tests in parallel (default: false)
          fail-fast: false # optional: fail the step early if any test fails (default: true)
```
