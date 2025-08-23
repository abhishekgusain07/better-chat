'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.ExternalServiceError =
  exports.ValidationError =
  exports.ServiceError =
    void 0
class ServiceError extends Error {
  code
  serviceName
  cause
  constructor(message, code, serviceName, cause) {
    super(message)
    this.code = code
    this.serviceName = serviceName
    this.cause = cause
    this.name = 'ServiceError'
  }
}
exports.ServiceError = ServiceError
class ValidationError extends ServiceError {
  field
  constructor(message, serviceName, field) {
    super(message, 'VALIDATION_ERROR', serviceName)
    this.field = field
    this.name = 'ValidationError'
  }
}
exports.ValidationError = ValidationError
class ExternalServiceError extends ServiceError {
  provider
  statusCode
  constructor(message, serviceName, provider, statusCode) {
    super(message, 'EXTERNAL_SERVICE_ERROR', serviceName)
    this.provider = provider
    this.statusCode = statusCode
    this.name = 'ExternalServiceError'
  }
}
exports.ExternalServiceError = ExternalServiceError
//# sourceMappingURL=index.js.map
