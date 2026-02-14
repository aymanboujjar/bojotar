/**
 * Local server for saving files to public/ folder
 * Handles audio file uploads and Rhubarb processing
 */

import express from 'express'
import cors from 'cors'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const publicDir = path.join(projectRoot, 'public')

const app = express()
const PORT = 3001

// Middleware
app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use(express.raw({ type: 'application/octet-stream', limit: '50mb' }))

// Serve static files from public directory
app.use(express.static(publicDir))

// Ensure public directory exists
async function ensurePublicDir() {
  try {
    await fs.access(publicDir)
  } catch {
    await fs.mkdir(publicDir, { recursive: true })
  }
}

/**
 * Save audio file to public/ folder
 */
app.post('/api/save-audio', async (req, res) => {
  try {
    const { filename, audioData } = req.body
    
    if (!filename || !audioData) {
      return res.status(400).json({ error: 'Missing filename or audioData' })
    }
    
    // Convert base64 to buffer if needed, or use raw buffer
    let audioBuffer
    if (typeof audioData === 'string') {
      // Base64 encoded
      audioBuffer = Buffer.from(audioData, 'base64')
    } else {
      // Already a buffer (from raw body)
      audioBuffer = Buffer.from(audioData)
    }
    
    // Ensure filename has .wav extension
    const wavFilename = filename.endsWith('.wav') ? filename : `${filename}.wav`
    const filePath = path.join(publicDir, wavFilename)
    
    // Save file
    await fs.writeFile(filePath, audioBuffer)
    console.log(`✅ Audio saved to public/: ${wavFilename}`)
    
    // Process with Rhubarb automatically in background (non-blocking)
    const jsonFilename = wavFilename.replace('.wav', '.json')
    processWithRhubarb(wavFilename, jsonFilename).catch(err => {
      console.error('❌ Background Rhubarb processing error:', err)
    })
    
    // Return immediately - don't wait for Rhubarb processing
    res.json({ 
      success: true, 
      message: 'Audio saved successfully',
      filename: wavFilename,
      path: `/public/${wavFilename}`
    })
  } catch (error) {
    console.error('❌ Error saving audio:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Process audio with Rhubarb
 */
async function processWithRhubarb(wavFile, jsonFile) {
  try {
    const wavPath = path.join(publicDir, wavFile)
    const jsonPath = path.join(publicDir, jsonFile)
    const rhubarbExe = path.join(projectRoot, 'rhubarb', 'rhubarb.exe')
    
    // Check if rhubarb.exe exists
    try {
      await fs.access(rhubarbExe)
    } catch {
      console.warn('⚠️ rhubarb.exe not found, skipping processing')
      return
    }
    
    // Run rhubarb command with phonetic recognizer for better accuracy
    const command = `"${rhubarbExe}" -f json -r phonetic "${wavPath}" -o "${jsonPath}"`
    console.log(`🔄 Processing with Rhubarb: ${wavFile} -> ${jsonFile}`)
    
    const { stdout, stderr } = await execAsync(command)
    
    if (stderr && !stderr.includes('warning')) {
      console.warn('⚠️ Rhubarb stderr:', stderr)
    }
    
    console.log(`✅ Rhubarb processing completed: ${jsonFile}`)
  } catch (error) {
    console.error('❌ Error processing with Rhubarb:', error.message)
    // Don't throw - file was saved successfully even if Rhubarb fails
  }
}

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'File server is running' })
})

// Start server
async function startServer() {
  await ensurePublicDir()
  
  app.listen(PORT, () => {
    console.log(`🚀 File server running on http://localhost:${PORT}`)
    console.log(`📁 Saving files to: ${publicDir}`)
  })
}

startServer().catch(console.error)

