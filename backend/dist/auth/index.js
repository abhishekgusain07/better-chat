'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.auth = void 0
const logger_1 = require('@/utils/logger')
exports.auth = {
  api: {
    signOut: async (options) => {
      logger_1.logger.warn(
        'Backend signOut called - should use tRPC frontend auth instead'
      )
      throw new Error(
        'Authentication moved to tRPC frontend - use frontend signout'
      )
    },
  },
}
//# sourceMappingURL=index.js.map
