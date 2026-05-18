// Re-export all user-domain route plugins from original locations.
// The original files stay in routes/ until TypeScript check passes.
export { meRoute } from '../../routes/me.js'
export { parentsRoute } from '../../routes/parents.js'
export { sessionRoute } from '../../routes/session.js'
