const { Reshuffle } = require('reshuffle')
const { SalesforceConnector } = require('reshuffle-salesforce-connector')

;(async () => {
  const app = new Reshuffle()
  const sf = new SalesforceConnector(app, {
    clientId: process.env.SALESFORCE_CLIENT_ID,
    clientSecret: process.env.SALESFORCE_CLIENT_SECRET,
    baseURL: process.env.RESHUFFLE_RUNTIME_BASE_URL,
    encryptionKey: process.env.RESHUFFLE_ENCRYPTION_KEY,
  })

  app.start(8000) // Listen to HTTP for authentication

  console.log('Authenticate with Salesforce')
  await sf.authenticate()
  console.log('Authenticated')

  const res = await sf.query('SELECT Id, Name FROM Account')
  console.log('Salesforce accounts:')
  for (const account of res.records) {
    console.log(' ', account.Id, account.Name)
  }

  process.exit(0) // Still listening - need to exit explicitly

})().catch(console.error)
