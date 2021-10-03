# Workflow Signer

An action that takes a repository and a workflow run id and signs the hash of the workflow file.

```yaml
name: Workflow Signer
on:
  issues:
    types: [ opened ]

jobs:
  sign:
    name: Sign Workflow Run
    runs-on: ubuntu-latest
    steps:
      - uses: web3actions/signer@edca6a44467709cf2674d1f1445daaafaf827864
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }} # to read information about workflow run
          wallet-key: ${{ secrets.WALLET_KEY }}
```

Issue body payload:

```json
{"owner": "web3actions", "repo": "booster", "runId": 1234567890}
```

**This repo's signing address: 0xaF7A78596e4fA588EAB254F5786D87255a16d49C**
