<template>
  <div class="flex items-center">
    <Avatar 
      size="sm" 
      class="overflow-hidden p-1 bg-slate-300 dark:bg-white dark:text-sidebar" 
      :style="{
        height: props.size + 'px',
        width: props.size + 'px',
      }"
    >
      <AvatarImage 
        v-if="iconExists" 
        :src="src"
        :alt="props.name"
      ></AvatarImage>
      <AvatarFallback>{{ props.name.charAt(0).toUpperCase() }}</AvatarFallback>
    </Avatar>
  </div>
</template>

<script setup>
import { ref, watch, defineProps } from 'vue'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

const props = defineProps({
  name: {
    type: String,
    required: true,
    default: '',
  },
  size: {
    type: Number,
    default: 24,
  },
})

// Ruta de los iconos locales
const localIconsPath = '/src/assets/icons/'

const src = ref('')
const iconExists = ref(true)

// Función para verificar si existe el icono
const checkIconExists = (url) => {
  return new Promise((resolve) => {
    // Para archivos PNG locales
    fetch(url)
      .then(response => resolve(response.ok))
      .catch(() => resolve(false))
  })
}

watch(
  () => props.name, 
  async (val) => {
    // Intenta primero con PNG
    const localPathPng = `${localIconsPath}${val}.png`
    
    try {
      const exists = await checkIconExists(localPathPng)
      
      if (exists) {
        src.value = localPathPng
        iconExists.value = true
      } else {
        // Si no existe el PNG, intenta con SVG
        const localPathSvg = `${localIconsPath}${val}.svg`
        const existsSvg = await checkIconExists(localPathSvg)
        
        if (existsSvg) {
          src.value = localPathSvg
          iconExists.value = true
        } else {
          // Si no existe ninguno, usa el fallback
          iconExists.value = false
        }
      }
    } catch (error) {
      console.error('Error cargando el icono:', error)
      iconExists.value = false
    }
  }, 
  {
    immediate: true,
  }
)
</script>

<style scoped></style>