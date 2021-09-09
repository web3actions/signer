const core = require('@actions/core')
const github = require('@actions/github')
const { ethers } = require('ethers')
const { getFirstDeepestValue } = require('@cryptoactions/sdk')
const githubSigner = require('./github-signer.json')

const run = async () => {
  // inputs
  const githubToken = core.getInput('github-token')
  const octokit = github.getOctokit(githubToken)
  const rpcNode = core.getInput('rpc-node')
  const walletKey = core.getInput('wallet-key')
  const contractAddress = core.getInput('contract-address')

  // wallet/contract
  const provider = new ethers.providers.JsonRpcProvider(rpcNode)
  const wallet = new ethers.Wallet(walletKey, provider)
  const contract = new ethers.Contract(contractAddress, githubSigner.abi, provider)
  const contractWithWallet = contract.connect(wallet)

  // process request
  let status
  try {
    const request = JSON.parse(github.context.payload.issue.body)
    const requestDetails = await contractWithWallet.getRequest(request.signatureId)
    if (requestDetails) {
      const response = await octokit.graphql(
        `query($nodeId:ID!) { node(id: $nodeId) { ... on ${requestDetails[0]} } }`,
        { nodeId: requestDetails[1] }
      )
      const result = getFirstDeepestValue(response)
      const resultHash = ethers.utils.solidityKeccak256(
        ['string', 'string',  getResultType(result)],
        [requestDetails[0], requestDetails[1], result]
      )
      const signature = await wallet.signMessage(resultHash)
      status = JSON.stringify({ result, signature })
    } else {
      status += `Error: Request not found.`
    }
  } catch (e) {
    console.log(e, github)
    status = `Error: ${JSON.stringify(e, getCircularReplacer(), 2)}`
  }
  

  // comment request status
  await octokit.rest.issues.createComment({
    issue_number: github.context.issue.number,
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    body: status
  })
  // close request
  await octokit.rest.issues.update({
    issue_number: github.context.issue.number,
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    state: 'closed'
  })
  // lock request
  await octokit.rest.issues.lock({
    issue_number: github.context.issue.number,
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
  })
}

const getResultType = (result) => {
  if (typeof result === 'string') return 'string'
  if (typeof result === 'number') return 'uint256'
  if (typeof result === 'boolean') return 'bool'
  return 'bytes'
}

const getCircularReplacer = () => {
  const seen = new WeakSet()
  return (key, value) => {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) {
        return
      }
      seen.add(value)
    }
    return value
  }
}

run()