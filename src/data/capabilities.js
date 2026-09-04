// The capability vocabulary lives in lib/ so api/notify.js can resolve who is
// allowed to receive a notification using exactly the rules usePermissions
// applies in the browser. Re-exported from here because every view already
// imports it under this path.
export * from '../../lib/capabilities.js'
