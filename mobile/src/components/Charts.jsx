// Gráficas simples con react-native-svg (línea y barras), con los colores del panel.
import { useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { colors } from '../lib/theme';

const H = 160;
const PAD = { top: 16, right: 12, bottom: 24, left: 34 };

function useWidth() {
  const [width, setWidth] = useState(0);
  return [width, (e) => setWidth(e.nativeEvent.layout.width)];
}

function scale(values) {
  let min = Math.min(...values); let max = Math.max(...values);
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * 0.15;
  return { min: min - pad, max: max + pad };
}

export function LineChart({ points, unit = '', empty = 'Sin datos todavía.' }) {
  const [width, onLayout] = useWidth();
  if (!points?.length) return <Text style={{ color: colors.muted, fontSize: 13 }}>{empty}</Text>;
  const values = points.map((p) => p.value);
  const { min, max } = scale(values);
  const iw = Math.max(1, width - PAD.left - PAD.right); const ih = H - PAD.top - PAD.bottom;
  const x = (i) => PAD.left + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const y = (v) => PAD.top + ih - ((v - min) / (max - min)) * ih;
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.value)}`).join(' ');
  const area = `${path} L${x(points.length - 1)},${PAD.top + ih} L${x(0)},${PAD.top + ih} Z`;
  const ticks = [max - (max - min) * 0.15, (max + min) / 2, min + (max - min) * 0.15];
  const last = points[points.length - 1];
  return (
    <View onLayout={onLayout}>
      {width > 0 && (
        <Svg width={width} height={H}>
          {ticks.map((t) => (
            <Line key={t} x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke={colors.border} strokeDasharray="3 4" />
          ))}
          {ticks.map((t) => (
            <SvgText key={`l${t}`} x={PAD.left - 6} y={y(t) + 4} fill={colors.muted} fontSize="10" textAnchor="end">{Math.round(t * 10) / 10}</SvgText>
          ))}
          <Path d={area} fill={colors.green} fillOpacity={0.12} />
          <Path d={path} stroke={colors.green} strokeWidth={2.5} fill="none" strokeLinejoin="round" />
          {points.map((p, i) => <Circle key={i} cx={x(i)} cy={y(p.value)} r={i === points.length - 1 ? 5 : 3} fill={colors.green} />)}
          <SvgText x={PAD.left} y={H - 6} fill={colors.muted} fontSize="10">{points[0].label}</SvgText>
          <SvgText x={width - PAD.right} y={H - 6} fill={colors.muted} fontSize="10" textAnchor="end">{last.label}</SvgText>
        </Svg>
      )}
      <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15, marginTop: 4 }}>Último: {last.value}{unit}</Text>
    </View>
  );
}

export function BarChart({ bars, highlightLast = true }) {
  const [width, onLayout] = useWidth();
  const max = Math.max(1, ...bars.map((b) => b.value));
  const iw = Math.max(1, width - 8); const ih = H - PAD.top - PAD.bottom;
  const slot = iw / bars.length; const bw = Math.min(28, slot * 0.6);
  return (
    <View onLayout={onLayout}>
      {width > 0 && (
        <Svg width={width} height={H}>
          <Line x1={0} x2={width} y1={PAD.top + ih} y2={PAD.top + ih} stroke={colors.border} />
          {bars.map((b, i) => {
            const h = (b.value / max) * ih; const bx = 4 + i * slot + (slot - bw) / 2;
            const fill = highlightLast && i === bars.length - 1 ? colors.green : colors.surface3;
            return (
              <G key={i}>
                <Rect x={bx} y={PAD.top + ih - h} width={bw} height={Math.max(h, 2)} rx={5} fill={fill} />
                {b.value > 0 && <SvgText x={bx + bw / 2} y={PAD.top + ih - h - 5} fill={colors.text} fontSize="11" fontWeight="700" textAnchor="middle">{b.value}</SvgText>}
                <SvgText x={bx + bw / 2} y={H - 6} fill={colors.muted} fontSize="10" textAnchor="middle">{b.label}</SvgText>
              </G>
            );
          })}
        </Svg>
      )}
    </View>
  );
}
