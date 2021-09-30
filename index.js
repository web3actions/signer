const core = require('@actions/core')
const github = require('@actions/github')
const { ethers } = require('ethers')

const run = async () => {
  try {
    // inputs
    const githubToken = core.getInput('github-token')
    const octokit = github.getOctokit(githubToken)
    const walletKey = core.getInput('wallet-key')
  
    // wallet
    const wallet = new ethers.Wallet(walletKey)
  
    // process request
    const request = JSON.parse(github.context.payload.issue.body)
    const workflowRunUrl = `https://api.github.com/repos/${request.owner}/${request.repo}/actions/runs/${request.runId}`
    const workflowRun = await octokit.request(workflowRunUrl)
    const workflow = await octokit.request(workflowRun.data.workflow_url)
    const workflowFile = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
      owner: request.owner,
      repo: request.repo,
      path: workflow.data.path,
      ref: workflowRun.data.head_sha
    })
    const message = ethers.utils.arrayify(ethers.utils.solidityKeccak256(
      ['string', 'uint256'],
      [workflowFile.data.sha, request.runId]
    ))
    const signature = await wallet.signMessage(message)
    await octokit.rest.issues.createComment({
      issue_number: github.context.issue.number,
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      body: JSON.stringify({ signature })
    })
    await octokit.rest.issues.update({
      issue_number: github.context.issue.number,
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      state: 'closed'
    })
  } catch (e) {
    core.setFailed(e.message)
  }
}

run()