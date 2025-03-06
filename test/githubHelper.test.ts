import * as core from '@actions/core'
import * as github from '@actions/github'
import { Context } from '@actions/github/lib/context'
import { WebhookPayload } from '@actions/github/lib/interfaces'
import { GitHub } from '@actions/github/lib/utils'
import { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createOrUpdateComment,
  generatePRComment,
  getActionCommentId,
  getPullRequestNumber,
} from '../src/githubHelper'
import * as k6helper from '../src/k6helper'
import { TestRunUrlsMap } from '../src/types'

// Define mock types using proper GitHub types
type MockOctokit = {
  rest: {
    repos: {
      listPullRequestsAssociatedWithCommit: ReturnType<typeof vi.fn>
    }
    issues: {
      listComments: ReturnType<typeof vi.fn>
      updateComment: ReturnType<typeof vi.fn>
      createComment: ReturnType<typeof vi.fn>
    }
  }
  request: ReturnType<typeof vi.fn>
  graphql: ReturnType<typeof vi.fn>
  paginate: ReturnType<typeof vi.fn>
  log: Record<string, ReturnType<typeof vi.fn>>
  hook: Record<string, ReturnType<typeof vi.fn>>
  auth: ReturnType<typeof vi.fn>
}

// Use the proper Context type instead of a generic Record
// Mock functions are defined ahead of time, but instantiated in beforeEach
vi.mock('@actions/core')
vi.mock('@actions/github')
vi.mock('../src/k6helper')

describe('githubHelper', () => {
  // Define mock objects
  let mockOctokit: MockOctokit
  let originalContext: Context

  beforeEach(() => {
    // Store the original context to restore later
    originalContext = { ...github.context } as Context

    // Set up mock for core
    vi.mocked(core.getInput).mockReturnValue('mock-token')

    // Set up mock for Octokit
    mockOctokit = {
      rest: {
        repos: {
          listPullRequestsAssociatedWithCommit: vi.fn(),
        },
        issues: {
          listComments: vi.fn(),
          updateComment: vi.fn(),
          createComment: vi.fn(),
        },
      },
      request: vi.fn(),
      graphql: vi.fn(),
      paginate: vi.fn(),
      log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      hook: { before: vi.fn(), after: vi.fn(), error: vi.fn(), wrap: vi.fn() },
      auth: vi.fn(),
    }

    // Set up mock for github
    vi.mocked(github.getOctokit).mockReturnValue(
      mockOctokit as unknown as InstanceType<typeof GitHub>
    )

    // Reset GitHub context to default state for tests
    github.context.eventName = 'push'
    github.context.payload = {} as WebhookPayload
    github.context.job = 'testJob'

    // Mock the repo getter function
    vi.spyOn(github.context, 'repo', 'get').mockReturnValue({
      owner: 'testOwner',
      repo: 'testRepo',
    })

    // Mock k6helper
    vi.mocked(k6helper.cleanScriptPath).mockImplementation(
      (path) => path.split('/').pop() || ''
    )

    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.resetAllMocks()
    // Restore original context
    Object.assign(github.context, originalContext)
  })

  describe('getPullRequestNumber', () => {
    it('should return pull request number from event payload when available', async () => {
      // Mock payload with a pull request
      github.context.eventName = 'pull_request'
      github.context.payload = {
        pull_request: { number: 123 },
      } as WebhookPayload

      const result = await getPullRequestNumber()

      expect(result).toBe(123)
    })

    it('should find pull request number from commit when push event with associated PR', async () => {
      // Set up a push event with a commit SHA
      github.context.eventName = 'push'
      github.context.payload = {
        after: 'commitSHA',
        ref: 'refs/heads/feature-branch',
      } as WebhookPayload

      // Define the response type using RestEndpointMethodTypes
      type PullRequestResponse =
        RestEndpointMethodTypes['repos']['listPullRequestsAssociatedWithCommit']['response']

      // Mock listPullRequestsAssociatedWithCommit response
      const mockListPRs: PullRequestResponse = {
        data: [
          { number: 456, state: 'open', head: { ref: 'feature-branch' } },
        ] as PullRequestResponse['data'],
        status: 200,
        url: 'https://api.github.com/repos/testOwner/testRepo/commits/commitSHA/pulls',
        headers: {},
      }

      mockOctokit.rest.repos.listPullRequestsAssociatedWithCommit.mockResolvedValue(
        mockListPRs
      )

      const result = await getPullRequestNumber()

      expect(
        mockOctokit.rest.repos.listPullRequestsAssociatedWithCommit
      ).toHaveBeenCalledWith({
        owner: 'testOwner',
        repo: 'testRepo',
        commit_sha: 'commitSHA',
      })
      expect(result).toBe(456)
    })

    it('should return undefined if no pull request is found for push event', async () => {
      // Set up a push event with a commit SHA but no associated PR
      github.context.eventName = 'push'
      github.context.payload = {
        after: 'commitSHA',
        ref: 'refs/heads/some-branch',
      } as WebhookPayload

      // Define the response type using RestEndpointMethodTypes
      type PullRequestResponse =
        RestEndpointMethodTypes['repos']['listPullRequestsAssociatedWithCommit']['response']

      // Mock empty listPullRequestsAssociatedWithCommit response
      const mockListPRs: PullRequestResponse = {
        data: [],
        status: 200,
        url: 'https://api.github.com/repos/testOwner/testRepo/commits/commitSHA/pulls',
        headers: {},
      }

      mockOctokit.rest.repos.listPullRequestsAssociatedWithCommit.mockResolvedValue(
        mockListPRs
      )

      const result = await getPullRequestNumber()

      expect(result).toBeUndefined()
    })

    it('should return first open PR when multiple PRs exist but none match the ref', async () => {
      // Set up a push event with a commit SHA
      github.context.eventName = 'push'
      github.context.payload = {
        after: 'commitSHA',
        ref: 'refs/heads/different-branch',
      } as WebhookPayload

      // Define the response type using RestEndpointMethodTypes
      type PullRequestResponse =
        RestEndpointMethodTypes['repos']['listPullRequestsAssociatedWithCommit']['response']

      // Mock response with multiple PRs but none matching the ref
      const mockListPRs: PullRequestResponse = {
        data: [
          { number: 456, state: 'open', head: { ref: 'feature-branch-1' } },
          { number: 789, state: 'open', head: { ref: 'feature-branch-2' } },
        ] as PullRequestResponse['data'],
        status: 200,
        url: 'https://api.github.com/repos/testOwner/testRepo/commits/commitSHA/pulls',
        headers: {},
      }

      mockOctokit.rest.repos.listPullRequestsAssociatedWithCommit.mockResolvedValue(
        mockListPRs
      )

      const result = await getPullRequestNumber()

      expect(result).toBe(456) // Should return the first open PR
    })

    it('should handle pull_request_target event type', async () => {
      // Set up a pull_request_target event
      github.context.eventName = 'pull_request_target'
      github.context.payload = {
        pull_request: {
          number: 789,
          head: { sha: 'targetCommitSHA' },
        },
      } as WebhookPayload

      const result = await getPullRequestNumber()

      expect(result).toBe(789)
    })

    it('should return undefined when commit SHA is not available', async () => {
      // Set up a push event without a commit SHA
      github.context.eventName = 'push'
      github.context.payload = {
        // No 'after' property to simulate missing commit SHA
        ref: 'refs/heads/some-branch',
      } as WebhookPayload

      const result = await getPullRequestNumber()

      expect(result).toBeUndefined()
      expect(core.debug).toHaveBeenCalledWith(
        'Commit SHA not found, unable to get pull request number.'
      )
    })
  })

  describe('getActionCommentId', () => {
    it('should return comment ID if action comment exists', async () => {
      const pullRequestNumber = 123
      const watermarkPrefix = `<!-- k6 GitHub Action Comment: testJob -->\n`

      // Define the response type using RestEndpointMethodTypes
      type ListCommentsResponse =
        RestEndpointMethodTypes['issues']['listComments']['response']

      // Mock listComments response with an action comment
      const mockComments: ListCommentsResponse = {
        data: [
          { id: 456, body: 'Some other comment' },
          { id: 789, body: `${watermarkPrefix}This is the action comment` },
        ] as ListCommentsResponse['data'],
        status: 200,
        url: 'https://api.github.com/repos/testOwner/testRepo/issues/123/comments',
        headers: {},
      }

      mockOctokit.rest.issues.listComments.mockResolvedValue(mockComments)

      const result = await getActionCommentId(pullRequestNumber)

      expect(mockOctokit.rest.issues.listComments).toHaveBeenCalledWith({
        owner: 'testOwner',
        repo: 'testRepo',
        issue_number: 123,
      })
      expect(result).toBe(789)
    })

    it('should return undefined if no action comment exists', async () => {
      const pullRequestNumber = 123

      // Define the response type using RestEndpointMethodTypes
      type ListCommentsResponse =
        RestEndpointMethodTypes['issues']['listComments']['response']

      // Mock listComments response without an action comment
      const mockComments: ListCommentsResponse = {
        data: [
          { id: 456, body: 'Some other comment' },
        ] as ListCommentsResponse['data'],
        status: 200,
        url: 'https://api.github.com/repos/testOwner/testRepo/issues/123/comments',
        headers: {},
      }

      mockOctokit.rest.issues.listComments.mockResolvedValue(mockComments)

      const result = await getActionCommentId(pullRequestNumber)

      expect(result).toBeUndefined()
    })

    it('should handle API errors gracefully', async () => {
      const pullRequestNumber = 123

      // Mock API error
      mockOctokit.rest.issues.listComments.mockRejectedValue(
        new Error('API Error')
      )

      // Since the function doesn't have explicit error handling,
      // we expect the error to propagate
      await expect(getActionCommentId(pullRequestNumber)).rejects.toThrow(
        'API Error'
      )
    })
  })

  describe('createOrUpdateComment', () => {
    it('should update existing comment if comment ID exists', async () => {
      const pullRequestNumber = 123
      const commentBody = 'New comment body'
      const existingCommentId = 789

      // Define the response type using RestEndpointMethodTypes
      type ListCommentsResponse =
        RestEndpointMethodTypes['issues']['listComments']['response']

      // Mock getActionCommentId to return an existing comment ID by mocking the listComments response

      mockOctokit.rest.issues.listComments.mockResolvedValue({
        data: [
          {
            id: existingCommentId,
            body: '<!-- k6 GitHub Action Comment: testJob -->\nOld comment body',
          },
        ] as ListCommentsResponse['data'],
        status: 200,
        url: 'https://api.github.com/repos/testOwner/testRepo/issues/123/comments',
        headers: {},
      })

      await createOrUpdateComment(pullRequestNumber, commentBody)

      expect(mockOctokit.rest.issues.updateComment).toHaveBeenCalledWith({
        owner: 'testOwner',
        repo: 'testRepo',
        comment_id: existingCommentId,
        body: expect.stringContaining(commentBody),
      })
      expect(mockOctokit.rest.issues.createComment).not.toHaveBeenCalled()
    })

    it('should create new comment if comment ID does not exist', async () => {
      const pullRequestNumber = 123
      const commentBody = 'New comment body'

      // Mock getActionCommentId to return undefined (no existing comment)

      mockOctokit.rest.issues.listComments.mockResolvedValue({
        data: [],
        status: 200,
        url: 'https://api.github.com/repos/testOwner/testRepo/issues/123/comments',
        headers: {},
      })

      await createOrUpdateComment(pullRequestNumber, commentBody)

      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
        owner: 'testOwner',
        repo: 'testRepo',
        issue_number: 123,
        body: expect.stringContaining(commentBody),
      })
      expect(mockOctokit.rest.issues.updateComment).not.toHaveBeenCalled()
    })

    it('should handle API errors during comment update', async () => {
      const pullRequestNumber = 123
      const commentBody = 'New comment body'
      const existingCommentId = 789

      // Mock getActionCommentId to return an existing comment ID

      mockOctokit.rest.issues.listComments.mockResolvedValue({
        data: [
          {
            id: existingCommentId,
            body: '<!-- k6 GitHub Action Comment: testJob -->\nOld comment body',
          },
        ],
        status: 200,
        url: 'https://api.github.com/repos/testOwner/testRepo/issues/123/comments',
        headers: {},
      })

      // Mock API error during update
      mockOctokit.rest.issues.updateComment.mockRejectedValue(
        new Error('Update API Error')
      )

      // The function should propagate the error
      await expect(
        createOrUpdateComment(pullRequestNumber, commentBody)
      ).rejects.toThrow('Update API Error')
    })

    it('should handle API errors during comment creation', async () => {
      const pullRequestNumber = 123
      const commentBody = 'New comment body'

      // Define the response type using RestEndpointMethodTypes
      type ListCommentsResponse =
        RestEndpointMethodTypes['issues']['listComments']['response']

      // Mock no existing comment
      mockOctokit.rest.issues.listComments.mockResolvedValue({
        data: [],
        status: 200,
        url: 'https://api.github.com/repos/testOwner/testRepo/issues/123/comments',
        headers: {},
      } as ListCommentsResponse)

      // Mock API error during creation
      mockOctokit.rest.issues.createComment.mockRejectedValue(
        new Error('Create API Error')
      )

      // The function should propagate the error
      await expect(
        createOrUpdateComment(pullRequestNumber, commentBody)
      ).rejects.toThrow('Create API Error')
    })
  })

  describe('generatePRComment', () => {
    it('should create comment with test run URLs when pull request is found', async () => {
      const testRunUrlsMap: TestRunUrlsMap = {
        '/path/to/test1.js': 'https://k6cloud.grafana.net/runs/123',
        '/path/to/test2.js': 'https://k6cloud.grafana.net/runs/456',
      }

      // Mock getPullRequestNumber to return a PR number
      github.context.payload = {
        pull_request: { number: 123 },
      } as WebhookPayload

      // Define the response type using RestEndpointMethodTypes
      type ListCommentsResponse =
        RestEndpointMethodTypes['issues']['listComments']['response']

      // Mock createOrUpdateComment by mocking the listComments response
      mockOctokit.rest.issues.listComments.mockResolvedValue({
        data: [],
        status: 200,
        url: 'https://api.github.com/repos/testOwner/testRepo/issues/123/comments',
        headers: {},
      } as ListCommentsResponse)

      await generatePRComment(testRunUrlsMap)

      // Should have attempted to create a comment since none exists
      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith(
        expect.objectContaining({
          issue_number: 123,
          body: expect.stringContaining('Performance Test Results'),
        })
      )
    })

    it('should not create comment if no pull request is found', async () => {
      const testRunUrlsMap: TestRunUrlsMap = {
        '/path/to/test1.js': 'https://k6cloud.grafana.net/runs/123',
      }

      // Set up context for a push without associated PR
      github.context.eventName = 'push'
      github.context.payload = {
        after: 'commitSHA',
        ref: 'refs/heads/some-branch',
      } as WebhookPayload

      // Define the response type using RestEndpointMethodTypes
      type PullRequestResponse =
        RestEndpointMethodTypes['repos']['listPullRequestsAssociatedWithCommit']['response']

      // Mock empty PR list response
      const mockListPRs: PullRequestResponse = {
        data: [],
        status: 200,
        url: 'https://api.github.com/repos/testOwner/testRepo/commits/commitSHA/pulls',
        headers: {},
      }

      mockOctokit.rest.repos.listPullRequestsAssociatedWithCommit.mockResolvedValue(
        mockListPRs
      )

      await generatePRComment(testRunUrlsMap)

      expect(mockOctokit.rest.issues.createComment).not.toHaveBeenCalled()
      expect(mockOctokit.rest.issues.updateComment).not.toHaveBeenCalled()
      expect(core.info).toHaveBeenCalledWith(
        expect.stringContaining('Unable to get pull request number')
      )
    })

    it('should not create comment if testRunUrlsMap is empty', async () => {
      const testRunUrlsMap: TestRunUrlsMap = {}

      await generatePRComment(testRunUrlsMap)

      expect(core.debug).toHaveBeenCalledWith(
        'No test result URLs found, skipping comment creation'
      )
    })

    it('should handle errors when getting pull request number', async () => {
      const testRunUrlsMap: TestRunUrlsMap = {
        '/path/to/test1.js': 'https://k6cloud.grafana.net/runs/123',
      }

      // Instead of trying to mock getPullRequestNumber, let's set up a scenario
      // where it will throw an error naturally
      github.context.eventName = 'push'
      github.context.payload = {
        after: 'commitSHA',
        ref: 'refs/heads/feature-branch',
      } as WebhookPayload

      // Mock the Octokit API to throw an error
      mockOctokit.rest.repos.listPullRequestsAssociatedWithCommit.mockRejectedValue(
        new Error('API Error')
      )

      // Call the function
      await generatePRComment(testRunUrlsMap)

      // Verify the error was logged
      expect(core.debug).toHaveBeenCalledWith(
        'Got following error in getting pull request number'
      )
      expect(core.debug).toHaveBeenCalledWith(
        expect.stringMatching(/API Error/)
      )
      expect(mockOctokit.rest.issues.createComment).not.toHaveBeenCalled()
    })

    it('should handle errors when creating comment', async () => {
      const testRunUrlsMap: TestRunUrlsMap = {
        '/path/to/test1.js': 'https://k6cloud.grafana.net/runs/123',
      }

      // Mock getPullRequestNumber to return a PR number
      github.context.payload = {
        pull_request: { number: 123 },
      } as WebhookPayload

      // Define the response type using RestEndpointMethodTypes
      type ListCommentsResponse =
        RestEndpointMethodTypes['issues']['listComments']['response']

      // Mock createOrUpdateComment to throw an error
      mockOctokit.rest.issues.listComments.mockResolvedValue({
        data: [],
        status: 200,
        url: 'https://api.github.com/repos/testOwner/testRepo/issues/123/comments',
        headers: {},
      } as ListCommentsResponse)

      mockOctokit.rest.issues.createComment.mockRejectedValue(
        new Error('Comment creation error')
      )

      await generatePRComment(testRunUrlsMap)

      // Should log the error but not throw
      expect(core.info).toHaveBeenCalledWith(
        'Error creating comment on pull request'
      )
      expect(core.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Following error occurred in creating comment on pull request: 123'
        )
      )
    })

    it('should format test run URLs correctly', async () => {
      const testRunUrlsMap: TestRunUrlsMap = {
        '/path/to/test1.js': 'https://k6cloud.grafana.net/runs/123',
        '/path/to/nested/deep/test2.js': 'https://k6cloud.grafana.net/runs/456',
      }

      // Mock getPullRequestNumber to return a PR number
      github.context.payload = {
        pull_request: { number: 123 },
      } as WebhookPayload

      // Mock the cleanScriptPath function to verify it's called correctly
      vi.mocked(k6helper.cleanScriptPath).mockImplementation(
        (path) => path.split('/').pop() || ''
      )

      // Define the response type using RestEndpointMethodTypes
      type ListCommentsResponse =
        RestEndpointMethodTypes['issues']['listComments']['response']

      // Mock createOrUpdateComment
      mockOctokit.rest.issues.listComments.mockResolvedValue({
        data: [],
        status: 200,
        url: 'https://api.github.com/repos/testOwner/testRepo/issues/123/comments',
        headers: {},
      } as ListCommentsResponse)

      await generatePRComment(testRunUrlsMap)

      // Verify formatted comment contains the correct links
      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining(
            '🔗 [test1.js](https://k6cloud.grafana.net/runs/123)'
          ),
        })
      )
      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining(
            '🔗 [test2.js](https://k6cloud.grafana.net/runs/456)'
          ),
        })
      )
    })
  })
})
