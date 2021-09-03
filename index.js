const core = require('@actions/core')
const github = require('@actions/github')
const { ethers } = require('ethers')
const axios = require('axios')

const run = async () => {
  // inputs
  const signerContractAddress = core.getInput('signer-contract')
  const rpcNode = core.getInput('rpc-node')
  const key = core.getInput('key')
  const githubToken = core.getInput('github-token')
  const octokit = github.getOctokit(githubToken)

  // wallet/contract
  const provider = new ethers.providers.JsonRpcProvider(rpcNode)
  const wallet = new ethers.Wallet(key, provider)
  const signerContract = new ethers.Contract(signerContractAddress, [], provider)

  // request
  const requestId = Number(github.context.payload.issue.body)
  const request = await signerContract.getRequest(requestId)
  const response = await octokit.graphql(request.query, { nodeId: request.nodeId })
  const result = getDeepestValue(response.node)
  const resultHash = ethers.utils.solidityKeccak256(
    ['string', 'string',  getResultType(result)],
    [request.query, request.nodeId, result]
  )
  const signature = await wallet.signMessage(resultHash)

  // send result to destination
  if (request.destination.startsWith('https://')) {
    await axios.post(request.destination, { requestId, result, signature })
  } else {
    const repository = await octokit.graphql(
      'query ($nodeId: ID) { node($nodeId) { ... on Repository { name, owner { login } } } }',
      { nodeId: request.destination }
    )
    await octokit.rest.issues.create({
      repo: repository.node.name,
      owner: repository.node.owner.login,
      title: 'Signer Response',
      body: JSON.stringify({ requestId, result, signature })
    })
  }
}

const getDeepestValue = (object) => {
  if (typeof object === 'string' || typeof object === 'number' || typeof object === 'boolean') {
    return object
  }

  const keys = Object.keys(object)
  if (keys.length && !Array.isArray(object)) {
    return getDeepestValue(object[keys[0]])
  }

  return null
}

const getResultType = (result) => {
  if (typeof result === 'string') return 'string'
  if (typeof result === 'number') return 'uint256'
  if (typeof result === 'boolean') return 'bool'
  return 'bytes'
}

run()