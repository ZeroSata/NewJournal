import React from 'react'
// Модульный ECharts: вместо импорта всего пакета подключаем только нужное —
// бандл уменьшается в разы (см. анализ: раньше echarts входил целиком)
import * as echarts from 'echarts/core'
import { LineChart, BarChart, PieChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent,
  AriaComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import { useSettings } from '../settings/SettingsContext'

echarts.use([
  LineChart,
  BarChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent,
  AriaComponent,
  CanvasRenderer,
])

function palette() {
  const css = getComputedStyle(document.documentElement)
  const v = (name) => css.getPropertyValue(name).trim()
  return {
    text: v('--text'),
    muted: v('--text-muted'),
    border: v('--border'),
    surface: v('--surface'),
    accent: v('--accent'),
    success: v('--success'),
    info: v('--info'),
    warning: v('--warning'),
    danger: v('--danger'),
  }
}

/**
 * Базовый компонент графика.
 * @param {object} option опции ECharts
 * @param {{headers: string[], rows: Array<string[]>}} [table] данные для
 *        скрытой таблицы — скринридеры читают их вместо картинки
 */
export function Chart({ option, height = 300, className = '', table }) {
  const { resolvedTheme } = useSettings()
  const p = palette()
  const base = {
    backgroundColor: 'transparent',
    aria: { enabled: true },
    textStyle: { color: p.muted, fontFamily: 'inherit' },
    // right: 28 — запас, чтобы подпись крайней точки («100%») не обрезалась
    grid: { left: 8, right: 28, top: 34, bottom: 8, containLabel: true },
    tooltip: {
      backgroundColor: p.surface,
      borderColor: p.border,
      textStyle: { color: p.text },
    },
  }
  return (
    <div>
      <ReactEChartsCore
        echarts={echarts}
        key={resolvedTheme}
        option={{ ...base, ...option }}
        notMerge
        lazyUpdate
        style={{ height, width: '100%' }}
        className={className}
      />
      {table && (
        <table className="sr-only">
          <thead>
            <tr>{table.headers.map((h, i) => <th key={i}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {table.rows.map((row, i) => (
              <tr key={i}>{row.map((c, j) => <td key={j}>{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

/**
 * Линия: средний балл по месяцам.
 * Точная настройка: ось Y подгоняется под реальный диапазон данных
 * (а не 0–5), показываются предыдущий месяц, средняя линия и значения
 * с двумя знаками в тултипе.
 */
export function GpaTrendChart({ data }) {
  const p = palette()
  const values = data.map((d) => d.value).filter((v) => v != null)
  const prevValues = data.map((d) => d.previous).filter((v) => v != null)
  const all = [...values, ...prevValues]
  const avg = values.length ? values.reduce((s, v) => s + v, 0) / values.length : null
  // ось Y: от (минимум данных − 0.5) до 5, шаг 0.5
  const minV = all.length ? Math.max(0, Math.floor((Math.min(...all) - 0.5) * 2) / 2) : 0
  const series = [
    {
      name: 'avg-progress',
      type: 'line',
      data: data.map((d) => d.value),
      smooth: false,
      symbol: 'circle',
      symbolSize: 8,
      lineStyle: { width: 3, color: p.accent },
      itemStyle: { color: p.accent },
      connectNulls: true,
    },
  ]
  if (prevValues.length) {
    series.push({
      name: 'prev-progress',
      type: 'line',
      data: data.map((d) => d.previous),
      smooth: false,
      symbol: 'diamond',
      symbolSize: 6,
      lineStyle: { width: 1.5, type: 'dashed', color: p.muted },
      itemStyle: { color: p.muted },
      connectNulls: true,
    })
  }
  if (avg != null) {
    series[0].markLine = {
      silent: true,
      symbol: 'none',
      data: [{ yAxis: Number(avg.toFixed(2)) }],
      lineStyle: { color: p.success, type: 'dashed' },
      label: { color: p.muted, formatter: (p2) => `Ø ${Number(p2.value).toFixed(2)}`, position: 'insideEndTop' },
    }
  }
  return (
    <Chart
      height={280}
      table={{
        headers: [data[0]?.label ? 'Месяц' : '', 'Средний балл', 'Предыдущий период'],
        rows: data.map((d) => [d.label, d.value ?? '—', d.previous ?? '—']),
      }}
      option={{
        legend: data.some((d) => d.previous != null)
          ? { top: 0, textStyle: { color: p.muted }, data: ['avg-progress', 'prev-progress'] }
          : undefined,
        xAxis: {
          type: 'category',
          data: data.map((d) => d.label),
          axisLine: { lineStyle: { color: p.border } },
          axisLabel: { color: p.text },
        },
        yAxis: {
          type: 'value',
          min: minV,
          max: 5,
          interval: 5 - minV <= 1 ? 0.25 : 0.5,
          splitLine: { lineStyle: { color: p.border } },
          axisLabel: { color: p.text, formatter: (v) => (Number.isInteger(v) ? v : v.toFixed(2).replace(/0$/, '')) },
        },
        series,
        tooltip: {
          trigger: 'axis',
          valueFormatter: (v) => (v == null ? '—' : Number(v).toFixed(2)),
        },
      }}
    />
  )
}

/**
 * Посещаемость по месяцам — ЛИНИЯ (по требованию: линия, а не столбики).
 * Ось Y подгоняется под реальный диапазон, у точек подписи и % в тултипе.
 */
export function AttendanceTrendChart({ data }) {
  const p = palette()
  const values = data.map((d) => d.value).filter((v) => v != null)
  const avg = values.length ? values.reduce((s, v) => s + v, 0) / values.length : null
  const minV = values.length ? Math.max(0, Math.floor((Math.min(...values) - 5) / 5) * 5) : 0
  return (
    <Chart
      height={280}
      table={{
        headers: ['Месяц', 'Посещаемость'],
        rows: data.map((d) => [d.label, d.value != null ? `${d.value}%` : '—']),
      }}
      option={{
        xAxis: {
          type: 'category',
          data: data.map((d) => d.label),
          boundaryGap: false,
          axisLine: { lineStyle: { color: p.border } },
          axisLabel: { color: p.text },
        },
        yAxis: {
          type: 'value',
          min: minV,
          max: 100,
          interval: 10,
          splitLine: { lineStyle: { color: p.border } },
          axisLabel: { color: p.text, formatter: '{value}%' },
        },
        series: [
          {
            name: 'attendance',
            type: 'line',
            data,
            smooth: false,
            symbol: 'circle',
            symbolSize: 8,
            // страховка: даже если в данных останется пустой месяц,
            // линия не будет разорвана
            connectNulls: true,
            lineStyle: { width: 3, color: p.success },
            itemStyle: { color: p.success },
            label: { show: true, position: 'top', distance: 7, color: p.text, fontSize: 10, formatter: ({ value }) => (value != null ? `${value}%` : '') },
            areaStyle: {
              color: {
                type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [
                  { offset: 0, color: p.success + '44' },
                  { offset: 1, color: p.success + '00' },
                ],
              },
            },
            markLine: avg != null
              ? {
                  silent: true,
                  symbol: 'none',
                  data: [{ yAxis: Number(avg.toFixed(1)) }],
                  lineStyle: { color: p.accent, type: 'dashed' },
                  label: { color: p.text, formatter: `Ø {c}%`, position: 'insideEndTop' },
                }
              : undefined,
          },
        ],
        tooltip: {
          trigger: 'axis',
          valueFormatter: (v) => (v == null ? '—' : `${v}%`),
        },
      }}
    />
  )
}

/** Горизонтальные бары: средний балл по предметам */
export function SubjectAverageChart({ data }) {
  const p = palette()
  return (
    <Chart
      height={Math.max(240, data.length * 34 + 70)}
      table={{
        headers: ['Предмет', 'Средний балл'],
        rows: data.map((d) => [d.label, d.value]),
      }}
      option={{
        xAxis: {
          type: 'value',
          min: 0,
          max: 5,
          interval: 1,
          splitLine: { lineStyle: { color: p.border } },
          axisLabel: { color: p.text },
        },
        yAxis: {
          type: 'category',
          data: data.map((d) => d.label),
          axisLabel: { color: p.text, width: 210, overflow: 'truncate' },
          axisLine: { lineStyle: { color: p.border } },
        },
        series: [
          {
            type: 'bar',
            data: data.map((d) => ({
              value: d.value,
              itemStyle: {
                color: d.value >= 4.5 ? p.success : d.value >= 3.5 ? p.info : d.value >= 2.5 ? p.warning : p.danger,
                borderRadius: [0, 6, 6, 0],
              },
            })),
            barMaxWidth: 18,
            label: { show: true, position: 'right', color: p.text, formatter: ({ value }) => value?.toFixed?.(2) ?? value },
          },
        ],
        tooltip: { trigger: 'axis', valueFormatter: (v) => Number(v).toFixed(2) },
      }}
    />
  )
}

/** Распределение оценок (пончик) */
export function MarksDistributionChart({ data }) {
  const p = palette()
  const colors = { 5: p.success, 4: p.info, 3: p.warning, 2: p.danger, 1: p.danger }
  return (
    <Chart
      height={280}
      table={{
        headers: ['Оценка', 'Количество'],
        rows: data.map((d) => [d.label, d.value]),
      }}
      option={{
        legend: { bottom: 0, textStyle: { color: p.text } },
        series: [
          {
            type: 'pie',
            radius: ['46%', '72%'],
            center: ['50%', '44%'],
            data: data.map((d) => ({ name: String(d.label), value: d.value, itemStyle: { color: colors[d.label] || p.accent } })),
            label: { color: p.text, formatter: '{b}: {c} ({d}%)' },
            itemStyle: { borderColor: p.surface, borderWidth: 2 },
          },
        ],
        tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      }}
    />
  )
}
