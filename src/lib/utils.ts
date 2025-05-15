// 自定义 Updater 类型
type Updater<T> = T | ((prev: T) => T)
import type { Ref } from 'vue'
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import DOMPurify from 'dompurify'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function valueUpdater<T extends Updater<any>>(
  updaterOrValue: T,
  ref: Ref,
) {
  ref.value =
    typeof updaterOrValue === 'function'
      ? updaterOrValue(ref.value)
      : updaterOrValue
}

const ICON_MAP = {
  'deepseek-r1': 'deepseek',
  'deepseek-coder': 'deepseek',
  'deepseek-v2': 'deepseek',
  'deepseek-v3': 'deepseek',
  qwen: 'qwen',
  qwen2: 'qwen',
  'qwen2.5': 'qwen',
  'qwen2.5-coder': 'qwen',
  phi: 'microsoft',
  phi3: 'microsoft',
  'phi3.5': 'microsoft',
  phi4: 'microsoft',
  llama3: 'meta',
  'llama3.1': 'meta',
  'llama3.2': 'meta',
  'llama3.3': 'meta',
  llama2: 'meta',
  mistral: 'mistral',
  mixtral: 'mistral',
  codellama: 'meta',
  gemma: 'google',
  gemma2: 'google',
  openchat: 'openchat',
  falcon: 'tii',
  vicuna: 'lmsys',
  'wizard-vicuna': 'lmsys',
  'stable-beluga': 'stability',
  stablelm2: 'stability',
} as const

// 获取图标名称
export function getIconName(modelName: string): string {
  const name = modelName.toLowerCase()

  // 1. 直接匹配
  if (ICON_MAP[name]) {
    return ICON_MAP[name]
  }

  // 2. 前缀匹配
  for (const [key, value] of Object.entries(ICON_MAP)) {
    if (name.startsWith(key)) {
      return value
    }
  }

  // 3. 获取首字母作为备选
  // 先分割名称,比如 'deepseek-r1' => ['deepseek', 'r1']
  const parts = modelName.split(/[-_\s]/)
  // 获取第一个有效部分的首字母
  const firstChar = parts[0]?.charAt(0)?.toLowerCase() || 'x'

  return firstChar
}

// 将参数量转换为文件大小
export function modelSizeToGB(size: string): string {
  // 提取数字和单位
  const dNum = 0.73
  const match = size.match(/(\d+(?:\.\d+)?)([bm]+)/)
  if (!match) return 'Unknown'

  const [_, num, unit] = match
  const number = parseFloat(num)

  // 根据单位转换
  switch (unit.toLowerCase()) {
    case 'b': // billion
      return `${(number * dNum).toFixed(1)}GB`
    case 'm': // million
      return `${((number * dNum) / 1000).toFixed(1)}GB`
    default:
      return 'Unknown'
  }
}
export function sintetizarCorreo(html: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  // 1. Eliminar basura visual
  doc.querySelectorAll('style, script, link, head, meta, title').forEach(el => el.remove())

  // 2. Limpiar atributos innecesarios
  doc.querySelectorAll('*').forEach(el => {
    el.removeAttribute('style')
    el.removeAttribute('class')
    el.removeAttribute('id')
    el.removeAttribute('width')
    el.removeAttribute('height')
    el.removeAttribute('cellpadding')
    el.removeAttribute('cellspacing')
    el.removeAttribute('border')
  })

  // 3. Procesar imágenes
  doc.querySelectorAll('img').forEach(img => {
    const src = img.getAttribute('src') || ''
    if (!src || src.includes('cid:') || src.length < 10) {
      img.remove() // Imagen rota o incrustada
    } else {
      img.setAttribute('style', 'max-width:100%;border-radius:4px;margin:0.75rem 0;')
    }
  })

  // 4. Convertir todo el texto a párrafos claros
  doc.body.innerHTML = doc.body.innerHTML
    .replace(/<br\s*\/?>/gi, '</p><p>')
    .replace(/<div[^>]*>/gi, '<p>')
    .replace(/<\/div>/gi, '</p>')

  // 5. Enlaces visibles y estilizados
  doc.querySelectorAll('a').forEach(a => {
    a.setAttribute('target', '_blank')
    a.setAttribute('rel', 'noopener noreferrer')
    a.setAttribute('style', 'color:#60a5fa;font-weight:500;text-decoration:underline;word-break:break-word')
  })

  // 6. Botones de acción transformados
  doc.querySelectorAll('button, input[type="submit"]').forEach(el => {
    const button = document.createElement('span')
    button.innerText = el.getAttribute('value') || el.textContent || 'Botón'
    button.setAttribute('style', 'display:inline-block;background:white;color:black;padding:0.4rem 0.8rem;border-radius:6px;font-weight:600;margin:0.5rem 0;')
    el.replaceWith(button)
  })

  // 7. Estilo general por defecto
  doc.querySelectorAll('*').forEach(el => {
    const element = el as HTMLElement
    element.style.color = '#ffffff'
    element.style.fontSize = '0.95rem'
    element.style.lineHeight = '1.6'
    element.style.marginBottom = '0.5rem'
    element.style.fontFamily = `'Segoe UI', system-ui, sans-serif`
  })

  // 8. Detectar basura (tokens gigantes tipo JWT) y limpiarlos
  doc.querySelectorAll('p').forEach(p => {
    if (p.textContent && p.textContent.length > 400) {
      p.remove()
    }
  })

  // 3. Separar los hilos de correo visualmente
  separarHilosDeCorreo(doc)

  // 9. Sanitizar y retornar
  return DOMPurify.sanitize(doc.body.innerHTML, {
    ADD_TAGS: ['style', 'span'],
    ADD_ATTR: ['style', 'target', 'rel', 'src', 'href', 'alt', 'title'],
    ALLOWED_TAGS: ['p', 'b', 'i', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'img', 'span'],
  })
}

function separarHilosDeCorreo(doc: Document): void {
  // Detectar bloques <blockquote> (muy común en Gmail/Outlook)
  doc.querySelectorAll('blockquote').forEach(block => {
    const wrapper = doc.createElement('div')
    wrapper.className = 'email-thread-block'

    const header = doc.createElement('div')
    header.className = 'email-thread-header'
    header.textContent = 'Mensaje anterior'

    const body = doc.createElement('div')
    body.className = 'email-thread-body'
    body.innerHTML = block.innerHTML

    wrapper.appendChild(header)
    wrapper.appendChild(body)

    block.replaceWith(wrapper)
  })

  // Detectar posibles hilos no estructurados, con muchos <br> seguidos
  doc.querySelectorAll('div, p').forEach(el => {
    const text = el.textContent || ''
    if (
      text.length > 300 &&
      /(on .* wrote:|el .* escribió:|sent:|de:|from:)/i.test(text) &&
      (el.innerHTML.match(/<br\s*\/?>/gi) || []).length > 5
    ) {
      const wrapper = doc.createElement('div')
      wrapper.className = 'email-thread-block'

      const header = doc.createElement('div')
      header.className = 'email-thread-header'
      header.textContent = 'Correo anterior'

      const body = doc.createElement('div')
      body.className = 'email-thread-body'
      body.innerHTML = el.innerHTML

      wrapper.appendChild(header)
      wrapper.appendChild(body)
      el.replaceWith(wrapper)
    }
  })
}

