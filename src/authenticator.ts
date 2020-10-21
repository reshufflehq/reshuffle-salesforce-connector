import { openAuthenticationWindow } from './common'

console.log()
console.log('┌────────────────────────────────────┐')
console.log('│ Reshuffle Salesforce Authenticator │')
console.log('└────────────────────────────────────┘')
console.log()

try {
  const url = openAuthenticationWindow(
    process.env.SALESFORCE_CLIENT_ID,
    process.env.SALESFORCE_CLIENT_SECRET,
    process.env.RESHUFFLE_RUNTIME_BASE_URL,
  )
  console.log('Please use your browser to login with Salesforce.')
  console.log()
  console.log('If a browser window does not open automatically, please go to:')
  console.log()
  console.log(url)
  console.log()
} catch (e) {
  console.error(e.message)
  console.error()
  console.error('Make sure to set the following environment variables:')
  console.error()
  console.error('  SALESFORCE_CLIENT_ID')
  console.error('  SALESFORCE_CLIENT_SECRET')
  console.error('  RESHUFFLE_RUNTIME_BASE_URL')
  console.error()
  process.exit(1)
}
