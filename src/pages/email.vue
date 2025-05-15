<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { Mail, Send, Inbox, Trash2, Edit, User, FileText, Info, Sparkles, AlertCircle, Star, Archive, RefreshCw, Search, Plus, Reply, ArrowLeft } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useI18n } from 'vue-i18n'
import {
  initializeMsal,
  loginWithMicrosoft,
  handleRedirectResponse,
  getActiveAccount,
  silentLogin
} from '@/lib/msal'
import { isAuthenticated, userAccount, accessToken } from '@/stores/auth'
import { sintetizarCorreo } from '@/lib/utils'

const { t } = useI18n()

interface Email {
  id: number
  sender: string
  subject: string
  preview: string
  date: string
  read: boolean
  body: string
  starred?: boolean
}

// Reactive state for the email interface
const selectedEmail = ref<Email | null>(null)
const showCompose = ref(false)
const showSidebar = ref(true)
const searchQuery = ref('')
const currentView = ref('inbox')

const emailDraft = reactive({
  to: '',
  subject: '',
  body: ''
})

const aiSuggestion = ref('')
const emailList = ref<Email[]>([])
const archivedEmails = ref<Email[]>([])

// Computed properties
const hasEmails = computed(() => emailList.value.length > 0)
const filteredEmails = computed(() => {
  return emailList.value.filter(email => {
    return email.sender.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      email.subject.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      email.preview.toLowerCase().includes(searchQuery.value.toLowerCase())
  })
})

const archiveEmail = (email: Email) => {
  // Quitarlo del inbox
  emailList.value = emailList.value.filter(e => e.id !== email.id)

  // Agregarlo a los archivados
  archivedEmails.value.push(email)

  // Salir de la vista de detalle
  selectedEmail.value = null
}

const displayedEmails = computed(() => {
  if (currentView.value === 'archive') {
    return archivedEmails.value
  }
  return filteredEmails.value
})


// Functions
const selectEmail = (email) => {
  selectedEmail.value = email
  email.read = true
  showCompose.value = false
}

const toggleSidebar = () => {
  showSidebar.value = !showSidebar.value
}

const openCompose = () => {
  showCompose.value = true
  selectedEmail.value = null
  emailDraft.to = ''
  emailDraft.subject = ''
  emailDraft.body = ''
}

const goBack = () => {
  if (showCompose.value) {
    showCompose.value = false
  } else if (selectedEmail.value) {
    selectedEmail.value = null
  }
}

const toggleStarEmail = (email) => {
  email.starred = !email.starred
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
  // Simulate AI suggestion
  if (emailDraft.subject.includes('meeting')) {
    aiSuggestion.value = "I notice you're writing about a meeting. Would you like me to suggest a professional closing for your email? Here's a suggestion: 'I look forward to our discussion and appreciate your time. Please let me know if you need any additional information before we meet.'"
  } else {
    aiSuggestion.value = "I can help you craft a more engaging email. Would you like me to suggest improvements to your tone or offer alternative phrases to make your message more effective?"
  }
}

const applyAISuggestion = () => {
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
      await fetchOutlookEmails()
    }
  } catch (error: unknown) {
    // Definir un tipo para los errores de autenticación
    interface AuthError {
      errorCode?: string;
      message: string;
    }

    // Type guard para verificar si es un error de autenticación
    const isAuthError = (err: unknown): err is AuthError => {
      return typeof err === 'object' && err !== null && ('errorCode' in err || 'message' in err);
    }

    if (isAuthError(error) && error.errorCode === 'popup_window_error') {
      try {
        await loginWithMicrosoft(true) // fallback a redirección
      } catch (redirectError) {
        console.error("Error en redirección:", redirectError)
      }
    } else {
      console.error('Error crítico de autenticación:', error)
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
      await fetchOutlookEmails()
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
    const response = await fetch('https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$top=20', {
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
        body: msg.body?.content || '', // Cuerpo completo opcional, se puede cargar al hacer click
        starred: false
      }))
    } else {
      console.error('No se pudieron obtener los correos:', data)
    }
  } catch (err) {
    console.error('Error al obtener correos:', err)
  }
}
const sanitizedEmail = computed(() =>
  selectedEmail.value?.body ? sintetizarCorreo(selectedEmail.value.body) : ''
)
</script>

<template>
  <div class="email-app h-screen bg-background flex flex-col">
    <!-- Login popup -->
    <div v-if="showLoginPopup"
      class="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm">
      <Card class="w-[400px] shadow-xl border-2 border-xavi-200 dark:border-xavi-800">
        <CardHeader class="text-center pb-4">
          <div class="flex justify-center mb-6">
            <div class="p-4 rounded-full xavi-bg">
              <Mail class="h-8 w-8 text-white dark:text-xavi-950" />
            </div>
          </div>
          <CardTitle class="text-2xl font-semibold">Sign in with Microsoft</CardTitle>
        </CardHeader>
        <CardContent class="space-y-6">
          <!-- Button -->
          <Button @click="tryLogin" class="w-full flex items-center justify-center gap-2 xavi-button h-11"
            :disabled="isLoading">
            <div v-if="isLoading"
              class="w-5 h-5 border-2 border-white dark:border-xavi-950 border-t-transparent rounded-full animate-spin">
            </div>
            <img v-else src="https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg"
              alt="Microsoft Logo" class="h-5 w-5" />
            <span class="font-medium">{{ isLoading ? 'Iniciando sesión...' : 'Sign in with Microsoft' }}</span>
          </Button>

          <!-- Optional description -->
          <p class="text-sm text-muted-foreground text-center">
            Connect your Outlook account to access your emails here.
          </p>
        </CardContent>
      </Card>
    </div>

    <!-- Main email interface -->
    <div class="email-container flex-1 flex overflow-hidden ">
      <!-- Sidebar navigation -->
      <div v-if="showSidebar"
        class="email-sidebar w-64 border-r border-border bg-background dark:bg-background h-full flex flex-col">
        <div class="p-4 flex items-center">
          <div class="w-10 h-10 rounded-full xavi-bg flex items-center justify-center mr-3">
            <Mail class="h-5 w-5 text-white dark:text-xavi-950" />
          </div>
          <h1 class="text-xl font-bold xavi-text">Mail</h1>
        </div>

        <div class="p-3">
          <Button @click="openCompose" variant='xavi'
            class="w-full xavi-button flex items-center justify-center gap-2 font-medium">
            <Plus class="h-4 w-4" />
            Compose
          </Button>
        </div>

        <div class="mt-2 px-2">
          <div
            class="sidebar-item flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer font-medium hover:bg-accent/50"
            :class="{ 'bg-accent/30': currentView === 'inbox' }"
            @click="() => { currentView = 'inbox'; selectedEmail = null; showCompose = false }">
            <Inbox class="h-5 w-5" />
            <span>Inbox</span>
            <Badge class="ml-auto bg-xavi-100 text-xavi-700 dark:bg-xavi-800 dark:text-xavi-300">
              {{ emailList.length }}
            </Badge>
          </div>


          <div class="sidebar-item flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer hover:bg-accent/50">
            <Star class="h-5 w-5" />
            <span>Starred</span>
          </div>

          <div class="sidebar-item flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer hover:bg-accent/50">
            <Send class="h-5 w-5" />
            <span>Sent</span>
          </div>

          <div
            class="sidebar-item flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer font-medium hover:bg-accent/50"
            :class="{ 'bg-accent/30': currentView === 'archive' }"
            @click="() => { currentView = 'archive'; selectedEmail = null; showCompose = false }">
            <Archive class="h-5 w-5" />
            <span>Archive</span>
            <Badge class="ml-auto bg-xavi-100 text-xavi-700 dark:bg-xavi-800 dark:text-xavi-300">
              {{ archivedEmails.length }}
            </Badge>
          </div>


          <div class="sidebar-item flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer hover:bg-accent/50">
            <Trash2 class="h-5 w-5" />
            <span>Trash</span>
          </div>
        </div>

        <div class="mt-6 px-4">
          <h3 class="text-xs font-semibold uppercase text-muted-foreground mb-2">Labels</h3>
          <div class="space-y-1">
            <div class="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent/50 cursor-pointer">
              <div class="w-2 h-2 rounded-full bg-rose-500"></div>
              <span class="text-sm">Personal</span>
            </div>
            <div class="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent/50 cursor-pointer">
              <div class="w-2 h-2 rounded-full bg-emerald-500"></div>
              <span class="text-sm">Work</span>
            </div>
            <div class="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent/50 cursor-pointer">
              <div class="w-2 h-2 rounded-full bg-amber-500"></div>
              <span class="text-sm">Projects</span>
            </div>
          </div>
        </div>

        <div class="mt-auto p-4 border-t">
          <div class="flex items-center">
            <Avatar class="h-8 w-8 mr-2 border xavi-border">
              <AvatarFallback class="bg-xavi-100 text-xavi-800 dark:bg-xavi-900 dark:text-xavi-200">
                {{ userAccount?.name?.charAt(0) || 'U' }}
              </AvatarFallback>
            </Avatar>
            <div class="overflow-hidden">
              <p class="text-sm font-medium truncate">{{ userAccount?.name || 'User' }}</p>
              <p class="text-xs text-muted-foreground truncate">{{ userAccount?.username || 'user@example.com' }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Main content area -->
      <div class="email-content flex-1 flex flex-col h-full overflow-hidden">
        <!-- Toolbar -->
        <div class="border-b border-border p-3 flex items-center">
          <Button variant="ghost" size="icon" @click="toggleSidebar" class="mr-2">
            <ArrowLeft class="h-5 w-5" />
          </Button>

          <div class="relative flex-1 max-w-md">
            <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input v-model="searchQuery" placeholder="Search emails..."
              class="pl-9 bg-background border-xavi-200 dark:border-xavi-800 focus-visible:ring-xavi-500" />
          </div>

          <Button variant="ghost" size="icon" class="ml-2">
            <RefreshCw class="h-4 w-4" />
          </Button>
        </div>

        <!-- Content area -->
        <div class="flex-1 flex overflow-y-auto">
          <!-- Email list panel -->
          <div v-if="!showCompose && !selectedEmail"
            class="w-full md:w-1/2 lg:w-2/5 xl:w-1/3 border-r border-border flex flex-col h-full">
            <div class="flex justify-between items-center p-4 border-b">
              <h2 class="font-medium">
                {{ currentView === 'archive' ? 'Archive' : 'Inbox' }}
              </h2>
              <p class="text-sm text-muted-foreground">
                {{ displayedEmails.length }} messages
              </p>
            </div>

            <ScrollArea class="h-full">
              <!-- Si hay correos, mostrarlos -->
              <div v-if="hasEmails" class="divide-y">
                <div v-for="email in displayedEmails" :key="email.id" @click="selectEmail(email)"
                  class="p-4 cursor-pointer hover:bg-accent/30 transition-colors"
                  :class="{ 'bg-xavi-50/50 dark:bg-xavi-950/40': !email.read }">
                  <div class="flex items-start">
                    <!-- Avatar -->
                    <Avatar class="h-10 w-10 mr-3">
                      <AvatarFallback class="bg-xavi-100 text-xavi-800 dark:bg-xavi-900 dark:text-xavi-200">
                        {{ email.sender.charAt(0) }}
                      </AvatarFallback>
                    </Avatar>

                    <!-- Contenido del correo -->
                    <div class="flex-1 min-w-0">
                      <!-- Fila superior: remitente + fecha + estrella -->
                      <div class="flex justify-between items-start">
                        <h3 class="font-medium truncate" :class="{ 'font-bold': !email.read }">
                          {{ email.sender }}
                        </h3>
                        <div class="flex items-center gap-2 flex-shrink-0">
                          <span class="text-xs text-muted-foreground">{{ email.date }}</span>
                          <button @click.stop="toggleStarEmail(email)">
                            <Star class="h-4 w-4"
                              :class="email.starred ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'" />
                          </button>
                        </div>
                      </div>

                      <!-- Asunto -->
                      <p class="text-sm truncate mt-0.5" :class="{ 'font-medium': !email.read }">
                        {{ email.subject }}
                      </p>

                      <!-- Vista previa -->
                      <p class="text-xs text-muted-foreground truncate mt-1">
                        {{ email.preview }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Si NO hay correos, mostrar mensaje -->
              <div v-else class="flex flex-col items-center justify-center h-[calc(100vh-12rem)] text-center p-4">
                <div class="w-16 h-16 rounded-full xavi-bg flex items-center justify-center mb-4">
                  <AlertCircle class="h-8 w-8 text-white dark:text-xavi-950" />
                </div>
                <h3 class="text-xl font-medium mb-2">No emails found</h3>
                <p class="text-sm text-muted-foreground mb-4">
                  Your inbox is empty
                </p>
                <Button @click="openCompose" variant="xavi" class="xavi-button">
                  <Plus class="mr-2 h-4 w-4" />
                  Compose new email
                </Button>
              </div>
            </ScrollArea>
          </div>

          <div v-if="!showCompose && !selectedEmail && hasEmails"
            class="hidden md:flex flex-1 items-center justify-center">
            <div class="text-center max-w-md p-6">
              <div class="w-16 h-16 xavi-bg rounded-full mx-auto flex items-center justify-center mb-6 opacity-80">
                <Mail class="h-8 w-8 text-white dark:text-xavi-950" />
              </div>
              <h3 class="text-xl font-medium mb-2">Select an email</h3>
              <p class="text-sm text-muted-foreground mb-4">
                Choose an email from the list to view its contents, or compose a new message
              </p>
              <Button @click="openCompose" class="xavi-button">
                <Plus class="mr-2 h-4 w-4" />
                Compose new email
              </Button>
            </div>
          </div>
          <!-- Email detail view -->
          <div v-if="selectedEmail" class="flex flex-col h-full w-full overflow-hidden">
            <!-- Header -->
            <div class="p-4 border-b flex items-center flex-shrink-0">
              <Button variant="ghost" size="icon" @click="selectedEmail = null" class="mr-2 md:hidden">
                <ArrowLeft class="h-5 w-5" />
              </Button>
              <h3 class="text-xl font-medium">{{ selectedEmail.subject }}</h3>
            </div>


            <!-- Sender info -->
            <div class="flex-shrink-0 p-4 border-b bg-card">
              <div class="flex justify-between items-start">
                <div class="flex items-center">
                  <Avatar class="h-10 w-10 mr-3">
                    <AvatarFallback class="bg-xavi-100 text-xavi-800 dark:bg-xavi-900 dark:text-xavi-200">
                      {{ selectedEmail.sender.charAt(0) }}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div class="font-medium">{{ selectedEmail.sender }}</div>
                    <div class="text-xs text-muted-foreground flex items-center gap-2">
                      <span>{{ selectedEmail.date }}</span>
                      <span>•</span>
                      <span>To: me</span>
                    </div>
                  </div>
                </div>
                <div class="flex space-x-2">
                  <Button variant="ghost" size="icon" @click="toggleStarEmail(selectedEmail)">
                    <Star class="h-4 w-4"
                      :class="selectedEmail.starred ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'" />
                  </Button>
                  <Button variant="ghost" size="icon" @click="requestAIExplanation">
                    <Sparkles class="h-4 w-4 text-xavi-500" />
                  </Button>
                </div>
              </div>
            </div>

            <!-- Scrollable body -->
            <div class="flex-1 overflow-hidden">
              <ScrollArea class="h-full">
                <div class="p-6">
                  <div class="email-body prose dark:prose-invert max-w-none" v-html="sanitizedEmail"></div>
                </div>
              </ScrollArea>
            </div>

            <!-- Actions -->
            <div class="p-4 border-t bg-card flex-shrink-0">
              <div class="flex gap-2">
                <Button class="xavi-button">
                  <Reply class="mr-2 h-4 w-4" />
                  Reply
                </Button>
                <Button variant="xavi" @click="archiveEmail(selectedEmail)">
                  <Archive class="mr-2 h-4 w-4" />
                  Archive
                </Button>
              </div>
            </div>

            <!-- AI suggestion -->
            <div v-if="aiSuggestion" class="p-4 border-t bg-xavi-50 dark:bg-xavi-950/40 flex-shrink-0">
              <div class="flex items-start">
                <div class="mr-3 xavi-bg rounded-full h-8 w-8 flex items-center justify-center flex-shrink-0">
                  <Sparkles class="h-4 w-4 text-white dark:text-xavi-950" />
                </div>
                <div>
                  <div class="font-medium">AI Assistant</div>
                  <p class="text-sm mt-1">{{ aiSuggestion }}</p>
                </div>
              </div>
            </div>
          </div>



          <!-- Compose email view -->
          <div v-else-if="showCompose" class="flex-1 flex flex-col h-full overflow-hidden">
            <div class="p-4 border-b flex items-center">
              <Button variant="ghost" size="icon" @click="goBack" class="mr-2">
                <ArrowLeft class="h-5 w-5" />
              </Button>
              <h3 class="text-xl font-medium">New Message</h3>
            </div>

            <div class="p-6 flex-1 flex flex-col">
              <div class="mb-4">
                <label class="text-sm font-medium mb-1.5 block">To</label>
                <Input v-model="emailDraft.to"
                  class="border-xavi-200 dark:border-xavi-800 focus-visible:ring-xavi-500" />
              </div>

              <div class="mb-4">
                <label class="text-sm font-medium mb-1.5 block">Subject</label>
                <Input v-model="emailDraft.subject"
                  class="border-xavi-200 dark:border-xavi-800 focus-visible:ring-xavi-500" />
              </div>

              <div class="flex-1 flex flex-col min-h-0">
                <label class="text-sm font-medium mb-1.5 block">Message</label>
                <Textarea v-model="emailDraft.body"
                  class="flex-1 min-h-[200px] resize-none border-xavi-200 dark:border-xavi-800 focus-visible:ring-xavi-500"
                  @input="aiSuggestion = ''" />
              </div>

              <div class="mt-6 flex justify-between">
                <Button variant="outline" @click="getAIHelp" class="border-xavi-200 dark:border-xavi-800">
                  <Sparkles class="mr-2 h-4 w-4 text-xavi-500" />
                  Get AI Help
                </Button>
                <Button @click="sendEmail" class="xavi-button">
                  <Send class="mr-2 h-4 w-4" />
                  Send
                </Button>
              </div>
            </div>

            <div v-if="aiSuggestion" class="p-4 border-t bg-xavi-50 dark:bg-xavi-950/40">
              <div class="flex items-start">
                <div class="mr-3 xavi-bg rounded-full h-8 w-8 flex items-center justify-center flex-shrink-0">
                  <Sparkles class="h-4 w-4 text-white dark:text-xavi-950" />
                </div>
                <div class="flex-1">
                  <div class="font-medium">AI Assistant</div>
                  <p class="text-sm mt-1">{{ aiSuggestion }}</p>
                  <Button v-if="aiSuggestion.includes('suggestion')" variant="outline" size="sm"
                    class="mt-3 border-xavi-200 dark:border-xavi-800 hover:bg-xavi-50 dark:hover:bg-xavi-900"
                    @click="applyAISuggestion">
                    Apply Suggestion
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <!-- Empty state -->
          <div v-else-if="!showCompose && !selectedEmail && !hasEmails" class="flex-1 flex items-center justify-center">
            <div class="text-center max-w-md p-6">
              <div class="w-20 h-20 xavi-bg rounded-full mx-auto flex items-center justify-center mb-6">
                <Mail class="h-10 w-10 text-white dark:text-xavi-950" />
              </div>
              <h2 class="text-2xl font-bold mb-2">Welcome to Xavi Mail</h2>
              <p class="text-muted-foreground mb-6">
                Your inbox is empty. Let's get started by composing your first email.
              </p>
              <Button @click="openCompose" class="xavi-button">
                <Plus class="mr-2 h-4 w-4" />
                Compose new email
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.custom-email-link {
  color: #60a5fa;
  font-weight: 500;
  text-decoration: underline;
}

.custom-email-button {
  background-color: #fff;
  color: #000;
  border: none;
  padding: 0.4rem 1rem;
  border-radius: 0.375rem;
  font-weight: 600;
  cursor: pointer;
  display: inline-block;
  margin: 0.5rem 0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.custom-email-button:hover {
  background-color: #e5e7eb;
}

.email-body {
  padding: 1rem;
  font-size: 0.95rem;
  line-height: 1.6;
  font-family: 'Segoe UI', system-ui, sans-serif;
}

.email-thread-block {
  border-left: 3px solid #555;
  background-color: #111;
  margin-top: 2rem;
  padding: 1rem;
  border-radius: 0.5rem;
}

.email-thread-header {
  font-size: 0.75rem;
  color: #bbb;
  margin-bottom: 0.5rem;
  font-weight: bold;
  border-bottom: 1px dashed #333;
  padding-bottom: 0.25rem;
}

.email-thread-body {
  color: #ccc;
  font-size: 0.9rem;
  line-height: 1.6;
}
</style>
