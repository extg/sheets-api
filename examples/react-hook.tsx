import { useState, useCallback } from 'react'

interface SheetData {
  [key: string]: unknown
}

interface SubmitOptions {
  sheetId?: string
  range?: string
}

interface UseSheetSubmitReturn {
  submit: (data: SheetData | SheetData[], options?: SubmitOptions) => Promise<unknown>
  loading: boolean
  error: string | null
  success: boolean
  reset: () => void
}

// Replace with your Cloudflare Worker URL
const DEFAULT_API_URL = 'https://your-worker.example.com'

export function useSheetSubmit(apiUrl: string = DEFAULT_API_URL): UseSheetSubmitReturn {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const submit = useCallback(async (
    data: SheetData | SheetData[], 
    options: SubmitOptions = {}
  ) => {
    setLoading(true)
    setError(null)
    setSuccess(false)
    
    try {
      const payload = {
        data,
        ...options
      }
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      })
      
      const result = await response.json()
      
      if (!result.ok) {
        throw new Error(result.error || 'Submit failed')
      }
      
      setSuccess(true)
      return result.result
      
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [apiUrl])

  const reset = useCallback(() => {
    setError(null)
    setSuccess(false)
    setLoading(false)
  }, [])

  return {
    submit,
    loading,
    error,
    success,
    reset
  }
}

// Example form component
interface ContactFormData {
  name: string
  email: string
  phone?: string
  message?: string
  source?: string
}

export function ContactForm() {
  const { submit, loading, error, success, reset } = useSheetSubmit()
  const [formData, setFormData] = useState<ContactFormData>({
    name: '',
    email: '',
    phone: '',
    message: '',
    source: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      await submit({
        ...formData,
        timestamp: new Date().toISOString(),
        page_url: window.location.href,
        user_agent: navigator.userAgent,
        // UTM parameters
        utm_source: new URLSearchParams(window.location.search).get('utm_source') || '',
        utm_medium: new URLSearchParams(window.location.search).get('utm_medium') || '',
        utm_campaign: new URLSearchParams(window.location.search).get('utm_campaign') || ''
      })
      
      // Reset form on success
      setFormData({
        name: '',
        email: '',
        phone: '',
        message: '',
        source: ''
      })
      
      // Optional: send event to analytics
      // gtag('event', 'form_submit', { event_category: 'engagement' })
      
    } catch (err) {
      console.error('Form submission failed:', err)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          Name *
        </label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          Email *
        </label>
        <input
          type="email"
          id="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          required
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
          Phone
        </label>
        <input
          type="tel"
          id="phone"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label htmlFor="source" className="block text-sm font-medium text-gray-700">
          Source
        </label>
        <select
          id="source"
          name="source"
          value={formData.source}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        >
          <option value="">Select source</option>
          <option value="google">Google</option>
          <option value="facebook">Facebook</option>
          <option value="instagram">Instagram</option>
          <option value="yandex">Yandex</option>
          <option value="direct">Direct</option>
          <option value="referral">Referral</option>
        </select>
      </div>

      <div>
        <label htmlFor="message" className="block text-sm font-medium text-gray-700">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          rows={4}
          value={formData.message}
          onChange={handleChange}
          placeholder="Describe your request..."
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        />
      </div>

      <div>
        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Sending...' : 'Send'}
        </button>
      </div>

      {/* Send status */}
      {error && (
        <div className="text-red-600 text-sm">
          ❌ Error: {error}
          <button
            type="button"
            onClick={reset}
            className="ml-2 text-indigo-600 hover:text-indigo-500"
          >
            Try again
          </button>
        </div>
      )}

      {success && (
        <div className="text-green-600 text-sm">
          ✅ Thank you! Your request has been sent.
        </div>
      )}
    </form>
  )
}

// Example usage for bulk submission
export function BulkSubmitExample() {
  const { submit, loading, error } = useSheetSubmit()

  const handleBulkSubmit = async () => {
    const bulkData = [
      { name: 'User 1', email: 'user1@example.com', source: 'import' },
      { name: 'User 2', email: 'user2@example.com', source: 'import' },
      { name: 'User 3', email: 'user3@example.com', source: 'import' }
    ]

    try {
      await submit(bulkData, {
        range: 'BulkImport!A:Z' // Different sheet for import
      })
      console.log('Bulk submit successful!')
    } catch (err) {
      console.error('Bulk submit failed:', err)
    }
  }

  return (
    <div>
      <button
        onClick={handleBulkSubmit}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Importing...' : 'Import users'}
      </button>
      
      {error && <div className="text-red-600 mt-2">Error: {error}</div>}
    </div>
  )
}
