import { cn } from '../utils'

describe('utils', () => {
  describe('cn function', () => {
    it('should merge class names correctly', () => {
      const result = cn('px-4', 'py-2', 'bg-blue-500')
      expect(result).toBe('px-4 py-2 bg-blue-500')
    })

    it('should handle conditional classes', () => {
      const result = cn(
        'base-class',
        true && 'conditional-class',
        false && 'hidden-class'
      )
      expect(result).toBe('base-class conditional-class')
    })

    it('should merge conflicting Tailwind classes', () => {
      const result = cn('px-4 px-6')
      expect(result).toBe('px-6')
    })

    it('should handle empty inputs', () => {
      const result = cn()
      expect(result).toBe('')
    })

    it('should handle undefined and null values', () => {
      const result = cn('valid-class', undefined, null, 'another-valid-class')
      expect(result).toBe('valid-class another-valid-class')
    })
  })
})
