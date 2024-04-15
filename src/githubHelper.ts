import * as core from '@actions/core';
import * as github from '@actions/github';

const { context } = github;
const { eventName, payload } = context;
const { repo, owner } = context.repo;

const WATERMARK = `<!-- K6 GitHub Action Comment: ${context.job} -->\n`;
const token = core.getInput('github-token', { required: true });
const octokit = github.getOctokit(token);

export async function getPullRequestNumber(): Promise<number | undefined> {
  /**
   * This function gets the open pull request number from the context of the action event.
   * 
   * @returns {Promise<number | undefined>} - The open pull request number. Returns undefined if the pull request number is not found.
   * 
   * @export
   */
  let commitSHA;
  let pullRequestNumber = payload.pull_request ? payload.pull_request.number : undefined;

  if (pullRequestNumber) {
    return pullRequestNumber;
  }

  if (eventName === 'pull_request' || eventName === 'pull_request_target') {
    commitSHA = payload.pull_request?.head.sha;
  } else if (eventName === 'push') {
    commitSHA = payload.after;
  }

  if (!commitSHA) {
    core.debug('Commit SHA not found, unable to get pull request number.')
    return;
  }

  const result =
    await octokit.rest.repos.listPullRequestsAssociatedWithCommit({
      owner: context.repo.owner,
      repo: context.repo.repo,
      commit_sha: commitSHA,
    }),

    openPRs = result.data.filter((pr: { state: string; }) => pr.state === 'open'),
    selectedPR =
      openPRs.find((pr: any) => {
        return context.payload.ref === `refs/heads/${pr.head.ref}`;
      }) || openPRs[0];

  return selectedPR?.number;
}

export async function getActionCommentId(pullRequestNumber: number): Promise<number | undefined> {
  /**
   * This function gets the comment ID of the action comment from the pull request.
   *
   * @param {number} pullRequestNumber - The pull request number
   * 
   * @returns {Promise<number | undefined>} - The comment ID of the action comment. Returns undefined if the action comment is not found.
   * 
   * @export
   */

  const { data: comments } = await octokit.rest.issues.listComments({
    repo,
    owner,
    issue_number: pullRequestNumber,
  });

  const comment = comments.find((c: any) => c.body.startsWith(WATERMARK));

  return comment?.id;

}

export async function createOrUpdateComment(pullRequestNumber: number, commentBody: string) {
  /**
   * This function creates or updates the action comment on the pull request.
   *
   * @param {number} pullRequestNumber - The pull request number
   * @param {number | undefined} commentId - The comment ID of the action comment. If the comment ID is undefined, a new comment is created.
   * @param {string} commentBody - The body of the comment
   * 
   * @export
   * 
   * @returns {Promise<void>} - Resolves when the comment is created or updated.
   * 
   * @throws {Error} - Throws an error if the comment cannot be created or updated.
   * 
   * */

  const commentId = await getActionCommentId(pullRequestNumber);

  commentBody = WATERMARK + commentBody;

  if (commentId) {
    await octokit.rest.issues.updateComment({
      repo,
      owner,
      comment_id: commentId,
      body: commentBody,
    });
  }
  else {
    await octokit.rest.issues.createComment({
      repo,
      owner,
      issue_number: pullRequestNumber,
      body: commentBody,
    });
  }
}

export async function generatePRComment(testResultUrlsMap: any) {
  /**
   * This function generates the body of the action comment.
   *
   * @param {any} testResults - The test results
   * 
   * @returns {string} - The body of the action comment
   *  
   * 
   * */

  core.debug('Generating PR comment')

  let testRunUrls = '';
  for (const [scriptPath, testRunUrl] of Object.entries(testResultUrlsMap)) {
    testRunUrls += `🔗 [${scriptPath}](${testRunUrl})\n`;
  }

  let comment = `# Performance Test Results 🚀
  
  Click on the links below to view the test results on Grafana Cloud K6:

  ${testRunUrls}
  `;

  const pullRequestNumber = await getPullRequestNumber();

  if (!pullRequestNumber) {
    core.debug('Pull request number not found skipping comment creation');
    return;
  }

  await createOrUpdateComment(pullRequestNumber, comment);

  core.debug('Comment created successfully');
}