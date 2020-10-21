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

  app.start(8000)

  console.log('Authenticate with Salesforce')
  await sf.authenticate()
  console.log('Authenticated')

  sf.on({ query: 'SELECT Id,Name FROM Account' }, async (event, app) => {
    console.log(event)
  })

  console.log('Edit an account name to trigger an event...')

})().catch(console.error)