const core = require('@actions/core')
const github = require('@actions/github')
const { ethers } = require('ethers')
const { getFirstDeepestValue } = require('@cryptoactions/sdk')
const axios = require('axios')
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

  // request
  console.log(github.context)
  const request = JSON.parse(github.context.payload.issue.body)
  const requestDetails = await contractWithWallet.getRequest(request.signatureId)
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

  // post result and signature as comment
  await octokit.rest.issues.createComment({
    issue_number: github.context.payload.issue.number,
    repo: github.context.payload.repository.name,
    owner: github.context.payload.repository.owner,
    title: 'Signer Response',
    body: JSON.stringify({ request, result, signature })
  })
}

const getResultType = (result) => {
  if (typeof result === 'string') return 'string'
  if (typeof result === 'number') return 'uint256'
  if (typeof result === 'boolean') return 'bool'
  return 'bytes'
}

run()