<template>
  <div class="editor-container">
    <!-- Sidebar for command list and editing -->
    <div class="sidebar" :class="{ collapsed: sidebarCollapsed }">
      <button @click="toggleSidebar" class="sidebar-toggle">
        {{ sidebarCollapsed ? '▶' : '◀' }}
      </button>
      <h2>Команды чата</h2>

      <!-- Command List -->
      <div class="command-list">
        <button @click="addNewCommand" class="btn-add">+ Добавить команду</button>
        <ul>
          <li
            v-for="command in commands"
            :key="command.id"
            :class="{ active: selectedCommand?.id === command.id }"
            @click="selectCommand(command)"
          >
            <span class="command-name">{{ command.name || 'Без имени' }}</span>
            <span class="command-id">{{ command.id }}</span>
            <button @click.stop="deleteCommand(command.id)" class="btn-delete">×</button>
          </li>
        </ul>
      </div>

      <!-- Command Editor -->
      <div v-if="selectedCommand" class="command-editor">
        <h3>Редактирование команды</h3>

        <div class="form-group">
          <label>ID:</label>
          <input v-model="selectedCommand.id" type="text" @blur="validateId" />
        </div>

        <div class="form-group">
          <label>Название:</label>
          <input v-model="selectedCommand.name" type="text" placeholder="Название команды" />
        </div>

        <div class="form-group">
          <label>Ключевые слова (через запятую):</label>
          <textarea
            v-model="keywordsText"
            @input="updateKeywords"
            placeholder="войти, вход, login"
          ></textarea>
        </div>

        <div class="form-group checkbox-group">
          <label>
            <input v-model="selectedCommand.enabled" type="checkbox" />
            Включена
          </label>
        </div>

        <div class="form-group checkbox-group">
          <label>
            <input v-model="selectedCommand.main" type="checkbox" />
            Основная команда
          </label>
        </div>

        <div class="form-group">
          <label>Ответ:</label>
          <textarea v-model="selectedCommand.response" rows="4" placeholder="Текст ответа"></textarea>
        </div>

        <div class="form-group">
          <label>Дочерние команды:</label>
          <div class="childs-selector">
            <div
              v-for="cmd in availableCommands"
              :key="cmd.id"
              :class="{ selected: selectedCommand.childs.includes(cmd.id) }"
              @click="toggleChild(cmd.id)"
              class="child-option"
            >
              {{ cmd.name || cmd.id }}
            </div>
          </div>
        </div>

        <div class="actions">
          <button @click="saveToJson" class="btn-save">Сохранить JSON</button>
          <button @click="loadFromJson" class="btn-load">Загрузить JSON</button>
        </div>
      </div>

      <div v-else class="no-selection">
        Выберите команду для редактирования
      </div>
    </div>

    <!-- VueFlow Diagram -->
    <div class="flow-container">
      <VueFlow
        v-model:nodes="nodes"
        v-model:edges="edges"
        :default-zoom="1"
        :min-zoom="0.2"
        :max-zoom="4"
        :fit-view-on-init="true"
        :direction="'LR'"
        @node-click="onNodeClick"
      >
        <Background />
        <Controls />
      </VueFlow>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { VueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MarkerType } from '@vue-flow/core'
import { getLayoutedElements } from './useLayout'

// Default data from the example
const defaultData = [
  {"id":"auth","name":"🔐 Войти","keywords":["войти","вход","login","авторизация","auth","asd"],"enabled":true,"main":true,"response":"Введите email или телефон для авторизации","childs":[]},
  {"id":"not","name":null,"keywords":[],"enabled":true,"main":false,"response":"Извините, я не понял ваш вопрос. Вы можете спросить о заказах, доставке, оплате, возврате или контактах","childs":["auth","delivery","return","status"]},
  {"id":"orders","name":"📦 Мои заказы","keywords":["заказ","order","orders","мои заказы"],"enabled":true,"main":true,"response":"Вы можете посмотреть ваши заказы в разделе \"Мои заказы\". Выберите заказ для просмотра деталей.","childs":["delivery","return","status"]},
  {"id":"faq","name":"❓ Вопросы","keywords":["faq","помощь","help","вопрос"],"enabled":true,"main":true,"response":"Часто задаваемые вопросы: доставка 3-5 дней, возврат 14 дней, оплата картами и наличными.","childs":["delivery","return","payment"]},
  {"id":"delivery","name":"Доставка","keywords":["доставк","shipping","delivery","доставить"],"enabled":true,"main":true,"response":"Доставка осуществляется в течение 3-5 рабочих дней. Стоимость доставки зависит от региона.vvvvvvvvvvvvvvvv","childs":["orders","auth"]},
  {"id":"return","name":"Возврат","keywords":["возврат","return","вернут","refund"],"enabled":true,"main":true,"response":"Возврат товара возможен в течение 14 дней с момента получения. Обратитесь в службу поддержки.","childs":["delivery","return","status"]},
  {"id":"payment","name":"Оплата","keywords":["оплат","payment","pay","оплачен"],"enabled":true,"main":true,"response":"Мы принимаем оплату банковскими картами, электронными кошельками и наличными при получении.","childs":[]},
  {"id":"contacts","name":"Контакты","keywords":["контакт","contact","связь","support","телефон"],"enabled":true,"main":true,"response":"Вы можете связаться с нами по телефону 8-800-000-00-00 или email support@example.com","childs":[]},
  {"id":"status","name":"Статус заказа","keywords":["статус","status","трек","track","отслеживан"],"enabled":true,"main":true,"response":"Статус заказа можно узнать в личном кабинете в разделе \"Мои заказы\".","childs":[]},
  {"id":"profile","name":"Профиль","keywords":["профил","profile","личный кабинет","account"],"enabled":true,"main":true,"response":"В личном кабинете вы можете управлять своими данными, адресами и просмотреть историю заказов.","childs":[]}
]

const commands = ref(JSON.parse(JSON.stringify(defaultData)))
const selectedCommand = ref(null)
const keywordsText = ref('')
const sidebarCollapsed = ref(false)

// Toggle sidebar
function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

// Computed properties
const availableCommands = computed(() => {
  if (!selectedCommand.value) return []
  return commands.value.filter(c => c.id !== selectedCommand.value.id)
})

// VueFlow nodes and edges
const nodes = ref([])
const edges = ref([])

// Update nodes and edges from commands
function updateFlow() {
  nodes.value = commands.value.map(cmd => ({
    id: cmd.id,
    label: cmd.name || cmd.id,
    position: { x: Math.random() * 400, y: Math.random() * 400 },
    style: {
      background: cmd.enabled ? '#fff' : '#f5f5f5',
      border: cmd.main ? '2px solid #4CAF50' : '1px solid #ccc',
      padding: '10px',
      borderRadius: '8px',
      width: '200px',
      fontSize: '12px'
    }
  }))

  edges.value = []
  commands.value.forEach(cmd => {
    if (cmd.childs && cmd.childs.length > 0) {
      cmd.childs.forEach(childId => {
        edges.value.push({
          id: `${cmd.id}-${childId}`,
          source: cmd.id,
          target: childId,
          type: 'smoothstep',
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#666',
            width: 20,
            height: 20
          },
          style: { stroke: '#666', strokeWidth: 2 }
        })
      })
    }
  })

  const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      nodes.value,
      edges.value,
      'LR'  // ← направление: Left to Right
  )

  nodes.value = layoutedNodes
  edges.value = layoutedEdges
}

// Watch for changes in commands
watch(commands, () => {
  updateFlow()
}, { deep: true })

// Select a command for editing
function selectCommand(command) {
  selectedCommand.value = command
  keywordsText.value = command.keywords.join(', ')
}

// Add new command
function addNewCommand() {
  const newId = 'cmd_' + Date.now()
  const newCommand = {
    id: newId,
    name: 'Новая команда',
    keywords: [],
    enabled: true,
    main: false,
    response: '',
    childs: []
  }
  commands.value.push(newCommand)
  selectCommand(newCommand)
}

// Delete command
function deleteCommand(id) {
  if (confirm('Удалить эту команду?')) {
    commands.value = commands.value.filter(c => c.id !== id)
    // Remove from other commands' childs
    commands.value.forEach(cmd => {
      cmd.childs = cmd.childs.filter(childId => childId !== id)
    })
    if (selectedCommand.value?.id === id) {
      selectedCommand.value = null
    }
  }
}

// Validate ID uniqueness
function validateId() {
  const duplicates = commands.value.filter((c, i) =>
    commands.value.findIndex(x => x.id === c.id) !== i
  )
  if (duplicates.length > 0) {
    alert('ID должен быть уникальным!')
    selectedCommand.value.id = selectedCommand.value.id + '_copy'
  }
}

// Update keywords from text
function updateKeywords() {
  if (selectedCommand.value) {
    selectedCommand.value.keywords = keywordsText.value
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0)
  }
}

// Toggle child command
function toggleChild(childId) {
  if (!selectedCommand.value.childs.includes(childId)) {
    selectedCommand.value.childs.push(childId)
  } else {
    selectedCommand.value.childs = selectedCommand.value.childs.filter(id => id !== childId)
  }
}

// Save to JSON file (download)
function saveToJson() {
  const dataStr = JSON.stringify(commands.value, null, 2)
  const blob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'chat-commands.json'
  a.click()
  URL.revokeObjectURL(url)
}

// Load from JSON file
function loadFromJson() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          commands.value = JSON.parse(event.target.result)
          selectedCommand.value = null
          updateFlow()
        } catch (err) {
          alert('Ошибка при загрузке JSON: ' + err.message)
        }
      }
      reader.readAsText(file)
    }
  }
  input.click()
}

// Handle node click in flow
function onNodeClick(event) {
  const command = commands.value.find(c => c.id === event.node.id)
  if (command) {
    selectCommand(command)
  }
}

// Initialize
onMounted(() => {
  updateFlow()
})
</script>

<style scoped>
.editor-container {
  display: flex;
  height: 100vh;
  width: 100vw;
  font-family: Arial, sans-serif;
  overflow: hidden;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

.sidebar {
  width: 400px;
  background: #f9f9f9;
  border-right: 1px solid #ddd;
  overflow-y: auto;
  padding: 20px;
  transition: all 0.3s ease;
  position: relative;
  z-index: 10;
}

.sidebar.collapsed {
  width: 0;
  padding: 20px 0;
  overflow: hidden;
}

.sidebar-toggle {
  position: absolute;
  top: 10px;
  right: -30px;
  width: 30px;
  height: 50px;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 0 4px 4px 0;
  cursor: pointer;
  font-size: 16px;
  z-index: 100;
}

.sidebar-toggle:hover {
  background: #45a049;
}

h2, h3 {
  margin-top: 0;
  color: #333;
}

.command-list {
  margin-bottom: 20px;
}

.btn-add {
  width: 100%;
  padding: 10px;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-bottom: 10px;
  font-size: 14px;
}

.btn-add:hover {
  background: #45a049;
}

ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  margin-bottom: 5px;
  cursor: pointer;
  transition: background 0.2s;
}

li:hover {
  background: #f0f0f0;
}

li.active {
  background: #e3f2fd;
  border-color: #2196F3;
}

.command-name {
  flex: 1;
  font-weight: bold;
}

.command-id {
  font-size: 12px;
  color: #666;
  margin-right: 10px;
}

.btn-delete {
  background: #f44336;
  color: white;
  border: none;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
}

.btn-delete:hover {
  background: #d32f2f;
}

.command-editor {
  background: white;
  padding: 15px;
  border-radius: 8px;
  border: 1px solid #ddd;
}

.form-group {
  margin-bottom: 15px;
}

label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
  color: #555;
}

input[type="text"],
textarea {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  box-sizing: border-box;
}

input[type="text"]:focus,
textarea:focus {
  outline: none;
  border-color: #2196F3;
}

.checkbox-group label {
  display: flex;
  align-items: center;
  font-weight: normal;
  cursor: pointer;
}

.checkbox-group input[type="checkbox"] {
  margin-right: 8px;
}

.childs-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.child-option {
  padding: 5px 10px;
  background: #e0e0e0;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: background 0.2s;
}

.child-option:hover {
  background: #d0d0d0;
}

.child-option.selected {
  background: #2196F3;
  color: white;
}

.actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.btn-save,
.btn-load {
  flex: 1;
  padding: 10px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.btn-save {
  background: #4CAF50;
  color: white;
}

.btn-save:hover {
  background: #45a049;
}

.btn-load {
  background: #2196F3;
  color: white;
}

.btn-load:hover {
  background: #1976D2;
}

.no-selection {
  text-align: center;
  color: #999;
  padding: 40px 20px;
}

.flow-container {
  flex: 1;
  height: 100%;
  width: 100%;
}

/* Edge styles with arrows */
:deep(.vue-flow__edge-path) {
  stroke: #666;
  stroke-width: 2;
}

:deep(.vue-flow__arrowhead) {
  fill: #666;
}
</style>
