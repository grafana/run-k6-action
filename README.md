# run-k6-action

This action allows you to easily execute k6 tests as part of your GitHub Actions workflow. 

It is a wrapper over `k6 run`, with support for globs, parallel execution, and fail-fast.

> This action won't setup/install k6. That functionality is provided by [grafana/setup-k6-action](https://github.com/grafana/setup-k6-action)

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
            ./tests/api*.js
```

#### Grafana Cloud k6 integration

To send the results to Grafana Cloud k6, you need to set the GCk6 environment variables.

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
            ./tests/api*.js
```

By default, the action will run k6 locally and send the results to Grafana Cloud k6. If you want to run the tests in our Cloud instances, you need to change the `cloud-run-locally` input to `false`:

```yaml
- uses: grafana/run-k6-action@v1
  env:
    K6_CLOUD_TOKEN: ${{ secrets.K6_CLOUD_TOKEN }}
    K6_CLOUD_PROJECT_ID: ${{ secrets.K6_CLOUD_PROJECT_ID }}
  with:
    path: |
      ./tests/api*.js
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
          browser: true
      - uses: grafana/run-k6-action@v1
        with:
          path: |
            ./tests/api*.js
            ./tests/app*.js
          flags: --vus 10 --duration 20s # optional: flags to pass to to each k6 test (default: none)
          parallel: true # optional: run tests in parallel (default: false)
          fail-fast: false # optional: fail the step early if any test fails (default: true)
```
