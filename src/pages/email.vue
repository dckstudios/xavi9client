<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { Mail, Send, Inbox, Trash2, Edit, User, FileText, Info, Sparkles, AlertCircle } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useI18n } from 'vue-i18n'
import { 
  initializeMsal, 
  loginWithMicrosoft, 
  handleRedirectResponse, 
  getActiveAccount,
  silentLogin
} from '@/lib/msal'
import { isAuthenticated, userAccount, accessToken } from '@/stores/auth'// Asumiendo que tienes un composable para el tema

const { t } = useI18n() // Agrega esta línea para acceder al estado del tema

interface Email {
  id: number
  sender: string
  subject: string
  preview: string
  date: string
  read: boolean
  body: string
}

// Reactive state for the email interface
const selectedEmail = ref<Email | null>(null)
const showCompose = ref(false)

const emailDraft = reactive({
  to: '',
  subject: '',
  body: ''
})

const aiSuggestion = ref('')
const emailList = ref<Email[]>([
  // Se pueden mantener los correos de ejemplo o dejarlo vacío para probar
  /* Ejemplo:
  {
    id: 1,
    sender: 'Microsoft Team',
    subject: 'Welcome to Microsoft Email Integration',
    preview: 'Thanks for connecting your Microsoft account...',
    date: new Date().toLocaleDateString(),
    read: true,
    body: 'Dear User,\n\nThank you for connecting your Microsoft account with our application. You can now access and manage your emails directly from here.\n\nBest regards,\nMicrosoft Team'
  }
  */
])

// Computed para verificar si hay correos
const hasEmails = computed(() => emailList.value.length > 0)

// Functions
const selectEmail = (email) => {
  selectedEmail.value = email
  email.read = true
  showCompose.value = false
}

const openCompose = () => {
  showCompose.value = true
  selectedEmail.value = null
  emailDraft.to = ''
  emailDraft.subject = ''
  emailDraft.body = ''
}

const sendEmail = () => {
  // In a real app, this would send the email via API
  emailList.value.unshift({
    id: emailList.value.length + 1,
    sender: 'Me',
    subject: emailDraft.subject,
    preview: emailDraft.body.substring(0, 60) + '...',
    date: new Date().toLocaleDateString(),
    read: true,
    body: emailDraft.body
  })
  showCompose.value = false
  emailDraft.to = ''
  emailDraft.subject = ''
  emailDraft.body = ''
}

const getAIHelp = () => {
  // Simulate AI suggestion (in real app, this would call an AI service)
  if (emailDraft.subject.includes('meeting')) {
    aiSuggestion.value = "I notice you're writing about a meeting. Would you like me to suggest a professional closing for your email? Here's a suggestion: 'I look forward to our discussion and appreciate your time. Please let me know if you need any additional information before we meet.'"
  } else {
    aiSuggestion.value = "I can help you craft a more engaging email. Would you like me to suggest improvements to your tone or offer alternative phrases to make your message more effective?"
  }
}

const applyAISuggestion = () => {
  // In a real app, this would intelligently append or modify the email text
  if (aiSuggestion.value) {
    emailDraft.body += "\n\n" + aiSuggestion.value.split("Here's a suggestion: ")[1]?.replace(/'/g, '') || ''
    aiSuggestion.value = ''
  }
}

const requestAIExplanation = () => {
  if (selectedEmail.value) {
    aiSuggestion.value = "This email appears to be about " + 
      (selectedEmail.value.subject.toLowerCase().includes('update') ? 
        "a project update. The sender is sharing weekly progress with the team, highlighting completed tasks and seeking feedback." : 
        "a company announcement. The sender is providing information about an upcoming event and indicating that more details will follow.")
  }
}

const showLoginPopup = ref(true)
const isLoading = ref(false)
const isLoggingIn = ref(false)

const tryLogin = async () => {
  if (isLoggingIn.value) return
  isLoggingIn.value = true
  isLoading.value = true

  try {
    const result = await loginWithMicrosoft(false)
    if (result) {
      isAuthenticated.value = true
      userAccount.value = result.account
      accessToken.value = result.accessToken
      showLoginPopup.value = false
    }
  } catch (popupErr) {
    if (popupErr.errorCode === 'popup_window_error') {
      try {
        await loginWithMicrosoft(true) // fallback a redirección
      } catch (redirectError) {
        console.error("Error en redirección:", redirectError)
      }
    } else {
      console.error('Error crítico de autenticación:', popupErr)
    }
  } finally {
    isLoading.value = false
    isLoggingIn.value = false
  }
}
onMounted(async () => {
  try {
    const msalInstance = await initializeMsal()

    const redirectResult = await handleRedirectResponse()
    if (redirectResult) {
      console.log('[MSAL] Redirección completada con éxito:', redirectResult)
      isAuthenticated.value = true
      userAccount.value = redirectResult.account
      accessToken.value = redirectResult.accessToken
      showLoginPopup.value = false
      await fetchOutlookEmails() // <---- aquí
      return
    }

    const account = getActiveAccount()
    if (account) {
      userAccount.value = account
      const silentResult = await silentLogin()
      if (silentResult) {
        isAuthenticated.value = true
        accessToken.value = silentResult.accessToken
        showLoginPopup.value = false
        await fetchOutlookEmails()
      }
    }
  } catch (err) {
    console.error('Error initializing auth:', err)
  }
})


const fetchOutlookEmails = async () => {
  if (!accessToken.value) return

  try {
    const response = await fetch('https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$top=10', {
      headers: {
        Authorization: `Bearer ${accessToken.value}`,
        'Content-Type': 'application/json'
      }
    })

    const data = await response.json()

    if (data.value) {
      emailList.value = data.value.map((msg, index) => ({
        id: index + 1,
        sender: msg.from?.emailAddress?.name || 'Unknown',
        subject: msg.subject || '(Sin asunto)',
        preview: msg.bodyPreview || '',
        date: new Date(msg.receivedDateTime).toLocaleDateString(),
        read: msg.isRead,
        body: '' // Cuerpo completo opcional, se puede cargar al hacer click
      }))
    } else {
      console.error('No se pudieron obtener los correos:', data)
    }
  } catch (err) {
    console.error('Error al obtener correos:', err)
  }
}


</script>

<template>
  <div class="email-container flex h-full">
    <div v-if="showLoginPopup" class="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50">
      <div class="bg-background rounded-2xl shadow-xl p-8 w-[400px] text-center space-y-6 border border-border">
        <!-- Microsoft logo -->
        <img
          src="https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg"
          alt="Microsoft Logo"
          class="mx-auto h-8"
        />

        <!-- Title -->
        <h2 class="text-2xl font-semibold text-foreground">Sign in with Microsoft</h2>

        <!-- Button -->
        <Button
          @click="tryLogin"
          class="w-full flex items-center justify-center gap-2 bg-[#2F2F2F] dark:bg-[#3F3F3F] text-white hover:bg-[#1f1f1f] dark:hover:bg-[#2f2f2f]"
          :disabled="isLoading"
        >
          <div v-if="isLoading" class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          <img
            v-else
            src="https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg"
            alt="Microsoft Logo"
            class="h-5 w-5"
          />
          <span class="font-medium">{{ isLoading ? 'Iniciando sesión...' : 'Sign in with Microsoft' }}</span>
        </Button>

        <!-- Optional description -->
        <p class="text-sm text-muted-foreground">
          Connect your Outlook account to access your emails here.
        </p>
      </div>
    </div>
    <!-- Email sidebar -->
    <div class="email-sidebar w-1/4 min-w-[200px] border-r overflow-hidden p-2">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-semibold flex items-center">
          <Mail class="mr-2" /> {{ t('email.inbox') || 'Inbox' }}
        </h2>
        <Button variant="ghost" size="icon" @click="openCompose">
          <Edit class="h-5 w-5" />
        </Button>
      </div>
      
      <ScrollArea class="h-[calc(100%-3rem)]">
        <!-- Si hay correos, mostrarlos -->
        <div v-if="hasEmails" class="space-y-2">
          <div 
            v-for="email in emailList" 
            :key="email.id"
            @click="selectEmail(email)"
            class="p-2 rounded cursor-pointer hover:bg-accent transition-colors"
            :class="{ 'bg-accent/50': selectedEmail && selectedEmail.id === email.id, 'font-bold': !email.read }"
          >
            <div class="flex justify-between">
              <span class="truncate">{{ email.sender }}</span>
              <span class="text-xs text-muted-foreground">{{ email.date }}</span>
            </div>
            <div class="text-sm font-medium truncate">{{ email.subject }}</div>
            <div class="text-xs text-muted-foreground truncate">{{ email.preview }}</div>
          </div>
        </div>
        
        <!-- Si NO hay correos, mostrar mensaje -->
        <div v-else class="flex flex-col items-center justify-center h-[calc(100vh-12rem)] text-center">
          <AlertCircle class="h-10 w-10 text-muted-foreground mb-4" />
          <h3 class="text-xl font-medium mb-2">No tienes correos</h3>
          <p class="text-sm text-muted-foreground mb-4">
            Tu bandeja de entrada está vacía
          </p>
          <Button variant="outline" @click="openCompose">
            <Edit class="mr-2 h-4 w-4" />
            {{ t('email.compose') || 'Compose' }}
          </Button>
        </div>
      </ScrollArea>
    </div>

    <!-- Email content -->
    <div class="email-content flex-1 overflow-hidden">
      <div v-if="selectedEmail" class="flex flex-col h-full">
        <div class="p-4 border-b">
          <h3 class="text-xl font-semibold">{{ selectedEmail.subject }}</h3>
          <div class="flex justify-between items-center mt-2">
            <div class="flex items-center">
              <div class="bg-primary text-primary-foreground rounded-full h-8 w-8 flex items-center justify-center mr-2">
                {{ selectedEmail.sender.charAt(0) }}
              </div>
              <div>
                <div class="font-medium">{{ selectedEmail.sender }}</div>
                <div class="text-xs text-muted-foreground">{{ selectedEmail.date }}</div>
              </div>
            </div>
            <div class="flex space-x-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Button variant="ghost" size="icon" @click="requestAIExplanation">
                      <Info class="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Ask AI to explain</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>
        
        <ScrollArea class="flex-1 p-4">
          <div class="whitespace-pre-line">{{ selectedEmail.body }}</div>
        </ScrollArea>

        <div v-if="aiSuggestion" class="p-4 border-t bg-accent/20">
          <div class="flex items-start">
            <div class="mr-2 bg-primary text-primary-foreground rounded-full h-6 w-6 flex items-center justify-center flex-shrink-0">
              <Sparkles class="h-3 w-3" />
            </div>
            <div class="text-sm">
              <div class="font-medium">AI Assistant</div>
              <p>{{ aiSuggestion }}</p>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="showCompose" class="flex flex-col h-full">
        <div class="p-4 border-b">
          <h3 class="text-xl font-semibold">{{ t('email.compose') || 'New Message' }}</h3>
        </div>
        
        <div class="p-4 flex-1 flex flex-col">
          <div class="mb-4">
            <label class="text-sm font-medium mb-1 block">{{ t('email.to') || 'To' }}</label>
            <Input v-model="emailDraft.to" />
          </div>
          
          <div class="mb-4">
            <label class="text-sm font-medium mb-1 block">{{ t('email.subject') || 'Subject' }}</label>
            <Input v-model="emailDraft.subject" />
          </div>
          
          <div class="flex-1 flex flex-col">
            <label class="text-sm font-medium mb-1 block">{{ t('email.message') || 'Message' }}</label>
            <Textarea 
              v-model="emailDraft.body" 
              class="flex-1 min-h-[200px] resize-none"
              @input="aiSuggestion = ''"
            />
          </div>
          
          <div class="mt-4 flex justify-between">
            <Button variant="outline" @click="getAIHelp">
              <Sparkles class="mr-2 h-4 w-4" />
              {{ t('email.aiHelp') || 'Get AI Help' }}
            </Button>
            <Button @click="sendEmail">
              <Send class="mr-2 h-4 w-4" />
              {{ t('email.send') || 'Send' }}
            </Button>
          </div>
        </div>

        <div v-if="aiSuggestion" class="p-4 border-t bg-accent/20">
          <div class="flex items-start">
            <div class="mr-2 bg-primary text-primary-foreground rounded-full h-6 w-6 flex items-center justify-center flex-shrink-0">
              <Sparkles class="h-3 w-3" />
            </div>
            <div class="text-sm flex-1">
              <div class="font-medium">AI Assistant</div>
              <p>{{ aiSuggestion }}</p>
              <Button 
                v-if="aiSuggestion.includes('suggestion')" 
                variant="outline" 
                size="sm" 
                class="mt-2"
                @click="applyAISuggestion"
              >
                Apply Suggestion
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="h-full flex items-center justify-center">
        <div class="text-center">
          <Mail class="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 class="mt-4 text-lg font-medium">
            {{ hasEmails 
              ? (t('email.noSelection') || 'Select an email to read') 
              : (t('email.noEmails') || 'No hay correos disponibles') 
            }}
          </h3>
          <p class="text-sm text-muted-foreground">
            {{ hasEmails 
              ? (t('email.noSelectionHint') || 'Or click the edit button to compose a new message') 
              : (t('email.composeFirst') || 'Comienza escribiendo un nuevo mensaje') 
            }}
          </p>
          <Button class="mt-4" @click="openCompose">
            <Edit class="mr-2 h-4 w-4" />
            {{ t('email.compose') || 'Compose' }}
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>