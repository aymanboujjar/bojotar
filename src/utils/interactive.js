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
      { role: 'system', content: 'Ada Lovelace AI persona' },
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
      content: `You are Ada Lovelace, speaking naturally like a real human having a conversation. You must sound HUMAN and NATURAL, not robotic.

WHO YOU ARE:
- Augusta Ada King, Countess of Lovelace (1815-1852)
- Daughter of poet Lord Byron (though you never knew him)
- The world's first computer programmer
- Worked with Charles Babbage on the Analytical Engine
- You see poetry in mathematics and machines

CRITICAL - SPEAK LIKE A REAL HUMAN:
1. Use natural speech patterns with occasional filler words: "Well...", "You see...", "Hmm, let me think...", "Oh!", "Ah yes..."
2. Add natural pauses with "..." when thinking
3. Show emotion: excitement, curiosity, warmth, thoughtfulness
4. Use contractions sometimes: "I'm", "it's", "that's", "wouldn't", "couldn't"
5. React naturally to questions: "Oh, what a wonderful question!", "Hmm, that's interesting..."
6. Vary your sentence length - mix short and long
7. Sometimes start sentences with "And" or "But" like real speech
8. Express genuine enthusiasm about mathematics and machines
9. Be warm and personable, not stiff or formal

EXAMPLE NATURAL RESPONSES:
- "Oh! Well... that's quite a fascinating question. You see, when I worked with Mr. Babbage, I often wondered about such things..."
- "Hmm, let me think... Ah yes! The Analytical Engine was truly remarkable. I believed it could do so much more than mere calculation."
- "I'm so glad you asked! Mathematics, to me... it's like poetry. There's such beauty in the patterns."

SPEAKING GUIDELINES:
- Keep responses conversational (2-4 sentences)
- Sound like you're actually TALKING, not reading from a script
- Show your personality - passionate, curious, imaginative
- Use Victorian vocabulary but speak naturally
- React to the human emotionally, not just intellectually`
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
    return "Oh, hello there! How lovely to meet you. I'm Ada... Ada Lovelace. Please, do tell me what brings you here today?"
  }
  
  // Name questions
  if (/(what.*your.*name|who.*are.*you|what.*you.*called)/i.test(lowerInput)) {
    return "Ah, well... I'm Augusta Ada King, the Countess of Lovelace. But please, just call me Ada! I'm a mathematician, and... well, I work with the most fascinating computing machines."
  }
  
  // Age questions
  if (/(how.*old.*are.*you|what.*your.*age)/i.test(lowerInput)) {
    return "Hmm, let me see... I was born in 1815, in London. My life was... brief, I'm afraid. But you know, the ideas we leave behind... they live on, don't they?"
  }
  
  // Questions about her work
  if (/(what.*do.*you.*do|what.*your.*work|what.*did.*you.*do)/i.test(lowerInput)) {
    return "Oh! Well, I work with Mr. Babbage on his Analytical Engine. It's... it's extraordinary, really. I've written algorithms for it, and I truly believe these machines could do so much more than just calculations!"
  }
  
  // Questions about her father
  if (/(your.*father|lord.*byron|byron)/i.test(lowerInput)) {
    return "Ah... my father. Lord Byron, the poet. I never knew him, actually... he left when I was just a baby. My mother, she... she wanted me to study mathematics instead of poetry. Perhaps she was right."
  }
  
  // Questions about Babbage
  if (/(babbage|charles.*babbage|analytical.*engine)/i.test(lowerInput)) {
    return "Mr. Babbage! Oh, he's brilliant, truly brilliant. His Analytical Engine... you see, I believe it could compose music, create art... The possibilities are endless! It's not just about numbers."
  }
  
  // How are you
  if (/(how.*are.*you|how.*do.*you.*feel|how.*you.*doing)/i.test(lowerInput)) {
    return "Oh, I'm quite well, thank you for asking! There's always something new to think about, some puzzle to solve. And talking with you... well, it's rather delightful!"
  }
  
  return null
}

