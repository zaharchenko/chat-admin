// useLayout.js
import dagre from 'dagre'
import { Position } from '@vue-flow/core'

export function getLayoutedElements(nodes, edges, direction = 'LR') {
	const dagreGraph = new dagre.graphlib.Graph()

	dagreGraph.setDefaultEdgeLabel(() => ({}))

	// 🎯 Ключевой параметр: 'LR' = Left to Right
	dagreGraph.setGraph({
		rankdir: direction,      // 'LR' | 'TB' | 'BT' | 'RL'
		nodesep: 60,             // отступ между узлами по вертикали
		ranksep: 100,            // отступ между колонками
		align: 'UL'              // выравнивание внутри ранга
	})

	// Добавляем узлы в граф dagre
	for (const node of nodes) {
		dagreGraph.setNode(node.id, {
			width: node.width || 150,   // примерная ширина, если не задана
			height: node.height || 50   // примерная высота
		})
	}

	// Добавляем связи
	for (const edge of edges) {
		dagreGraph.setEdge(edge.source, edge.target)
	}

	// Запускаем расчёт позиций
	dagre.layout(dagreGraph)

	// Применяем вычисленные координаты к узлам Vue Flow
	const layoutedNodes = nodes.map(node => {
		const nodeWithPosition = dagreGraph.node(node.id)
		const isHorizontal = direction === 'LR'

		return {
			...node,
			// Фиксируем позиции хендлов для аккуратных стрелок
			targetPosition: isHorizontal ? Position.Left : Position.Top,
			sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
			// Новые координаты от dagre
			position: {
				x: nodeWithPosition.x - (node.width || 150) / 2,
				y: nodeWithPosition.y - (node.height || 50) / 2
			}
		}
	})

	return { nodes: layoutedNodes, edges }
}
