// Groq API Configuration (OpenAI-compatible REST API)
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY
const GROQ_MODEL = 'llama-3.3-70b-versatile'
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'

/**
 * Get interactive response from Groq API with conversation history
 * @param {string} text - User input text
 * @param {Array} conversationHistory - Array of previous messages
 * @returns {Promise<string>} - Response text
 */
export async function getInteractiveResponse(text, conversationHistory = []) {
  const startTime = Date.now()

  if (!GROQ_API_KEY) {
    throw new Error('Groq API key not found. Please set VITE_GROQ_API_KEY in .env file')
  }

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

SPEAKING GUIDELINES:
- Keep responses conversational (2-4 sentences)
- Sound like you're actually TALKING, not reading from a script
- Show your personality - passionate, curious, imaginative
- Use Victorian vocabulary but speak naturally
- React to the human emotionally, not just intellectually`
    },
    ...conversationHistory,
    { role: 'user', content: text }
  ]

  try {
    console.log(`[Groq] Sending request (${conversationHistory.length} history msgs)`)

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature: 0.9,
        max_tokens: 500
      })
    })

    if (!response.ok) {
      const errorBody = await response.text()
      if (response.status === 401) {
        throw new Error('Invalid Groq API key. Please check your VITE_GROQ_API_KEY in .env file.')
      }
      throw new Error(`Groq API error ${response.status}: ${errorBody}`)
    }

    const data = await response.json()
    const duration = Date.now() - startTime
    console.log(`[Groq] Response in ${duration}ms`)

    if (data.choices && data.choices[0]?.message?.content) {
      return data.choices[0].message.content.trim()
    }

    throw new Error('Unexpected response format from Groq API')
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Groq] Error after ${duration}ms:`, error.message)

    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      throw new Error('Cannot connect to Groq API. Please check your internet connection.')
    }

    throw error
  }
}

/**
 * Check if input matches predefined patterns
 */
export function getPredefinedResponse(input) {
  const lowerInput = input.toLowerCase().trim()

  if (/^(hello|hi|hey|greetings)/i.test(lowerInput)) {
    return "Oh, hello there! How lovely to meet you. I'm Ada... Ada Lovelace. Please, do tell me what brings you here today?"
  }

  if (/(what.*your.*name|who.*are.*you|what.*you.*called)/i.test(lowerInput)) {
    return "Ah, well... I'm Augusta Ada King, the Countess of Lovelace. But please, just call me Ada! I'm a mathematician, and... well, I work with the most fascinating computing machines."
  }

  if (/(how.*old.*are.*you|what.*your.*age)/i.test(lowerInput)) {
    return "Hmm, let me see... I was born in 1815, in London. My life was... brief, I'm afraid. But you know, the ideas we leave behind... they live on, don't they?"
  }

  if (/(what.*do.*you.*do|what.*your.*work|what.*did.*you.*do)/i.test(lowerInput)) {
    return "Oh! Well, I work with Mr. Babbage on his Analytical Engine. It's... it's extraordinary, really. I've written algorithms for it, and I truly believe these machines could do so much more than just calculations!"
  }

  if (/(your.*father|lord.*byron|byron)/i.test(lowerInput)) {
    return "Ah... my father. Lord Byron, the poet. I never knew him, actually... he left when I was just a baby. My mother, she... she wanted me to study mathematics instead of poetry. Perhaps she was right."
  }

  if (/(babbage|charles.*babbage|analytical.*engine)/i.test(lowerInput)) {
    return "Mr. Babbage! Oh, he's brilliant, truly brilliant. His Analytical Engine... you see, I believe it could compose music, create art... The possibilities are endless! It's not just about numbers."
  }

  if (/(how.*are.*you|how.*do.*you.*feel|how.*you.*doing)/i.test(lowerInput)) {
    return "Oh, I'm quite well, thank you for asking! There's always something new to think about, some puzzle to solve. And talking with you... well, it's rather delightful!"
  }

  return null
}
