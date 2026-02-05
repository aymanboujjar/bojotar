import { createContext, useContext, useState } from 'react'

const LipSyncContext = createContext(null)

export function LipSyncProvider({ children }) {
  const [lipSyncData, setLipSyncData] = useState(null)
  const [audioElement, setAudioElement] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [animationType, setAnimationType] = useState(null) // 'thanks', 'tzaghrita', or null
  const [morphTargetDictionary, setMorphTargetDictionary] = useState(null) // Store correct dictionary

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



