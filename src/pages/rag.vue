<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { SidebarProvider } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { useEnvStore } from "@/stores/env"
import { Upload, FileText, Cog } from 'lucide-vue-next'

import SidebarRag from '@/components/rag/SidebarRag.vue';
import DocumentTable from '@/components/rag/DocumentTable.vue';

const { t } = useI18n() 
const sidebarLeftOpen = ref(true)
const envStore = useEnvStore()
</script>

<template>
  <div class="flex relative overflow-hidden">
    <SidebarProvider
      class="w-auto"
      :style="{ '--sidebar-width': '250px' }"
      v-model:open="sidebarLeftOpen"
    >
      <SidebarRag />
    </SidebarProvider>
    <div class="w-full h-[calc(100dvh-30px)] max-h-[calc(100dvh-30px)] flex flex-col grow" :class="envStore.isWeb ? 'h-[100dvh] max-h-[100dvh]' : ''">
      <div class="p-4 flex justify-between items-center">
        <div class="px-3">{{ t('rag.documentList') }}</div>
        <div class="flex items-center space-x-3">
          <Button variant="xavi"><Upload />{{ t('rag.addDocument') }}</Button>
          <Button variant="outline"><Cog />{{ t('rag.modelConfig') }}</Button>
          <Button variant="outline"><FileText />{{ t('rag.helpDocument') }}</Button>
        </div>
      </div>
      <div class="p-4 pt-0">
        <DocumentTable />
      </div>
    </div>
  </div>
</template>