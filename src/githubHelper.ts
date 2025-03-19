import * as core from '@actions/core'
import * as github from '@actions/github'
import { Context } from '@actions/github/lib/context'
import { WebhookPayload } from '@actions/github/lib/interfaces'
import { GitHub } from '@actions/github/lib/utils'
import { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods'
import {
  cleanScriptPath,
  extractTestRunId,
  fetchChecks,
  fetchTestRunSummary,
} from './k6helper'
import {
  generateMarkdownSummary,
  getTestRunStatusMarkdown,
} from './markdownRenderer'
import { TestRunUrlsMap } from './types'

// Create a watermark function instead of a constant
const getWatermark = () =>
  `<!-- k6 GitHub Action Comment: ${(github.context as Context).job} -->\n`

const getOctokit = (): InstanceType<typeof GitHub> => {
  const token = core.getInput('github-token', { required: true })
  return github.getOctokit(token)
}

export async function getPullRequestNumber(): Promise<number | undefined> {
  /**
   * This function gets the open pull request number from the context of the action event.
   *
   * @returns {Promise<number | undefined>} - The open pull request number. Returns undefined if the pull request number is not found.
   *
   * @export
   */

  const octokit = getOctokit()

  // Use the context from the github import
  const { eventName, payload }: { eventName: string; payload: WebhookPayload } =
    github.context as Context

  let commitSHA: string | undefined
  const pullRequestNumber = payload.pull_request
    ? payload.pull_request.number
    : undefined

  if (pullRequestNumber) {
    return pullRequestNumber
  }

  if (eventName === 'pull_request' || eventName === 'pull_request_target') {
    commitSHA = payload.pull_request?.head.sha
  } else if (eventName === 'push') {
    commitSHA = payload.after as string | undefined
  }

  if (!commitSHA) {
    core.debug('Commit SHA not found, unable to get pull request number.')
    return
  }

  type PullRequestResponse =
    RestEndpointMethodTypes['repos']['listPullRequestsAssociatedWithCommit']['response']
  type PullRequest = PullRequestResponse['data'][0]

  const result = await octokit.rest.repos.listPullRequestsAssociatedWithCommit({
      owner: (github.context as Context).repo.owner,
      repo: (github.context as Context).repo.repo,
      commit_sha: commitSHA,
    }),
    openPRs = result.data.filter((pr: PullRequest) => pr.state === 'open'),
    selectedPR =
      openPRs.find((pr: PullRequest) => {
        return (
          (github.context as Context).payload.ref ===
          `refs/heads/${pr.head.ref}`
        )
      }) || openPRs[0]

  return selectedPR?.number
}

export async function getActionCommentId(
  pullRequestNumber: number
): Promise<number | undefined> {
  /**
   * This function gets the comment ID of the action comment from the pull request.
   *
   * @param {number} pullRequestNumber - The pull request number
   *
   * @returns {Promise<number | undefined>} - The comment ID of the action comment. Returns undefined if the action comment is not found.
   *
   * @export
   */
  const octokit = getOctokit()

  const { owner, repo } = (github.context as Context).repo
  const watermark = getWatermark()

  type ListCommentsResponse =
    RestEndpointMethodTypes['issues']['listComments']['response']
  type IssueComment = ListCommentsResponse['data'][0]

  const { data: comments } = await octokit.rest.issues.listComments({
    repo,
    owner,
    issue_number: pullRequestNumber,
  })

  const comment = comments.find(
    (c: IssueComment) => c.body && c.body.startsWith(watermark)
  )

  return comment?.id
}

export async function createOrUpdateComment(
  pullRequestNumber: number,
  commentBody: string
): Promise<void> {
  /**
   * This function creates or updates the action comment on the pull request.
   *
   * @param {number} pullRequestNumber - The pull request number
   * @param {string} commentBody - The body of the comment
   *
   * @export
   *
   * @returns {Promise<void>} - Resolves when the comment is created or updated.
   *
   * @throws {Error} - Throws an error if the comment cannot be created or updated.
   *
   * */
  const octokit = getOctokit()

  const { owner, repo } = (github.context as Context).repo
  const watermark = getWatermark()

  const commentId = await getActionCommentId(pullRequestNumber)

  const fullCommentBody = watermark + commentBody

  if (commentId) {
    await octokit.rest.issues.updateComment({
      repo,
      owner,
      comment_id: commentId,
      body: fullCommentBody,
    })
  } else {
    await octokit.rest.issues.createComment({
      repo,
      owner,
      issue_number: pullRequestNumber,
      body: fullCommentBody,
    })
  }
}

export async function generatePRComment(
  testRunUrlsMap: TestRunUrlsMap
): Promise<void> {
  /**
   * This function posts/updates a comment containing the test run URLs if a pull request is present.
   *
   * @param {TestRunUrlsMap} testResults - Map of test run URLs where the key is the script path
   *  and the value is the test run URL
   *
   * */

  if (Object.keys(testRunUrlsMap).length === 0) {
    core.debug('No test result URLs found, skipping comment creation')
    return
  }

  core.debug('Generating PR comment')

  const resultSummaryStrings = ['# Performance Test Results 🚀\n\n']
  let testRunIndex = 0

  for (const [scriptPath, testRunUrl] of Object.entries(testRunUrlsMap)) {
    testRunIndex++

    resultSummaryStrings.push(
      `## ${testRunIndex}. 🔗 [${cleanScriptPath(scriptPath)}](${testRunUrl})\n`
    )

    const testRunId = extractTestRunId(testRunUrl)

    if (!testRunId) {
      core.info(
        `Skipping test run URL ${testRunUrl} (Script Path: ${scriptPath}) as it does not contain a valid test run id`
      )
      continue
    }

    // Run both API calls in parallel
    const [testRunSummary, checks] = await Promise.all([
      fetchTestRunSummary(testRunId),
      fetchChecks(testRunId),
    ])

    if (!testRunSummary) {
      core.info(`Unable to fetch test run summary for test run ${testRunId}`)
      continue
    }

    resultSummaryStrings.push(
      getTestRunStatusMarkdown(testRunSummary.run_status)
    )

    const markdownSummary = generateMarkdownSummary(
      testRunSummary.metrics_summary,
      testRunSummary.baseline_test_run_details?.metrics_summary,
      checks
    )

    resultSummaryStrings.push(markdownSummary)
    resultSummaryStrings.push('\n')
  }

  const comment = resultSummaryStrings.join('\n')

  let pullRequestNumber

  try {
    pullRequestNumber = await getPullRequestNumber()
  } catch (error) {
    core.debug(`Got following error in getting pull request number`)
    core.debug(error instanceof Error ? error.message : String(error))
    return // Return early if there's an error getting the PR number
  }

  if (!pullRequestNumber) {
    core.info(
      'Unable to get pull request number for the commit, skipping comment creation'
    )
    return
  }

  try {
    await createOrUpdateComment(pullRequestNumber, comment)
    core.debug('Comment created successfully')
  } catch (error) {
    core.info('Error creating comment on pull request')
    core.debug(
      `Following error occurred in creating comment on pull request: ${pullRequestNumber}`
    )
    core.debug(error instanceof Error ? error.message : String(error))
  }
}
