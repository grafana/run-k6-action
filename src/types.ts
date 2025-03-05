export type TestRunUrlsMap = {
  [key: string]: string
}

export type TrendSummary = {
  count?: number
  max?: number
  mean?: number
  min?: number
  p95?: number
  p99?: number
  stdev?: number
}

export type HttpMetricSummary = {
  requests_count?: number
  failures_count?: number
  rps_mean?: number
  rps_max?: number
  duration?: TrendSummary
  duration_median?: number
}

export type WsMetricSummary = {
  msgs_sent?: number
  msgs_received?: number
  sessions?: number
  connecting?: TrendSummary
  ping?: TrendSummary
  session_duration?: TrendSummary
}

export type GrpcMetricSummary = {
  requests_count?: number
  rps_mean?: number
  rps_max?: number
  duration_median?: number
  duration?: TrendSummary
}

export type ChecksMetricSummary = {
  total?: number
  successes?: number
  hits_total?: number
  hits_successes?: number
}

export type ThresholdsSummary = {
  total?: number
  successes?: number
}

export type BrowserMetricSummary = {
  browser_data_received?: number
  browser_data_sent?: number
  web_vital_cls?: TrendSummary
  web_vital_cls_p75?: number
  web_vital_fcp?: TrendSummary
  web_vital_fcp_p75?: number
  web_vital_fid?: TrendSummary
  web_vital_fid_p75?: number
  web_vital_inp?: TrendSummary
  web_vital_inp_p75?: number
  web_vital_lcp?: TrendSummary
  web_vital_lcp_p75?: number
  web_vital_ttfb?: TrendSummary
  web_vital_ttfb_p75?: number
  http_duration?: TrendSummary
  http_failure_count?: number
  http_request_count?: number
  http_rps_mean?: number
}

export type MetricsSummary = {
  http_metric_summary: HttpMetricSummary | null
  ws_metric_summary: WsMetricSummary | null
  grpc_metric_summary: GrpcMetricSummary | null
  checks_metric_summary: ChecksMetricSummary | null
  thresholds_summary: ThresholdsSummary | null
  browser_metric_summary: BrowserMetricSummary | null
}

export type TestRunSummary = {
  metrics_summary: MetricsSummary
  test_run_status: number
}
