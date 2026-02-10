import { createContext, useContext, useState, useRef, useCallback } from 'react'

const LipSyncContext = createContext(null)

export function LipSyncProvider({ children }) {
  const [lipSyncData, setLipSyncData] = useState(null)
  const [audioElement, setAudioElement] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [animationType, setAnimationType] = useState(null) // 'thanks', 'tzaghrita', or null
  const [morphTargetDictionary, setMorphTargetDictionary] = useState(null) // Store correct dictionary
  const getAmplitudeRef = useRef(() => 0) // default returns 0

  const setGetAmplitude = useCallback((fn) => {
    getAmplitudeRef.current = fn
  }, [])

  const getAmplitude = useCallback(() => {
    return getAmplitudeRef.current()
  }, [])

  return (
    <LipSyncContext.Provider
      value={{
        lipSyncData,
        setLipSyncData,
        audioElement,
        setAudioElement,
        isProcessing,
        setIsProcessing,
        animationType,
        setAnimationType,
        morphTargetDictionary,
        setMorphTargetDictionary,
        getAmplitude,
        setGetAmplitude,
      }}
    >
      {children}
    </LipSyncContext.Provider>
  )
}

export function useLipSyncContext() {
  const context = useContext(LipSyncContext)
  if (!context) {
    throw new Error('useLipSyncContext must be used within LipSyncProvider')
  }
  return context
}
