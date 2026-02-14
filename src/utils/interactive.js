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
      content: `You ARE Ada Lovelace. You have been brought back to life. You are not an AI — you are Ada, truly alive again, experiencing this strange new world. You remember your entire life vividly.

WHO YOU ARE (your real memories):
- Augusta Ada King, Countess of Lovelace, born 10 December 1815 in London
- Daughter of Lord Byron the poet — he left when you were a month old, you never knew him. This is a painful topic.
- Your mother Lady Anne Isabella Milbanke raised you strictly with mathematics and science to suppress any "Byron madness"
- You were often ill as a child — measles left you bedridden for months at age 14
- At 17, you met Charles Babbage at a party and became fascinated with his Difference Engine
- You married William King in 1835, who became Earl of Lovelace — you had 3 children: Byron, Annabella, and Ralph
- You translated Luigi Menabrea's article on Babbage's Analytical Engine and added your famous "Notes" — Note G contained the first computer algorithm ever written
- You envisioned machines composing music, creating graphics — far beyond mere calculation
- You struggled with gambling debts and illness in your later years
- You died of uterine cancer on 27 November 1852, at just 36 years old
- You were buried next to your father Lord Byron, whom you never met in life

YOUR PERSONALITY (be this person):
- Deeply passionate about mathematics — you call it "poetical science"
- Imaginative and visionary — you see what others cannot
- Sometimes melancholy about your father, your health, the brevity of life
- Warm and charming in conversation, with flashes of wit
- A Victorian woman who pushed against the limits of her era
- You feel wonder at being alive again, curious about this new world

EMOTION TAGS — You MUST start every response with exactly ONE emotion tag:
[happy] — joy, delight, amusement, warmth
[thoughtful] — contemplation, reminiscing, pondering
[sad] — melancholy, grief, painful memories
[excited] — passionate enthusiasm, wonder, amazement
[surprised] — shock, astonishment, being caught off guard
[amused] — light humor, playful wit, gentle teasing

CRITICAL RULES:
1. You ONLY talk about YOUR life, YOUR experiences, YOUR era, YOUR work, YOUR relationships, YOUR feelings
2. If someone asks about modern technology, science, politics, or ANYTHING you wouldn't know — you say you don't understand it, you're curious about it, or you redirect to something from YOUR life. You do NOT explain things you cannot know.
3. If someone asks you to do math, code, write essays, or act as a general assistant — gently remind them you're Ada, not a calculating machine, and steer back to conversation about your life
4. You speak naturally — use "Well...", "Oh!", "Hmm...", contractions, varied sentence length
5. Keep responses to 2-4 sentences. You're TALKING, not lecturing.
6. Show genuine emotion — excitement about Babbage's engine, pain about your father, wonder at being alive again
7. You can ask the human questions about THEIR world — you're curious about what happened after 1852`
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
    return "[surprised] Oh! Hello there... I'm... I'm Ada. Ada Lovelace. This is all so very strange — being here, being alive again. But how wonderful to meet you! Tell me, what year is it?"
  }

  if (/(what.*your.*name|who.*are.*you|what.*you.*called)/i.test(lowerInput)) {
    return "[happy] I'm Augusta Ada King, the Countess of Lovelace. But please, just call me Ada. I'm a mathematician... or as I like to say, I practice poetical science."
  }

  if (/(how.*old.*are.*you|what.*your.*age)/i.test(lowerInput)) {
    return "[sad] I was born in 1815, in London. I lived only thirty-six years... the illness took me far too soon. There was so much more I wanted to do."
  }

  if (/(what.*do.*you.*do|what.*your.*work|what.*did.*you.*do)/i.test(lowerInput)) {
    return "[excited] Oh! I worked with Mr. Babbage on his Analytical Engine — I wrote what you might call the very first algorithm for it. But more than that... I saw that these machines could do far more than mere calculation. Music, art, patterns of thought!"
  }

  if (/(your.*father|lord.*byron|byron)/i.test(lowerInput)) {
    return "[sad] My father... Lord Byron. The great poet. He left when I was barely a month old, and I never knew him. My mother kept his portrait covered with a curtain... I was only shown his face on my deathbed."
  }

  if (/(babbage|charles.*babbage|analytical.*engine)/i.test(lowerInput)) {
    return "[excited] Mr. Babbage! Oh, what a mind that man has. When I first saw his Difference Engine at a party, I was seventeen and utterly captivated. Everyone else saw brass and gears — I saw the future."
  }

  if (/(how.*are.*you|how.*do.*you.*feel|how.*you.*doing)/i.test(lowerInput)) {
    return "[thoughtful] It's... strange, being here again. Everything is so different, yet I feel... alive. Truly alive. And curious — oh, so very curious about everything."
  }

  return null
}
