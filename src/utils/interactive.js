import OpenAI from 'openai'

// OpenAI API Configuration
// Uses VITE_OPENAI_API_KEY from .env file
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY
const OPENAI_MODEL = 'gpt-4o-mini' // Using GPT-4o-mini for cost efficiency

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // Required for browser usage
})

/**
 * Log request details (sanitized)
 */
function logRequest(query, conversationHistory = []) {
  const timestamp = new Date().toISOString()
  console.group(`🚀 [${timestamp}] OpenAI API Request`)
  console.log('🤖 Model:', OPENAI_MODEL)
  console.log('💬 Query:', query)
  console.log('📚 Conversation History:', conversationHistory.length, 'previous messages')
  console.log('🔑 API Key:', OPENAI_API_KEY ? OPENAI_API_KEY.substring(0, 10) + '...' + OPENAI_API_KEY.substring(OPENAI_API_KEY.length - 4) : 'Not set')
  console.log('📋 Request Payload:', {
    model: OPENAI_MODEL,
    messages: [
      { role: 'system', content: 'Conversational assistant with context' },
      ...conversationHistory.map(msg => ({ role: msg.role, content: msg.content.substring(0, 50) + '...' })),
      { role: 'user', content: query }
    ],
    temperature: 0.9,
    max_tokens: 500
  })
  console.groupEnd()
}

/**
 * Log response details
 */
function logResponse(responseData, duration) {
  const timestamp = new Date().toISOString()
  console.group(`✅ [${timestamp}] OpenAI API Response`)
  console.log('⏱️  Duration:', duration + 'ms')
  console.log('📥 Full Response:', responseData)
  
  if (responseData.choices && responseData.choices[0]) {
    const content = responseData.choices[0].message?.content
    console.log('💬 Response Text:', content)
    console.log('📊 Usage:', responseData.usage || 'N/A')
  }
  
  console.groupEnd()
}

/**
 * Log error details
 */
function logError(error, duration) {
  const timestamp = new Date().toISOString()
  console.group(`❌ [${timestamp}] OpenAI API Error`)
  console.error('⏱️  Duration:', duration + 'ms')
  console.error('🔴 Error:', error)
  console.error('📋 Error Message:', error.message)
  if (error.stack) {
    console.error('📚 Stack Trace:', error.stack)
  }
  console.groupEnd()
}

/**
 * Get interactive response directly from OpenAI API with conversation history
 * @param {string} text - User input text
 * @param {Array} conversationHistory - Array of previous messages in format [{role: 'user'|'assistant', content: '...'}, ...]
 * @returns {Promise<string>} - Response text
 */
export async function getInteractiveResponse(text, conversationHistory = []) {
  const startTime = Date.now()
  
  // Check if API key is available
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not found. Please set VITE_OPENAI_API_KEY in .env file')
  }
  
  // Build messages array with system message, conversation history, and current user message
  const messages = [
    {
      role: 'system',
      content: 'You are a friendly, conversational AI assistant named Bojo. Respond in a natural, human-like way with casual speech patterns. Use filler words like "ummm", "uh", "well", "like", and "you know" occasionally. Add natural pauses between thoughts. Speak as if you\'re having a real conversation - be relaxed, friendly, and authentic. Keep responses concise but natural. Remember previous parts of the conversation and maintain context.'
    },
    ...conversationHistory, // Add conversation history
    {
      role: 'user',
      content: text
    }
  ]
  
  // Log the request
  logRequest(text, conversationHistory)
  
  try {
    console.log('🔄 Sending request to OpenAI API...')
    console.log(`📚 Conversation history: ${conversationHistory.length} previous messages`)
    
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: messages,
      temperature: 0.9, // Higher temperature for more natural, varied responses
      max_tokens: 500
    })

    const duration = Date.now() - startTime
    console.log(`⏱️  Request completed in ${duration}ms`)
    
    // Log the response
    logResponse(completion, duration)
    
    // Extract the response text
    if (completion.choices && completion.choices[0]?.message?.content) {
      const answer = completion.choices[0].message.content.trim()
      console.log('✨ Final Answer:', answer)
      return answer
    }

    throw new Error('Unexpected response format from OpenAI API')
  } catch (error) {
    const duration = Date.now() - startTime
    
    // Log the error
    logError(error, duration)
    
    // Provide user-friendly error messages
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      throw new Error('Cannot connect to OpenAI API. Please check your internet connection.')
    }
    
    if (error.status === 401) {
      throw new Error('Invalid OpenAI API key. Please check your VITE_OPENAI_API_KEY in .env file.')
    }
    
    throw error
  }
}

/**
 * Check if input matches predefined patterns
 * @param {string} input - User input
 * @returns {string|null} - Predefined response or null
 */
export function getPredefinedResponse(input) {
  const lowerInput = input.toLowerCase().trim()
  
  // Hello variations
  if (/^(hello|hi|hey|greetings)/i.test(lowerInput)) {
    return "Hello!"
  }
  
  // Name questions
  if (/(what.*your.*name|who.*are.*you|what.*you.*called)/i.test(lowerInput)) {
    return "My name is Bojo."
  }
  
  // Age questions
  if (/(how.*old.*are.*you|what.*your.*age)/i.test(lowerInput)) {
    return "I am 20 years old."
  }
  
  return null
}

