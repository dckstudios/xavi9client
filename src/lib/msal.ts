// msal.ts
import { PublicClientApplication, type AuthenticationResult, PopupRequest, RedirectRequest, BrowserAuthError } from '@azure/msal-browser'

const msalConfig = {
  auth: {
    clientId: '2feb8baf-b726-490b-9d88-cdbf3c78cee2',
    authority: 'https://login.microsoftonline.com/common',
    redirectUri: window.location.origin,
    navigateToLoginRequestUrl: true
  },
  cache: {
    cacheLocation: "sessionStorage", 
    storeAuthStateInCookie: true 
  },
  system: {
    allowRedirectInIframe: true,
    loggerOptions: {
      loggerCallback: () => {}, // Función vacía para suprimir logs
      logLevel: 0, // No mostrar logs
      piiLoggingEnabled: false
    }
  }
}

let msalInstance: PublicClientApplication | null = null
let initialized = false

export async function initializeMsal() {
  if (!msalInstance) {
    msalInstance = new PublicClientApplication(msalConfig)
  }
  if (!initialized) {
    await msalInstance.initialize()
    initialized = true
  }
  
  return msalInstance
}

export async function loginWithMicrosoft(useRedirect = false): Promise<AuthenticationResult | null> {
  if (!initialized || !msalInstance) {
    await initializeMsal()
  }

  // Verificación de seguridad para garantizar que msalInstance esté definido
  if (!msalInstance) {
    console.error("MSAL instance no está inicializado correctamente")
    return null
  }

  const authParams = {
    scopes: ['User.Read', 'Mail.Read']
  }

  if (useRedirect) {
    // Usar silenciosamente redirección
    try {
      await msalInstance.loginRedirect(authParams as RedirectRequest)
    } catch (error) {
      console.error("Error en redirección:", error)
    }
    return null
  } else {
    try {
      // Intenta con popup primero
      const result = await msalInstance.loginPopup({
        ...authParams,
        popupWindowAttributes: {
          width: 600,
          height: 600,
          left: window.screenX + (window.outerWidth - 600) / 2,
          top: window.screenY + (window.outerHeight - 600) / 2
        }
      } as PopupRequest)
      
      return result || null // Asegurarnos de que devolvemos null en lugar de undefined
    } catch (error) {
      // Si falla el popup, cambiar automáticamente a redirección sin mostrar error al usuario
      if (error instanceof BrowserAuthError && error.message.includes('popup_window_error')) {
        console.log('Manejando error de popup automáticamente...')
        try {
          await msalInstance.loginRedirect(authParams as RedirectRequest)
        } catch (redirectError) {
          console.error("Error al redirigir:", redirectError)
        }
      }
      // Re-lanzar el error para manejo externo si es necesario
      throw error
    }
  }
}

export async function handleRedirectResponse(): Promise<AuthenticationResult | null> {
  if (!msalInstance) {
    await initializeMsal()
  }
  
  try {
    return await msalInstance?.handleRedirectPromise() || null
  } catch (error) {
    console.error("Error handling redirect:", error)
    return null
  }
}

export function getMsalInstance() {
  return msalInstance
}

export function getActiveAccount() {
  if (!msalInstance) return null
  
  const accounts = msalInstance.getAllAccounts()
  if (accounts.length === 0) return null
  
  return accounts[0]
}

export async function silentLogin(): Promise<AuthenticationResult | null> {
  if (!msalInstance) {
    await initializeMsal()
  }
  
  const account = getActiveAccount()
  if (!account) return null
  
  try {
    return await msalInstance?.acquireTokenSilent({
      scopes: ['User.Read', 'Mail.Read'],
      account
    }) || null
  } catch (error) {
    console.error("Silent token acquisition failed", error)
    return null
  }
}