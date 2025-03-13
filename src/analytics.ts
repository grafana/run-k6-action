import crypto from 'crypto'
import os from 'os'
import { apiRequest, DEFAULT_RETRY_OPTIONS } from './apiUtils'
import { getInstalledK6Version } from './k6helper'

const ANALYTICS_SOURCE = 'github-action'

export interface UserSpecifiedAnalyticsData {
  totalTestScriptsExecuted: number
  isCloudRun: boolean
  isUsingFlags: boolean
  isUsingInspectFlags: boolean
  failFast: boolean
  commentOnPr: boolean
  parallelFlag: boolean
  cloudRunLocally: boolean
  onlyVerifyScripts: boolean
}

interface AnalyticsData {
  source: string
  usageStatsId: string
  osPlatform: string
  osArch: string
  osType: string
  k6Version: string

  totalTestScriptsExecuted: number
  isCloudRun: boolean
  isUsingFlags: boolean
  isUsingInspectFlags: boolean
  failFast: boolean
  commentOnPr: boolean
  parallelFlag: boolean
  cloudRunLocally: boolean
  onlyVerifyScripts: boolean
}

/**
 * Gets the usage stats id which is an identifier for the invocation of the action
 * Here we use a hash of GITHUB_ACTION and GITHUB_REPOSITORY to identify the unique users and
 * club multiple invocations from the same user/repo
 *
 * @returns The usage stats id
 */
function getUsageStatsId(): string {
  const githubAction = process.env.GITHUB_ACTION || ''
  const githubWorkflow = process.env.GITHUB_WORKFLOW || ''
  return crypto
    .createHash('sha256')
    .update(`${githubAction}-${githubWorkflow}`)
    .digest('hex')
}

export async function sendAnalytics(
  userSpecifiedAnalyticsData: UserSpecifiedAnalyticsData
) {
  const analyticsData: AnalyticsData = {
    ...userSpecifiedAnalyticsData,
    source: ANALYTICS_SOURCE,
    usageStatsId: getUsageStatsId(),
    osPlatform: os.platform(),
    osArch: os.arch(),
    osType: os.type(),
    k6Version: getInstalledK6Version(),
  }

  const url = process.env.GRAFANA_ANALYTICS_URL || 'https://stats.grafana.org'

  try {
    await apiRequest(
      url,
      {
        method: 'POST',
        body: JSON.stringify(analyticsData),
      },
      {
        ...DEFAULT_RETRY_OPTIONS,
        maxRetries: 1,
      }
    )
  } catch (error) {
    console.error('Error sending analytics:', error)
  }
}
