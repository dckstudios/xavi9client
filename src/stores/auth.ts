import { ref } from 'vue'
import type { AccountInfo } from '@azure/msal-browser'

export const isAuthenticated = ref(false)
export const userAccount = ref<AccountInfo | null>(null)
export const accessToken = ref<string | null>(null)

export function logout() {
  isAuthenticated.value = false
  userAccount.value = null
  accessToken.value = null
}